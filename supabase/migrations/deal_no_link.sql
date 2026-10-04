-- The deal number that ties a quotation to its invoice, contract, packing
-- list and purchase order.
--
-- The printed number (KL-QU-12349) has to be parsed back to 12349 for every
-- link if it is the only place the value lives, and a parser over a
-- human-edited string is a liability. Storing the raw counter next to it
-- makes the relationship an integer join instead.
--
-- Nullable: every existing document predates the scheme and keeps its old
-- date-derived number. Only new documents carry a deal_no.

alter table public.quotations add column if not exists deal_no bigint;
alter table public.invoices   add column if not exists deal_no bigint;

create index if not exists quotations_deal_no_idx on public.quotations (tenant_id, deal_no) where deal_no is not null;
create index if not exists invoices_deal_no_idx   on public.invoices   (tenant_id, deal_no) where deal_no is not null;
