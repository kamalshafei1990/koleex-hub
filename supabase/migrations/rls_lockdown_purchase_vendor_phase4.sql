-- RLS lockdown Phase 4 (2026-07-14) — purchase / vendor / price-list batch.
-- Pre-conditions verified: all reads/writes go through gated API routes
-- (RLS-4 dialogs rewire, commit pending); zero anon .from() refs; zero
-- realtime subscriptions. Reversible: ALTER POLICY ... TO public.
-- EXCLUDED (still anon-read, next slice): purchase_returns,
-- supplier_contracts, commercial_*_tiers, inbox_messages, discuss_* (realtime),
-- media/elements/pages/sections (website-builder, intent unverified).

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'purchase_requisitions','purchase_requisition_items',
    'purchase_orders','purchase_order_items',
    'purchase_receipts','purchase_receipt_items',
    'purchase_categories','purchase_rfqs','purchase_approval_rules',
    'vendor_bills','vendor_bill_items','vendor_payments',
    'supplier_price_lists','supplier_price_list_items',
    'brands'
  ] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
        and 'public' = any(roles::text[])
    loop
      execute format('alter policy %I on public.%I to service_role', p.policyname, t);
    end loop;
  end loop;
end $$;
