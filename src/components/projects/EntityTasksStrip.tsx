"use client";

/* ---------------------------------------------------------------------------
   EntityTasksStrip — compact "Tasks" card any detail page can drop in to
   show project tasks linked to that record.

     <EntityTasksStrip entityType="customer" entityId={customer.id} />

   Mirrors the shape of EntityPlanningStrip so detail pages get a
   consistent pair of strips: upcoming Planning items + related
   Project Tasks.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import ProjectsIcon from "@/components/icons/ProjectsIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import {
  fetchTasks,
  formatDueDate,
  isOverdue,
  PRIORITY_COLOR,
  type TaskRow,
} from "@/lib/projects";

export default function EntityTasksStrip({
  entityType,
  entityId,
  openOnly = true,
  limit = 5,
  title = "Project tasks",
}: {
  entityType: string;
  entityId: string;
  openOnly?: boolean;
  limit?: number;
  title?: string;
}) {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);

  useEffect(() => {
    if (!entityId) return;
    let cancelled = false;
    fetchTasks({
      linked_entity_type: entityType,
      linked_entity_id: entityId,
      status: openOnly ? "open" : "all",
    }).then((rows) => {
      if (!cancelled) setTasks(rows.slice(0, limit));
    });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, openOnly, limit]);

  if (tasks === null) {
    return (
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] p-4 flex items-center gap-2">
        <SpinnerIcon className="h-4 w-4 text-[var(--text-dim)] animate-spin" />
        <span className="text-[12px] text-[var(--text-dim)]">Loading tasks…</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <ProjectsIcon size={14} className="text-[var(--text-dim)]" />
          <h3 className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {title}
          </h3>
          <span className="text-[10px] font-semibold text-[var(--text-ghost)] bg-[var(--bg-surface)] px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        <Link
          href="/projects"
          className="text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1"
        >
          Open
          <ExternalLinkIcon size={10} />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="px-4 py-5 text-[12px] text-[var(--text-dim)] text-center">
          No tasks linked to this record.
        </div>
      ) : (
        <div className="divide-y divide-[var(--border-subtle)]">
          {tasks.map((tk) => {
            const due = formatDueDate(tk.due_date);
            const overdue = isOverdue(tk.due_date) && tk.status === "open";
            return (
              <div key={tk.id} className="flex items-center gap-3 px-4 py-2.5">
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
                      style={{ background: tk.project?.color ?? "#818cf8" }}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
