-- Purchase orders join the deal.
--
-- A PO raised to source a customer's machines belongs to that customer's
-- deal, but until now nothing recorded the connection: the Purchases app
-- knew the supplier and the goods, and the Orders app could not see that the
-- sourcing had started at all.
--
-- Same shape as quotations, invoices and documents got: two nullable columns.
-- Nullable because most POs are ordinary stock replenishment with no customer
-- deal behind them, and every PO raised before today has none.

alter table public.purchase_orders add column if not exists order_id uuid references public.orders(id) on delete set null;
alter table public.purchase_orders add column if not exists deal_no  bigint;

create index if not exists purchase_orders_order_idx   on public.purchase_orders (order_id) where order_id is not null;
create index if not exists purchase_orders_deal_no_idx on public.purchase_orders (tenant_id, deal_no) where deal_no is not null;
