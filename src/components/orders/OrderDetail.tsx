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
  customer: OrderCustomer | null;
}

export default function OrderDetail({ id }: { id: string }) {
  const { t } = useTranslation(ordersT);
  const router = useRouter();

  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <div className="mx-auto w-full max-w-4xl px-4 pt-12 sm:px-6">
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
      <div className="mx-auto w-full max-w-4xl px-4 pt-12 pb-16 sm:px-6">
        <PageHeader
          title={order.order_no}
          subtitle={orderParty(order)}
          icon={<OrdersIcon size={16} />}
          backHref="/orders"
          backLabel={t("detail.back")}
          showTabs={false}
          action={
            <span
              className={`inline-flex items-center h-[26px] px-3 rounded-full border text-[11.5px] font-semibold ${STATUS_BADGE[order.status]}`}
            >
              {t(`status.${order.status}`)}
            </span>
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
        <div className="mt-6 flex flex-col gap-5">
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
            hrefFor={() => "/quotations"}
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
            hrefFor={() => "/invoices"}
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
        </div>
      </div>
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
