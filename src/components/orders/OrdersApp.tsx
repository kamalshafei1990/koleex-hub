"use client";

/* ---------------------------------------------------------------------------
   Orders — /orders

   The deal list. An order is not a document; it is the thing the documents
   are about. Each row shows the deal number that every document shares, who
   it is with, what it is worth, and which papers exist so far.

   Layout follows the AppHomeMenu convention: navItems for the filters, and
   nothing in the header's action slot — an order is never created by hand.
   It comes into being when a quotation becomes an invoice, or when a contract
   is raised. A "New order" button would be a lie about how the system works.

   Requests on open: ONE. The API fans out to the three document tables
   server-side; filtering and search are client-side over the loaded page, so
   switching between All / Open / Shipped costs nothing. No poller.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { ordersT } from "@/lib/translations/orders";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
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
  type OrderDocuments,
  type OrderRow,
  type OrderStatus,
} from "./types";

type Filter = "all" | OrderStatus;

const STATUS_BADGE: Record<OrderStatus, string> = {
  open: "bg-blue-500/12 text-blue-300 border-blue-500/35",
  shipped: "bg-amber-500/12 text-amber-300 border-amber-500/35",
  closed: "bg-emerald-500/12 text-emerald-400 border-emerald-500/35",
  cancelled: "bg-rose-500/12 text-rose-400 border-rose-500/35",
};

export default function OrdersApp() {
  const { t } = useTranslation(ordersT);
  const router = useRouter();

  const [rows, setRows] = useState<OrderRow[] | null>(null);
  const [docs, setDocs] = useState<Record<string, OrderDocuments>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/orders?limit=200", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { orders: OrderRow[]; documents: Record<string, OrderDocuments> };
      setRows(body.orders ?? []);
      setDocs(body.documents ?? {});
    } catch {
      setError(t("error.load"));
      setRows([]);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c = { all: 0, open: 0, shipped: 0, closed: 0, cancelled: 0 };
    for (const r of rows ?? []) {
      c.all++;
      c[r.status]++;
    }
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return [r.order_no, r.customer_name, r.company_name, r.customer_code, String(r.deal_no)]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [rows, filter, query]);

  return (
    /* A flowing list page, so it lives in the Hub scroller — min-h-full, not
       h-full. pt-12 clears the frosted header ramp, which reaches
       calc(--kx-header-h + 3rem); without it the first control sits inside
       the frost, permanently veiled but still clickable, which is worse than
       broken because nothing looks wrong enough to report. */
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-6xl px-4 pt-12 pb-16 sm:px-6">
        <PageHeader
          title={t("app.title")}
          subtitle={t("app.subtitle")}
          icon={<OrdersIcon size={16} />}
          showTabs={false}
        />

        <div className="mt-5 mb-3">
          <AppHomeMenu
            searchPlaceholder={t("search.placeholder")}
            onSearchSubmit={setQuery}
            navItems={[
              { key: "all", onClick: () => setFilter("all"), icon: "file", label: t("nav.all"), count: counts.all, active: filter === "all" },
              { key: "open", onClick: () => setFilter("open"), icon: "clock", label: t("nav.open"), count: counts.open, active: filter === "open" },
              { key: "shipped", onClick: () => setFilter("shipped"), icon: "truck-side", label: t("nav.shipped"), count: counts.shipped, active: filter === "shipped" },
              { key: "closed", onClick: () => setFilter("closed"), icon: "check", label: t("nav.closed"), count: counts.closed, active: filter === "closed" },
            ]}
          />
        </div>

        {rows === null ? (
          /* The Hub's ONE loading shape — never a bespoke spinner. */
          <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
            <SpinnerIcon size={28} />
          </div>
        ) : error ? (
          <div className={`${CARD} p-6 text-center`}>
            <p className="text-[var(--text-secondary)]">{error}</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void load()}>
                {t("action.retry")}
              </Button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className={`${CARD} px-6 py-14 text-center`}>
            <p className="text-base font-medium">{t("empty.title")}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("empty.body")}</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((o) => {
              const d = docs[o.id] ?? { quotations: [], invoices: [], contracts: [], packingLists: [] };
              const nDocs = d.quotations.length + d.invoices.length + d.contracts.length + d.packingLists.length;
              return (
                <li key={o.id}>
                  <button
                    onClick={() => router.push(`/orders/${o.id}`)}
                    className={`${CARD} w-full text-start flex flex-col gap-2 px-4 py-3 transition-colors hover:border-[var(--border-strong)]`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-[13px] font-semibold tracking-tight text-[var(--text-primary)]">
                        {o.order_no}
                      </span>
                      <span
                        className={`inline-flex items-center h-[20px] px-2 rounded-full border text-[10.5px] font-semibold ${STATUS_BADGE[o.status]}`}
                      >
                        {t(`status.${o.status}`)}
                      </span>
                      <span className="text-[13px] text-[var(--text-primary)] truncate">{orderParty(o)}</span>
                      {o.customer_code ? (
                        <span className="font-mono text-[11px] text-[var(--text-faint)]">{o.customer_code}</span>
                      ) : null}
                      <span className="ms-auto text-[13px] font-semibold tabular-nums text-[var(--text-primary)]">
                        {orderMoney(o.total, o.currency)}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-[var(--text-secondary)]">
                      {nDocs === 0 ? (
                        <span className="text-[var(--text-faint)]">{t("doc.none")}</span>
                      ) : (
                        <>
                          {d.quotations.length > 0 && (
                            <DocCount icon={<QuotationIcon size={12} />} n={d.quotations.length} label={t("doc.quotations")} />
                          )}
                          {d.invoices.length > 0 && (
                            <DocCount icon={<InvoicesIcon size={12} />} n={d.invoices.length} label={t("doc.invoices")} />
                          )}
                          {d.contracts.length > 0 && (
                            <DocCount icon={<ContractIcon size={12} />} n={d.contracts.length} label={t("doc.contracts")} />
                          )}
                          {d.packingLists.length > 0 && (
                            <DocCount icon={<BoxIcon size={12} />} n={d.packingLists.length} label={t("doc.packingLists")} />
                          )}
                        </>
                      )}
                      <span className="ms-auto text-[var(--text-faint)]">{dmy(o.created_at)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function DocCount({ icon, n, label }: { icon: React.ReactNode; n: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-[var(--text-faint)]">{icon}</span>
      <span className="tabular-nums font-medium text-[var(--text-primary)]">{n}</span>
      <span>{label}</span>
    </span>
  );
}
