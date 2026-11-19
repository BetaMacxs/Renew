-- =============================================================================
--  ORDER ANONYMISATION: REMOVE FREE-TEXT AND ADMIN IDENTIFIERS
-- =============================================================================
-- Preserve accounting/order facts and event chronology, but remove personal
-- data that may have been entered into free-text notes or actor email fields.
-- This is a technical data-minimisation measure, not a determination of legal
-- retention periods or complete POPIA compliance.

create or replace function public.admin_anonymize_order(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

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
         internal_note = '',
         events = coalesce((
           select jsonb_agg(
             jsonb_strip_nulls(jsonb_build_object(
               'at', e.value -> 'at',
               'kind', e.value -> 'kind',
               'from', e.value -> 'from',
               'to', e.value -> 'to',
               -- Free-text event notes are removed. Preserve event chronology
               -- and transition facts, but never retain an admin email address.
               'by', case
                 when e.value ->> 'by' in ('customer', 'system') then e.value -> 'by'
                 else to_jsonb('admin'::text)
               end
             ))
             order by e.ordinality
           )
           from jsonb_array_elements(coalesce(orders.events, '[]'::jsonb))
                with ordinality as e(value, ordinality)
           where e.value ->> 'note' is distinct from 'Customer personal details and free-text notes redacted (POPIA).'
         ), '[]'::jsonb)
         || jsonb_build_array(jsonb_build_object(
           'at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
           'kind', 'note',
           'note', 'Customer personal details and free-text notes redacted (POPIA).',
           'by', 'system'
         ))
   where id = p_order_id
  returning * into v_order;

  return to_jsonb(v_order) - 'access_token_hash';
end;
$$;

revoke all on function public.admin_anonymize_order(uuid) from public, anon;
grant execute on function public.admin_anonymize_order(uuid) to authenticated;
