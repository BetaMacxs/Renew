-- Derive stock reservation/release inside the database from the locked
-- order state. p_stock_delta remains in the function signature for API
-- compatibility but is intentionally ignored.
create or replace function public.admin_transition_order(
  p_order_id uuid,
  p_from text,
  p_to text,
  p_stock_delta integer default 0,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order     public.orders;
  v_product   record;
  v_req       record;
  v_available integer;
  v_delta     integer := 0;
  v_actor     text := coalesce((select auth.jwt()) ->> 'email', 'admin');
  v_now       text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_events    jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  if (p_from, p_to) not in (
    ('prepared', 'received'), ('prepared', 'discarded'),
    ('opened', 'received'), ('opened', 'discarded'),
    ('received', 'confirmed'), ('received', 'cancelled'),
    ('confirmed', 'fulfilled'), ('confirmed', 'cancelled'),
    ('fulfilled', 'completed'),
    ('cancelled', 'received'), ('discarded', 'received')
  ) then
    raise exception 'That step is not possible from here.' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if v_order.status <> p_from then
    raise exception 'conflict: order is now %', v_order.status using errcode = 'P0001';
  end if;

  -- Derive inventory effects from the locked order state and requested
  -- transition. Never trust p_stock_delta supplied by the caller.
  if p_to = 'confirmed' and not v_order.stock_reserved then
    v_delta := 1;
  elsif p_to = 'cancelled' and v_order.stock_reserved then
    v_delta := -1;
  else
    v_delta := 0;
  end if;

  -- Never reserve twice, never return what was not taken.
  if v_delta = 1 and v_order.stock_reserved then v_delta := 0; end if;
  if v_delta = -1 and not v_order.stock_reserved then v_delta := 0; end if;
  if v_delta not in (-1, 0, 1) then v_delta := 0; end if;

  if v_delta <> 0 then
    -- Lock every referenced product row in deterministic UUID order to prevent deadlocks.
    perform 1
      from public.products p
     where p.id in (
       select distinct (item ->> 'productId')::uuid
         from jsonb_array_elements(v_order.items) as item
        where coalesce(item ->> 'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     )
     order by p.id
     for update;

    if v_delta = 1 then
      -- Validate total requested units per (product, variant) against live locked stock.
      for v_req in
        select
          (item ->> 'productId')::uuid as product_id,
          item ->> 'variantId' as variant_id,
          sum(greatest(0, coalesce((item ->> 'quantity')::integer, 0)))::integer as qty
        from jsonb_array_elements(v_order.items) as item
        where coalesce(item ->> 'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        group by 1, 2
      loop
        continue when v_req.qty <= 0;

        select p.id, p.name, p.track_inventory, p.variants
          into v_product
          from public.products p
         where p.id = v_req.product_id;

        if not found then
          raise exception 'Cannot confirm order: a product in this order no longer exists.'
            using errcode = 'P0001';
        end if;
        continue when not v_product.track_inventory;

        select (v ->> 'stock')::integer
          into v_available
          from jsonb_array_elements(v_product.variants) as v
         where v ->> 'id' = v_req.variant_id
         limit 1;

        if v_available is null then
          raise exception 'Cannot confirm order: a selected option for "%" no longer exists.', v_product.name
            using errcode = 'P0001';
        end if;

        if v_available < v_req.qty then
          raise exception 'Not enough stock for "%": % requested, % left.', v_product.name, v_req.qty, greatest(0, v_available)
            using errcode = 'P0001';
        end if;
      end loop;
    end if;

    for v_product in
      select p.id
        from public.products p
       where p.id in (
         select distinct (item ->> 'productId')::uuid
           from jsonb_array_elements(v_order.items) as item
          where coalesce(item ->> 'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       )
         and p.track_inventory
       order by p.id
    loop
      update public.products p
         set variants = (
           select jsonb_agg(
                    case
                      when req.qty is not null then
                        jsonb_set(
                          v,
                          '{stock}',
                          to_jsonb(greatest(0, coalesce((v ->> 'stock')::integer, 0) - v_delta * req.qty))
                        )
                      else v
                    end
                    order by t.ordinality
                  )
             from jsonb_array_elements(p.variants) with ordinality as t(v, ordinality)
             left join (
               select
                 item ->> 'variantId' as variant_id,
                 sum(greatest(0, coalesce((item ->> 'quantity')::integer, 0)))::integer as qty
               from jsonb_array_elements(v_order.items) as item
               where coalesce(item ->> 'productId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 and (item ->> 'productId')::uuid = p.id
               group by 1
             ) as req on req.variant_id = (t.v ->> 'id')
         )
       where p.id = v_product.id;
    end loop;

    v_events := v_events || jsonb_build_array(jsonb_build_object(
      'at', v_now, 'kind', 'stock', 'by', v_actor,
      'note', case when v_delta = 1 then 'Stock reserved for this order.' else 'Reserved stock returned.' end));
  end if;

  v_events := v_events || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
    'at', v_now, 'kind', 'status', 'from', p_from, 'to', p_to, 'by', v_actor,
    'note', nullif(trim(coalesce(p_note, '')), ''))));

  update public.orders
     set status = p_to,
         stock_reserved = case v_delta when 1 then true when -1 then false else stock_reserved end,
         events = events || v_events
   where id = p_order_id
  returning * into v_order;

  return to_jsonb(v_order) - 'access_token_hash';
end;
$$;

revoke all on function public.admin_transition_order(uuid, text, text, integer, text) from public, anon;
grant execute on function public.admin_transition_order(uuid, text, text, integer, text) to authenticated;

-- The signed checkout token is also the idempotency key. A unique index makes
-- retries safe even if the browser resubmits after a network timeout.
create unique index if not exists orders_access_token_hash_uidx
  on public.orders (access_token_hash);

-- A product must remain available while an order that references it is still
-- awaiting fulfilment. Archiving is safe; hard deletion would make the order
-- impossible to confirm or fulfil and could strand inventory.
create or replace function public.prevent_product_delete_with_open_orders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
      from public.orders o
     where o.status in ('prepared', 'opened', 'received', 'confirmed', 'fulfilled')
       and exists (
         select 1
           from jsonb_array_elements(o.items) as item
          where item ->> 'productId' = old.id::text
       )
  ) then
    raise exception 'This product is part of an open order. Archive it instead.'
      using errcode = 'P0001';
  end if;
  return old;
end;
$$;

revoke all on function public.prevent_product_delete_with_open_orders() from public, anon, authenticated;

drop trigger if exists prevent_product_delete_with_open_orders on public.products;
create trigger prevent_product_delete_with_open_orders
before delete on public.products
for each row execute function public.prevent_product_delete_with_open_orders();

-- Open orders hold a reference to the exact product variant they were placed
-- against. Do not remove that variant or change inventory tracking until the
-- order has been completed, cancelled or discarded.
create or replace function public.prevent_open_order_variant_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.track_inventory is distinct from new.track_inventory and exists (
    select 1
      from public.orders o
     where o.status in ('prepared', 'opened', 'received', 'confirmed', 'fulfilled')
       and exists (
         select 1
           from jsonb_array_elements(o.items) as item
          where item ->> 'productId' = old.id::text
       )
  ) then
    raise exception 'Inventory tracking cannot be changed while this product is referenced by an open order.'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
      from public.orders o
      cross join lateral jsonb_array_elements(o.items) as item
     where o.status in ('prepared', 'opened', 'received', 'confirmed', 'fulfilled')
       and item ->> 'productId' = old.id::text
       and not exists (
         select 1
           from jsonb_array_elements(new.variants) as variant
          where variant ->> 'id' = item ->> 'variantId'
       )
  ) then
    raise exception 'A product option cannot be removed while it is referenced by an open order.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_open_order_variant_changes() from public, anon, authenticated;

drop trigger if exists prevent_open_order_variant_changes on public.products;
create trigger prevent_open_order_variant_changes
before update of variants, track_inventory on public.products
for each row execute function public.prevent_open_order_variant_changes();
