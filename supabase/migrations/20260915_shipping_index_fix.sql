-- Follow-up to 20260915_shipping.sql: replace the two partial unique indexes
-- with plain ones. ON CONFLICT cannot infer a partial index unless the
-- statement repeats its predicate, and PostgREST cannot emit that — so the
-- reference seed could not upsert. See the note in the main migration.
drop index if exists public.shipping_ports_locode_key;
drop index if exists public.shipping_ports_tenant_locode_key;
drop index if exists public.shipping_airports_iata_key;
create unique index if not exists shipping_ports_locode_key on public.shipping_ports (locode);
create unique index if not exists shipping_airports_iata_key on public.shipping_airports (iata);
