"use client";

/* ---------------------------------------------------------------------------
   ReporterIssueView — the reporter-safe, read-only view of one QA issue
   (/qa/report/[id]).

   This is NOT the admin console. A reporter sees their own issue's status,
   details, public discussion and resolution, and can post a public reply.
   There are no workflow controls, no internal notes, and no developer
   metadata — the API guarantees that server-side; this component only
   renders what it receives.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";
import { useCommentAttachments, AttachmentStrip, AttachmentThumbs } from "@/components/qa/CommentAttachments";
import WatchControl from "@/components/qa/WatchControl";
import FixEvidenceSection from "@/components/qa/FixEvidenceSection";
import type { QaAttachment } from "@/lib/qa/types";
import {
  SEVERITY_LABEL,
  STATUS_LABEL,
  PRIORITY_LABEL,
  ISSUE_TYPE_LABEL,
  ACTIVITY_LABEL,
  type IssueStatus,
  type Severity,
  type Priority,
  type IssueType,
  type ActivityType,
} from "@/lib/qa/types";

interface SafeIssue {
  id: string;
  title: string;
  description: string | null;
  expected_result: string | null;
  suggested_solution: string | null;
  issue_type: IssueType;
  severity: Severity;
  priority: Priority;
  status: IssueStatus;
  app_module: string | null;
  route: string | null;
  page_title: string | null;
  screenshot_url: string | null;
  resolution_summary: string | null;
  fixed_commit: string | null;
  assigned_to_name: string | null;
  reopen_count: number;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  is_admin_view: boolean;
}
interface SafeComment {
  id: string;
  user_name: string | null;
  user_role: string | null;
  message: string;
  attachments: QaAttachment[];
  created_at: string;
  edited_at: string | null;
}
interface SafeActivity {
  id: string;
  actor_name: string | null;
  activity_type: ActivityType;
  old_value: string | null;
  new_value: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

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

function fmt(iso: string | null): string {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}
function rel(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const day = Math.round(h / 24); if (day < 30) return `${day}d ago`;
  try { return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }); } catch { return ""; }
}
function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function ReporterIssueView({ issueId }: { issueId: string }) {
  const { t } = useTranslation(qaT);
  const [issue, setIssue] = useState<SafeIssue | null>(null);
  const [comments, setComments] = useState<SafeComment[]>([]);
  const [activity, setActivity] = useState<SafeActivity[]>([]);
  // Phase 9.2
  const [evidence, setEvidence] = useState<import("@/lib/qa/types").FixEvidenceCycle[]>([]);
  const [beforeUrls, setBeforeUrls] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postErr, setPostErr] = useState<string | null>(null);
  const att = useCommentAttachments();

  const load = useCallback(async () => {
    setLoading(true); setError(null); setNotFound(false);
    try {
      const res = await fetch(`/api/qa/my-issues/${issueId}`, { credentials: "include", cache: "no-store" });
      if (res.status === 404) { setNotFound(true); setLoading(false); return; }
      const j = await res.json();
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setIssue(j.issue);
      setComments(j.comments ?? []);
      setActivity(j.activity ?? []);
      setEvidence(Array.isArray(j.fix_evidence) ? j.fix_evidence : []);
      setBeforeUrls(Array.isArray(j.before_urls) ? j.before_urls : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qa.reporter.loadErr", "Couldn't load this issue."));
    } finally { setLoading(false); }
  }, [issueId, t]);

  useEffect(() => { void load(); }, [load]);

  /* Realtime: refetch the reporter view whenever the row changes. This is
     how the "Does this fix work for you?" Verify / Reopen banner appears
     instantly the moment status flips to fixed — no manual refresh. */
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let unsub: (() => void) | undefined;
    (async () => {
      const mod = await import("@/lib/qa/realtime");
      if (cancelled) return;
      unsub = mod.subscribeToQaReport(issueId, () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { if (!cancelled) void load(); }, 250);
      });
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (unsub) unsub();
    };
  }, [issueId, load]);

  async function postReply() {
    const message = text.trim();
    if (!message && att.count === 0) return;
    setPosting(true); setPostErr(null);
    try {
      const res = await fetch(`/api/qa/my-issues/${issueId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, attachments: att.payload() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      if (j.comment) setComments((prev) => [...prev, j.comment as SafeComment]);
      setText(""); att.clear();
    } catch (e) {
      setPostErr(e instanceof Error ? e.message : t("qa.reporter.postErr", "Couldn't post your reply."));
    } finally { setPosting(false); }
  }

  const shell = "mx-auto max-w-[760px] px-4 py-8 sm:px-6";

  if (loading) {
    return <div className={shell}><div className="py-24 text-center text-[13px] text-[var(--text-dim)]">{t("qa.common.loading", "Loading…")}</div></div>;
  }

  // Deleted issue OR not yours — same graceful fallback, no existence leak.
  if (notFound || !issue) {
    return (
      <div className={shell}>
        <div className="flex flex-col items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-6 py-16 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-surface)] text-[20px] text-[var(--text-dim)]">⌀</div>
          <h1 className="text-[16px] font-bold text-[var(--text-primary)]">{t("qa.reporter.notFoundTitle", "This issue is unavailable")}</h1>
          <p className="mt-1.5 max-w-sm text-[13px] text-[var(--text-dim)]">
            {t("qa.reporter.notFound", "This issue no longer exists or was deleted — or it isn’t one you reported. Any notification about it stays readable in your bell.")}
          </p>
          <Link href="/" className="mt-5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-2 text-[12.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            {t("qa.reporter.home", "Back to Hub")}
          </Link>
        </div>
      </div>
    );
  }

  const label = "block text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)] mb-1";
  const box = "rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap break-words";

  return (
    <div className={shell}>
      {/* Page header — issue dc295123 follow-up (Kamal): when the reporter
          lands here from a notification deep-link there was no in-page nav,
          no breadcrumb, no way back. This strip is the page identity + the
          escape hatch: Back, what page this is, where the underlying issue
          lives. Sticky-top so it's reachable while scrolling long discussions. */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[12px]">
            <Link
              href="/"
              className="flex items-center gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              aria-label="Back to Hub"
            >
              <span aria-hidden>←</span>
              <span>{t("qa.reporter.backHub", "Hub")}</span>
            </Link>
            <span className="text-[var(--text-ghost)]" aria-hidden>/</span>
            <span className="font-semibold text-[var(--text-primary)]">
              {t("qa.reporter.pageTitle", "My Issue Report")}
            </span>
            {issue.app_module && (
              <>
                <span className="text-[var(--text-ghost)]" aria-hidden>·</span>
                <span className="text-[var(--text-secondary)]">{issue.app_module}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            {issue.route && (
              <Link
                href={issue.route}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                title={`Go to ${issue.route}`}
              >
                {t("qa.reporter.openRoute", "Open page where this happened")} ↗
              </Link>
            )}
            {issue.is_admin_view && (
              <Link
                href={`/database/issues?issue=${issue.id}`}
                className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                {t("qa.reporter.adminPanel", "Admin panel")} ↗
              </Link>
            )}
          </div>
        </div>
      </div>

      {issue.is_admin_view && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
          <span>{t("qa.reporter.adminNote", "You’re viewing the reporter experience as an admin.")}</span>
          <Link href={`/database/issues?issue=${issue.id}`} className="font-semibold text-[var(--accent)] hover:underline">{t("qa.reporter.openConsole", "Open in QA Console →")}</Link>
        </div>
      )}

      {/* Header */}
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${SEVERITY_TONE[issue.severity]}`}>{t("qa.severity." + issue.severity, SEVERITY_LABEL[issue.severity])}</span>
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${STATUS_TONE[issue.status]}`}>{t("qa.status." + issue.status, STATUS_LABEL[issue.status])}</span>
        <span className="text-[11px] text-[var(--text-dim)]">{t("qa.issueType." + issue.issue_type, ISSUE_TYPE_LABEL[issue.issue_type])} · {t("qa.priority." + issue.priority, PRIORITY_LABEL[issue.priority])} {t("qa.badge.priorityWord", "priority")}</span>
      </div>
      <h1 className="text-[18px] font-bold text-[var(--text-primary)]">{issue.title}</h1>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-dim)]">
        {issue.app_module && <span><b className="text-[var(--text-secondary)]">{t("qa.reporter.module", "Module:")}</b> {issue.app_module}</span>}
        <span><b className="text-[var(--text-secondary)]">{t("qa.reporter.filed", "Filed:")}</b> {fmt(issue.created_at)}</span>
        {issue.assigned_to_name && <span><b className="text-[var(--text-secondary)]">{t("qa.reporter.owner", "Owner:")}</b> {issue.assigned_to_name}</span>}
        {issue.reopen_count > 0 && <span>{t("qa.reporter.reopenedTimes", "Reopened")} ×{issue.reopen_count}</span>}
      </div>

      <div className="mt-3"><WatchControl issueId={issue.id} /></div>

      {/* Resolution banner */}
      {(issue.resolution_summary || issue.status === "fixed" || issue.status === "verified" || issue.status === "closed") && (
        <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-3.5 py-3">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">{t("qa.reporter.resolution", "Resolution")}</div>
          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-[var(--text-secondary)]">
            {issue.resolution_summary || t("qa.reporter.resolutionDefault", "This issue has been addressed by the team.")}
          </p>
          {issue.fixed_commit && <p className="mt-1 font-mono text-[11px] text-[var(--text-dim)]">{t("qa.reporter.fix", "Fix:")} {issue.fixed_commit}</p>}
        </div>
      )}

      {/* Reporter verification loop — only available while status is "fixed".
          Verify confirms the fix; Reopen pushes back with a reason. */}
      {issue.status === "fixed" && (
        <VerifyControl issueId={issue.id} onChanged={load} />
      )}

      {/* Phase 9.2 — Fix Evidence (BEFORE / AFTER). Shows whenever any cycle
          exists, regardless of current status — so a reopened-then-re-fixed
          issue still shows the full history. */}
      <FixEvidenceSection beforeUrls={beforeUrls} cycles={evidence} />


      {issue.screenshot_url && (
        <a href={issue.screenshot_url} target="_blank" rel="noreferrer" className="mt-4 block overflow-hidden rounded-lg border border-[var(--border-color)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={issue.screenshot_url} alt="screenshot" className="max-h-80 w-full bg-[var(--bg-surface-subtle)] object-contain" />
        </a>
      )}

      <div className="mt-4 space-y-3">
        <div><div className={label}>{t("qa.reporter.whatHappened", "What happened")}</div><div className={box}>{issue.description || "—"}</div></div>
        <div><div className={label}>{t("qa.reporter.expectedResult", "Expected result")}</div><div className={box}>{issue.expected_result || "—"}</div></div>
        {issue.suggested_solution && <div><div className={label}>{t("qa.reporter.yourSuggestion", "Your suggestion")}</div><div className={box}>{issue.suggested_solution}</div></div>}
      </div>

      {/* Public discussion */}
      <div className="mt-5 space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("qa.discussion.title", "Discussion")}{comments.length > 0 ? ` · ${comments.length}` : ""}</div>
        {comments.length === 0 ? (
          <div className="py-3 text-center text-[12px] text-[var(--text-dim)]">{t("qa.reporter.noReplies", "No replies yet. Add details below if anything’s missing.")}</div>
        ) : (
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
                <div className="mb-0.5 flex items-center gap-1.5 text-[10.5px]">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-surface-active)] text-[8px] font-bold text-[var(--text-secondary)]">{initials(c.user_name)}</span>
                  <span className="font-semibold text-[var(--text-secondary)]">{c.user_name ?? "—"}</span>
                  {c.user_role && <span className="rounded bg-[var(--bg-surface)] px-1 text-[9px] text-[var(--text-dim)]">{c.user_role}</span>}
                  <span className="ms-auto text-[var(--text-dim)]">{rel(c.created_at)}{c.edited_at ? ` · ${t("qa.discussion.edited", "edited")}` : ""}</span>
                </div>
                {c.message && <div className="whitespace-pre-wrap break-words text-[12.5px] text-[var(--text-primary)]">{c.message}</div>}
                <AttachmentThumbs attachments={c.attachments ?? []} />
              </li>
            ))}
          </ul>
        )}

        {postErr && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11.5px] text-rose-500 dark:text-rose-300">{postErr}</div>}
        <div className="space-y-1.5 pt-1" onDrop={att.onDrop} onDragOver={att.onDragOver}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={att.onPaste}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void postReply(); }}
            rows={2}
            placeholder={t("qa.reporter.replyPlaceholder", "Add a public reply, paste/drop a screenshot…  (⌘/Ctrl+Enter to send)")}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
          />
          <AttachmentStrip att={att} disabled={posting} />
          <div className="flex justify-end">
            <button type="button" onClick={postReply} disabled={posting || (!text.trim() && att.count === 0)} className="rounded-lg bg-[var(--bg-inverted)] px-4 py-1.5 text-[13px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-40">
              {posting ? t("qa.reporter.posting", "Posting…") : t("qa.reporter.reply", "Reply")}
            </button>
          </div>
        </div>
      </div>

      {/* Public timeline */}
      {activity.length > 0 && (
        <div className="mt-4 space-y-2 rounded-xl border border-[var(--border-subtle)] p-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("qa.activityPanel.title", "Activity")}</div>
          <ol className="space-y-1.5">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-[12px]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--text-dim)]" />
                <span className="text-[var(--text-secondary)]">
                  <b className="font-semibold text-[var(--text-primary)]">{a.actor_name ?? t("qa.reporter.theTeam", "The team")}</b>{" "}
                  {a.activity_type === "status_changed" && a.new_value
                    ? `${t("qa.reporter.movedThisTo", "moved this to")} ${t("qa.status." + a.new_value, STATUS_LABEL[a.new_value as IssueStatus] ?? a.new_value)}`
                    : t("qa.activity." + a.activity_type, ACTIVITY_LABEL[a.activity_type] ?? a.activity_type)}
                  <span className="ms-1.5 text-[var(--text-dim)]">· {rel(a.created_at)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}
    </div>
  );
}

/* ── Reporter verification loop ────────────────────────────────────────────
   Calls POST /api/qa/my-issues/[id]/action with { action: "verify"|"reopen" }.
   Reopen requires a non-empty reason. On success, the caller refreshes the
   detail view so the status pill / banner reflect the new state. */
function VerifyControl({ issueId, onChanged }: { issueId: string; onChanged: () => void }) {
  const { t } = useTranslation(qaT);
  const [busy, setBusy] = useState<"verify" | "reopen" | null>(null);
  const [showReopen, setShowReopen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const send = async (action: "verify" | "reopen", reasonText?: string) => {
    setBusy(action); setErr(null);
    try {
      const res = await fetch(`/api/qa/my-issues/${issueId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action, reason: reasonText ?? null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setShowReopen(false); setReason("");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t("qa.reporter.verifyErr", "Couldn't update the issue."));
    } finally { setBusy(null); }
  };
  return (
    <div className="mt-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-subtle)] px-3.5 py-3">
      <div className="text-[12.5px] font-semibold text-[var(--text-primary)]">{t("qa.reporter.verifyTitle", "Does this fix work for you?")}</div>
      <div className="mt-0.5 text-[11.5px] text-[var(--text-dim)]">{t("qa.reporter.verifyHint", "Confirm the fix or push back if it's not really fixed.")}</div>
      {!showReopen ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => send("verify")}
            disabled={busy !== null}
            className="rounded-lg bg-emerald-500 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "verify" ? t("qa.reporter.verifying", "Verifying…") : t("qa.reporter.verify", "Verify — it works")}
          </button>
          <button
            type="button"
            onClick={() => setShowReopen(true)}
            disabled={busy !== null}
            className="rounded-lg border border-[var(--border-color)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {t("qa.reporter.reopen", "It's not fixed — reopen")}
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={t("qa.reporter.reopenPlaceholder", "Briefly describe what's still broken…")}
            className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-focus)]"
          />
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => { setShowReopen(false); setReason(""); }} disabled={busy !== null} className="rounded-md px-3 py-1.5 text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">{t("qa.common.cancel", "Cancel")}</button>
            <button
              type="button"
              onClick={() => send("reopen", reason.trim())}
              disabled={busy !== null || reason.trim().length === 0}
              className="rounded-lg bg-[var(--bg-inverted)] px-3.5 py-1.5 text-[12.5px] font-semibold text-[var(--text-inverted)] shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy === "reopen" ? t("qa.reporter.reopening", "Reopening…") : t("qa.reporter.confirmReopen", "Confirm reopen")}
            </button>
          </div>
        </div>
      )}
      {err && <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-[11.5px] text-rose-500 dark:text-rose-300">{err}</div>}
    </div>
  );
}
