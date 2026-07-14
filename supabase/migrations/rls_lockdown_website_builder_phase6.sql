-- RLS lockdown Phase 6 (2026-07-14) — orphaned website-builder tables.
-- elements / pages / sections / media (the DB table, distinct from the
-- 'media' Storage bucket used by catalogue-sync) have ZERO code references
-- anywhere in src/ and are NOT in the realtime publication. Locking to
-- service_role has no app impact. Reversible: ALTER POLICY ... TO public.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array['elements','pages','sections','media'] loop
    for p in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = t
        and 'public' = any(roles::text[])
    loop
      execute format('alter policy %I on public.%I to service_role', p.policyname, t);
    end loop;
  end loop;
end $$;
