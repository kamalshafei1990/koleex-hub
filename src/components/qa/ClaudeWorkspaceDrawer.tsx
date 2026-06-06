"use client";

/* ---------------------------------------------------------------------------
   ClaudeWorkspaceDrawer — the admin-only Debug Workspace panel (Phase 6).

   Opens over the QA console, fetches the deterministic workspace
   (/api/qa/[id]/workspace), and shows the structured sections + the
   copy-paste-ready Claude prompt. "Regenerate" force-rebuilds the cache.
   Reuses AttachmentThumbs for image previews. No AI.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import { AttachmentThumbs } from "@/components/qa/CommentAttachments";
import { STATUS_LABEL, type IssueStatus, type QaAttachment } from "@/lib/qa/types";

interface RelatedIssue { id: string; title: string; status: IssueStatus; reasons: string[] }
interface WsComment { author: string | null; role: string | null; internal: boolean; message: string; created_at: string; attachments: QaAttachment[] }
interface Workspace {
  issue_snapshot: Record<string, unknown>;
  related_components: Array<{ name: string | null; module: string | null; section: string | null; record_id: string | null }>;
  related_issues: RelatedIssue[];
  reproduction_summary: string;
  debug_context: { assignee_name: string | null; watchers_count: number; comments: WsComment[]; activity: Array<{ actor: string | null; type: string; new_value: string | null; created_at: string }> };
  screenshot_url: string | null;
  generated_prompt: string;
  generation_version: string;
  cached?: boolean;
}

function rel(iso: string): string {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }); } catch { return iso; }
}

export default function ClaudeWorkspaceDrawer({ issueId, onClose, onJump }: { issueId: string; onClose: () => void; onJump?: (id: string) => void }) {
  const [ws, setWs] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async (regenerate = false) => {
    if (regenerate) setRegenerating(true); else setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        regenerate ? `/api/qa/${issueId}/workspace/regenerate` : `/api/qa/${issueId}/workspace`,
        { method: regenerate ? "POST" : "GET", credentials: "include", cache: "no-store" },
      );
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setWs({ ...(j.workspace as Workspace), cached: j.cached });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the workspace.");
    } finally { setLoading(false); setRegenerating(false); }
  }, [issueId]);

  useEffect(() => { void load(false); }, [load]);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copyPrompt() {
    if (!ws) return;
    navigator.clipboard?.writeText(ws.generated_prompt)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); })
      .catch(() => setError("Clipboard blocked — select & copy manually."));
  }

  const s = ws?.issue_snapshot ?? {};
  const btn = "rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-50";
  const card = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3";
  const head = "text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5";

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/40" onClick={onClose} role="dialog" aria-modal="true">
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[640px] flex-col border-s border-[var(--border-subtle)] bg-[var(--bg-secondary)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
          <div className="flex items-center gap-1.5">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z" />
            </svg>
            <span className="text-[14px] font-bold text-[var(--text-primary)]">Claude Debug Workspace</span>
            {ws && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] text-[var(--text-dim)]">v{ws.generation_version}{ws.cached ? " · cached" : " · fresh"}</span>}
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            <button type="button" className={btn} onClick={() => load(true)} disabled={regenerating || loading}>{regenerating ? "Regenerating…" : "Regenerate"}</button>
            <button type="button" className={btn} onClick={copyPrompt} disabled={!ws}>{copied ? "Copied ✓" : "Copy Claude Prompt"}</button>
            <button type="button" aria-label="Close" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-[16px] text-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">×</button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-16 text-center text-[13px] text-[var(--text-dim)]">Building workspace…</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>
          ) : ws ? (
            <>
              {/* Component info */}
              <div className={card}>
                <div className={head}>Component & Context</div>
                <div className="text-[12.5px] text-[var(--text-secondary)]">
                  <div><b className="text-[var(--text-primary)]">{String(s.title ?? "—")}</b></div>
                  <div className="mt-1 text-[11.5px] text-[var(--text-dim)]">
                    {String(s.app_module ?? "—")} · {String(s.route ?? "—")}
                    {ws.debug_context.assignee_name ? ` · @${ws.debug_context.assignee_name}` : ""}
                    {ws.debug_context.watchers_count > 0 ? ` · ${ws.debug_context.watchers_count} watching` : ""}
                  </div>
                  {s.component_name ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px]">
                      {s.component_module ? <><span>{String(s.component_module)}</span><span className="text-[var(--text-ghost)]">→</span></> : null}
                      {s.component_section ? <><span>{String(s.component_section)}</span><span className="text-[var(--text-ghost)]">→</span></> : null}
                      <span className="font-semibold text-[var(--text-primary)]">{String(s.component_name)}</span>
                      {s.component_record_id ? <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10.5px]">#{String(s.component_record_id)}</span> : null}
                    </div>
                  ) : <div className="mt-1 text-[11.5px] text-[var(--text-dim)]">Whole-page report (no component pinned).</div>}
                </div>
              </div>

              {/* Attachments */}
              {(ws.screenshot_url || ws.debug_context.comments.some((c) => c.attachments?.length)) && (
                <div className={card}>
                  <div className={head}>Attachments</div>
                  {ws.screenshot_url && (
                    <AttachmentThumbs attachments={[{ path: "screenshot", name: "Issue screenshot", type: "image", size: 0, url: ws.screenshot_url }]} />
                  )}
                  {ws.debug_context.comments.map((c, i) =>
                    c.attachments?.length ? <AttachmentThumbs key={i} attachments={c.attachments} internal={c.internal} /> : null,
                  )}
                </div>
              )}

              {/* Related issues */}
              <div className={card}>
                <div className={head}>Related Issues</div>
                {ws.related_issues.length === 0 ? (
                  <div className="text-[12px] text-[var(--text-dim)]">None found in the recent timeframe.</div>
                ) : (
                  <ul className="space-y-1.5">
                    {ws.related_issues.map((r) => (
                      <li key={r.id} className="text-[12px]">
                        <button type="button" onClick={() => onJump?.(r.id)} className="font-semibold text-[var(--accent)] hover:underline">{r.title}</button>
                        <span className="ms-1 rounded bg-[var(--bg-surface)] px-1 text-[10px] text-[var(--text-dim)]">{STATUS_LABEL[r.status] ?? r.status}</span>
                        <div className="text-[10.5px] text-[var(--text-dim)]">{r.reasons.join(" · ")}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Timeline */}
              <div className={card}>
                <div className={head}>Timeline</div>
                {ws.debug_context.activity.length === 0 ? (
                  <div className="text-[12px] text-[var(--text-dim)]">No recorded activity.</div>
                ) : (
                  <ol className="space-y-1">
                    {ws.debug_context.activity.slice(-12).map((a, i) => (
                      <li key={i} className="text-[11.5px] text-[var(--text-secondary)]">
                        <span className="text-[var(--text-dim)]">{rel(a.created_at)}</span> — <b className="text-[var(--text-primary)]">{a.actor ?? "Someone"}</b> {a.type.replace(/_/g, " ")}{a.new_value ? `: ${a.new_value}` : ""}
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Generated prompt */}
              <div className={card}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className={head + " mb-0"}>Generated Claude Prompt</span>
                  <button type="button" className={btn} onClick={copyPrompt}>{copied ? "Copied ✓" : "Copy"}</button>
                </div>
                <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)]">{ws.generated_prompt}</pre>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
