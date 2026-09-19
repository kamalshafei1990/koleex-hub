-- Shipping — a stored rate says WHICH REGISTER its codes come from.
--
-- Additive: two columns and one index. No ALTER of an existing column, no DROP.
--
-- ── ⚠️ WHY A CODE ALONE IS NOT AN IDENTIFIER ──────────────────────────────
-- Measured on the seeded reference data, 15 Sep 2026:
--
--   · 787 UN/LOCODEs name BOTH a seaport and an airport. USDET is the Detroit
--     seaport in shipping_ports and Coleman A. Young airport in
--     shipping_airports. Both rows are real and they are different facilities.
--   · A country prefix plus a three-letter IATA code is frequently a real and
--     DIFFERENT seaport. CN + ZJG reads as CNZJG, which is Zhangjiagang — a
--     port, not an airport.
--
-- So `origin_code = 'USDET'` answers nothing on its own. Until now the system
-- was inferred from `mode` (air ⇒ IATA, ocean ⇒ UN/LOCODE), which happened to
-- be true and was never written down — an invariant living in one reader's
-- head is not an invariant. It is a column now.
--
-- Rows written before this migration are ocean rows: the air path did not work
-- until 15 Sep 2026 (every air search failed on port resolution), so the
-- backfill below is a statement of fact, not a guess.

alter table public.shipping_rate_quotes
  add column if not exists origin_code_system text
    check (origin_code_system in ('unlocode','iata')),
  add column if not exists destination_code_system text
    check (destination_code_system in ('unlocode','iata'));

update public.shipping_rate_quotes
   set origin_code_system = 'unlocode'
 where origin_code_system is null;

update public.shipping_rate_quotes
   set destination_code_system = 'unlocode'
 where destination_code_system is null;

-- The lane lookup keys on the code AND its register, so a seaport row and an
-- airport row that share a UN/LOCODE can never be served for one another.
create index if not exists shipping_rate_quotes_lane_system_idx
  on public.shipping_rate_quotes
     (tenant_id, origin_code, origin_code_system,
      destination_code, destination_code_system, mode, rate_kind, retrieved_at desc);
