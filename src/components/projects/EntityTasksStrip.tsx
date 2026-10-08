"use client";

/* ---------------------------------------------------------------------------
   EntityTasksStrip — compact "Tasks" card any detail page can drop in to
   show project tasks linked to that record.

     <EntityTasksStrip entityType="customer" entityId={customer.id} />

   Mirrors the shape of EntityPlanningStrip so detail pages get a
   consistent pair of strips: upcoming Planning items + related
   Project Tasks. Each row deep-links to its task on the project board
   (/projects?project=…&task=…). The request carries `limit`, so the
   server returns only the rows the strip shows.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { projectsT } from "@/lib/translations/projects";
import ProjectsIcon from "@/components/icons/ProjectsIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import {
  fetchTasks,
  formatDueDate,
  isOverdue,
  projectLink,
  PRIORITY_COLOR,
  type TaskRow,
} from "@/lib/projects";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

export default function EntityTasksStrip({
  entityType,
  entityId,
  openOnly = true,
  limit = 5,
  title,
}: {
  entityType: string;
  entityId: string;
  openOnly?: boolean;
  limit?: number;
  title?: string;
}) {
  const { t, lang } = useTranslation(projectsT);
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetchTasks({
      linked_entity_type: entityType,
      linked_entity_id: entityId,
      status: openOnly ? "open" : "all",
      limit,
    })
      .then((rows) => { if (!cancelled) { setTasks(rows.slice(0, limit)); setFailed(false); } })
      .catch(() => { if (!cancelled) { setTasks([]); setFailed(true); } });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, openOnly, limit]);

  const heading = title ?? t("strip.title");

  if (tasks === null) {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center gap-2">
        <SpinnerIcon className="h-4 w-4 text-[var(--text-dim)]" />
        <span className="text-[12px] text-[var(--text-dim)]">{t("strip.loading")}</span>
      </div>
    );
  }

  const dueLabels = { today: t("date.today"), tomorrow: t("date.tomorrow"), yesterday: t("date.yesterday") };

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <ProjectsIcon size={14} className="text-[var(--text-dim)]" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {heading}
          </h3>
          <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Link
          href="/projects"
          className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          {t("strip.open")}
          <ExternalLinkIcon size={10} className="rtl:-scale-x-100" />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="px-4 py-5 text-[12px] text-[var(--text-dim)] text-center">
          {failed ? t("error.load") : t("strip.empty")}
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {tasks.map((tk) => {
            const due = formatDueDate(tk.due_date, lang, dueLabels);
            const overdue = isOverdue(tk.due_date) && tk.status === "open";
            return (
              <Link
                key={tk.id}
                href={projectLink(tk.project_id, tk.id)}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--bg-surface-subtle)] transition-colors"
              >
                <div
                  className="w-1 h-8 rounded-full shrink-0"
                  style={{ background: PRIORITY_COLOR[tk.priority] }}
                />
                <div className="flex-1 min-w-0">
                  <div className={`text-[12px] font-semibold truncate ${tk.status === "done" ? "line-through opacity-60" : "text-[var(--text-primary)]"}`}>
                    {tk.title}
                  </div>
                  <div className="text-[10px] text-[var(--text-dim)] truncate flex items-center gap-1.5">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: tk.project?.color ?? "#567FB2" }}
                    />
                    {tk.project?.name ?? "—"}
                    {due && (
                      <span className={`ms-1 ${overdue ? "text-rose-400" : ""}`}>
                        · {due}
                      </span>
                    )}
                  </div>
                </div>
                {tk.assignee?.username && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]">
                    @{tk.assignee.username}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
