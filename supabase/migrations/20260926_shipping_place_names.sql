-- Shipping — a port's name in Arabic and Chinese (26 Sep 2026; the owner took
-- every recommendation of the published plan: "do the right way").
--
-- Purely additive: one new table and its indexes. No ALTER on anything that
-- exists, no DROP, no UPDATE.
--
-- ── A translated name is SHOWN, never RESOLVED ─────────────────────────────
-- The owner's rule (15/09/2026) counts five identifier concepts that are never
-- interchangeable: UN/LOCODE, IATA, provider code, trade alias and translated
-- display name. This table holds the fifth. shipping_ports.name stays what is
-- stored, sent to a rate provider and printed; nothing reads this table to
-- turn a name into a code (validate:shipping-names holds port-resolver's
-- resolvers to that).
--
-- ── Only an approved name reaches a screen ─────────────────────────────────
-- Proposals come from Wikidata by UN/LOCODE (scripts/shipping/
-- build-place-names.mts). Measured 26/09: 74% Arabic / 79% Chinese of the
-- Koleex list — and wrong often enough (Lobito as «وبيتو», Mina Zayed as the
-- city «أبو ظبي») that a person approves each one. Until then the port keeps
-- its Latin name.

create extension if not exists pg_trgm;

create table if not exists public.shipping_place_names (
  id           uuid primary key default gen_random_uuid(),
  /* Exactly one place: a port now; an airport in a later phase. */
  port_id      uuid references public.shipping_ports(id) on delete cascade,
  airport_id   uuid references public.shipping_airports(id) on delete cascade,
  lang         text not null check (lang in ('ar', 'zh')),
  name         text not null check (char_length(name) between 1 and 120),
  /* What a search matches on — placeSearchKey() in src/lib/shipping/place-names.ts
     (Arabic without tashkeel, one alef, ه for ة). */
  search_key   text not null,
  status       text not null default 'proposed'
                 check (status in ('proposed', 'approved', 'rejected')),
  source       text not null check (source in ('wikidata', 'manual')),
  /* The Wikidata item a proposal came from, e.g. 'Q87' — the reviewer's link. */
  source_ref   text,
  reviewed_by  uuid,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint shipping_place_names_one_place check ((port_id is null) <> (airport_id is null))
);

-- One name per place and language. Non-partial for the same ON CONFLICT reason
-- as shipping_ports_locode_key; NULLs are distinct, so port rows and airport
-- rows never collide on the other column.
create unique index if not exists shipping_place_names_port_key
  on public.shipping_place_names (port_id, lang);
create unique index if not exists shipping_place_names_airport_key
  on public.shipping_place_names (airport_id, lang);
create index if not exists shipping_place_names_status_idx
  on public.shipping_place_names (lang, status);
create index if not exists shipping_place_names_search_idx
  on public.shipping_place_names using gin (search_key gin_trgm_ops)
  where status = 'approved';

/* House pattern (20260915_shipping.sql): RLS on, one service_role policy, no
   anon policy — the browser's key can neither read nor write it. */
alter table public.shipping_place_names enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shipping_place_names'
      and policyname = 'shipping_place_names_service_role_all'
  ) then
    create policy shipping_place_names_service_role_all on public.shipping_place_names
      for all to service_role using (true) with check (true);
  end if;
end $$;
