"use client";

/* ---------------------------------------------------------------------------
   QaReportsApp — admin console for QA issue reports (/qa).

   Master/detail: filterable list on the left, full detail + triage on the
   right. Admins can change status, add developer notes / resolution summary /
   fixed commit, view the screenshot, and copy a ready-to-paste "Debug Prompt"
   for Claude Code. Tenant-scoped + admin-gated by the API.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  SEVERITIES,
  STATUSES,
  ISSUE_TYPE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  type QaReport,
  type IssueStatus,
} from "@/lib/qa/types";

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
  rejected: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  duplicate: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  needs_more_info: "bg-amber-500/12 text-amber-600 dark:text-amber-300",
  closed: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch { return iso; }
}

export default function QaReportsApp({ embedded = false }: { embedded?: boolean }) {
  const [reports, setReports] = useState<QaReport[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [fModule, setFModule] = useState("");
  const [fSeverity, setFSeverity] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const params = new URLSearchParams();
    if (fModule) params.set("module", fModule);
    if (fSeverity) params.set("severity", fSeverity);
    if (fStatus) params.set("status", fStatus);
    if (q.trim()) params.set("q", q.trim());
    try {
      const res = await fetch(`/api/qa/reports?${params}`, { credentials: "include", cache: "no-store" });
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setReports(j.reports ?? []);
      setModules(j.modules ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load reports.");
    } finally { setLoading(false); }
  }, [fModule, fSeverity, fStatus, q]);

  useEffect(() => { void load(); }, [load]);

  const selected = useMemo(() => reports.find((r) => r.id === selectedId) ?? null, [reports, selectedId]);

  const onUpdated = useCallback((updated: QaReport) => {
    setReports((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  }, []);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-[var(--text-dim)]">
        <h1 className="mb-2 text-[18px] font-bold text-[var(--text-primary)]">Issue Reports</h1>
        <p className="text-[13px]">You don’t have access to the QA console. Ask a Super Admin for access.</p>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1400px] px-4 py-6 sm:px-6"}>
      {!embedded && (
        <div className="mb-4">
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">Issue Reports</h1>
          <p className="text-[12.5px] text-[var(--text-dim)]">Bugs, UI issues and suggestions submitted from across the Hub.</p>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title / description…" className="h-9 min-w-[200px] flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]" />
        <select value={fModule} onChange={(e) => setFModule(e.target.value)} className="h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 text-[12.5px] text-[var(--text-primary)]">
          <option value="">All modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fSeverity} onChange={(e) => setFSeverity(e.target.value)} className="h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 text-[12.5px] text-[var(--text-primary)]">
          <option value="">All severity</option>
          {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 text-[12.5px] text-[var(--text-primary)]">
          <option value="">All status</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {error && <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,420px)_1fr]">
        {/* List */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          {loading ? (
            <div className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">Loading…</div>
          ) : reports.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">No reports match your filters.</div>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-[var(--border-faint)] overflow-y-auto">
              {reports.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSelectedId(r.id)} className={`block w-full px-4 py-3 text-left transition-colors ${selectedId === r.id ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${SEVERITY_TONE[r.severity]}`}>{SEVERITY_LABEL[r.severity]}</span>
                      <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">{r.title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]">
                      <span className={`rounded px-1.5 py-0.5 font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                      <span>{ISSUE_TYPE_LABEL[r.issue_type]}</span>
                      <span>· {r.app_module}</span>
                      <span className="ms-auto">{fmt(r.created_at)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          {selected ? (
            <ReportDetail key={selected.id} report={selected} onUpdated={onUpdated} />
          ) : (
            <div className="px-6 py-16 text-center text-[13px] text-[var(--text-dim)]">Select a report to view details.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportDetail({ report, onUpdated }: { report: QaReport; onUpdated: (r: QaReport) => void }) {
  const [status, setStatus] = useState<IssueStatus>(report.status);
  const [notes, setNotes] = useState(report.developer_notes ?? "");
  const [resolution, setResolution] = useState(report.resolution_summary ?? "");
  const [commit, setCommit] = useState(report.fixed_commit ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setStatus(report.status);
    setNotes(report.developer_notes ?? "");
    setResolution(report.resolution_summary ?? "");
    setCommit(report.fixed_commit ?? "");
  }, [report]);

  async function save() {
    setSaving(true); setErr(null); setSaved(false);
    try {
      const res = await fetch(`/api/qa/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, developer_notes: notes, resolution_summary: resolution, fixed_commit: commit }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      if (j.report) onUpdated(j.report as QaReport);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save.");
    } finally { setSaving(false); }
  }

  function copyDebugPrompt() {
    const lines = [
      `Fix this issue reported in KOLEEX Hub (${report.app_module}).`,
      "",
      `Title: ${report.title}`,
      `Type: ${ISSUE_TYPE_LABEL[report.issue_type]} · Severity: ${SEVERITY_LABEL[report.severity]}`,
      `Route: ${report.route ?? "—"}`,
      `Page: ${report.page_title ?? "—"}`,
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
    const text = lines.join("\n");
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }).catch(() => { setErr("Clipboard blocked — select & copy manually."); });
  }

  const label = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1";
  const box = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap break-words";
  const input = "w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

  return (
    <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_TONE[report.severity]}`}>{SEVERITY_LABEL[report.severity]}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[report.status]}`}>{STATUS_LABEL[report.status]}</span>
        <span className="text-[11px] text-[var(--text-dim)]">{ISSUE_TYPE_LABEL[report.issue_type]}</span>
        <button type="button" onClick={copyDebugPrompt} className="ms-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]">
          {copied ? "Copied ✓" : "Copy Debug Prompt"}
        </button>
      </div>

      <h2 className="text-[16px] font-bold text-[var(--text-primary)]">{report.title}</h2>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-dim)]">
        <span><b className="text-[var(--text-secondary)]">Module:</b> {report.app_module}</span>
        <span className="font-mono"><b className="font-sans text-[var(--text-secondary)]">Route:</b> {report.route ?? "—"}</span>
        <span><b className="text-[var(--text-secondary)]">Reporter:</b> {report.reporter_name ?? "—"}</span>
        <span><b className="text-[var(--text-secondary)]">Filed:</b> {fmt(report.created_at)}</span>
      </div>

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
        {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{err}</div>}
        <div className="flex items-center justify-end gap-2">
          {saved && <span className="text-[12px] text-emerald-500">Saved ✓</span>}
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
