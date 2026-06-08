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
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";
import TargetIcon from "@/components/icons/ui/TargetIcon";
import { humanizeError } from "@/lib/ui/humanize-error";
import { copyText } from "@/lib/ui/clipboard";
import { useScopeContext } from "@/lib/use-scope";
import { useCommentAttachments, AttachmentStrip, AttachmentThumbs } from "@/components/qa/CommentAttachments";
import WatchControl from "@/components/qa/WatchControl";
import ClaudeWorkspaceDrawer from "@/components/qa/ClaudeWorkspaceDrawer";
import FixEvidenceSection from "@/components/qa/FixEvidenceSection";
import FixEvidenceForm from "@/components/qa/FixEvidenceForm";
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
/* Status visualization. Two coordinated layers that make state readable from
 * across the room (Kamal — issue f548b45e follow-up):
 *   1. STATUS_STRIPE — a 3px coloured bar on the LEFT edge of every list row.
 *      The eye locks on shape + position, so a glance down the list tells you
 *      counts/clusters of each state without reading any text.
 *   2. STATUS_TONE — the pill itself: saturated bg + light text, bigger and
 *      bolder than before, moved BEFORE the title in the row so it anchors
 *      the line. */
const STATUS_TONE: Record<string, string> = {
  new:             "bg-blue-600 text-white",
  triaged:         "bg-slate-500 text-white",
  in_progress:     "bg-amber-500 text-black",
  fixed:           "bg-emerald-600 text-white",
  verified:        "bg-emerald-700 text-white",
  rejected:        "bg-rose-600 text-white",
  duplicate:       "bg-violet-600 text-white",
  needs_more_info: "bg-yellow-500 text-black",
  closed:          "bg-zinc-500 text-white",
  reopened:        "bg-red-600 text-white",
};
const STATUS_STRIPE: Record<string, string> = {
  new:             "bg-blue-500",
  triaged:         "bg-slate-400",
  in_progress:     "bg-amber-500",
  fixed:           "bg-emerald-500",
  verified:        "bg-emerald-600",
  rejected:        "bg-rose-500",
  duplicate:       "bg-violet-500",
  needs_more_info: "bg-yellow-500",
  closed:          "bg-zinc-400",
  reopened:        "bg-red-500",
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

/* Days since creation — used both for sort comparison and for the age tone. */
function ageDays(iso: string | null): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return (Date.now() - t) / 86400000;
}
/* Color-coded age tone: fresh (green) → amber → red. RESOLVED issues are
   muted regardless of age. */
function ageTone(d: number, resolved: boolean): string {
  if (resolved) return "bg-[var(--bg-surface)] text-[var(--text-dim)]";
  if (d <= 2) return "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300";
  if (d <= 7) return "bg-amber-500/15 text-amber-600 dark:text-amber-300";
  return "bg-rose-500/15 text-rose-600 dark:text-rose-300";
}
function ageLabel(d: number): string {
  if (d < 1) return "<1d";
  return `${Math.floor(d)}d`;
}

export default function QaReportsApp({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation(qaT);
  const scope = useScopeContext();
  const myId = scope?.account_id ?? null;

  const [reports, setReports] = useState<QaReport[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [assigneeFacet, setAssigneeFacet] = useState<{ id: string; name: string }[]>([]);
  const [reporterFacet, setReporterFacet] = useState<{ id: string; name: string }[]>([]);
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
  const [fReporter, setFReporter] = useState("");
  const [q, setQ] = useState("");
  const [searchFocus, setSearchFocus] = useState(false);
  const [sortPriority, setSortPriority] = useState(false);

  // Selection set for bulk operations. Stable Set so we don't reallocate
  // the array on every toggle; reset whenever the filter results change.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // View mode — list (master/detail) or board (kanban-style by status).
  const [boardView, setBoardView] = useState(false);

  // URL-persistent filter / view state — read once on mount, replaced on
  // every change so refreshing or sharing the link reproduces the view.
  const router = useRouter();
  const pageRoute = usePathname() ?? "/database/issues";
  const initFromUrlRef = useRef(false);

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

  // Keep a ref to the AbortController of the in-flight fetch so a fresh
  // load() can cancel the stale one. Without this, a slow earlier fetch
  // can resolve AFTER a successful newer fetch and overwrite good state
  // with an error (we used to see a sticky "Not signed in" banner over
  // already-loaded data because of this race in dev / Strict Mode).
  const loadAbortRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    // Cancel any in-flight call so its late response can't clobber us.
    loadAbortRef.current?.abort();
    const ac = new AbortController();
    loadAbortRef.current = ac;

    setLoading(true); setError(null);
    const params = new URLSearchParams(viewParams);
    if (fModule) params.set("module", fModule);
    if (fSeverity) params.set("severity", fSeverity);
    if (fStatus && !params.has("status")) params.set("status", fStatus);
    if (fPriority && !params.has("priority")) params.set("priority", fPriority);
    if (fAssignee && !params.has("assignee")) params.set("assignee", fAssignee);
    if (fReporter && !params.has("reporter")) params.set("reporter", fReporter);
    if (q.trim()) params.set("q", q.trim());

    // One transparent retry on 401 — the auth cookie is sometimes a beat
    // behind a soft navigation / view-as switch, so a single retry after
    // a tiny delay turns a flash-of-failure into a successful load.
    const doFetch = (): Promise<Response> =>
      fetch(`/api/qa/reports?${params}`, { credentials: "include", cache: "no-store", signal: ac.signal });

    try {
      let res = await doFetch();
      if (res.status === 401 && !ac.signal.aborted) {
        await new Promise((r) => setTimeout(r, 350));
        if (ac.signal.aborted) return;
        res = await doFetch();
      }
      if (ac.signal.aborted) return;
      if (res.status === 403) { setForbidden(true); setLoading(false); return; }
      const j = await res.json();
      if (ac.signal.aborted) return;
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setReports(j.reports ?? []);
      setModules(j.modules ?? []);
      setAssigneeFacet(j.assignees ?? []);
      setReporterFacet(j.reporters ?? []);
    } catch (e) {
      // Aborted = a newer load() superseded us. Stay silent — the newer
      // call owns the UI state now.
      if (ac.signal.aborted || (e instanceof DOMException && e.name === "AbortError")) return;
      setError(e instanceof Error ? e.message : t("qa.list.loadErr", "Couldn't load reports."));
    } finally {
      // Only the LATEST controller clears loading; a stale call landing
      // after a newer one started must not flip the spinner off early.
      if (loadAbortRef.current === ac) setLoading(false);
    }
  }, [viewParams, fModule, fSeverity, fStatus, fPriority, fAssignee, fReporter, q, t]);

  useEffect(() => {
    void load();
    return () => { loadAbortRef.current?.abort(); };
  }, [load]);

  // A report can be filed from anywhere via the global Report button (a
  // separate component tree). Refresh the list when one is submitted so the
  // new issue shows up immediately instead of being "lost" until reload.
  useEffect(() => {
    const onCreated = () => { void load(); };
    window.addEventListener("qa:issue-created", onCreated);
    return () => window.removeEventListener("qa:issue-created", onCreated);
  }, [load]);

  /* Realtime: when any row in qa_issue_reports changes (e.g. Koleex AI
     auto-fix writes the Triage directly via MCP, bypassing the React state),
     refetch the list so what we display matches what the database actually
     holds. Without this, an open page can show stale "New" / empty Triage
     long after the row was actually moved to Fixed. Debounced — many
     updates in quick succession (e.g. a bulk action) coalesce into one
     refetch. */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefetch = () => {
      if (cancelled) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (!cancelled) void load(); }, 250);
    };
    let unsub: (() => void) | undefined;
    (async () => {
      const mod = await import("@/lib/qa/realtime");
      if (cancelled) return;
      unsub = mod.subscribeToQaReports(scheduleRefetch);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (unsub) unsub();
    };
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
  // Phase 9.2 — fix evidence cycles for the currently selected issue. Always
  // fetched fresh on selection because the list endpoint doesn't carry it.
  const [evidence, setEvidence] = useState<import("@/lib/qa/types").FixEvidenceCycle[]>([]);
  const [evidenceTick, setEvidenceTick] = useState(0); // bump to force refetch
  useEffect(() => {
    if (!selectedId) {
      setExtra(null); setExtraMissing(false); setEvidence([]);
      return;
    }
    let alive = true;
    setExtraMissing(false);
    fetch(`/api/qa/reports/${selectedId}`, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        if (r.status === 404) { if (alive) setExtraMissing(true); return null; }
        return r.ok ? r.json() : null;
      })
      .then((j) => {
        if (!alive) return;
        if (j?.report) {
          // Update extra only when the row isn't already in the list; if it
          // IS, the list copy stays canonical.
          if (!reports.some((r) => r.id === selectedId)) setExtra(j.report as QaReport);
        }
        setEvidence(Array.isArray(j?.fix_evidence) ? j.fix_evidence : []);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedId, reports, evidenceTick]);

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

  /* URL ↔ filter sync. On mount we hydrate state from the URL once (so
     bookmarks / shared links work). On every subsequent filter change we
     replace the URL — never push — so the back button doesn't bounce
     through every keystroke. */
  useEffect(() => {
    if (initFromUrlRef.current) return;
    initFromUrlRef.current = true;
    const v = searchParams.get("view"); if (v) setView(v as SavedViewId);
    const m = searchParams.get("module"); if (m) setFModule(m);
    const sv = searchParams.get("severity"); if (sv) setFSeverity(sv);
    const st = searchParams.get("status"); if (st) setFStatus(st);
    const pr = searchParams.get("priority"); if (pr) setFPriority(pr);
    const as = searchParams.get("assignee"); if (as) setFAssignee(as);
    const qp = searchParams.get("q"); if (qp) setQ(qp);
    const sp = searchParams.get("sort"); if (sp === "priority") setSortPriority(true);
    const bv = searchParams.get("board"); if (bv === "1") setBoardView(true);
  }, [searchParams]);

  // Keep `q` in sync when the URL changes AFTER mount — e.g. the header search
  // submits ?q=… while we're already on this page. Guarded against our own
  // URL writes (compare to the trimmed current value) so it never fights typing.
  const qRef = useRef(q);
  qRef.current = q;
  useEffect(() => {
    const qp = searchParams.get("q") ?? "";
    if (qp !== qRef.current.trim()) setQ(qp);
  }, [searchParams]);

  useEffect(() => {
    if (!initFromUrlRef.current) return;
    const p = new URLSearchParams();
    if (view !== "all") p.set("view", view);
    if (fModule) p.set("module", fModule);
    if (fSeverity) p.set("severity", fSeverity);
    if (fStatus) p.set("status", fStatus);
    if (fPriority) p.set("priority", fPriority);
    if (fAssignee) p.set("assignee", fAssignee);
    if (fReporter) p.set("reporter", fReporter);
    if (q.trim()) p.set("q", q.trim());
    if (sortPriority) p.set("sort", "priority");
    if (boardView) p.set("board", "1");
    if (issueParam) p.set("issue", issueParam);
    const qs = p.toString();
    router.replace(qs ? `${pageRoute}?${qs}` : pageRoute, { scroll: false });
  }, [view, fModule, fSeverity, fStatus, fPriority, fAssignee, fReporter, q, sortPriority, boardView, issueParam, router, pageRoute]);

  /* Bulk action — apply one workflow change to every selected row in a
     single API call. Optimistic so the UI reacts immediately. */
  const bulkApply = useCallback(async (change: { status?: IssueStatus; priority?: Priority; assigned_to?: string | null }) => {
    if (selectedIds.size === 0 || bulkBusy) return;
    setBulkBusy(true);
    const ids = Array.from(selectedIds);
    // Optimistic local update so the action feels instant.
    setReports((prev) => prev.map((r) => (selectedIds.has(r.id) ? { ...r, ...change } as QaReport : r)));
    try {
      const res = await fetch("/api/qa/reports/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ids, change }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(humanizeError(j.error ?? `Bulk update failed (${res.status})`));
        // Revert by reloading the list.
        void load();
      } else {
        setSelectedIds(new Set());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk update failed.");
      void load();
    } finally {
      setBulkBusy(false);
    }
  }, [selectedIds, bulkBusy, load]);

  /* Clear selection whenever the filtered list changes — otherwise stale
     ids that fell out of the current view would still be "selected". */
  useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const r of reports) if (prev.has(r.id)) next.add(r.id);
      return next.size === prev.size ? prev : next;
    });
  }, [reports]);

  /* KPI strip — computed off the current filtered list, no extra fetch. */
  const kpis = useMemo(() => {
    const open = reports.filter((r) => !RESOLVED_STATUSES.includes(r.status));
    const urgent = reports.filter((r) => r.priority === "urgent" && !RESOLVED_STATUSES.includes(r.status));
    const waiting = reports.filter((r) => r.status === "fixed");
    const aiReady = reports.filter((r) => isClaudeReady(r));
    const stale = reports.filter((r) => !RESOLVED_STATUSES.includes(r.status) && ageDays(r.created_at) > 7);
    const ages = open.map((r) => ageDays(r.created_at));
    const avgAge = ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0;
    return {
      total: reports.length,
      open: open.length,
      urgent: urgent.length,
      waiting: waiting.length,
      aiReady: aiReady.length,
      stale: stale.length,
      avgAge,
    };
  }, [reports]);

  /* Keyboard triage: j/k navigate, enter/o opens, a/p/s focus the matching
     control on the detail pane, c clears selection, ? toggles help. Ignored
     when the focus is in an input/textarea/select. */
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const visible = sorted;
      const idx = selectedId ? visible.findIndex((r) => r.id === selectedId) : -1;
      const move = (dir: 1 | -1) => {
        if (visible.length === 0) return;
        const next = idx < 0 ? 0 : Math.max(0, Math.min(visible.length - 1, idx + dir));
        setSelectedId(visible[next].id);
      };
      switch (e.key) {
        case "j": case "ArrowDown": e.preventDefault(); move(1); break;
        case "k": case "ArrowUp": e.preventDefault(); move(-1); break;
        case "/": e.preventDefault(); document.querySelector<HTMLInputElement>("[data-qa-search]")?.focus(); break;
        case "?": e.preventDefault(); setShowHelp((v) => !v); break;
        case "Escape": setShowHelp(false); break;
        case "c": if (selectedIds.size > 0) { e.preventDefault(); setSelectedIds(new Set()); } break;
        case "b": e.preventDefault(); setBoardView((v) => !v); break;
        default: break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sorted, selectedId, selectedIds.size]);

  /* CSV export — pulls only the rows currently in view (post-filter, sort
     preserved). Encoded client-side so it works without a new endpoint. */
  const exportCSV = useCallback(() => {
    const rows = sorted;
    const cols: Array<[string, (r: QaReport) => string]> = [
      ["id", (r) => r.id],
      ["title", (r) => r.title],
      ["status", (r) => r.status],
      ["priority", (r) => r.priority],
      ["severity", (r) => r.severity],
      ["issue_type", (r) => r.issue_type],
      ["module", (r) => r.app_module ?? ""],
      ["route", (r) => r.route ?? ""],
      ["assignee", (r) => r.assigned_to_name ?? ""],
      ["reporter", (r) => r.reporter_name ?? ""],
      ["component", (r) => r.component_name ?? ""],
      ["fixed_commit", (r) => r.fixed_commit ?? ""],
      ["created_at", (r) => r.created_at],
      ["age_days", (r) => Math.floor(ageDays(r.created_at)).toString()],
    ];
    const esc = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [cols.map(([h]) => esc(h)).join(",")];
    for (const r of rows) lines.push(cols.map(([, f]) => esc(f(r) ?? "")).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `qa-issues-${stamp}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [sorted]);

  if (forbidden) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-[var(--text-dim)]">
        <h1 className="mb-2 text-[18px] font-bold text-[var(--text-primary)]">{t("qa.list.noAccessTitle", "Issue Reports")}</h1>
        <p className="text-[13px]">{t("qa.list.noAccess", "You don’t have access to the QA console. Ask a Super Admin for access.")}</p>
      </div>
    );
  }

  const selectCls = "h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 text-[12.5px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-focus)]";

  return (
    <div className={embedded ? "" : "mx-auto max-w-[1850px] px-4 py-6 sm:px-6"}>
      {!embedded && (
        <div className="mb-4">
          <h1 className="text-[20px] font-bold text-[var(--text-primary)]">{t("qa.list.heading", "Issue Reports")}</h1>
          <p className="text-[12.5px] text-[var(--text-dim)]">{t("qa.list.subtitle", "Report → review → assign → fix → verify → close. A lightweight QA workflow.")}</p>
        </div>
      )}

      {/* KPI strip — at-a-glance team-health signal computed over the
          currently-filtered list. No extra API call. */}
      <KpiStrip kpis={kpis} />

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
            {t("qa.view." + v.id, v.label)}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <input
            data-qa-search
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setSearchFocus(true)}
            onBlur={() => setTimeout(() => setSearchFocus(false), 150)}
            onKeyDown={(e) => { if (e.key === "Escape") setSearchFocus(false); }}
            placeholder={t("qa.filter.search", "Search issues — title, tag, module, reporter…  ( / )")}
            className="h-9 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
          {(() => {
            const term = q.trim().toLowerCase();
            if (!searchFocus || term.length < 1) return null;
            const seen = new Set<string>();
            const out: { kind: string; value: string }[] = [];
            const add = (kind: string, value?: string | null) => {
              if (!value) return;
              if (!value.toLowerCase().includes(term)) return;
              const k = kind + ":" + value.toLowerCase();
              if (seen.has(k)) return;
              seen.add(k);
              out.push({ kind, value });
            };
            for (const r of reports as unknown as Array<Record<string, unknown>>) {
              add("Title", r.title as string);
              add("Module", r.app_module as string);
              add("Reporter", r.reporter_name as string);
              const tg = r.tags;
              if (Array.isArray(tg)) tg.forEach((x) => add("Tag", String(x)));
              if (out.length > 40) break;
            }
            const top = out.slice(0, 8);
            if (top.length === 0) return null;
            return (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] py-1 shadow-2xl shadow-black/40 backdrop-blur-none">
                {top.map((s) => (
                  <button
                    key={s.kind + s.value}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); setQ(s.value); setSearchFocus(false); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                  >
                    <span className="shrink-0 rounded border border-[var(--border-subtle)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{s.kind}</span>
                    <span className="truncate">{s.value}</span>
                  </button>
                ))}
              </div>
            );
          })()}
        </div>
        <select value={fModule} onChange={(e) => setFModule(e.target.value)} className={selectCls}>
          <option value="">{t("qa.filter.allModules", "All modules")}</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
          <option value="">{t("qa.filter.allStatus", "All status")}</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{t("qa.status." + s.value, s.label)}</option>)}
        </select>
        <select value={fPriority} onChange={(e) => setFPriority(e.target.value)} className={selectCls}>
          <option value="">{t("qa.filter.allPriority", "All priority")}</option>
          {PRIORITIES.map((s) => <option key={s.value} value={s.value}>{t("qa.priority." + s.value, s.label)}</option>)}
        </select>
        <select value={fSeverity} onChange={(e) => setFSeverity(e.target.value)} className={selectCls}>
          <option value="">{t("qa.filter.allSeverity", "All severity")}</option>
          {SEVERITIES.map((s) => <option key={s.value} value={s.value}>{t("qa.severity." + s.value, s.label)}</option>)}
        </select>
        <select value={fAssignee} onChange={(e) => setFAssignee(e.target.value)} className={selectCls}>
          <option value="">{t("qa.filter.allAssignees", "All assignees")}</option>
          <option value="unassigned">{t("qa.filter.unassigned", "Unassigned")}</option>
          {assigneeFacet.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={fReporter} onChange={(e) => setFReporter(e.target.value)} className={selectCls}>
          <option value="">{t("qa.filter.allReporters", "All reporters")}</option>
          {myId && <option value={myId}>{t("qa.filter.myReports", "My reports")}</option>}
          {reporterFacet.filter((r) => r.id !== myId).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setSortPriority((v) => !v)}
          className={`h-9 rounded-lg border px-3 text-[12px] font-semibold ${sortPriority ? "border-[var(--accent)] text-[var(--text-secondary)]" : "border-[var(--border-color)] text-[var(--text-secondary)]"}`}
        >
          {sortPriority ? t("qa.filter.sortPriority", "Sort: Priority") : t("qa.filter.sortNewest", "Sort: Newest")}
        </button>
        <button
          type="button"
          onClick={() => setBoardView((v) => !v)}
          aria-pressed={boardView}
          title={t("qa.filter.boardTip", "Kanban-style board grouped by status (b)")}
          className={`h-9 rounded-lg border px-3 text-[12px] font-semibold ${boardView ? "border-[var(--text-secondary)] text-[var(--text-primary)]" : "border-[var(--border-color)] text-[var(--text-secondary)]"}`}
        >
          {boardView ? t("qa.filter.viewList", "View: List") : t("qa.filter.viewBoard", "View: Board")}
        </button>
        <button
          type="button"
          onClick={exportCSV}
          title={t("qa.filter.exportTip", "Export the current view as CSV")}
          className="h-9 rounded-lg border border-[var(--border-color)] px-3 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          {t("qa.filter.exportCSV", "Export CSV")}
        </button>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          title={t("qa.filter.helpTip", "Keyboard shortcuts (?)")}
          aria-label={t("qa.filter.help", "Keyboard shortcuts")}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-color)] text-[12px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        >
          ?
        </button>
      </div>

      {/* Bulk action bar — sticky just below the filters; appears once one
          or more rows are selected. Keeps a low profile until needed. */}
      {selectedIds.size > 0 && (
        <BulkBar
          count={selectedIds.size}
          busy={bulkBusy}
          assignees={allAssignees}
          onClear={() => setSelectedIds(new Set())}
          onApply={(c) => void bulkApply(c)}
        />
      )}

      {error && <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}

      <div className={boardView ? "" : "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(320px,440px)_1fr]"}>
        {/* Board view replaces the master/detail grid with a Kanban grouped
            by status. Clicking a card still opens the detail in a modal-ish
            inline area below (keep simple: just sets selectedId, which the
            user can then view by switching back to List). */}
        {boardView ? (
          <BoardView
            rows={sorted}
            selectedIds={selectedIds}
            onToggle={(id) => setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            onOpen={(id) => { setSelectedId(id); setBoardView(false); }}
          />
        ) : (
        <div className={`overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] ${selectedId ? "hidden lg:block" : ""}`}>
          {loading ? (
            <div className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">{t("qa.common.loading", "Loading…")}</div>
          ) : sorted.length === 0 ? (
            <div className="px-4 py-10 text-center text-[13px] text-[var(--text-dim)]">{t("qa.list.noMatch", "No issues match this view.")}</div>
          ) : (
            <>
              {/* Select-all header */}
              <div className="flex items-center gap-2 border-b border-[var(--border-faint)] px-4 py-2 text-[11px] text-[var(--text-dim)]">
                <input
                  type="checkbox"
                  aria-label={t("qa.list.selectAll", "Select all visible")}
                  checked={sorted.length > 0 && sorted.every((r) => selectedIds.has(r.id))}
                  ref={(el) => { if (el) { const all = sorted.length > 0 && sorted.every((r) => selectedIds.has(r.id)); const some = sorted.some((r) => selectedIds.has(r.id)); el.indeterminate = some && !all; } }}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(sorted.map((r) => r.id)));
                    else setSelectedIds(new Set());
                  }}
                />
                <span>{sorted.length} {sorted.length === 1 ? t("qa.list.issue", "issue") : t("qa.list.issues", "issues")}</span>
              </div>
            {/* Grouped list. Kamal: "the issue list need to be more organized
                … too messy." The previous flat row interleaved every state and
                fired 5+ coloured pills per line. Now: rows are clustered into
                4 status groups with a single section header per group, and
                each row is stripped down to title + a single meta line. Status
                lives in the left-edge stripe + the section header, so the
                title gets the visual weight back. */}
            <div className="lg:max-h-[72vh] lg:overflow-y-auto">
              {(() => {
                /* Cluster definitions — keep them stable and exhaustive so a
                   new status doesn't silently disappear. */
                const CLUSTERS: { key: string; label: string; statuses: IssueStatus[] }[] = [
                  { key: "open",   label: t("qa.cluster.open",   "Open"),                  statuses: ["new", "triaged", "reopened"]      as IssueStatus[] },
                  { key: "active", label: t("qa.cluster.active", "In Progress"),           statuses: ["in_progress", "needs_more_info"]  as IssueStatus[] },
                  { key: "review", label: t("qa.cluster.review", "Awaiting verification"), statuses: ["fixed"]                           as IssueStatus[] },
                  { key: "done",   label: t("qa.cluster.done",   "Verified"),              statuses: ["verified"]                        as IssueStatus[] },
                  { key: "archive",label: t("qa.cluster.archive","Closed"),                statuses: ["closed", "rejected", "duplicate"] as IssueStatus[] },
                ];
                const byCluster = new Map<string, typeof sorted>();
                for (const c of CLUSTERS) byCluster.set(c.key, []);
                for (const r of sorted) {
                  const cluster = CLUSTERS.find((c) => c.statuses.includes(r.status as IssueStatus));
                  if (cluster) byCluster.get(cluster.key)!.push(r);
                }
                return CLUSTERS.map((c) => {
                  const rows = byCluster.get(c.key) ?? [];
                  if (rows.length === 0) return null;
                  return (
                    <section key={c.key} className="border-b border-[var(--border-faint)] last:border-b-0">
                      {/* Section header — sticky so the group label stays
                          visible while scrolling the cluster. Compact
                          uppercase, monochrome — no extra colour competing
                          with the row stripes. */}
                      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[var(--border-faint)] bg-[var(--bg-secondary)]/95 px-4 py-2 backdrop-blur-sm">
                        <div className="flex items-center gap-2">
                          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STRIPE[c.statuses[0]]}`} />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">{c.label}</span>
                        </div>
                        <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--text-secondary)]">
                          {rows.length}
                        </span>
                      </header>
                      <ul className="divide-y divide-[var(--border-faint)]">
                        {rows.map((r) => {
                          const ready = isClaudeReady(r);
                          const d = ageDays(r.created_at);
                          const checked = selectedIds.has(r.id);
                          return (
                            <li key={r.id} className="relative">
                              {/* Status stripe — kept as the single ambient
                                  signal so colour reads spatially, never
                                  competing with text for attention. */}
                              <span aria-hidden className={`absolute left-0 top-0 h-full w-[3px] ${STATUS_STRIPE[r.status] ?? "bg-transparent"}`} />
                              <div className={`flex w-full items-start gap-3 pl-5 pr-4 py-3 transition-colors ${selectedId === r.id ? "bg-[var(--bg-surface-active)]" : "hover:bg-[var(--bg-surface-subtle)]"}`}>
                                <input
                                  type="checkbox"
                                  aria-label={t("qa.list.selectRow", "Select row")}
                                  className="mt-1 shrink-0"
                                  checked={checked}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    setSelectedIds((prev) => {
                                      const n = new Set(prev);
                                      if (n.has(r.id)) n.delete(r.id); else n.add(r.id);
                                      return n;
                                    });
                                  }}
                                />
                                <button type="button" onClick={() => setSelectedId(r.id)} className="block flex-1 text-left">
                                  {/* Title row — hero. No pills competing.
                                      Only severity gets a small dot prefix
                                      so critical/high pop without taking
                                      a whole pill's worth of width. */}
                                  <div className="flex items-center gap-2">
                                    {r.severity === "critical" || r.severity === "high" ? (
                                      <span
                                        aria-label={`${SEVERITY_LABEL[r.severity]} severity`}
                                        title={t("qa.severity." + r.severity, SEVERITY_LABEL[r.severity])}
                                        className={`shrink-0 h-1.5 w-1.5 rounded-full ${r.severity === "critical" ? "bg-rose-500" : "bg-amber-500"}`}
                                      />
                                    ) : null}
                                    <span className="truncate text-[14px] font-semibold text-[var(--text-primary)]">{r.title}</span>
                                    {r.priority === "urgent" && (
                                      <span className="shrink-0 rounded bg-[var(--bg-inverted)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[var(--text-inverted)]">
                                        {t("qa.priority.urgent", "Urgent")}
                                      </span>
                                    )}
                                  </div>
                                  {/* One quiet meta line — minimum readable
                                      context, monochrome. Drops: severity
                                      pill, priority pill, issue type, dup
                                      flag, comment emoji. */}
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[var(--text-dim)]">
                                    <span>{ageLabel(d)}</span>
                                    <span aria-hidden>·</span>
                                    <span>{r.app_module}</span>
                                    {r.reporter_name && (<><span aria-hidden>·</span><span>{t("qa.row.by", "by")} {r.reporter_name}</span></>)}
                                    {r.assigned_to_name && (<><span aria-hidden>·</span><span className="text-[var(--text-secondary)]">@{r.assigned_to_name}</span></>)}
                                    {ready && (<><span aria-hidden>·</span><span className="font-medium text-[var(--text-secondary)]">{t("qa.badge.aiReady", "AI-ready")}</span></>)}
                                    <span className="ms-auto">{rel(r.created_at)}</span>
                                  </div>
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                });
              })()}
            </div>
            </>
          )}
        </div>
        )}
        {!boardView && (
        /* Detail — hidden on mobile until an issue is picked; a Back bar
           returns to the list (lg keeps it always visible beside the list). */
        <div className={`overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] ${selectedId ? "" : "hidden lg:block"}`}>
          {selectedId && (
            <button type="button" onClick={() => setSelectedId(null)} className="flex w-full items-center gap-1.5 border-b border-[var(--border-subtle)] px-4 py-2.5 text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] lg:hidden">
              <span aria-hidden>←</span> {t("qa.list.backToList", "Back to list")}
            </button>
          )}
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
              evidence={evidence}
              onEvidenceChanged={() => setEvidenceTick((t) => t + 1)}
            />
          ) : extraMissing ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[18px] text-[var(--text-dim)]">⌀</div>
              <p className="text-[14px] font-semibold text-[var(--text-primary)]">{t("qa.list.deletedTitle", "This issue no longer exists or was deleted.")}</p>
              <p className="mt-1 text-[12px] text-[var(--text-dim)]">{t("qa.list.deletedSub", "The notification stays readable, but there’s nothing to open.")}</p>
            </div>
          ) : selectedId ? (
            <div className="px-6 py-16 text-center text-[13px] text-[var(--text-dim)]">{t("qa.list.loadingIssue", "Loading issue…")}</div>
          ) : (
            <div className="px-6 py-16 text-center text-[13px] text-[var(--text-dim)]">{t("qa.list.selectPrompt", "Select an issue to view details, discuss, assign and resolve.")}</div>
          )}
        </div>
        )}
      </div>

      {/* Keyboard-shortcuts cheatsheet — opened with `?`. */}
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
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
  evidence, onEvidenceChanged,
}: {
  report: QaReport;
  assignees: QaAssignee[];
  allReports: QaReport[];
  myId: string | null;
  onUpdated: (r: QaReport) => void;
  onRefresh?: () => void;
  onJump: (id: string) => void;
  evidence: import("@/lib/qa/types").FixEvidenceCycle[];
  onEvidenceChanged: () => void;
}) {
  const { t } = useTranslation(qaT);
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
  const [copying, setCopying] = useState(false);
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
      setErr(e instanceof Error ? e.message : t("qa.triage.errSave", "Couldn't save."));
      return false;
    } finally { setBusy(false); }
  }, [report.id, onUpdated, onRefresh, t]);

  async function saveTriage() {
    setSaving(true); setErr(null); setSaved(false);
    const ok = await patch({ status, developer_notes: notes, resolution_summary: resolution, fixed_commit: commit });
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 2000); }
    setSaving(false);
  }

  async function copyDebugPrompt() {
    if (copying) return;
    // Phase 6: copy the FULL deterministic workspace prompt; fall back to the
    // inline summary if the workspace can't be built. Building the workspace on
    // first read can take a second — show a "Preparing…" state so it doesn't
    // feel frozen.
    setCopying(true); setErr(null);
    try {
      const res = await fetch(`/api/qa/${report.id}/workspace`, { credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.workspace?.generated_prompt) {
        const ok = await copyText(j.workspace.generated_prompt as string);
        if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
        else setErr(t("qa.detail.copyManual", "Couldn't copy — open the issue and copy the prompt manually."));
        setCopying(false);
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
    else setErr(t("qa.detail.copyManual", "Couldn't copy — open the issue and copy the prompt manually."));
    setCopying(false);
  }

  const label = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1";
  const box = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap break-words";
  // min-h-[38px] enforces a consistent height floor so native <select>
  // elements match the AssigneePicker button (which is taller because of its
  // inner avatar pill). Without this, the Priority dropdown rendered visibly
  // thinner than the Assigned-to picker beside it — issue 06ae2743.
  const input = "w-full min-h-[38px] rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";

  const ready = isClaudeReady(report);
  const isResolved = (RESOLVED_STATUSES as string[]).includes(report.status) || report.status === "closed";
  const curStep = stepIndex(report.status);
  const dupTarget = report.duplicate_of_issue_id ? allReports.find((r) => r.id === report.duplicate_of_issue_id) : null;

  return (
    <div className="space-y-4 px-5 py-4 lg:max-h-[72vh] lg:overflow-y-auto">
      {/* Action error — surfaced at the top so priority/assignee/duplicate/
          reopen failures aren't hidden in a section the user isn't viewing. */}
      {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{err}</div>}
      {/* Badges row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`${PILL} ${SEVERITY_TONE[report.severity]}`}>{t("qa.severity." + report.severity, SEVERITY_LABEL[report.severity])}</span>
        <span className={`${PILL} ${PRIORITY_TONE[report.priority]}`}>{t("qa.priority." + report.priority, PRIORITY_LABEL[report.priority])} {t("qa.badge.priorityWord", "priority")}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[report.status]}`}>{t("qa.status." + report.status, STATUS_LABEL[report.status])}</span>
        <span className="text-[11px] text-[var(--text-dim)]">{t("qa.issueType." + report.issue_type, ISSUE_TYPE_LABEL[report.issue_type])}</span>
        {ready && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">{t("qa.badge.aiReady", "AI-ready")}</span>}
        {report.duplicate_of_issue_id && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-dim)]">{t("qa.badge.duplicate", "Duplicate")}</span>}
        {report.reopen_count > 0 && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-dim)]">{t("qa.badge.reopenedTimes", "Reopened")} ×{report.reopen_count}</span>}
        <div className="ms-auto flex items-center gap-2">
          {/* Open Route — ALWAYS carry qa_issue + qa_title so the destination
              shows an arrival banner identifying the issue, even for whole-page
              reports with no pinned component. qa_focus is added only when a
              component was pinned, so the page can also ring it. (Issue
              dc295123 + 46dba6b3 follow-up: previously no-component reports
              navigated with no marker at all.) */}
          {report.route ? (
            <a
              href={(() => {
                const base = report.route as string;
                const sep = base.includes("?") ? "&" : "?";
                const params = new URLSearchParams();
                params.set("qa_issue", report.id);
                if (report.title) params.set("qa_title", String(report.title).slice(0, 120));
                const name = report.component_name?.trim();
                if (name) params.set("qa_focus", name);
                return `${base}${sep}${params.toString()}`;
              })()}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
            >
              {t("qa.detail.openRoute", "Open Route ↗")}
            </a>
          ) : null}
          <button type="button" onClick={() => setWorkspaceOpen(true)} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]">
            {t("qa.detail.debugWorkspace", "Debug Workspace")}
          </button>
          <button type="button" onClick={copyDebugPrompt} disabled={copying} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-60">
            {copying ? t("qa.detail.preparing", "Preparing…") : copied ? t("qa.common.copied", "Copied ✓") : t("qa.detail.copyPrompt", "Copy AI Prompt")}
          </button>
        </div>
      </div>

      {workspaceOpen && (
        <ClaudeWorkspaceDrawer issueId={report.id} onClose={() => setWorkspaceOpen(false)} onJump={onJump} />
      )}

      <h2 className="text-[16px] font-bold text-[var(--text-primary)]">{report.title}</h2>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-dim)]">
        <span><b className="text-[var(--text-secondary)]">{t("qa.detail.moduleLabel", "Module:")}</b> {report.app_module}</span>
        <span className="font-mono"><b className="font-sans text-[var(--text-secondary)]">{t("qa.detail.routeLabel", "Route:")}</b> {report.route ?? "—"}</span>
        <span><b className="text-[var(--text-secondary)]">{t("qa.detail.reporter", "Reporter")}:</b> {report.reporter_name ?? "—"}</span>
        <span><b className="text-[var(--text-secondary)]">{t("qa.detail.filedLabel", "Filed:")}</b> {fmt(report.created_at)}</span>
      </div>

      {/* Workflow stepper — per-step coloured icons + labels (issue dc295123,
          Kamal). Each step has a semantic functional colour: open=blue,
          in-progress=amber, fixed=emerald (the requested green), verified=
          deeper emerald, closed=zinc. The active step gets the saturated
          variant; completed steps get a muted version of the same colour so
          history reads at a glance; future steps stay dim/neutral. */}
      {(() => {
        const STEP_COLOURS: Record<string, {
          activeBg: string; activeText: string; activeRing: string;
          doneBg: string;   doneText: string;
          label: string; connector: string;
        }> = {
          new:         { activeBg: "bg-blue-500",    activeText: "text-white", activeRing: "ring-blue-300/40",
                         doneBg:   "bg-blue-500/80", doneText:   "text-white",
                         label:    "text-blue-500", connector: "bg-blue-500/70" },
          in_progress: { activeBg: "bg-amber-500",   activeText: "text-black", activeRing: "ring-amber-300/40",
                         doneBg:   "bg-amber-500/80",doneText:   "text-black",
                         label:    "text-amber-500", connector: "bg-amber-500/70" },
          fixed:       { activeBg: "bg-emerald-500", activeText: "text-white", activeRing: "ring-emerald-300/40",
                         doneBg:   "bg-emerald-500/80", doneText:"text-white",
                         label:    "text-emerald-500", connector: "bg-emerald-500/70" },
          verified:    { activeBg: "bg-emerald-700", activeText: "text-white", activeRing: "ring-emerald-400/40",
                         doneBg:   "bg-emerald-700/80", doneText:"text-white",
                         label:    "text-emerald-600", connector: "bg-emerald-700/70" },
          closed:      { activeBg: "bg-zinc-500",    activeText: "text-white", activeRing: "ring-zinc-300/40",
                         doneBg:   "bg-zinc-500/80", doneText:   "text-white",
                         label:    "text-zinc-500", connector: "bg-zinc-500/70" },
        };
        return (
          <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2.5">
            {WORKFLOW_STEPS.map((s, i) => {
              const c = STEP_COLOURS[s.value] ?? STEP_COLOURS.new;
              const isDone = i < curStep;
              const isActive = i === curStep;
              const circleCls = isActive
                ? `${c.activeBg} ${c.activeText} ring-2 ${c.activeRing}`
                : isDone
                  ? `${c.doneBg} ${c.doneText}`
                  : "bg-[var(--bg-surface)] text-[var(--text-dim)] border border-[var(--border-color)]";
              const labelCls = isActive
                ? `font-semibold ${c.label}`
                : isDone
                  ? `font-semibold ${c.label} opacity-80`
                  : "text-[var(--text-dim)]";
              const connectorCls = isDone ? c.connector : "bg-[var(--border-color)]";
              return (
                <div key={s.value} className="flex flex-1 items-center gap-1.5">
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${circleCls}`}>
                    {isDone ? "✓" : i + 1}
                  </div>
                  <span className={`hidden whitespace-nowrap text-[11px] sm:inline ${labelCls}`}>
                    {t("qa.step." + s.value, s.label)}
                  </span>
                  {i < WORKFLOW_STEPS.length - 1 && <div className={`h-px flex-1 ${connectorCls}`} />}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Watch / follow */}
      <WatchControl issueId={report.id} showWatchers />

      {/* Quick actions: priority · assignee · duplicate · reopen */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className={label}>{t("qa.action.priority", "Priority")}</label>
          {/* Issue 06ae2743 (reopened): the priority control looked thinner
              than the assignee control beside it. A native <select> with only
              min-height renders shorter than the flex AssigneePicker button on
              some browsers. Force the exact same box: explicit h-[38px], full
              width, leading-normal so the two sit at identical height. */}
          <select
            value={report.priority}
            disabled={busy}
            onChange={(e) => void patch({ priority: e.target.value as Priority })}
            className={`${input} h-[38px] leading-normal`}
          >
            {PRIORITIES.map((p) => <option key={p.value} value={p.value}>{t("qa.priority." + p.value, p.label)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("qa.action.assignedTo", "Assigned to")}</label>
          <AssigneePicker
            assignees={assignees}
            value={report.assigned_to}
            valueName={report.assigned_to_name ?? null}
            myId={myId}
            disabled={busy}
            onChange={(id) => patch({ assigned_to: id })}
          />
        </div>
      </div>

      <DuplicateControl report={report} allReports={allReports} disabled={busy} onPatch={patch} onJump={onJump} dupTarget={dupTarget ?? null} />

      {isResolved && <ReopenControl disabled={busy} onReopen={(reason) => patch({ action: "reopen", reopen_reason: reason })} />}

      <ComponentsBreadcrumbs report={report} />

      <ScreenshotsGallery report={report} />

      <div><div className={label}>{t("qa.detail.whatHappened", "What happened")}</div><div className={box}>{report.description || "—"}</div></div>
      <div><div className={label}>{t("qa.report.expected", "Expected result")}</div><div className={box}>{report.expected_result || "—"}</div></div>
      <div><div className={label}>{t("qa.report.solution", "Suggested solution")}</div><div className={box}>{report.suggested_solution || "—"}</div></div>

      <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[11px] text-[var(--text-dim)]">
        <b className="text-[var(--text-secondary)]">{t("qa.detail.environment", "Environment")}</b> — {report.device_info ?? "—"} · screen {report.screen_size ?? "—"} · {report.language ?? "—"} · {report.timezone ?? "—"}
        <div className="mt-1 break-words font-mono text-[10px] opacity-80">{report.browser_info ?? ""}</div>
      </div>

      {/* Triage */}
      <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("qa.triage.title", "Triage")}</div>
        <div>
          <label className={label}>{t("qa.triage.status", "Status")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as IssueStatus)} className={input}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{t("qa.status." + s.value, s.label)}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{t("qa.triage.devNotes", "Developer notes")}</label>
          {/* Bigger by default + user-resizable. Issue f548b45e (Kamal): the
             3-row textarea was too short to read multi-paragraph dev notes;
             Koleex AI auto-fix routinely writes 1000+ chars here. min-h
             holds the floor when empty, resize-y lets him pull it taller,
             leading-relaxed makes wrapped Arabic / Chinese readable. */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={8}
            className={`${input} min-h-[180px] resize-y leading-relaxed`}
            placeholder={t("qa.triage.devNotesPlaceholder", "Investigation notes, root cause…")}
          />
        </div>
        <div>
          <label className={label}>{t("qa.triage.resolution", "Resolution summary")}</label>
          <textarea
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            rows={4}
            className={`${input} min-h-[96px] resize-y leading-relaxed`}
            placeholder={t("qa.triage.resolutionPlaceholder", "What was done to fix it")}
          />
        </div>
        <div>
          <label className={label}>{t("qa.triage.commit", "Fixed commit")}</label>
          <input value={commit} onChange={(e) => setCommit(e.target.value)} className={`${input} font-mono`} placeholder="e.g. a5b5481d" />
        </div>
        <div className="flex items-center justify-end gap-2">
          {saved && <span className="text-[12px] text-emerald-500">{t("qa.triage.saved", "Saved ✓")}</span>}
          <button type="button" onClick={saveTriage} disabled={saving} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-2 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
            {saving ? t("qa.triage.saving", "Saving…") : t("qa.triage.save", "Save changes")}
          </button>
        </div>
      </div>

      {/* Phase 9.2 — Fix Evidence (BEFORE / AFTER) + admin upload form. The
          form is always available on the admin side so an admin can pre-stage
          evidence before flipping the status. The display section auto-hides
          when there are no cycles. */}
      <div className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
          {t("qa.evidence.title", "Fix Evidence")}
        </div>
        <FixEvidenceForm
          issueId={report.id}
          defaultCommit={commit}
          onSaved={() => { onEvidenceChanged(); onRefresh?.(); }}
        />
        <FixEvidenceSection
          /* BEFORE source — merge BOTH the multi-shot array AND the scalar
             so we never render a blank pane just because the array happens
             to be []. Old single-shot reports only have screenshot_url;
             multi-shot reports have screenshot_urls[]; some have both. */
          beforeUrls={(() => {
            const fromArr = Array.isArray(report.screenshot_urls)
              ? (report.screenshot_urls as string[]).filter((u): u is string => typeof u === "string" && u.length > 0)
              : [];
            const scalar = typeof report.screenshot_url === "string" ? report.screenshot_url : null;
            // De-dupe (same URL might appear in both shapes).
            const set = new Set<string>(fromArr);
            if (scalar) set.add(scalar);
            return Array.from(set);
          })()}
          cycles={evidence}
        />
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
  onChange: (id: string | null) => void | Promise<boolean>;
}) {
  const { t } = useTranslation(qaT);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Optimistic selection: reflect the picked assignee immediately, independent
  // of the prop round-trip; reconcile when the server value arrives, revert if
  // the change is rejected. (`undefined` = no pending choice.)
  const [pending, setPending] = useState<string | null | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Server value caught up → clear the optimistic override.
  useEffect(() => { setPending(undefined); }, [value]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return assignees;
    return assignees.filter((a) => a.name.toLowerCase().includes(s) || (a.email ?? "").toLowerCase().includes(s));
  }, [assignees, search]);

  const effectiveValue = pending !== undefined ? pending : value;
  const current = effectiveValue ? (assignees.find((a) => a.id === effectiveValue)?.name ?? valueName ?? "—") : null;

  async function choose(id: string | null) {
    setPending(id);
    setOpen(false);
    setSearch("");
    const result = onChange(id);
    if (result instanceof Promise) {
      const ok = await result;
      if (ok === false) setPending(undefined); // rejected → revert to server value
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[38px] items-center gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-left text-[13px] text-[var(--text-primary)] outline-none transition-colors hover:bg-[var(--bg-surface-hover)] disabled:opacity-50"
      >
        {current ? (
          <>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-surface-active)] text-[9px] font-bold text-[var(--text-secondary)]">{initials(current)}</span>
            <span className="truncate">{current}</span>
          </>
        ) : (
          <span className="text-[var(--text-dim)]">{t("qa.assignee.unassigned", "Unassigned")}</span>
        )}
        <span className="ms-auto text-[var(--text-dim)]">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] shadow-xl">
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("qa.assignee.search", "Search people…")}
            className="w-full border-b border-[var(--border-subtle)] bg-transparent px-3 py-2 text-[12.5px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
          />
          <ul className="max-h-56 overflow-y-auto p-1">
            <li>
              <button type="button" onClick={() => choose(null)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-[var(--bg-surface-hover)] ${!effectiveValue ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]" : "text-[var(--text-dim)]"}`}>
                <span className="flex h-5 w-5 items-center justify-center text-[var(--text-dim)]">∅</span>
                <span className="flex-1">{t("qa.assignee.unassigned", "Unassigned")}</span>
                {!effectiveValue && <span className="text-[var(--text-secondary)]">✓</span>}
              </button>
            </li>
            {filtered.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => choose(a.id)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[12.5px] hover:bg-[var(--bg-surface-hover)] ${a.id === effectiveValue ? "bg-[var(--bg-surface-active)]" : ""}`}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-surface-active)] text-[9px] font-bold text-[var(--text-secondary)]">{initials(a.name)}</span>
                  <span className="flex-1 truncate text-[var(--text-primary)]">{a.name}{a.id === myId ? t("qa.common.me", " (me)") : ""}</span>
                  {a.id === effectiveValue && <span className="text-[var(--text-secondary)]">✓</span>}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-3 py-2 text-[12px] text-[var(--text-dim)]">{t("qa.assignee.noMatch", "No matches.")}</li>}
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
  const { t } = useTranslation(qaT);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState("");

  if (report.duplicate_of_issue_id) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px]">
        <span className="text-[var(--text-dim)]">{t("qa.action.duplicateOf", "Duplicate of")}</span>
        <button type="button" onClick={() => dupTarget && onJump(dupTarget.id)} className="truncate font-semibold text-[var(--accent)] hover:underline">
          {dupTarget ? dupTarget.title : report.duplicate_of_issue_id}
        </button>
        <button type="button" disabled={disabled} onClick={() => void onPatch({ duplicate_of_issue_id: null })} className="ms-auto text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">
          {t("qa.action.unlink", "Unlink")}
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
          + {t("qa.action.markDuplicateShort", "Mark as duplicate")}
        </button>
      ) : (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("qa.action.duplicateOfPrompt", "Duplicate of…")}</span>
            <button type="button" onClick={() => { setPicking(false); setSearch(""); }} className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.common.cancel", "Cancel")}</button>
          </div>
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("qa.action.searchIssues", "Search issues…")} className="mb-1 w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none" />
          <ul className="max-h-40 overflow-y-auto">
            {filtered.map((r) => (
              <li key={r.id}>
                <button type="button" disabled={disabled} onClick={async () => { const ok = await onPatch({ duplicate_of_issue_id: r.id }); if (ok) { setPicking(false); setSearch(""); } }} className="block w-full truncate px-2 py-1.5 text-left text-[12px] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">
                  {r.title}
                </button>
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-1.5 text-[12px] text-[var(--text-dim)]">{t("qa.assignee.noMatch", "No matches.")}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ── Reopen ──────────────────────────────────────────────────────────────── */
function ReopenControl({ disabled, onReopen }: { disabled?: boolean; onReopen: (reason: string) => Promise<boolean> }) {
  const { t } = useTranslation(qaT);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  return (
    <div>
      {!open ? (
        <button type="button" disabled={disabled} onClick={() => setOpen(true)} className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--text-primary)]">
          ↻ {t("qa.action.reopenIssue", "Reopen issue")}
        </button>
      ) : (
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2.5">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{t("qa.action.whyReopen", "Why reopen?")}</div>
          <textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder={t("qa.action.reopenReasonPlaceholder", "Reason (preserved on the timeline)…")} className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-2.5 py-1.5 text-[12px] text-[var(--text-primary)] outline-none" />
          <div className="mt-1.5 flex justify-end gap-2">
            <button type="button" onClick={() => { setOpen(false); setReason(""); }} className="text-[12px] text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.common.cancel", "Cancel")}</button>
            <button type="button" disabled={disabled} onClick={async () => { const ok = await onReopen(reason.trim()); if (ok) { setOpen(false); setReason(""); } }} className="rounded-md bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
              {t("qa.action.reopen", "Reopen")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Comments / discussion ───────────────────────────────────────────────── */
function CommentsPanel({ issueId, myId, refreshKey = 0 }: { issueId: string; myId: string | null; refreshKey?: number }) {
  const { t } = useTranslation(qaT);
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
      setLoadErr(t("qa.discussion.loadErr", "Couldn't load the discussion."));
    } finally { setLoading(false); }
  }, [issueId, t]);
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
      setErr(e instanceof Error ? e.message : t("qa.discussion.postErr", "Couldn't post."));
    } finally { setPosting(false); }
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("qa.discussion.title", "Discussion")}{comments.length > 0 ? ` · ${comments.length}` : ""}</div>

      {loading ? (
        <div className="py-3 text-center text-[12px] text-[var(--text-dim)]">{t("qa.common.loading", "Loading…")}</div>
      ) : loadErr ? (
        <div className="py-3 text-center text-[12px] text-rose-500 dark:text-rose-300">{loadErr}</div>
      ) : comments.length === 0 ? (
        <div className="py-3 text-center text-[12px] text-[var(--text-dim)]">{t("qa.discussion.empty", "No comments yet. Start the thread below.")}</div>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li key={c.id} className={`rounded-lg border px-3 py-2 ${c.is_internal_note ? "border-amber-500/30 bg-amber-500/[0.06]" : "border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]"} ${c.user_id === myId ? "ms-6" : "me-6"}`}>
              <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px]">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-surface-active)] text-[8px] font-bold text-[var(--text-secondary)]">{initials(c.user_name)}</span>
                <span className="font-semibold text-[var(--text-secondary)]">{c.user_name ?? "—"}</span>
                {c.user_role && <span className="rounded bg-[var(--bg-surface)] px-1 text-[9px] text-[var(--text-dim)]">{c.user_role}</span>}
                {c.is_internal_note && <span className="rounded bg-amber-500/20 px-1 text-[9px] font-semibold text-amber-600 dark:text-amber-300">{t("qa.discussion.internalBadge", "Internal")}</span>}
                <span className="ms-auto text-[var(--text-dim)]">{rel(c.created_at)}{c.edited_at ? ` · ${t("qa.discussion.edited", "edited")}` : ""}</span>
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
          placeholder={t("qa.discussion.replyPlaceholder", "Write a reply…  (paste/drop an image · ⌘/Ctrl+Enter to send)")}
          className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
        />
        <AttachmentStrip att={att} disabled={posting} />
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--accent)]" />
            {t("qa.discussion.internal", "Internal note")}
          </label>
          <button type="button" onClick={post} disabled={posting || (!text.trim() && att.count === 0)} className="ms-auto rounded-lg bg-[var(--bg-inverted)] px-4 py-1.5 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40">
            {posting ? t("qa.discussion.posting", "Posting…") : t("qa.discussion.comment", "Comment")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Activity timeline ───────────────────────────────────────────────────── */
function ActivityPanel({ issueId, refreshKey = 0 }: { issueId: string; refreshKey?: number }) {
  const { t } = useTranslation(qaT);
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
        if (!r.ok) { if (alive) setLoadErr(t("qa.activityPanel.loadErr", "Couldn't load the activity timeline.")); return { activity: [] }; }
        return r.json();
      })
      .then((j) => { if (alive) setActivity(j.activity ?? []); })
      .catch(() => { if (alive) setLoadErr(t("qa.activityPanel.loadErr", "Couldn't load the activity timeline.")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [issueId, refreshKey, t]);

  function describe(a: QaActivity): string {
    const verb = t("qa.activity." + a.activity_type, ACTIVITY_LABEL[a.activity_type] ?? a.activity_type);
    switch (a.activity_type) {
      case "status_changed": return `${verb} → ${a.new_value ? t("qa.status." + a.new_value, STATUS_LABEL[a.new_value as IssueStatus] ?? (a.new_value as string)) : a.new_value}`;
      case "priority_changed": return `${verb} → ${a.new_value ? t("qa.priority." + a.new_value, PRIORITY_LABEL[a.new_value as Priority] ?? (a.new_value as string)) : a.new_value}`;
      case "assigned": return `${verb} ${t("qa.activityPanel.to", "to")} ${(a.metadata?.assignee_name as string) ?? t("qa.activityPanel.someone", "someone")}`;
      case "commit_added": return `${verb} ${a.new_value ?? ""}`;
      case "reopened": return a.metadata?.reason ? `${verb}: ${a.metadata.reason as string}` : verb;
      default: return verb;
    }
  }

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("qa.activityPanel.title", "Activity")}</div>
      {loading ? (
        <div className="py-2 text-center text-[12px] text-[var(--text-dim)]">{t("qa.common.loading", "Loading…")}</div>
      ) : loadErr ? (
        <div className="py-2 text-center text-[12px] text-rose-500 dark:text-rose-300">{loadErr}</div>
      ) : activity.length === 0 ? (
        <div className="py-2 text-center text-[12px] text-[var(--text-dim)]">{t("qa.activityPanel.empty", "No activity yet.")}</div>
      ) : (
        <ol className="space-y-1.5">
          {activity.map((a) => (
            <li key={a.id} className="flex items-start gap-2 text-[12px]">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-dim)]" />
              <span className="text-[var(--text-secondary)]">
                <b className="font-semibold text-[var(--text-primary)]">{a.actor_name ?? t("qa.activityPanel.someoneCap", "Someone")}</b> {describe(a)}
                <span className="ms-1.5 text-[var(--text-dim)]">· {rel(a.created_at)}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── Components breadcrumb (multi-pick aware) ─────────────────────────────────
   When a report carries the new `components` array, list every pick stacked
   vertically. Falls back to the scalar component_* fields for legacy rows. */
function ComponentsBreadcrumbs({ report }: { report: QaReport }) {
  const { t } = useTranslation(qaT);
  const list = useMemo(() => {
    if (Array.isArray(report.components) && report.components.length > 0) {
      return report.components.map((c) => ({
        name: c.component,
        module: c.module,
        section: c.section,
        recordId: c.recordId,
      }));
    }
    if (report.component_name) {
      return [{
        name: report.component_name,
        module: report.component_module,
        section: report.component_section,
        recordId: report.component_record_id,
      }];
    }
    return [];
  }, [report.components, report.component_name, report.component_module, report.component_section, report.component_record_id]);
  if (list.length === 0) return null;
  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
        <TargetIcon size={12} className="text-[var(--text-secondary)]" />{" "}
        {list.length > 1
          ? t("qa.detail.inspectedMany", `Inspected components (${list.length})`).replace("{n}", String(list.length))
          : t("qa.detail.inspected", "Inspected component")}
      </div>
      <ul className="mt-1.5 space-y-1">
        {list.map((c, idx) => (
          <li key={`${c.name}-${idx}`} className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            {list.length > 1 && (
              <span className="inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--bg-surface)] px-1 text-[10px] font-bold text-[var(--text-secondary)]">{idx + 1}</span>
            )}
            {c.module && (<><span className="text-[var(--text-secondary)]">{c.module}</span><span className="text-[var(--text-ghost)]">→</span></>)}
            {c.section && (<><span className="text-[var(--text-secondary)]">{c.section}</span><span className="text-[var(--text-ghost)]">→</span></>)}
            <span className="font-semibold text-[var(--text-primary)]">{c.name}</span>
            {c.recordId && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">#{c.recordId}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── KPI strip ───────────────────────────────────────────────────────────────
   Six compact numbers showing team health over the current filtered list. */
function KpiStrip({ kpis }: { kpis: { total: number; open: number; urgent: number; waiting: number; aiReady: number; stale: number; avgAge: number } }) {
  const { t } = useTranslation(qaT);
  const cells: Array<{ label: string; value: string; tone?: string; title?: string }> = [
    { label: t("qa.kpi.total", "Total"), value: String(kpis.total) },
    { label: t("qa.kpi.open", "Open"), value: String(kpis.open) },
    { label: t("qa.kpi.urgent", "Urgent"), value: String(kpis.urgent), tone: kpis.urgent > 0 ? "text-rose-500" : undefined },
    { label: t("qa.kpi.waiting", "Waiting verify"), value: String(kpis.waiting) },
    { label: t("qa.kpi.aiReady", "AI-ready"), value: String(kpis.aiReady) },
    { label: t("qa.kpi.stale", ">7d stale"), value: String(kpis.stale), tone: kpis.stale > 0 ? "text-amber-500" : undefined, title: t("qa.kpi.staleTip", "Open issues older than 7 days") },
    { label: t("qa.kpi.avgAge", "Avg age"), value: `${kpis.avgAge.toFixed(1)}d` },
  ];
  return (
    <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {cells.map((c) => (
        <div key={c.label} title={c.title} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{c.label}</div>
          <div className={`mt-0.5 text-[18px] font-bold ${c.tone ?? "text-[var(--text-primary)]"}`}>{c.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Bulk action bar ─────────────────────────────────────────────────────────
   Sticky strip that appears whenever ≥1 row is selected. Single-action design:
   pick status / priority / assignee, apply, done. */
function BulkBar({
  count, busy, assignees, onClear, onApply,
}: {
  count: number; busy: boolean; assignees: QaAssignee[];
  onClear: () => void;
  onApply: (change: { status?: IssueStatus; priority?: Priority; assigned_to?: string | null }) => void;
}) {
  const { t } = useTranslation(qaT);
  const cls = "h-8 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]";
  return (
    <div className="sticky top-2 z-30 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/95 px-3 py-2 shadow-md backdrop-blur-md">
      <span className="text-[12px] font-semibold text-[var(--text-primary)]">{count} {count === 1 ? t("qa.bulk.selected1", "selected") : t("qa.bulk.selectedN", "selected")}</span>
      <select className={cls} defaultValue="" disabled={busy} onChange={(e) => { const v = e.target.value as IssueStatus; if (!v) return; onApply({ status: v }); e.target.value = ""; }}>
        <option value="">{t("qa.bulk.setStatus", "Set status…")}</option>
        {STATUSES.map((s) => <option key={s.value} value={s.value}>{t("qa.status." + s.value, s.label)}</option>)}
      </select>
      <select className={cls} defaultValue="" disabled={busy} onChange={(e) => { const v = e.target.value as Priority; if (!v) return; onApply({ priority: v }); e.target.value = ""; }}>
        <option value="">{t("qa.bulk.setPriority", "Set priority…")}</option>
        {PRIORITIES.map((s) => <option key={s.value} value={s.value}>{t("qa.priority." + s.value, s.label)}</option>)}
      </select>
      <select className={cls} defaultValue="" disabled={busy} onChange={(e) => { const v = e.target.value; if (v === "") return; onApply({ assigned_to: v === "__null" ? null : v }); e.target.value = ""; }}>
        <option value="">{t("qa.bulk.assign", "Assign to…")}</option>
        <option value="__null">{t("qa.bulk.unassign", "Unassign")}</option>
        {assignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="button" onClick={onClear} disabled={busy} className="ms-auto rounded-md px-2 py-1 text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.bulk.clear", "Clear selection")}</button>
    </div>
  );
}

/* ── Board view (Kanban by status) ───────────────────────────────────────────
   Cards grouped into columns matching the workflow steps. Click a card →
   it opens in the list (auto-switches back). Checkboxes mirror the list. */
const BOARD_COLS: IssueStatus[] = ["new", "triaged", "in_progress", "fixed", "verified", "closed"];
function BoardView({
  rows, selectedIds, onToggle, onOpen,
}: {
  rows: QaReport[]; selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation(qaT);
  const cols = useMemo(() => {
    const map = new Map<IssueStatus, QaReport[]>();
    for (const s of BOARD_COLS) map.set(s, []);
    for (const r of rows) {
      // Coalesce statuses outside the canonical set into "triaged".
      const k = (BOARD_COLS as string[]).includes(r.status) ? r.status : "triaged";
      map.get(k as IssueStatus)?.push(r);
    }
    return BOARD_COLS.map((s) => ({ status: s, rows: map.get(s) ?? [] }));
  }, [rows]);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
      {cols.map(({ status, rows: list }) => (
        <div key={status} className="overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
            <span>{t("qa.status." + status, STATUS_LABEL[status])}</span>
            <span className="rounded-full bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--text-secondary)]">{list.length}</span>
          </div>
          <div className="max-h-[68vh] overflow-y-auto p-2">
            {list.length === 0 ? (
              <div className="px-2 py-6 text-center text-[11px] text-[var(--text-ghost)]">—</div>
            ) : (
              <ul className="space-y-2">
                {list.map((r) => {
                  const d = ageDays(r.created_at);
                  const resolved = RESOLVED_STATUSES.includes(r.status);
                  return (
                    <li key={r.id}>
                      <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-2">
                        <div className="flex items-start gap-1.5">
                          <input type="checkbox" className="mt-1 shrink-0" checked={selectedIds.has(r.id)} onChange={() => onToggle(r.id)} />
                          <button type="button" onClick={() => onOpen(r.id)} className="block flex-1 text-left">
                            <div className="line-clamp-2 text-[12px] font-semibold text-[var(--text-primary)]">{r.title}</div>
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-[var(--text-dim)]">
                              <span className={`rounded px-1 py-0.5 font-semibold ${ageTone(d, resolved)}`}>{ageLabel(d)}</span>
                              <span className={`rounded px-1 py-0.5 ${PRIORITY_TONE[r.priority]}`}>{t("qa.priority." + r.priority, PRIORITY_LABEL[r.priority])}</span>
                              {r.assigned_to_name && <span className="rounded bg-[var(--bg-surface-subtle)] px-1 py-0.5">@{r.assigned_to_name}</span>}
                            </div>
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Keyboard shortcuts cheatsheet ───────────────────────────────────────── */
function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation(qaT);
  const rows: Array<[string, string]> = [
    ["j  /  ↓", t("qa.keys.next", "Next issue")],
    ["k  /  ↑", t("qa.keys.prev", "Previous issue")],
    ["/", t("qa.keys.search", "Focus the search box")],
    ["b", t("qa.keys.board", "Toggle Board / List view")],
    ["c", t("qa.keys.clearSel", "Clear bulk selection")],
    ["Esc", t("qa.keys.escape", "Close this overlay")],
    ["?", t("qa.keys.toggleHelp", "Toggle this help")],
  ];
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[14px] font-bold text-[var(--text-primary)]">{t("qa.keys.title", "Keyboard shortcuts")}</h3>
          <button type="button" onClick={onClose} className="text-[var(--text-dim)] hover:text-[var(--text-primary)]">✕</button>
        </div>
        <table className="w-full text-[12.5px]">
          <tbody>
            {rows.map(([k, label]) => (
              <tr key={k}>
                <td className="py-1 pr-3"><kbd className="rounded border border-[var(--border-color)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">{k}</kbd></td>
                <td className="py-1 text-[var(--text-secondary)]">{label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Screenshots gallery (multi-shot aware) ──────────────────────────────────
   Renders all attached screenshots with a click-to-zoom lightbox. Falls back
   to the scalar screenshot_url for legacy rows. */
function ScreenshotsGallery({ report }: { report: QaReport }) {
  const { t } = useTranslation(qaT);
  const urls = useMemo(() => {
    const arr = Array.isArray(report.screenshot_urls) ? report.screenshot_urls.filter((u): u is string => !!u) : [];
    if (arr.length > 0) return arr;
    return report.screenshot_url ? [report.screenshot_url] : [];
  }, [report.screenshot_url, report.screenshot_urls]);
  const [zoomIdx, setZoomIdx] = useState<number | null>(null);
  useEffect(() => {
    if (zoomIdx == null) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setZoomIdx(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIdx]);
  if (urls.length === 0) return null;
  const zoomUrl = zoomIdx != null ? urls[zoomIdx] : null;
  return (
    <>
      {urls.length === 1 ? (
        <button type="button" onClick={() => setZoomIdx(0)} className="block w-full overflow-hidden rounded-lg border border-[var(--border-color)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[0]} alt="screenshot" className="max-h-72 w-full bg-[var(--bg-surface-subtle)] object-contain" />
        </button>
      ) : (
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
            {t("qa.detail.screenshots", "Screenshots")} <span className="text-[var(--text-ghost)]">{urls.length}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {urls.map((u, idx) => (
              <button key={u} type="button" onClick={() => setZoomIdx(idx)} className="relative overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-subtle)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt={`screenshot ${idx + 1}`} className="h-28 w-full object-contain" />
                <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[var(--bg-secondary)]/85 px-1 text-[10px] font-bold text-[var(--text-secondary)] backdrop-blur-md">{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setZoomIdx(null); }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoomUrl} alt="full size" className="max-h-[92vh] max-w-[94vw] rounded-lg object-contain shadow-2xl" />
          <button type="button" onClick={() => setZoomIdx(null)} aria-label={t("qa.report.close", "Close")} className="fixed right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/70 text-[15px] text-white shadow-lg backdrop-blur-md hover:bg-black/90">✕</button>
          {urls.length > 1 && (
            <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/70 px-3 py-1 text-[12px] font-medium text-white shadow-lg backdrop-blur-md">{(zoomIdx ?? 0) + 1} / {urls.length}</div>
          )}
        </div>
      )}
    </>
  );
}

