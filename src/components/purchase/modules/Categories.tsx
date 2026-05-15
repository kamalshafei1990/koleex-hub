"use client";

/* Spend Categories — the Direct vs Indirect spend taxonomy that
   ties every PR / PO / Bill to a budget bucket. Standard ERP
   feature for spend visibility (SAP "G/L Account groupings", Odoo
   "Analytic Accounts"). The seed migration created the four kinds
   most companies use:
     · direct   — raw materials, finished goods to resell, packaging
     · indirect — office, IT, maintenance, marketing, T&E
     · services — consultants, freelancers
     · capex    — equipment, furniture, durable assets */

import { useEffect, useMemo, useState } from "react";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { PurchaseModuleProps } from "../PurchaseApp";
import { cardCls, sectionTitleCls } from "../shared";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Category = {
  id: string; code: string | null; name: string;
  kind: string; description: string | null;
  is_active: boolean | null;
};

const KIND_TONE: Record<string, string> = {
  direct:   "bg-blue-500/15 text-blue-400 border-blue-500/20",
  indirect: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  services: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  capex:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
};

const KIND_LABEL: Record<string, string> = {
  direct:   "Direct",
  indirect: "Indirect",
  services: "Services",
  capex:    "Capex",
};

export default function CategoriesModule({ t }: PurchaseModuleProps) {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("purchase_categories")
        .select("id,code,name,kind,description,is_active")
        .order("kind").order("name");
      if (cancelled) return;
      setRows((r.data ?? []) as Category[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<string, Category[]>();
    for (const r of rows) {
      const k = r.kind || "direct";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(r);
    }
    return m;
  }, [rows]);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  if (rows.length === 0) {
    return (
      <div className="p-6">
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("purchase.empty.noCategories")}</p>
        </div>
      </div>
    );
  }

  const order = ["direct", "indirect", "services", "capex"];

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h2 className={sectionTitleCls}><LayoutGridIcon className="h-3 w-3" />Spend categories</h2>

      {order.map((kind) => {
        const list = grouped.get(kind) ?? [];
        if (list.length === 0) return null;
        return (
          <div key={kind} className={`${cardCls} overflow-hidden`}>
            <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${KIND_TONE[kind]}`}>{KIND_LABEL[kind]}</span>
                <span className="text-[12px] text-[var(--text-dim)]">{list.length} categor{list.length === 1 ? "y" : "ies"}</span>
              </div>
            </div>
            <ul className="divide-y divide-[var(--border-subtle)]">
              {list.map((c) => (
                <li key={c.id} className="grid grid-cols-[80px_1fr_auto] gap-3 items-center px-4 py-3">
                  <span className="font-mono text-[11px] font-semibold text-[var(--text-muted)]">{c.code || "—"}</span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{c.name}</p>
                    {c.description && <p className="text-[11px] text-[var(--text-dim)] truncate">{c.description}</p>}
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${c.is_active !== false ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-slate-500/15 text-slate-400 border-slate-500/20"}`}>
                    {c.is_active !== false ? "Active" : "Off"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
