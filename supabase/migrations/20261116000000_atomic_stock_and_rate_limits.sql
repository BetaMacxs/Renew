-- =============================================================================
--  ATOMIC INVENTORY RESERVATION & SERVERLESS RATE LIMITING
-- =============================================================================
--
--  1. Updates `public.admin_transition_order` so confirming an order locks all
--     affected product rows in deterministic UUID order (FOR UPDATE), verifies
--     aggregated tracked stock is sufficient before decrementing, and raises an
--     informative error (errcode P0001) instead of silently clamping to zero.
--  2. Adds `public.rate_limits` and `public.check_rate_limit` so multi-instance
--     serverless deployments (e.g. Vercel) share rate-limit counters in Postgres.
-- =============================================================================

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
  v_delta     integer := coalesce(p_stock_delta, 0);
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

        continue when not found or not v_product.track_inventory;

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

-- -------------------------------------------------------------- rate limits

create table if not exists public.rate_limits (
  key      text primary key,
  count    integer not null check (count >= 0),
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;

revoke all on public.rate_limits from public, anon, authenticated;
grant all on public.rate_limits to service_role;

create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_ms integer
)
returns table (allowed boolean, retry_after_ms integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now      timestamptz := clock_timestamp();
  v_reset_at timestamptz;
  v_count    integer;
begin
  insert into public.rate_limits as rl (key, count, reset_at)
  values (p_key, 1, v_now + (p_window_ms::double precision / 1000.0) * interval '1 second')
  on conflict (key) do update
    set count = case
                  when rl.reset_at <= v_now then 1
                  else rl.count + 1
                end,
        reset_at = case
                     when rl.reset_at <= v_now then v_now + (p_window_ms::double precision / 1000.0) * interval '1 second'
                     else rl.reset_at
                   end
  returning rl.count, rl.reset_at into v_count, v_reset_at;

  -- Opportunistic bounded cleanup of stale windows (~1% of calls)
  if random() < 0.01 then
    delete from public.rate_limits
     where key in (
       select key from public.rate_limits
        where reset_at < v_now - interval '1 day'
        limit 200
     );
  end if;

  if v_count <= p_limit then
    return query select true, 0;
  else
    return query select false, greatest(0, ceil(extract(epoch from (v_reset_at - v_now)) * 1000)::integer);
  end if;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ------------------------------------------------------- POPIA order redaction
-- NOTE: This function removes consumer personal identifiable information (name, phone,
-- email, address, customer note) to support privacy principles (such as POPIA data
-- minimization for closed orders). However, technical anonymisation alone does not
-- constitute full legal POPIA compliance; organization data retention policies apply.
-- Accounting records (totals, line items, order numbers) are preserved.

create or replace function public.admin_anonymize_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
  v_actor text := coalesce((select auth.jwt()) ->> 'email', 'admin');
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  if v_order.status not in ('completed', 'cancelled', 'discarded') then
    raise exception 'Only completed, cancelled, or discarded orders can have customer details removed.'
      using errcode = 'P0001';
  end if;

  update public.orders
     set customer = '{"name":"Redacted customer","phone":"","email":""}'::jsonb,
         address = null,
         customer_note = '',
         events = events || jsonb_build_array(jsonb_build_object(
           'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'kind', 'note',
           'note', 'Customer personal details redacted (POPIA).',
           'by', v_actor
         ))
   where id = p_order_id
  returning * into v_order;

  return to_jsonb(v_order) - 'access_token_hash';
end;
$$;

revoke all on function public.admin_anonymize_order(uuid) from public, anon;
grant execute on function public.admin_anonymize_order(uuid) to authenticated;
