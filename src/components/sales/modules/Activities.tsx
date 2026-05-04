"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, linkBtnCls, sectionTitleCls, formatDate } from "../shared";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Activity = {
  id: string; title: string | null; type: string | null;
  due_date: string | null; is_done: boolean | null;
  opportunity_id: string | null;
};

const TYPE_TONE: Record<string, string> = {
  call:    "bg-blue-500/15 text-blue-400 border-blue-500/20",
  meeting: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  task:    "bg-amber-500/15 text-amber-400 border-amber-500/20",
  email:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  note:    "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export default function ActivitiesModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("crm_activities")
        .select("id,title,type,due_date,is_done,opportunity_id")
        .eq("is_done", false)
        .order("due_date", { ascending: true })
        .limit(30);
      if (cancelled) return;
      setRows((r.data ?? []) as Activity[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const markDone = async (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
    await supabase.from("crm_activities").update({ is_done: true, completed_at: new Date().toISOString() }).eq("id", id);
  };

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  const today = new Date(); today.setHours(0, 0, 0, 0);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><ActivityIcon className="h-3 w-3" />Upcoming activities</h2>
        <Link href="/crm" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)]">{t("sales.empty.noActivities")}</p>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((a) => {
            const type = (a.type || "task").toLowerCase();
            const tone = TYPE_TONE[type] || TYPE_TONE.task;
            const due = a.due_date ? new Date(a.due_date) : null;
            const isOverdue = due ? due.getTime() < today.getTime() : false;
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors">
                <button
                  type="button"
                  onClick={() => markDone(a.id)}
                  className="h-6 w-6 rounded-full border-2 border-[var(--border-subtle)] hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center text-emerald-400 transition-colors shrink-0"
                  aria-label="Mark done"
                  title="Mark done"
                >
                  <CheckCircleIcon className="h-3 w-3 opacity-0 hover:opacity-100" />
                </button>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider border ${tone} shrink-0`}>{type}</span>
                <p className="flex-1 text-[13px] text-[var(--text-primary)] truncate">{a.title || "Untitled task"}</p>
                <span className={`text-[11px] tabular-nums shrink-0 ${isOverdue ? "text-red-400 font-semibold" : "text-[var(--text-dim)]"}`}>
                  {due ? formatDate(due) : "no date"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
