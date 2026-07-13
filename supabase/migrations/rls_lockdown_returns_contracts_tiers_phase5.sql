-- RLS lockdown Phase 5 (2026-07-14) — returns / contracts / commercial tiers.
-- Pre-conditions verified: Returns.tsx, Contracts.tsx, Commissions.tsx,
-- Discounts.tsx rewired to gated routes; zero anon .from() refs; zero
-- realtime subscriptions. Reversible: ALTER POLICY ... TO public.
-- Still deferred: inbox_messages (anon realtime SELECT + inbox.ts CRUD —
-- its own slice), discuss_* (intentional realtime), media/elements/pages/
-- sections (website-builder, intent unverified).

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'purchase_returns',
    'supplier_contracts',
    'commercial_commission_tiers',
    'commercial_discount_tiers',
    'commercial_volume_discount_tiers'
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
