-- Amendments to a signed contract.
--
-- ── Why a link and not just a status ───────────────────────────────────────
-- A signed contract is immutable (guard_signed_sales_contract). Changing what
-- was agreed means raising a NEW contract on the same deal — KL-CN-12352-2 —
-- and retiring the original.
--
-- The tempting shortcut is to flip the original to 'superseded' the moment
-- the amendment is created. That is wrong: the amendment is a DRAFT, possibly
-- for days, and during that window neither document is in force. The parties
-- would be holding an agreement the system says is retired and a replacement
-- nobody has signed.
--
-- So the amendment records WHAT IT AMENDS, and the original is superseded at
-- the moment the amendment is signed — the same moment the amendment itself
-- becomes binding. Exactly one contract is in force at every instant.

alter table public.sales_contracts
  add column if not exists amends_id uuid references public.sales_contracts(id) on delete set null;

create index if not exists sales_contracts_amends_idx
  on public.sales_contracts (amends_id) where amends_id is not null;
