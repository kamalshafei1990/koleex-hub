"use client";

/* Approval Rules — spend-threshold ladder. The migration seeded the
   common 5-step ladder (auto / manager / director / CFO / CEO) so
   the app is useful out-of-box. Standard SAP "Release Strategy",
   Odoo "Approval Rules", Coupa "Approval Chains". */

import { useEffect, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../shared";
import { cardCls, formatMoney, sectionTitleCls } from "../shared";
import HandCoinsIcon from "@/components/icons/ui/HandCoinsIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { kxInspectAttrs } from "@/lib/qa/inspector";

type Rule = {
  id: string; code: string | null; name: string;
  applies_to: string | null;
  min_amount_usd: number | null; max_amount_usd: number | null;
  approver_role: string | null; sort_order: number | null;
  is_active: boolean | null;
};

const APPLIES_LABEL: Record<string, string> = {
  requisition: "Requisition",
  po:          "Purchase order",
  bill:        "Vendor bill",
};

export default function ApprovalsModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("purchase_approval_rules")
        .select("id,code,name,applies_to,min_amount_usd,max_amount_usd,approver_role,sort_order,is_active")
        .order("applies_to").order("sort_order", { ascending: true, nullsFirst: false });
      if (cancelled) return;
      setRows((r.data ?? []) as Rule[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h2 className={sectionTitleCls}><HandCoinsIcon className="h-3 w-3" />Spend approval ladder</h2>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noApprovals")}</p>
        </div>
      ) : (
        <div className={`${cardCls} overflow-hidden`}>
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h3 className="text-[12px] font-semibold text-[var(--text-primary)]">Threshold rules</h3>
            <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">document → amount → approver</span>
          </div>
          <ul className="divide-y divide-[var(--border-subtle)]">
            {rows.map((r) => (
              <li key={r.id} {...kxInspectAttrs({ component: "PurchaseApprovalRow", module: "Purchases", section: "Approvals", recordId: r.id })} className="grid grid-cols-[80px_120px_1fr_140px_auto] gap-3 items-center px-4 py-3">
                <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">{r.code || "—"}</span>
                <span className="text-[11px] text-[var(--text-dim)] uppercase tracking-wider">{APPLIES_LABEL[r.applies_to || "requisition"] || "—"}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{r.name}</p>
                  <p className="text-[11px] text-[var(--text-dim)] tabular-nums">
                    {formatMoney(Number(r.min_amount_usd) || 0)} – {r.max_amount_usd ? formatMoney(Number(r.max_amount_usd)) : "∞"}
                  </p>
                </div>
                <span className="text-[12px] text-[var(--text-muted)] truncate">{r.approver_role || "—"}</span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${r.is_active !== false ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]"}`}>
                  {r.is_active !== false ? "Active" : "Off"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
