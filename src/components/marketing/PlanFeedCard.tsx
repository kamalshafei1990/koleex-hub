"use client";

/* ---------------------------------------------------------------------------
   PlanFeedCard — the week's plan in one line on the Feed (owner, 29/09/2026):
   how far it has come, or that it waits for approval, and the way to it.

   One fixed-height line from its first frame — a skeleton until the plan
   arrives — so nothing on the Feed moves when it fills in. It shares the
   Plan tab's session copy (painted at once when there is one) and asks the
   server only once the Feed's own requests are done.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import ProgressBar from "@/components/kds/ProgressBar";
import StatusPill from "@/components/kds/StatusPill";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { whenNetworkQuiet } from "@/lib/net-idle";
import { SPACE_PLAN, type MarketingSpace } from "@/lib/marketing/spaces";
import { planCacheKey, readLastWeek, readPlanCache, writeLastWeek, writePlanCache, type PlanResponse } from "@/lib/marketing/plan-cache";

/* Its own few words: the Plan tab's dictionary stays out of the Feed. */
const T: Translations = {
  "title":  { en: "This week's plan", zh: "本周计划", ar: "خطة الأسبوع" },
  "none":   { en: "No plan yet — Koleex AI drafts it on Monday", zh: "尚无计划——Koleex AI 将在周一起草", ar: "لا توجد خطة بعد — يُعدّها Koleex AI يوم الاثنين" },
  "draft":  { en: "Waiting for approval", zh: "待审批", ar: "في انتظار الموافقة" },
  "tasks":  { en: "{total} tasks", zh: "{total} 项任务", ar: "{total} مهام" },
  "doneOf": { en: "{done} of {total} done", zh: "已完成 {done}/{total}", ar: "تم {done} من {total}" },
  "open":   { en: "Open the plan", zh: "打开计划", ar: "افتح الخطة" },
};

export default function PlanFeedCard({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(T);
  const [data, setData] = useState<PlanResponse | null>(() => {
    if (typeof window === "undefined") return null;
    const last = readLastWeek(space);
    return last ? readPlanCache(planCacheKey(space, last)) : null;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void whenNetworkQuiet().then(async () => {
      if (!alive) return;
      try {
        const res = await fetch(`/api/marketing/plan?space=${space}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as PlanResponse;
        writePlanCache(planCacheKey(space, body.week), body);
        writeLastWeek(space, body.week);
        if (alive) setData(body);
      } catch {
        if (alive) setFailed(true);
      }
    });
    return () => { alive = false; };
  }, [space]);

  const plan = data?.plan ?? null;
  let line: React.ReactNode;
  if (!data) {
    line = failed ? null : <span aria-hidden="true" className="h-3 w-40 max-w-full rounded-full bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />;
  } else if (!plan) {
    line = <span className="truncate">{t("none")}</span>;
  } else if (plan.status === "draft") {
    line = (
      <>
        <StatusPill tone="warning">{t("draft")}</StatusPill>
        <span className="truncate tabular-nums">{t("tasks").replace("{total}", String(plan.total))}</span>
      </>
    );
  } else {
    line = (
      <>
        <span className="shrink-0 tabular-nums">{t("doneOf").replace("{done}", String(plan.done)).replace("{total}", String(plan.total))}</span>
        <ProgressBar value={plan.total ? plan.done / plan.total : 0} className="hidden w-24 shrink-0 sm:block" />
      </>
    );
  }

  return (
    <Link
      href={SPACE_PLAN[space]}
      className="flex h-[52px] min-w-0 items-center gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 text-[13px] transition-colors hover:border-[var(--border-focus)]"
    >
      <ClipboardCheckIcon size={16} className="shrink-0 text-[var(--text-muted)]" />
      <span className="shrink-0 font-semibold text-[var(--text-primary)]">{t("title")}</span>
      <span className="flex min-w-0 flex-1 items-center gap-3 text-[var(--text-muted)]">{line}</span>
      <span className="hidden shrink-0 text-[12px] font-semibold text-[var(--text-muted)] sm:inline">{t("open")}</span>
      <AngleRightIcon size={12} className="shrink-0 text-[var(--text-dim)] rtl:rotate-180" />
    </Link>
  );
}
