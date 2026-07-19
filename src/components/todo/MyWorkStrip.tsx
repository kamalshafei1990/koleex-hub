"use client";

/* ---------------------------------------------------------------------------
   MyWorkStrip — compact cross-app "My Work" summary at the top of the To-do
   app: open project tasks assigned to me + my published schedule for the
   next 7 days. Loads after mount and renders NOTHING while loading or when
   both lists are empty, so it costs the To-do first paint nothing.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import { useTranslation } from "@/lib/i18n";
import { todoT } from "@/lib/translations/todo";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import AutoTranslatedText from "@/components/ui/AutoTranslatedText";

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

export default function MyWorkStrip() {
  const { t, lang } = useTranslation(todoT);
  const [tasks, setTasks] = useState<WorkTask[]>([]);
  const [tasksCount, setTasksCount] = useState(0);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [shiftsCount, setShiftsCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/work", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as {
          tasks: WorkTask[];
          tasksCount: number;
          planning: WorkShift[];
          planningCount: number;
        };
        if (cancelled) return;
        setTasks(json.tasks ?? []);
        setTasksCount(json.tasksCount ?? 0);
        setShifts(json.planning ?? []);
        setShiftsCount(json.planningCount ?? 0);
      } catch {
        /* silent — the strip is optional context, never an error surface */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded || (tasks.length === 0 && shifts.length === 0)) return null;

  const today = new Date().toISOString().slice(0, 10);
  const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString(lang, { weekday: "short", month: "short", day: "numeric" });
  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 mb-3">
      {tasks.length > 0 && (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3">
          <Link href="/projects" className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <BriefcaseIcon size={12} />
            {t("mywork.tasks")}
            <span className="ml-auto font-semibold normal-case tracking-normal">{tasksCount}</span>
          </Link>
          <div className="space-y-1">
            {tasks.map((tk) => {
              const overdue = tk.due_date != null && tk.due_date < today;
              return (
                <Link key={tk.id} href="/projects" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--bg-surface)] transition-colors">
                  <span className="w-1 h-4 rounded-full shrink-0" style={{ background: tk.project?.color ?? "#94a3b8" }} />
                  <span className="text-[12px] text-[var(--text-primary)] truncate flex-1"><AutoTranslatedText text={tk.title} /></span>
                  {tk.due_date && (
                    <span className={`text-[10px] font-semibold shrink-0 ${overdue ? "text-red-400" : "text-[var(--text-dim)]"}`}>
                      {tk.due_date.slice(5)}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {shifts.length > 0 && (
        <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-3">
          <Link href="/planning" className="flex items-center gap-1.5 mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text-primary)]">
            <ClockIcon size={12} />
            {t("mywork.schedule")}
            <span className="ml-auto font-semibold normal-case tracking-normal">{shiftsCount}</span>
          </Link>
          <div className="space-y-1">
            {shifts.map((sh) => (
              <Link key={sh.id} href="/planning" className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--bg-surface)] transition-colors">
                <span className="text-[12px] text-[var(--text-primary)] truncate flex-1">{sh.title ? <AutoTranslatedText text={sh.title} /> : sh.type}</span>
                <span className="text-[10px] font-semibold text-[var(--text-dim)] shrink-0">
                  {fmtDay(sh.start_at)} · {fmtTime(sh.start_at)}–{fmtTime(sh.end_at)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
