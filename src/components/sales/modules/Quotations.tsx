"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, formatDate, linkBtnCls, sectionTitleCls } from "../shared";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Quote = {
  id: string; quote_no: string | null; status: string | null;
  customer_name: string | null; total: number | null;
  created_at: string; valid_until: string | null;
};

const STATUS_TONE: Record<string, string> = {
  draft:     "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  sent:      "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  pending:   "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  accepted:  "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35",
  rejected:  "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35",
  expired:   "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
};

export default function QuotationsModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      /* Read through /api/sales/overview: this table is service-role-only, so
         the browser query that used to be here returned nothing and the panel
         was always empty. */
      const res = await fetch("/api/sales/overview?module=quotations", { credentials: "include" });
      const json = res.ok ? ((await res.json()) as { rows?: Quote[] }) : { rows: [] };
      if (cancelled) return;
      setRows(json.rows ?? []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><DocumentIcon className="h-3 w-3" />{t("sales.recent")} {t("sales.tabQuotations").toLowerCase()}</h2>
        <Link href="/quotations" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-3">{t("sales.empty.noQuotes")}</p>
          <Link href="/quotations" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">Create quotation</Link>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((q) => {
            const status = (q.status || "draft").toLowerCase();
            const tone = STATUS_TONE[status] || STATUS_TONE.draft;
            return (
              <Link
                key={q.id}
                href={`/quotations/${q.id}`}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_120px_auto] gap-3 md:gap-4 items-center px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors"
              >
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{q.quote_no || q.id.slice(0, 8)}</span>
                <span className="text-[13px] text-[var(--text-muted)] truncate">{q.customer_name || "—"}</span>
                <span className="hidden md:inline text-[12px] tabular-nums text-[var(--text-dim)]">{formatDate(q.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>{status}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(q.total) || 0)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
