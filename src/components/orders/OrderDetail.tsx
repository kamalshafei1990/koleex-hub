"use client";

/* ---------------------------------------------------------------------------
   One order — /orders/[id]

   Everything raised against a single deal, in the order it happens:
   quotation → invoice → contract. Each document is a row that opens the
   document itself; the order screen never tries to be an editor for them.

   ── Why the timeline is grouped by TYPE, not sorted by date ────────────────
   A proforma invoice and the commercial invoice that replaces it sit side by
   side, and an amendment sits beside the contract it amends. Sorting by date
   would interleave them and lose the one thing a reader is looking for: how
   many of each exist, and which is current.

   Requests on open: ONE.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { ordersT } from "@/lib/translations/orders";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import OrdersIcon from "@/components/icons/OrdersIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import QuotationIcon from "@/components/icons/QuotationIcon";
import InvoicesIcon from "@/components/icons/InvoicesIcon";
import ContractIcon from "@/components/icons/ui/ContractIcon";
import BoxIcon from "@/components/icons/ui/BoxIcon";
import PurchaseIcon from "@/components/icons/PurchaseIcon";
import RaisePurchaseOrderDialog from "./RaisePurchaseOrderDialog";
import { CARD } from "@/components/travel/fields";
import {
  dmy,
  orderMoney,
  orderParty,
  type OrderCustomer,
  type OrderDocSummary,
  type OrderRow,
  type OrderStatus,
} from "./types";

const STATUS_BADGE: Record<OrderStatus, string> = {
  open: "bg-blue-500/12 text-blue-300 border-blue-500/35",
  shipped: "bg-amber-500/12 text-amber-300 border-amber-500/35",
  closed: "bg-emerald-500/12 text-emerald-400 border-emerald-500/35",
  cancelled: "bg-rose-500/12 text-rose-400 border-rose-500/35",
};

/* Document statuses come from three different tables with three different
   vocabularies. Rather than teach this screen all of them, tone is decided by
   MEANING: something final and good, something rejected, or in flight. */
function docTone(status: string | null): string {
  const s = (status ?? "").toLowerCase();
  if (/signed|paid|accepted|issued|closed/.test(s)) return "bg-emerald-500/12 text-emerald-400 border-emerald-500/35";
  if (/cancel|reject|void|expired|superseded/.test(s)) return "bg-rose-500/12 text-rose-400 border-rose-500/35";
  if (/draft/.test(s)) return "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]";
  return "bg-blue-500/12 text-blue-300 border-blue-500/35";
}

interface Payload {
  order: OrderRow;
  quotations: (OrderDocSummary & { quote_no?: string; created_at?: string })[];
  invoices: (OrderDocSummary & { inv_no?: string; issue_date?: string })[];
  contracts: (OrderDocSummary & { contract_no?: string; contract_date?: string })[];
  packingLists: (OrderDocSummary & { doc_no?: string; issue_date?: string })[];
  purchaseOrders: (OrderDocSummary & { po_no?: string; order_date?: string })[];
  goods: { description: string; model: string; qty: number; price: number }[];
  goodsFrom: string | null;
  customer: OrderCustomer | null;
}

export default function OrderDetail({ id }: { id: string }) {
  const { t } = useTranslation(ordersT);
  const router = useRouter();

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [raisingPo, setRaisingPo] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: "no-store" });
      const json = (await res.json()) as Partial<Payload> & { error?: string };
      if (!res.ok || !json.order) throw new Error(json.error ?? "not found");
      setData({
        order: json.order,
        quotations: json.quotations ?? [],
        invoices: json.invoices ?? [],
        contracts: json.contracts ?? [],
        packingLists: json.packingLists ?? [],
        purchaseOrders: json.purchaseOrders ?? [],
        goods: json.goods ?? [],
        goodsFrom: json.goodsFrom ?? null,
        customer: json.customer ?? null,
      });
    } catch {
      setError(t("detail.notFound"));
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="min-h-full">
        <div className="mx-auto w-full max-w-[1500px] px-4 pt-12 sm:px-6 lg:px-8">
          <div className={`${CARD} p-8 text-center`}>
            <p className="text-[var(--text-secondary)]">{error}</p>
            <div className="mt-4">
              <Button variant="secondary" onClick={() => router.push("/orders")}>
                {t("detail.back")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-full flex items-center justify-center py-20 text-[var(--text-secondary)]">
        <SpinnerIcon size={28} />
      </div>
    );
  }

  const { order, customer } = data;

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 pt-12 pb-16 sm:px-6 lg:px-8">
        <PageHeader
          title={order.order_no}
          subtitle={orderParty(order)}
          icon={<OrdersIcon size={16} />}
          backHref="/orders"
          backLabel={t("detail.back")}
          showTabs={false}
          action={
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center h-[26px] px-3 rounded-full border text-[11.5px] font-semibold ${STATUS_BADGE[order.status]}`}
              >
                {t(`status.${order.status}`)}
              </span>
              {/* Sourcing acts on the DEAL, not on any one document, so it
                  belongs with the order's own controls. */}
              <Button variant="secondary" onClick={() => setRaisingPo(true)}>
                {t("action.raisePo")}
              </Button>
            </div>
          }
        />

        {/* ── The facts, above the paperwork ── */}
        <div className={`${CARD} mt-5 grid gap-x-6 gap-y-3 p-4 sm:grid-cols-3`}>
          <Fact label={t("detail.customer")}>
            <div className="text-[13px] font-medium text-[var(--text-primary)]">{orderParty(order)}</div>
            {customer?.customer_code || order.customer_code ? (
              <div className="font-mono text-[11px] text-[var(--text-faint)]">
                {customer?.customer_code ?? order.customer_code}
              </div>
            ) : null}
            {customer?.email ? (
              <div className="text-[11.5px] text-[var(--text-secondary)] truncate">{customer.email}</div>
            ) : null}
          </Fact>
          <Fact label={t("detail.value")}>
            <div className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">
              {orderMoney(order.total, order.currency)}
            </div>
          </Fact>
          <Fact label={t("detail.opened")}>
            <div className="text-[13px] tabular-nums text-[var(--text-primary)]">{dmy(order.created_at)}</div>
            <div className="font-mono text-[11px] text-[var(--text-faint)]">deal {order.deal_no}</div>
          </Fact>
        </div>

        {order.notes ? (
          <div className={`${CARD} mt-3 p-4`}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)] mb-1.5">
              {t("detail.notes")}
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap">{order.notes}</p>
          </div>
        ) : null}

        {/* ── The documents ── */}
        {/* Two columns from lg up — five short groups stacked in a single
            column on a 1500px shell is the same wasted screen the list had.
            Base stays one column, so narrow screens are unaffected. */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <DocGroup
            title={t("doc.quotations")}
            icon={<QuotationIcon size={14} />}
            docs={data.quotations.map((q) => ({
              id: q.id,
              number: q.number ?? q.quote_no ?? null,
              status: q.status,
              total: q.total,
              currency: q.currency,
              date: q.date ?? q.created_at ?? null,
            }))}
            hrefFor={(d) => `/quotations?doc=${d.id}`}
          />
          <DocGroup
            title={t("doc.invoices")}
            icon={<InvoicesIcon size={14} />}
            docs={data.invoices.map((r) => ({
              id: r.id,
              number: r.number ?? r.inv_no ?? null,
              status: r.status,
              total: r.total,
              currency: r.currency,
              date: r.date ?? r.issue_date ?? null,
            }))}
            hrefFor={(d) => `/invoices?doc=${d.id}`}
          />
          <DocGroup
            title={t("doc.contracts")}
            icon={<ContractIcon size={14} />}
            docs={data.contracts.map((r) => ({
              id: r.id,
              number: r.number ?? r.contract_no ?? null,
              status: r.status,
              total: r.total,
              currency: r.currency,
              date: r.date ?? r.contract_date ?? null,
            }))}
            hrefFor={(d) => `/contracts/${d.id}`}
          />
          <DocGroup
            title={t("doc.packingLists")}
            icon={<BoxIcon size={14} />}
            docs={data.packingLists.map((r) => ({
              id: r.id,
              number: r.number ?? r.doc_no ?? null,
              status: r.status,
              total: r.total,
              currency: r.currency,
              date: r.date ?? r.issue_date ?? null,
            }))}
            /* The packing list lives in the Documents app; the deep link opens
               it straight into its editor rather than its list. */
            hrefFor={(d) => `/documents?doc=${d.id}`}
          />
          <DocGroup
            title={t("doc.purchaseOrders")}
            icon={<PurchaseIcon size={14} />}
            docs={data.purchaseOrders.map((r) => ({
              id: r.id,
              number: r.number ?? r.po_no ?? null,
              status: r.status,
              total: r.total,
              currency: r.currency,
              date: r.date ?? r.order_date ?? null,
            }))}
            /* The Purchases app owns the PO; this only points at it. */
            hrefFor={() => "/purchase/orders"}
          />

        </div>

        {/* ── What the deal is actually FOR ──
            Two document chips do not fill a 1500px screen, and stretching
            them would not make the page more useful. The goods do: reading
            an order used to mean opening its invoice to find out what was
            sold. Taken from the deal's latest invoice, so it follows a
            correction there. */}
        {data.goods.length > 0 && (
          <section className="mt-6">
            <h2 className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)] mb-2">
              <BoxIcon size={14} />
              {t("goods.title")}
              <span className="tabular-nums">({data.goods.length})</span>
              {data.goodsFrom ? (
                <span className="font-mono normal-case tracking-normal text-[10px] text-[var(--text-faint)]">
                  · {data.goodsFrom}
                </span>
              ) : null}
            </h2>
            {/* Wide content owns its own scroll — the page never slides. */}
            <div className={`${CARD} overflow-x-auto`}>
              <table className="w-full min-w-[640px] text-[12.5px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                    <th className="px-4 py-2.5 text-start font-semibold">{t("goods.description")}</th>
                    <th className="px-3 py-2.5 text-start font-semibold w-[120px]">{t("goods.model")}</th>
                    <th className="px-3 py-2.5 text-end font-semibold w-[70px]">{t("goods.qty")}</th>
                    <th className="px-3 py-2.5 text-end font-semibold w-[110px]">{t("goods.unitPrice")}</th>
                    <th className="px-4 py-2.5 text-end font-semibold w-[120px]">{t("goods.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.goods.map((g, i) => (
                    <tr key={i} className="border-t border-[var(--border-subtle)]">
                      <td className="px-4 py-2.5 text-[var(--text-primary)]">{g.description || "—"}</td>
                      <td className="px-3 py-2.5 font-mono text-[11.5px] text-[var(--text-secondary)]">
                        {g.model || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular-nums text-[var(--text-primary)]">{g.qty}</td>
                      <td className="px-3 py-2.5 text-end tabular-nums text-[var(--text-secondary)]">
                        {orderMoney(g.price, order.currency)}
                      </td>
                      <td className="px-4 py-2.5 text-end tabular-nums font-semibold text-[var(--text-primary)]">
                        {orderMoney(g.qty * g.price, order.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {raisingPo && (
        <RaisePurchaseOrderDialog
          orderId={order.id}
          orderNo={order.order_no}
          onClose={() => setRaisingPo(false)}
          onCreated={() => {
            setRaisingPo(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)] mb-1">{label}</div>
      {children}
    </div>
  );
}

function DocGroup({
  title,
  icon,
  docs,
  hrefFor,
}: {
  title: string;
  icon: React.ReactNode;
  docs: OrderDocSummary[];
  hrefFor: (d: OrderDocSummary) => string;
}) {
  const router = useRouter();
  /* An empty group is noise on a deal that never had one. */
  if (docs.length === 0) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)] mb-2">
        <span>{icon}</span>
        {title}
        <span className="tabular-nums">({docs.length})</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {docs.map((d) => (
          <li key={d.id}>
            <button
              onClick={() => router.push(hrefFor(d))}
              className={`${CARD} w-full text-start flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 transition-colors hover:border-[var(--border-strong)]`}
            >
              <span className="font-mono text-[12.5px] font-semibold text-[var(--text-primary)]">{d.number ?? "—"}</span>
              {d.status ? (
                <span
                  className={`inline-flex items-center h-[19px] px-2 rounded-full border text-[10px] font-semibold capitalize ${docTone(d.status)}`}
                >
                  {d.status}
                </span>
              ) : null}
              <span className="text-[11.5px] text-[var(--text-faint)] tabular-nums">{dmy(d.date)}</span>
              <span className="ms-auto text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                {orderMoney(d.total, d.currency)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
