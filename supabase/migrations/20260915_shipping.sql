-- Shipping — freight rate lookup, China to anywhere.
--
-- Purely additive. Six new tables, no ALTER on anything that exists, no DROP.
-- `shipping_methods`, `shipping_documents` and `incoterms` (Commercial Setup)
-- are untouched and stay the master list of HOW we ship; this module answers
-- WHAT IT COSTS, and joins to them by code later.
--
-- ── Why reference data lives in Postgres and not in a TS file ──────────────
-- The Hub already carries three hand-curated port lists — src/lib/ports.ts and
-- two more inside QuotationA4Preview — and they disagree with each other
-- ("Ningbo-Zhoushan" vs "Ningbo", "Guangzhou (Nansha)" vs "Guangzhou"). None
-- carries a UN/LOCODE, so nothing could be sent to a rate provider, and a
-- 3,800-port picker cannot ship to the browser as a literal.
--
-- Those three lists are NOT being deleted or rewritten by this migration. They
-- keep working exactly as they do today. shipping_port_aliases records every
-- string they use so the canonical row can be found FROM the old wording, and
-- their consumers migrate later, one at a time, once each is verified.
--
-- ── ⚠️ CNSHA IS AN AIRPORT ────────────────────────────────────────────────
-- UN/LOCODE assigns CNSHA to Shanghai Hongqiao INTERNATIONAL AIRPORT; the
-- Shanghai SEAPORT is CNSGH. The freight trade books ocean cargo as CNSHA
-- anyway, and so do the rate providers. Ningbo is the same: CNNGB is the
-- airport, CNNBO is the port. So the port row holds the STANDARD code and the
-- trade spelling is an alias with kind = 'trade_code'. Resolution must never
-- guess between them — see the unique index on (alias, kind) below, and the
-- long note in scripts/shipping/build-reference-dataset.mts.

/* ══ 1. Ports ═══════════════════════════════════════════════════════════════
   Global reference data: tenant_id NULL = a system row every tenant reads.
   A tenant may add its own private port later without a schema change. */
create table if not exists public.shipping_ports (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,

  /* UN/LOCODE, e.g. 'CNSGH'. NULLABLE ON PURPOSE: four Koleex ports have no
     confirmed code in the register (ambiguous or absent). They are shown by
     name only. A code is never invented to fill this in. */
  locode        text,
  /* What the operator sees and what gets printed. Koleex's own wording wins
     here — it is what already appears on a packing list. */
  name          text not null,
  /* The register's own spelling, kept so the two can be reconciled by eye
     ('Al Iskandariyh (Alexandria)' vs 'Alexandria'). */
  name_official text,

  country_code  char(2) not null,
  country_name  text,
  subdivision   text,

  lat           numeric(9,5),
  lng           numeric(9,5),

  /* NGA World Port Index commercial attributes. is_container is THREE-valued:
     true / false / unknown — the index genuinely does not know for 3,233 of
     its 3,807 ports, Shanghai included, so NULL must not read as "no". */
  harbor_size   text check (harbor_size in ('Large','Medium','Small','Very Small')),
  harbor_type   text,
  is_container  boolean,
  wpi_number    integer,

  /* Sea region from the quotation transit estimator, where that list knew the
     port. Lets the existing distance/chokepoint model be reused unchanged. */
  sea_region    text,

  /* True when one of the three existing Koleex lists already uses this port —
     these sort first in the picker, because they are the lanes we actually run. */
  in_koleex_list boolean not null default false,

  source        text not null default 'unlocode+wpi',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- One row per code, full stop.
--
-- NOT partial, and that is deliberate. A partial unique index cannot be
-- inferred by `ON CONFLICT (locode)` unless the statement repeats the
-- predicate, which PostgREST cannot emit — so the seed upsert fails with
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
-- Postgres treats NULLs as distinct, so the 457 code-less ports are unaffected
-- and coexist happily. The cost is that a tenant-private port cannot reuse a
-- system port's code; that is correct anyway — it would be the same place.
create unique index if not exists shipping_ports_locode_key
  on public.shipping_ports (locode);
create index if not exists shipping_ports_country_idx
  on public.shipping_ports (country_code, in_koleex_list desc, name);
create index if not exists shipping_ports_koleex_idx
  on public.shipping_ports (in_koleex_list) where in_koleex_list;

/* ══ 2. Port aliases ═══════════════════════════════════════════════════════
   Every string that must resolve to a port: the legacy Koleex spellings, the
   register's names, the World Port Index names, and the trade codes.
   `alias` is stored already normalised (lower-case, de-accented, punctuation
   collapsed) so a lookup is one equality test on an index, not a LIKE scan. */
create table if not exists public.shipping_port_aliases (
  id         uuid primary key default gen_random_uuid(),
  port_id    uuid not null references public.shipping_ports(id) on delete cascade,
  alias      text not null,
  /* the un-normalised original, for showing a human why a match happened */
  raw        text,
  /* koleex_list — a string one of the three existing lists uses
     locode      — the port's own UN/LOCODE
     trade_code  — a code the trade uses that the register assigns elsewhere
     unlocode_name / wpi_name / wpi_alt — register + index spellings */
  kind       text not null check (kind in
               ('koleex_list','locode','trade_code','unlocode_name','wpi_name','wpi_alt')),
  created_at timestamptz not null default now()
);

create unique index if not exists shipping_port_aliases_key
  on public.shipping_port_aliases (alias, kind, port_id);
create index if not exists shipping_port_aliases_lookup_idx
  on public.shipping_port_aliases (alias);

/* ══ 3. Airports ═══════════════════════════════════════════════════════════ */
create table if not exists public.shipping_airports (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid,
  iata          char(3) not null,
  icao          text,
  /* the UN/LOCODE airport code where the register has one — CNSHA really is
     Shanghai Hongqiao here, and in THIS table that is correct */
  locode        text,
  name          text not null,
  country_code  char(2) not null,
  municipality  text,
  lat           numeric(9,5),
  lng           numeric(9,5),
  size          text not null check (size in ('large','medium')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Non-partial for the same ON CONFLICT reason as shipping_ports_locode_key.
create unique index if not exists shipping_airports_iata_key
  on public.shipping_airports (iata);
create index if not exists shipping_airports_country_idx
  on public.shipping_airports (country_code, size, name);

/* ══ 4. Rate quotes ════════════════════════════════════════════════════════
   ONE table for the cache, the history and the forwarder quotes. They are the
   same shape and splitting them would mean three writers of one fact.
   APPEND-ONLY: a refreshed rate is a new row, so the history builds itself.

   ── THE RULE THIS TABLE EXISTS TO ENFORCE ─────────────────────────────────
   Four kinds of number look alike on screen and are not the same thing:
     provider  — a freight data provider's own rate for this lane
     market    — a public index or calculator range. NOT a quotation.
     koleex    — recovered from our own past shipments and cost simulations
     forwarder — a price a named forwarder actually gave us
   `rate_kind` is NOT NULL and has no default, so a writer has to say which one
   it is. Nothing in this schema averages across kinds, and nothing should.

   ── Comparability ─────────────────────────────────────────────────────────
   Two rates are comparable only when mode, equipment, unit, currency AND
   service_scope agree, and the three `includes_*` flags agree. A port-to-port
   price beside a door-to-door one is not a cheaper option, it is a different
   product. Those columns exist so the engine can refuse the comparison. */
create table if not exists public.shipping_rate_quotes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,

  rate_kind     text not null check (rate_kind in ('provider','market','koleex','forwarder')),
  /* 'freightos_public' | 'awice' | 'koleex_landed_cost' | 'koleex_quotation' |
     a contacts.id for a forwarder */
  source_id     text not null,
  source_label  text,
  /* How fresh the SOURCE is, not this row: 'realtime' | 'daily' | 'historical'
     | 'manual'. The UI label comes from here — a provider that syncs once a
     day must never be shown as live. */
  source_cadence text check (source_cadence in ('realtime','daily','historical','manual')),

  mode          text not null check (mode in ('ocean_fcl','ocean_lcl','air')),

  origin_port_id       uuid references public.shipping_ports(id) on delete set null,
  destination_port_id  uuid references public.shipping_ports(id) on delete set null,
  origin_airport_id    uuid references public.shipping_airports(id) on delete set null,
  destination_airport_id uuid references public.shipping_airports(id) on delete set null,
  /* denormalised so a lane query never needs the join, and so history survives
     a reference row being deactivated */
  origin_code   text not null,
  destination_code text not null,

  service_scope text not null default 'port_to_port'
                check (service_scope in ('port_to_port','door_to_port','port_to_door',
                                         'door_to_door','airport_to_airport')),
  includes_origin_charges      boolean,
  includes_destination_charges boolean,
  includes_customs             boolean,
  incoterm      text,

  /* '20GP' | '40GP' | '40HQ' for FCL; NULL for LCL and air */
  equipment     text check (equipment in ('20GP','40GP','40HQ')),
  /* what `amount` is per */
  unit          text not null check (unit in ('container','cbm','kg','shipment')),
  /* air weight bracket as the provider expressed it: 'MIN','+45','+100',
     '+300','+500','+1000'. Text, because every provider breaks weight
     differently and an enum would lose the ones that do not fit. */
  weight_break  text,
  min_charge    numeric(14,2),

  /* amount NULL is a legitimate, meaningful row: we asked and there is no
     rate. The UI says "Rate unavailable" from exactly this. */
  amount        numeric(14,2),
  /* a market RANGE lives here and leaves `amount` null, so a band can never be
     mistaken for a quotation */
  amount_low    numeric(14,2),
  amount_high   numeric(14,2),
  currency      char(3) not null default 'USD',
  /* [{ code, label, amount, currency, per }] — itemised, never folded in */
  surcharges    jsonb not null default '[]'::jsonb,
  total_estimate numeric(14,2),

  /* when WE fetched it */
  retrieved_at  timestamptz not null default now(),
  /* when the CACHE entry goes stale — not the same thing as the rate's own
     validity, which is the next two columns and belongs to the carrier */
  expires_at    timestamptz,
  valid_from    date,
  valid_until   date,

  transit_days_min integer,
  transit_days_max integer,
  carrier       text,
  vessel        text,
  voyage        text,
  etd           date,
  eta           date,

  /* computed by the confidence model, stored so a historical row keeps the
     verdict it was given at the time */
  confidence       text check (confidence in ('high','medium','low')),
  confidence_score smallint check (confidence_score between 0 and 100),
  /* true unless the source says this is bookable */
  is_estimate   boolean not null default true,

  /* the provider's own response, for audit and for re-normalising later
     without re-spending an API credit */
  raw           jsonb,
  notes         text,

  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The cache lookup: lane + mode + kind, newest first.
create index if not exists shipping_rate_quotes_lane_idx
  on public.shipping_rate_quotes
     (tenant_id, origin_code, destination_code, mode, rate_kind, retrieved_at desc);
-- The history chart: one lane + equipment over time.
create index if not exists shipping_rate_quotes_history_idx
  on public.shipping_rate_quotes
     (tenant_id, origin_code, destination_code, mode, equipment, retrieved_at desc);
-- Live cache sweep.
create index if not exists shipping_rate_quotes_expiry_idx
  on public.shipping_rate_quotes (expires_at) where expires_at is not null;
create index if not exists shipping_rate_quotes_source_idx
  on public.shipping_rate_quotes (tenant_id, source_id, retrieved_at desc);

/* ══ 5. Recent searches ════════════════════════════════════════════════════
   Per account, so one operator's history is not another's. Upsert on the lane
   so re-running a route moves it up instead of filling the list. */
create table if not exists public.shipping_searches (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  account_id    uuid not null,
  mode          text not null check (mode in ('ocean_fcl','ocean_lcl','air')),
  origin_code   text not null,
  destination_code text not null,
  origin_label  text,
  destination_label text,
  /* cbm / weight / dimensions as entered, so a re-run restores the whole form */
  params        jsonb not null default '{}'::jsonb,
  run_count     integer not null default 1,
  last_run_at   timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create unique index if not exists shipping_searches_key
  on public.shipping_searches (tenant_id, account_id, mode, origin_code, destination_code);
create index if not exists shipping_searches_recent_idx
  on public.shipping_searches (tenant_id, account_id, last_run_at desc);

/* ══ 6. Favourite routes ═══════════════════════════════════════════════════ */
create table if not exists public.shipping_favorite_routes (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null,
  account_id    uuid not null,
  label         text,
  mode          text check (mode in ('ocean_fcl','ocean_lcl','air')),
  origin_code   text not null,
  destination_code text not null,
  origin_label  text,
  destination_label text,
  params        jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  created_by    uuid,
  created_at    timestamptz not null default now()
);

create unique index if not exists shipping_favorite_routes_key
  on public.shipping_favorite_routes (tenant_id, account_id, mode, origin_code, destination_code);
create index if not exists shipping_favorite_routes_list_idx
  on public.shipping_favorite_routes (tenant_id, account_id, sort_order, created_at);

/* ══ RLS ═══════════════════════════════════════════════════════════════════
   House pattern: RLS on, one service_role policy, NO anon policy — the browser's
   anon key can neither read nor write these tables. Tenant isolation is
   enforced in the route handlers by .eq("tenant_id", auth.tenant_id), which is
   what scripts/tenant-isolation.ts red-teams. The two reference tables are
   deliberately global (tenant_id NULL rows) and carry no tenant data. */
do $$
declare t text;
begin
  foreach t in array array[
    'shipping_ports','shipping_port_aliases','shipping_airports',
    'shipping_rate_quotes','shipping_searches','shipping_favorite_routes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and policyname = t || '_service_role_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        t || '_service_role_all', t);
    end if;
  end loop;
end $$;
