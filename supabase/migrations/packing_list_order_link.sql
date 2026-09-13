-- The packing list joins the deal.
--
-- ── Why the documents table, not a new one ─────────────────────────────────
-- `documents` already holds the packing list: doc_kind 'packing_list', with
-- { rows, meta } in its `doc` jsonb, its own numbering, the shared DocToolbar,
-- and a working A4 print. What it never had was a way to say WHICH DEAL it
-- belongs to — its invoice number is a text field somebody types.
--
-- So this is a link, not a rebuild. Two nullable columns, exactly as
-- quotations and invoices got in orders_entity.sql, and for the same reason:
-- every packing list written before today has no order, and one drafted for a
-- shipment that never happened never gets one.

alter table public.documents add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.documents add column if not exists deal_no  bigint;

create index if not exists documents_order_idx   on public.documents (order_id) where order_id is not null;
create index if not exists documents_deal_no_idx on public.documents (tenant_id, deal_no) where deal_no is not null;
