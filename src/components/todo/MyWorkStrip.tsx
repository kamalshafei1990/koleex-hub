"use client";

/* ---------------------------------------------------------------------------
   MyWorkStrip — cross-app "My Work" beside the to-do list: open project tasks
   assigned to me + my published schedule for the next 7 days.

   Warm-started (shared warm cache), so on every visit after the first it is
   on the first frame instead of arriving late and shoving the list down. It
   renders nothing while cold-loading or when both lists are empty, and it
   sits in the scrolling area — not the fixed header, where it used to eat a
   phone's screen before the first task.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import { useWarmData } from "@/lib/warm-cache";
import { useCurrentAccountId } from "@/lib/identity";
import { fmtDay, isOverdueDate, isoDay, todoLocale } from "./todo-dates";

interface WorkTask {
  id: string;
  title: string;
  due_date: string | null;
  priority: string;
  project?: { name?: string | null; color?: string | null } | null;
}
interface WorkShift {
  id: string;
  type: string;
  title: string | null;
  start_at: string;
  end_at: string;
}
interface Work { tasks: WorkTask[]; tasksCount: number; planning: WorkShift[]; planningCount: number }

async function loadWork(): Promise<Work> {
  /* Coalesced (SYS-2): the sidebar badge loader asks for the same URL. */
  const { cachedGet } = await import("@/lib/client-cache");
  const json = await cachedGet<Partial<Work>>("/api/me/work", 15_000);
  return {
    tasks: json.tasks ?? [],
    tasksCount: json.tasksCount ?? 0,
    planning: json.planning ?? [],
    planningCount: json.planningCount ?? 0,
  };
}

const card = "kx-glass rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3 min-w-0";
const head = "flex items-center gap-1.5 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text-primary)] rounded-md";
const row = "flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--bg-surface)] transition-colors min-w-0";

export default function MyWorkStrip() {
  const { t, lang } = useTranslation(todoT);
  const accountId = useCurrentAccountId();
  const { data } = useWarmData<Work>(accountId ? `todo:mywork:${accountId}` : "", loadWork);
  if (!data || (data.tasks.length === 0 && data.planning.length === 0)) return null;

  const time = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString(todoLocale(lang), { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    } catch { return ""; }
  };
  const weekday = (iso: string) => {
    try { return new Date(iso).toLocaleDateString(todoLocale(lang), { weekday: "short" }); } catch { return ""; }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 [&>*]:min-w-0">
      {data.tasks.length > 0 && (
        <div className={card}>
          <Link href="/projects" className={head}>
            <BriefcaseIcon size={12} />
            {t("mywork.tasks")}
            <span className="ms-auto font-semibold normal-case tracking-normal tabular-nums">{data.tasksCount}</span>
          </Link>
          <div className="space-y-0.5">
            {data.tasks.slice(0, 4).map((tk) => (
              <Link key={tk.id} href="/projects" className={row}>
                <span className="w-1 h-4 rounded-full shrink-0" style={{ background: tk.project?.color ?? "#94a3b8" }} />
                <span className="text-[12px] text-[var(--text-primary)] truncate flex-1"><AutoTranslatedText text={tk.title} plain /></span>
                {tk.due_date && (
                  <span className={`text-[10px] font-semibold shrink-0 ${isOverdueDate(tk.due_date) ? "text-red-400" : "text-[var(--text-dim)]"}`}>
                    {fmtDay(tk.due_date, lang)}
                  </span>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
      {data.planning.length > 0 && (
        <div className={card}>
          <Link href="/planning" className={head}>
            <ClockIcon size={12} />
            {t("mywork.schedule")}
            <span className="ms-auto font-semibold normal-case tracking-normal tabular-nums">{data.planningCount}</span>
          </Link>
          <div className="space-y-0.5">
            {data.planning.slice(0, 4).map((sh) => (
              <Link key={sh.id} href="/planning" className={row}>
                <span className="text-[12px] text-[var(--text-primary)] truncate flex-1">{sh.title ? <AutoTranslatedText text={sh.title} plain /> : sh.type}</span>
                <span className="text-[10px] font-semibold text-[var(--text-dim)] shrink-0 tabular-nums">
                  {weekday(sh.start_at)} {fmtDay(isoDay(new Date(sh.start_at)), lang)} · {time(sh.start_at)}–{time(sh.end_at)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
