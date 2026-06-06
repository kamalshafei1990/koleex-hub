"use client";

/* ---------------------------------------------------------------------------
   MyIssuesView — a reporter's own filed issues (issue e3bc4002 follow-up).

   The reporter self-edit feature already lives on /qa/report/[id], but there
   was no browsable surface to REACH it — reporters could only open an issue
   via a direct/notification link. This page lists every report the caller
   filed and links each one to its reporter view (where they can edit while
   the issue is still pre-work). Reporter-safe: the API only returns the
   caller's own issues and never exposes internal/developer fields.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";
import {
  SEVERITY_LABEL,
  STATUS_LABEL,
  PRIORITY_LABEL,
  ISSUE_TYPE_LABEL,
} from "@/lib/qa/types";

interface MyIssue {
  id: string;
  title: string;
  status: string;
  issue_type: string;
  severity: string;
  priority: string;
  app_module: string | null;
  route: string | null;
  reopen_count: number;
  created_at: string;
  updated_at: string | null;
  resolved_at: string | null;
}

const STATUS_TONE: Record<string, string> = {
  new: "bg-[var(--bg-surface-active)] text-[var(--text-secondary)]",
  triaged: "bg-[var(--bg-surface-active)] text-[var(--text-secondary)]",
  needs_more_info: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  in_progress: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  reopened: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  fixed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  verified: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  closed: "bg-[var(--bg-surface-active)] text-[var(--text-dim)]",
};

const OPEN_STATUSES = new Set(["new", "triaged", "needs_more_info", "in_progress", "reopened"]);

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
  catch { return "—"; }
}

export default function MyIssuesView() {
  const { t } = useTranslation(qaT);
  const [issues, setIssues] = useState<MyIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"open" | "all">("open");

  useEffect(() => {
    let alive = true;
    fetch("/api/qa/my-issues", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => { if (alive) setIssues(j.issues ?? []); })
      .catch(() => { if (alive) setError(t("qa.myIssues.loadErr", "Couldn't load your reports.")); });
    return () => { alive = false; };
  }, [t]);

  const shell = "mx-auto max-w-[760px] px-4 py-8 sm:px-6";
  const visible = (issues ?? []).filter((i) => (tab === "open" ? OPEN_STATUSES.has(i.status) : true));
  const openCount = (issues ?? []).filter((i) => OPEN_STATUSES.has(i.status)).length;

  return (
    <div className={shell}>
      {/* Header strip */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Back to Hub"
            >
              <span aria-hidden>←</span>
              <span>{t("qa.reporter.backHub", "Hub")}</span>
            </Link>
            <span className="text-[var(--text-ghost)]" aria-hidden>/</span>
            <span className="font-semibold text-[var(--text-primary)]">{t("qa.myIssues.title", "My Reports")}</span>
          </div>
        </div>
      </div>

      <p className="mb-4 text-[13px] text-[var(--text-dim)]">
        {t("qa.myIssues.subtitle", "Every issue you’ve reported. Open one to follow its progress — or edit it while it’s still being triaged.")}
      </p>

      {/* Tabs */}
      <div className="mb-4 flex gap-1">
        {(["open", "all"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
              tab === k
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {k === "open"
              ? `${t("qa.myIssues.tabOpen", "Open")} (${openCount})`
              : `${t("qa.myIssues.tabAll", "All")} (${(issues ?? []).length})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] px-3 py-3 text-[13px] text-[var(--text-secondary)]">{error}</div>
      )}

      {!error && issues === null && (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-[68px] animate-pulse rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]" />)}
        </div>
      )}

      {!error && issues !== null && visible.length === 0 && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">
          {tab === "open"
            ? t("qa.myIssues.emptyOpen", "You have no open reports.")
            : t("qa.myIssues.emptyAll", "You haven’t reported any issues yet.")}
        </div>
      )}

      <div className="space-y-2">
        {visible.map((i) => (
          <Link
            key={i.id}
            href={`/qa/report/${i.id}`}
            className="block rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 transition-colors hover:bg-[var(--bg-surface-hover)]"
          >
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[i.status] ?? "bg-[var(--bg-surface-active)] text-[var(--text-secondary)]"}`}>
                {t("qa.status." + i.status, STATUS_LABEL[i.status as keyof typeof STATUS_LABEL] ?? i.status)}
              </span>
              <span className="text-[11px] text-[var(--text-dim)]">
                {t("qa.issueType." + i.issue_type, ISSUE_TYPE_LABEL[i.issue_type as keyof typeof ISSUE_TYPE_LABEL] ?? i.issue_type)}
                {" · "}
                {t("qa.severity." + i.severity, SEVERITY_LABEL[i.severity as keyof typeof SEVERITY_LABEL] ?? i.severity)}
                {" · "}
                {t("qa.priority." + i.priority, PRIORITY_LABEL[i.priority as keyof typeof PRIORITY_LABEL] ?? i.priority)}
              </span>
              {i.reopen_count > 0 && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400">↺ {t("qa.reporter.reopenedTimes", "Reopened")} ×{i.reopen_count}</span>
              )}
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-[14px] font-semibold text-[var(--text-primary)]">{i.title}</span>
              <span className="shrink-0 text-[11px] text-[var(--text-dim)]">{fmt(i.created_at)}</span>
            </div>
            {i.app_module && <div className="mt-0.5 text-[11px] text-[var(--text-dim)]">{i.app_module}{i.route ? ` · ${i.route}` : ""}</div>}
          </Link>
        ))}
      </div>
    </div>
  );
}
