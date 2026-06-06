"use client";

/* ---------------------------------------------------------------------------
   QaReportsApp — QA Workflow & Ticketing console (/database/issues, /qa).

   Phase 3 turns the issue list into a lightweight engineering workflow:
   saved views + advanced filters, a priority/assignment/duplicate/reopen
   lifecycle, a threaded discussion, and an activity timeline — without Jira
   bureaucracy. Tenant-scoped + admin-gated by the API. The Copy Debug Prompt
   and component breadcrumbs from earlier phases are preserved verbatim.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { copyText } from "@/lib/ui/clipboard";
import { useScopeContext } from "@/lib/use-scope";
import { useCommentAttachments, AttachmentStrip, AttachmentThumbs } from "@/components/qa/CommentAttachments";
import WatchControl from "@/components/qa/WatchControl";
import ClaudeWorkspaceDrawer from "@/components/qa/ClaudeWorkspaceDrawer";
import {
  SEVERITIES,
  STATUSES,
  PRIORITIES,
  SAVED_VIEWS,
  WORKFLOW_STEPS,
  RESOLVED_STATUSES,
  ISSUE_TYPE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  ACTIVITY_LABEL,
  isClaudeReady,
  type QaReport,
  type QaComment,
  type QaActivity,
  type QaAssignee,
  type IssueStatus,
  type Priority,
  type SavedViewId,
} from "@/lib/qa/types";

/* ── tone maps ─────────────────────────────────────────────────────────── */
const SEVERITY_TONE: Record<string, string> = {
  low: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  medium: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  high: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  critical: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
};
const STATUS_TONE: Record<string, string> = {
  new: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  triaged: "bg-[var(--bg-surface)] text-[var(--text-secondary)]",
  in_progress: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  fixed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  verified: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-200",
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  duplicate: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  needs_more_info: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  closed: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  reopened: "bg-blue-500/15 text-blue-600 dark:text-blue-300",
};
// Priority stays monochrome (brand): urgency reads through weight, not colour.
const PRIORITY_TONE: Record<Priority, string> = {
  low: "bg-[var(--bg-surface)] text-[var(--text-dim)] border border-transparent",
  normal: "bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-transparent",
  high: "bg-transparent text-[var(--text-primary)] border border-[var(--text-muted)]",
  urgent: "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border border-transparent",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}
function rel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24);
  if (day < 30) return `${day}d ago`;
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }); } catch { return ""; }
}
function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

const PILL = "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide";

export default function QaReportsApp({ embedded = false }: { embedded?: boolean }) {
  const scope = useScopeContext();
  const myId = scope?.account_id ?? null;

  const [reports, setReports] = useState<QaReport[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [assigneeFacet, setAssigneeFacet] = useState<{ id: string; name: string }[]>([]);
  const [allAssignees, setAllAssignees] = useState<QaAssignee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Saved view + filters
  const [view, setView] = useState<SavedViewId>("all");
  const [fModule, setFModule] = useState("");
  const [fSeverity, setFSeverity] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fAssignee, setFAssignee] = useState("");
  const [q, setQ] = useState("");
  const [sortPriority, setSortPriority] = useState(false);

  // Saved views translate to concrete query params.
  const viewParams = useMemo(() => {
    const p = new URLSearchParams();
    switch (view) {
      case "my_issues": if (myId) p.set("assignee", myId); break;
      case "urgent": p.set("priority", "urgent"); break;
      case "waiting_verification": p.set("status", "fixed"); break;
      case "ready_for_claude": p.set("claude_ready", "1"); break;
      case "recently_reopened": p.set("status", "reopened"); break;
      default: break;
    }
    return p;
  }, [view, myId]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams(viewParams);
    if (fModule) params.set("module", fModule);
    if (fSeverity) params.set("severity", fSeverity);
    if (fStatus && !params.has("status")) params.set("status", fStatus);
    if (fPriority && !params.has("priority")) params.set("priority", fPriority);
    if (fAssignee && !params.has("assignee")) params.set("assignee", fAssignee);
    if (q.trim()) params.set("q", q.trim());
    try {
      const res = await fetch(`/api/qa/reports?${params}`, { credentials: "include", cache: "no-store" });
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setReports(j.reports ?? []);
      setModules(j.modules ?? []);
      setAssigneeFacet(j.assignees ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load reports.");
    } finally { setLoading(false); }
  }, [viewParams, fModule, fSeverity, fStatus, fPriority, fAssignee, q]);

  useEffect(() => { void load(); }, [load]);

  // A report can be filed from anywhere via the global Report button (a
  // separate component tree). Refresh the list when one is submitted so the
  // new issue shows up immediately instead of being "lost" until reload.
  useEffect(() => {
    const onCreated = () => { void load(); };
    window.addEventListener("qa:issue-created", onCreated);
    return () => window.removeEventListener("qa:issue-created", onCreated);
  }, [load]);

  /* Deep-link from a notification: /database/issues?issue=<id> auto-selects
     the row. useSearchParams is REACTIVE, so clicking another notification
     while already on this page (soft navigation, no remount) re-selects the
     new issue immediately. */
  const searchParams = useSearchParams();
  const issueParam = searchParams.get("issue");
  useEffect(() => {
    if (issueParam) setSelectedId(issueParam);
  }, [issueParam]);

  /* When the selected issue isn't in the loaded list (filtered out, or it
     was deleted), resolve it directly. 404 → graceful "deleted" fallback;
     200 → show it even though the list filter excludes it. */
  const [extra, setExtra] = useState<QaReport | null>(null);
  const [extraMissing, setExtraMissing] = useState(false);
  useEffect(() => {
    if (!selectedId || reports.some((r) => r.id === selectedId)) {
      setExtra(null); setExtraMissing(false);
      return;
    }
    let alive = true;
    setExtraMissing(false);
    fetch(`/api/qa/reports/${selectedId}`, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) { if (alive) setExtraMissing(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((j) => { if (alive && j?.report) setExtra(j.report as QaReport); })
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedId, reports]);

  // Assignee directory for the picker (loaded once).
  useEffect(() => {
    let alive = true;
    fetch("/api/qa/assignees", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { assignees: [] }))
      .then((j) => { if (alive) setAllAssignees(j.assignees ?? []); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const sorted = useMemo(() => {
    if (!sortPriority) return reports;
    return [...reports].sort((a, b) => (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2));
  }, [reports, sortPriority]);

  const selected = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? (extra && extra.id === selectedId ? extra : null),
    [reports, selectedId, extra],
  );

  const onUpdated = useCallback((updated: QaReport) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
    setExtra((prev) => (prev && prev.id === updated.id ? { ...prev, ...updated } : prev));
  }, []);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-[var(--text-dim)]">
        <h1 className="mb-2 text-[18px] font-bold text-[var(--text-primary)]">Issue Reports</h1>
        <p className="text-[13px]">You don’t have access to the QA console. Ask a Super Admin for access.</p>
      </div>
    );
  }

  const selectCls = "h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 text-[12.5px] text-[var(--text-primary)]";

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1500px] px-4 py-6 sm:px-6"}>
      {!embedded && (
        <div className="mb-4">
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">Issue Reports</h1>
          <p className="text-[12.5px] text-[var(--text-dim)]">Report → review → assign → fix → verify → close. A lightweight QA workflow.</p>
        </div>
      )}

      {/* Saved views */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {SAVED_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => { setView(v.id); setSelectedId(null); }}
            disabled={v.id === "my_issues" && !myId}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-40 ${
              view === v.id
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title / description…" className="h-9 min-w-[180px] flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
        <select value={fModule} onChange={(e) => setFModule(e.target.value)} className={selectCls}>
          <option value="">All modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
          <option value="">All status</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className={selectCls}>
          <option value="">All priority</option>
          {PRIORITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={fSeverity} onChange={(e) => setFSeverity(e.target.value)} className={selectCls}>
          <option value="">All severity</option>
          {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className={selectCls}>
          <option value="">All assignees</option>
          <option value="unassigned">Unassigned</option>
          {assigneeFacet.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setSortPriority((v) => !v)}
          className={`h-9 rounded-lg border px-3 text-[12px] font-semibold ${sortPriority ? "border-[var(--accent)] text-[var(--accent)]" : "border-[var(--border-color)] text-[var(--text-secondary)]"}`}
        >
          Sort: {sortPriority ? "Priority" : "Newest"}
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,440px)_1fr]">
        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          {loading ? (
            <div className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">No issues match this view.</div>
          ) : (
            <ul className="max-h-[72vh] divide-y divide-[var(--border-faint)] overflow-y-auto">
              {sorted.map((r) => {
                const ready = isClaudeReady(r);
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelectedId(r.id)} className={`block w-full px-4 py-3 text-left transition-colors ${selectedId === r.id ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
                      <div className="flex items-center gap-2">
                        <span className={`shrink-0 ${PILL} ${SEVERITY_TONE[r.severity]}`}>{SEVERITY_LABEL[r.severity]}</span>
                        <span className={`shrink-0 ${PILL} ${PRIORITY_TONE[r.priority]}`}>{PRIORITY_LABEL[r.priority]}</span>
                        <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{r.title}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]">
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        <span>{ISSUE_TYPE_LABEL[r.issue_type]}</span>
                        <span>· {r.app_module}</span>
                        {r.assigned_to_name && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[var(--text-secondary)]">@{r.assigned_to_name}</span>}
                        {ready && <span className="rounded bg-[var(--accent)]/12 px-1.5 py-0.5 font-semibold text-[var(--accent)]">Claude-ready</span>}
                        {r.duplicate_of_issue_id && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5">dup</span>}
                        {typeof r.comment_count === "number" && r.comment_count > 0 && <span>💬 {r.comment_count}</span>}
                        <span className="ms-auto">{rel(r.created_at)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          {selected ? (
            <ReportDetail
              key={selected.id}
              report={selected}
              assignees={allAssignees}
              allReports={reports}
              myId={myId}
              onUpdated={onUpdated}
              onRefresh={load}
              onJump={(id) => setSelectedId(id)}
            />
          ) : extraMissing ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[18px] text-[var(--text-dim)]">⌀</div>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">This issue no longer exists or was deleted.</p>
              <p className="mt-1 text-[12px] text-[var(--text-dim)]">The notification stays readable, but there’s nothing to open.</p>
            </div>
          ) : selectedId ? (
            <div className="px-6 py-16 text-center text-[13px] text-[var(--text-dim)]">Loading issue…</div>
          ) : (
            <div className="px-6 py-16 text-center text-[13px] text-[var(--text-dim)]">Select an issue to view details, discuss, assign and resolve.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════ Detail + workflow ═══════════════════════════ */

function stepIndex(status: IssueStatus): number {
  switch (status) {
    case "in_progress": return 1;
    case "fixed": return 2;
    case "verified": return 3;
    case "closed": return 4;
    default: return 0; // new / triaged / needs_more_info / reopened
  }
}

function ReportDetail({
  report, assignees, allReports, myId, onUpdated, onRefresh, onJump,
}: {
  report: QaReport;
  assignees: QaAssignee[];
  allReports: QaReport[];
  myId: string | null;
  onUpdated: (r: QaReport) => void;
  onRefresh?: () => void;
  onJump: (id: string) => void;
}) {
  // Bumped after any successful mutation so the Discussion/Activity panels
  // reload (the server writes a timeline event we'd otherwise miss).
  const [refreshKey, setRefreshKey] = useState(0);
  const [status, setStatus] = useState<IssueStatus>(report.status);
  const [notes, setNotes] = useState(report.developer_notes ?? "");
  const [resolution, setResolution] = useState(report.resolution_summary ?? "");
  const [commit, setCommit] = useState(report.fixed_commit ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  useEffect(() => {
    setStatus(report.status);
    setNotes(report.developer_notes ?? "");
    setResolution(report.resolution_summary ?? "");
    setCommit(report.fixed_commit ?? "");
  }, [report]);

  // Generic PATCH helper used by every quick action.
  const patch = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(`/api/qa/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      if (j.report) onUpdated(j.report as QaReport);
      // Reconcile the list (a changed field may now match/violate the active
      // filter) and reload the Discussion/Activity panels (the server logged a
      // new timeline event).
      onRefresh?.();
      setRefreshKey((k) => k + 1);
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save.");
      return false;
    } finally { setBusy(false); }
  }, [report.id, onUpdated, onRefresh]);

  async function saveTriage() {
    setSaving(true); setErr(null); setSaved(false);
    const ok = await patch({ status, developer_notes: notes, resolution_summary: resolution, fixed_commit: commit });
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  }

  async function copyDebugPrompt() {
    // Phase 6: copy the FULL deterministic workspace prompt; fall back to the
    // inline summary if the workspace can't be built.
    try {
      const res = await fetch(`/api/qa/${report.id}/workspace`, { credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.workspace?.generated_prompt) {
        const ok = await copyText(j.workspace.generated_prompt as string);
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
        else setErr("Couldn't copy — open the issue and copy the prompt manually.");
        return;
      }
    } catch { /* fall through to the inline summary */ }
    const lines = [
      `Fix this issue reported in KOLEEX Hub (${report.app_module}).`,
      "",
      `Title: ${report.title}`,
      `Type: ${ISSUE_TYPE_LABEL[report.issue_type]} · Severity: ${SEVERITY_LABEL[report.severity]} · Priority: ${PRIORITY_LABEL[report.priority]}`,
      `Route: ${report.route ?? "—"}`,
      `Page: ${report.page_title ?? "—"}`,
      report.component_name
        ? `Component: ${report.component_name}${report.component_module ? " · module " + report.component_module : ""}${report.component_section ? " · section " + report.component_section : ""}${report.component_record_id ? " · record #" + report.component_record_id : ""}`
        : "Component: (whole page — no specific component selected)",
      "",
      `What happened:\n${report.description ?? "—"}`,
      "",
      `Expected result:\n${report.expected_result ?? "—"}`,
      "",
      `Suggested solution:\n${report.suggested_solution ?? "—"}`,
      "",
      report.screenshot_url ? `Screenshot: ${report.screenshot_url}` : `Screenshot: (none)`,
      "",
      `Environment: ${report.device_info ?? "—"} · ${report.browser_info ?? "—"} · screen ${report.screen_size ?? "—"} · ${report.language ?? "—"} · ${report.timezone ?? "—"}`,
      `Reporter: ${report.reporter_name ?? "—"} (${report.reporter_email ?? "—"})`,
      `Status: ${STATUS_LABEL[report.status]}`,
      `Report ID: ${report.id}`,
    ];
    const ok = await copyText(lines.join("\n"));
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
    else setErr("Couldn't copy — open the issue and copy the prompt manually.");
  }

  const label = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1";
  const box = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap break-words";
  const input = "w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

  const ready = isClaudeReady(report);
  const isResolved = (RESOLVED_STATUSES as string[]).includes(report.status) || report.status === "closed";
  const curStep = stepIndex(report.status);
  const dupTarget = report.duplicate_of_issue_id ? allReports.find((r) => r.id === report.duplicate_of_issue_id) : null;

  return (
    <div className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-4">
      {/* Action error — surfaced at the top so priority/assignee/duplicate/
          reopen failures aren't hidden in a section the user isn't viewing. */}
      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{err}</div>}
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${PILL} ${SEVERITY_TONE[report.severity]}`}>{SEVERITY_LABEL[report.severity]}</span>
        <span className={`${PILL} ${PRIORITY_TONE[report.priority]}`}>{PRIORITY_LABEL[report.priority]} priority</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[report.status]}`}>{STATUS_LABEL[report.status]}</span>
        <span className="text-[11px] text-[var(--text-dim)]">{ISSUE_TYPE_LABEL[report.issue_type]}</span>
        {ready && <span className="rounded bg-[var(--accent)]/12 px-1.5 py-0.5 text-[10px] font-semibold text-[var(--accent)]">Claude-ready</span>}
        {report.duplicate_of_issue_id && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-dim)]">Duplicate</span>}
        {report.reopen_count > 0 && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]">Reopened ×{report.reopen_count}</span>}
        <div className="ms-auto flex items-center gap-2">
          {report.route ? (
            <a href={report.route} target="_blank" rel="noreferrer" className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]">
              Open Route ↗
            </a>
          ) : null}
          <button type="button" onClick={() => setWorkspaceOpen(true)} className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--accent)] hover:bg-[var(--accent)]/15">
            Debug Workspace
          </button>
          <button type="button" onClick={copyDebugPrompt} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]">
            {copied ? "Copied ✓" : "Copy Claude Prompt"}
          </button>
        </div>
      </div>

      {workspaceOpen && (
        <ClaudeWorkspaceDrawer issueId={report.id} onClose={() => setWorkspaceOpen(false)} onJump={onJump} />
      )}

      <h2 className="text-[16px] font-bold text-[var(--text-primary)]">{report.title}</h2>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-dim)]">
        <span><b className="text-[var(--text-secondary)]">Module:</b> {report.app_module}</span>
        <span className="font-mono"><b className="font-sans text-[var(--text-secondary)]">Route:</b> {report.route ?? "—"}</span>
        <span><b className="text-[var(--text-secondary)]">Reporter:</b> {report.reporter_name ?? "—"}</span>
        <span><b className="text-[var(--text-secondary)]">Filed:</b> {fmt(report.created_at)}</span>
      </div>

      {/* Workflow stepper */}
      <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2.5">
        {WORKFLOW_STEPS.map((s, i) => (
          <div key={s.value} className="flex flex-1 items-center gap-1.5">
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
              i < curStep ? "bg-[var(--accent)] text-white"
              : i === curStep ? "bg-[var(--accent)] text-white ring-2 ring-[var(--accent)]/25"
              : "bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-color)]"
            }`}>{i < curStep ? "✓" : i + 1}</div>
            <span className={`text-[11px] ${i <= curStep ? "font-semibold text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>{s.label}</span>
            {i < WORKFLOW_STEPS.length - 1 && <div className={`h-px flex-1 ${i < curStep ? "bg-[var(--accent)]" : "bg-[var(--border-color)]"}`} />}
          </div>
        ))}
      </div>

      {/* Watch / follow */}
      <WatchControl issueId={report.id} showWatchers />

      {/* Quick actions: priority · assignee · duplicate · reopen */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={label}>Priority</label>
          <select
            value={report.priority}
            disabled={busy}
            onChange={(e) => void patch({ priority: e.target.value as Priority })}
            className={input}
          >
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Assigned to</label>
          <AssigneePicker
            assignees={assignees}
            value={report.assigned_to}
            valueName={report.assigned_to_name ?? null}
            myId={myId}
            disabled={busy}
            onChange={(id) => void patch({ assigned_to: id })}
          />
        </div>
      </div>

      <DuplicateControl report={report} allReports={allReports} disabled={busy} onPatch={patch} onJump={onJump} dupTarget={dupTarget ?? null} />

      {isResolved && <ReopenControl disabled={busy} onReopen={(reason) => patch({ action: "reopen", reopen_reason: reason })} />}

      {/* Inspected component breadcrumb (Phase-2, preserved). */}
      {report.component_name && (
        <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.05] px-3.5 py-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            <TargetIcon size={12} className="text-[var(--accent)]" /> Inspected component
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px]">
            {report.component_module && (<><span className="text-[var(--text-secondary)]">{report.component_module}</span><span className="text-[var(--text-ghost)]">→</span></>)}
            {report.component_section && (<><span className="text-[var(--text-secondary)]">{report.component_section}</span><span className="text-[var(--text-ghost)]">→</span></>)}
            <span className="font-semibold text-[var(--text-primary)]">{report.component_name}</span>
            {report.component_record_id && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">#{report.component_record_id}</span>}
          </div>
        </div>
      )}

      {report.screenshot_url && (
        <a href={report.screenshot_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-[var(--border-color)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={report.screenshot_url} alt="screenshot" className="max-h-72 w-full bg-[var(--bg-surface-subtle)] object-contain" />
        </a>
      )}

      <div><div className={label}>What happened</div><div className={box}>{report.description || "—"}</div></div>
      <div><div className={label}>Expected result</div><div className={box}>{report.expected_result || "—"}</div></div>
      <div><div className={label}>Suggested solution</div><div className={box}>{report.suggested_solution || "—"}</div></div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-dim)]">
        <b className="text-[var(--text-secondary)]">Environment</b> — {report.device_info ?? "—"} · screen {report.screen_size ?? "—"} · {report.language ?? "—"} · {report.timezone ?? "—"}
        <div className="mt-1 break-words font-mono text-[10px] opacity-80">{report.browser_info ?? ""}</div>
      </div>

      {/* Triage */}
      <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Triage</div>
        <div>
          <label className={label}>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)} className={input}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>Developer notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={input} placeholder="Investigation notes, root cause…" />
        </div>
        <div>
          <label className={label}>Resolution summary</label>
          <textarea value={resolution} onChange={(e) => setResolution(e.target.value)} rows={2} className={input} placeholder="What was done to fix it" />
        </div>
        <div>
          <label className={label}>Fixed commit</label>
          <input value={commit} onChange={(e) => setCommit(e.target.value)} className={`${input} font-mono`} placeholder="e.g. a5b5481d" />
        </div>
        <div className="flex items-center justify-end gap-2">
          {saved && <span className="text-[12px] text-emerald-500">Saved ✓</span>}
          <button type="button" onClick={saveTriage} disabled={saving} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>

      {/* Discussion + Activity */}
      <CommentsPanel issueId={report.id} myId={myId} refreshKey={refreshKey} />
      <ActivityPanel issueId={report.id} refreshKey={refreshKey} />
    </div>
  );
}

/* ── Searchable assignee picker ───────────────────────────────────────────── */
function AssigneePicker({
  assignees, value, valueName, myId, disabled, onChange,
}: {
  assignees: QaAssignee[];
  value: string | null;
  valueName: string | null;
  myId: string | null;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return assignees;
    return assignees.filter((a) => a.name.toLowerCase().includes(s) || (a.email ?? "").toLowerCase().includes(s));
  }, [assignees, search]);

  const current = value ? (assignees.find((a) => a.id === value)?.name ?? valueName ?? "—") : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-left text-[13px] text-[var(--text-primary)] outline-none hover:border-[var(--accent)] disabled:opacity-50"
      >
        {current ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[9px] font-bold text-[var(--accent)]">{initials(current)}</span>
            <span className="truncate">{current}</span>
          </>
        ) : (
          <span className="text-[var(--text-dim)]">Unassigned</span>
        )}
        <span className="ms-auto text-[var(--text-dim)]">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] shadow-lg">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search people…"
            className="w-full border-b border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
          />
          <ul className="max-h-56 overflow-y-auto py-1">
            <li>
              <button type="button" onClick={() => { onChange(null); setOpen(false); setSearch(""); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)]">
                Unassigned
              </button>
            </li>
            {filtered.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => { onChange(a.id); setOpen(false); setSearch(""); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12.5px] hover:bg-[var(--bg-surface-hover)] ${a.id === value ? "bg-[var(--bg-surface-active)]" : ""}`}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[9px] font-bold text-[var(--accent)]">{initials(a.name)}</span>
                  <span className="truncate text-[var(--text-primary)]">{a.name}{a.id === myId ? " (me)" : ""}</span>
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-[12px] text-[var(--text-dim)]">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Duplicate marking ───────────────────────────────────────────────────── */
function DuplicateControl({
  report, allReports, disabled, onPatch, onJump, dupTarget,
}: {
  report: QaReport;
  allReports: QaReport[];
  disabled?: boolean;
  onPatch: (b: Record<string, unknown>) => Promise<boolean>;
  onJump: (id: string) => void;
  dupTarget: QaReport | null;
}) {
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");

  if (report.duplicate_of_issue_id) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px]">
        <span className="text-[var(--text-dim)]">Duplicate of</span>
        <button type="button" onClick={() => dupTarget && onJump(dupTarget.id)} className="truncate font-semibold text-[var(--accent)] hover:underline">
          {dupTarget ? dupTarget.title : report.duplicate_of_issue_id}
        </button>
        <button type="button" disabled={disabled} onClick={() => void onPatch({ duplicate_of_issue_id: null })} className="ms-auto text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          Unlink
        </button>
      </div>
    );
  }

  const candidates = allReports.filter((r) => r.id !== report.id);
  const s = search.trim().toLowerCase();
  const filtered = s ? candidates.filter((r) => r.title.toLowerCase().includes(s)) : candidates.slice(0, 8);

  return (
    <div>
      {!picking ? (
        <button type="button" disabled={disabled} onClick={() => setPicking(true)} className="text-[12px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          + Mark as duplicate
        </button>
      ) : (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Duplicate of…</span>
            <button type="button" onClick={() => { setPicking(false); setSearch(""); }} className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">Cancel</button>
          </div>
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search issues…" className="mb-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none" />
          <ul className="max-h-40 overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id}>
                <button type="button" disabled={disabled} onClick={async () => { const ok = await onPatch({ duplicate_of_issue_id: r.id }); if (ok) { setPicking(false); setSearch(""); } }} className="block w-full truncate px-2 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
                  {r.title}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-1.5 text-[12px] text-[var(--text-dim)]">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Reopen ──────────────────────────────────────────────────────────────── */
function ReopenControl({ disabled, onReopen }: { disabled?: boolean; onReopen: (reason: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div>
      {!open ? (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]">
          ↻ Reopen issue
        </button>
      ) : (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">Why reopen?</div>
          <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Reason (preserved on the timeline)…" className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none" />
          <div className="mt-1.5 flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setReason(""); }} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">Cancel</button>
            <button type="button" disabled={disabled} onClick={async () => { const ok = await onReopen(reason.trim()); if (ok) { setOpen(false); setReason(""); } }} className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-[12px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              Reopen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Comments / discussion ───────────────────────────────────────────────── */
function CommentsPanel({ issueId, myId, refreshKey = 0 }: { issueId: string; myId: string | null; refreshKey?: number }) {
  const [comments, setComments] = useState<QaComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [posting, setPosting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const att = useCommentAttachments();

  const load = useCallback(async () => {
    setLoading(true); setLoadErr(null);
    try {
      const res = await fetch(`/api/qa/reports/${issueId}/comments`, { credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) setComments(j.comments ?? []);
      else setLoadErr(humanizeError(j.error ?? `HTTP ${res.status}`));
    } catch {
      setLoadErr("Couldn't load the discussion.");
    } finally { setLoading(false); }
  }, [issueId]);
  // Reload on mount, on issue change, and after any detail mutation (refreshKey).
  useEffect(() => { void load(); }, [load, refreshKey]);

  async function post() {
    const message = text.trim();
    if (!message && att.count === 0) return;
    setPosting(true); setErr(null);
    try {
      const res = await fetch(`/api/qa/reports/${issueId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, is_internal_note: internal, attachments: att.payload() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      if (j.comment) setComments((prev) => [...prev, j.comment as QaComment]);
      setText(""); setInternal(false); att.clear();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't post.");
    } finally { setPosting(false); }
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Discussion{comments.length > 0 ? ` · ${comments.length}` : ""}</div>

      {loading ? (
        <div className="py-3 text-center text-[12px] text-[var(--text-dim)]">Loading…</div>
      ) : loadErr ? (
        <div className="py-3 text-center text-[12px] text-rose-500 dark:text-rose-300">{loadErr}</div>
      ) : comments.length === 0 ? (
        <div className="py-3 text-center text-[12px] text-[var(--text-dim)]">No comments yet. Start the thread below.</div>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className={`rounded-lg border px-3 py-2 ${c.is_internal_note ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"} ${c.user_id === myId ? "ms-6" : "me-6"}`}>
              <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)]/15 text-[8px] font-bold text-[var(--accent)]">{initials(c.user_name)}</span>
                <span className="font-semibold text-[var(--text-secondary)]">{c.user_name ?? "—"}</span>
                {c.user_role && <span className="rounded bg-[var(--bg-surface)] px-1 text-[9px] text-[var(--text-dim)]">{c.user_role}</span>}
                {c.is_internal_note && <span className="rounded bg-amber-500/20 px-1 text-[9px] font-semibold text-amber-600 dark:text-amber-300">Internal</span>}
                <span className="ms-auto text-[var(--text-dim)]">{rel(c.created_at)}{c.edited_at ? " · edited" : ""}</span>
              </div>
              {c.message && <div className="whitespace-pre-wrap break-words text-[12.5px] text-[var(--text-primary)]">{c.message}</div>}
              <AttachmentThumbs attachments={c.attachments ?? []} internal={c.is_internal_note} />
            </li>
          ))}
        </ul>
      )}

      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11.5px] text-rose-500 dark:text-rose-300">{err}</div>}

      <div className="space-y-1.5 pt-1" onDrop={att.onDrop} onDragOver={att.onDragOver}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={att.onPaste}
          onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void post(); }}
          rows={2}
          placeholder="Write a reply…  (paste/drop an image · ⌘/Ctrl+Enter to send)"
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
        />
        <AttachmentStrip att={att} disabled={posting} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            Internal note
          </label>
          <button type="button" onClick={post} disabled={posting || (!text.trim() && att.count === 0)} className="ms-auto rounded-lg bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-40">
            {posting ? "Posting…" : "Comment"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Activity timeline ───────────────────────────────────────────────────── */
function ActivityPanel({ issueId, refreshKey = 0 }: { issueId: string; refreshKey?: number }) {
  const [activity, setActivity] = useState<QaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  // Reload on mount, on issue change, and after any detail mutation (refreshKey)
  // so the freshly-logged timeline event shows without reopening the issue.
  useEffect(() => {
    let alive = true;
    setLoading(true); setLoadErr(null);
    fetch(`/api/qa/reports/${issueId}/activity`, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) { if (alive) setLoadErr("Couldn't load the activity timeline."); return { activity: [] }; }
        return r.json();
      })
      .then((j) => { if (alive) setActivity(j.activity ?? []); })
      .catch(() => { if (alive) setLoadErr("Couldn't load the activity timeline."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [issueId, refreshKey]);

  function describe(a: QaActivity): string {
    const verb = ACTIVITY_LABEL[a.activity_type] ?? a.activity_type;
    switch (a.activity_type) {
      case "status_changed": return `${verb} → ${STATUS_LABEL[a.new_value as IssueStatus] ?? a.new_value}`;
      case "priority_changed": return `${verb} → ${PRIORITY_LABEL[a.new_value as Priority] ?? a.new_value}`;
      case "assigned": return `${verb} to ${(a.metadata?.assignee_name as string) ?? "someone"}`;
      case "commit_added": return `${verb} ${a.new_value ?? ""}`;
      case "reopened": return a.metadata?.reason ? `${verb}: ${a.metadata.reason as string}` : verb;
      default: return verb;
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">Activity</div>
      {loading ? (
        <div className="py-2 text-center text-[12px] text-[var(--text-dim)]">Loading…</div>
      ) : loadErr ? (
        <div className="py-2 text-center text-[12px] text-rose-500 dark:text-rose-300">{loadErr}</div>
      ) : activity.length === 0 ? (
        <div className="py-2 text-center text-[12px] text-[var(--text-dim)]">No activity yet.</div>
      ) : (
        <ol className="space-y-1.5">
          {activity.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-[12px]">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]/50" />
              <span className="text-[var(--text-secondary)]">
                <b className="font-semibold text-[var(--text-primary)]">{a.actor_name ?? "Someone"}</b> {describe(a)}
                <span className="ms-1.5 text-[var(--text-dim)]">· {rel(a.created_at)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
