"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, formatMoney, formatDate, sectionTitleCls } from "../shared";
import BoxesIcon from "@/components/icons/ui/BoxesIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Order = {
  id: string; order_no: string | null; status: string | null;
  customer_name: string | null; total: number | null;
  created_at: string; expected_ship_date: string | null;
};

const STATUS_TONE: Record<string, string> = {
  pending:    "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  confirmed:  "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  processing: "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  shipped:    "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  delivered:  "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35",
  cancelled:  "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35",
  closed:     "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
};

export default function OrdersModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("sales_orders")
        .select("id,order_no,status,customer_name,total,created_at,expected_ship_date")
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled) return;
      setRows((r.data ?? []) as Order[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><BoxesIcon className="h-3 w-3" />{t("sales.recent")} {t("sales.tabOrders").toLowerCase()}</h2>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-2">{t("sales.empty.noOrders")}</p>
          <p className="text-[12px] text-[var(--text-ghost)]">Once a quotation is accepted you can convert it into a sales order.</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((o) => {
            const status = (o.status || "pending").toLowerCase();
            const tone = STATUS_TONE[status] || STATUS_TONE.pending;
            return (
              <div key={o.id} className="grid grid-cols-[1fr_auto] md:grid-cols-[120px_1fr_120px_auto] gap-3 md:gap-4 items-center px-4 py-3">
                <span className="font-mono text-[12px] font-semibold text-[var(--text-primary)] truncate">{o.order_no || o.id.slice(0, 8)}</span>
                <span className="text-[13px] text-[var(--text-muted)] truncate">{o.customer_name || "—"}</span>
                <span className="hidden md:inline text-[12px] tabular-nums text-[var(--text-dim)]">{formatDate(o.created_at)}</span>
                <div className="flex items-center gap-2 justify-end">
                  <span className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${tone}`}>{status}</span>
                  <span className="text-[13px] tabular-nums font-semibold text-[var(--text-primary)] min-w-[80px] text-right">{formatMoney(Number(o.total) || 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
