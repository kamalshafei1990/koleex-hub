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
interface Investigation {
  possible_causes: Array<{ cause: string; evidence: string }>;
  regression_flags: Array<{ label: string; detail: string }>;
  hotspot_flags: Array<{ label: string; detail: string }>;
  related_patterns: Array<{ pattern: string; count: number; examples: string[] }>;
  suggested_files: string[];
  investigation_notes: string[];
  risk_score: number;
  confidence_score: number;
  module_health_snapshot: { module: string | null; total: number; open: number; urgent: number; reopened: number; duplicates: number };
  generated_summary: string;
}
interface Workspace {
  issue_snapshot: Record<string, unknown>;
  related_components: Array<{ name: string | null; module: string | null; section: string | null; record_id: string | null }>;
  related_issues: RelatedIssue[];
  reproduction_summary: string;
  debug_context: { assignee_name: string | null; watchers_count: number; comments: WsComment[]; activity: Array<{ actor: string | null; type: string; new_value: string | null; created_at: string }> };
  screenshot_url: string | null;
  generated_prompt: string;
  generation_version: string;
  investigation?: Investigation | null;
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
  const [tab, setTab] = useState<"overview" | "investigation">("overview");

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
              {/* Tabs */}
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setTab("overview")} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${tab === "overview" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>Overview</button>
                <button type="button" onClick={() => setTab("investigation")} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${tab === "investigation" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>
                  Investigation{ws.investigation ? ` · risk ${ws.investigation.risk_score}` : ""}
                </button>
              </div>

              {tab === "investigation" ? (
                <InvestigationPanel inv={ws.investigation ?? null} />
              ) : (
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
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ── Investigation panel (deterministic engineering dashboard) ───────────── */
function Gauge({ label, value, tone }: { label: string; value: number; tone: "risk" | "confidence" }) {
  const color = tone === "risk"
    ? (value >= 66 ? "bg-rose-500" : value >= 33 ? "bg-amber-500" : "bg-emerald-500")
    : "bg-[var(--accent)]";
  return (
    <div className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
      <div className="flex items-baseline justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{label}</span>
        <span className="text-[18px] font-bold tabular-nums text-[var(--text-primary)]">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
        <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function InvestigationPanel({ inv }: { inv: Investigation | null }) {
  const card = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3";
  const head = "text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5";
  if (!inv) return <div className="py-10 text-center text-[12px] text-[var(--text-dim)]">No analysis available.</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Gauge label="Risk" value={inv.risk_score} tone="risk" />
        <Gauge label="Confidence" value={inv.confidence_score} tone="confidence" />
      </div>

      <div className={card}>
        <div className={head}>Summary</div>
        <p className="text-[12.5px] text-[var(--text-secondary)]">{inv.generated_summary}</p>
      </div>

      <div className={card}>
        <div className={head}>Possible Causes</div>
        {inv.possible_causes.length === 0 ? (
          <div className="text-[12px] text-[var(--text-dim)]">No strong cause detected.</div>
        ) : (
          <ul className="space-y-1.5">
            {inv.possible_causes.map((c, i) => (
              <li key={i} className="text-[12px]"><b className="text-[var(--text-primary)]">{c.cause}</b><div className="text-[11px] text-[var(--text-dim)]">{c.evidence}</div></li>
            ))}
          </ul>
        )}
      </div>

      {inv.regression_flags.length > 0 && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-300">Regression Warnings</div>
          <ul className="space-y-1">
            {inv.regression_flags.map((f, i) => (<li key={i} className="text-[12px] text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">{f.label}:</b> {f.detail}</li>))}
          </ul>
        </div>
      )}

      {inv.hotspot_flags.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">Hotspot Warnings</div>
          <ul className="space-y-1">
            {inv.hotspot_flags.map((f, i) => (<li key={i} className="text-[12px] text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">{f.label}:</b> {f.detail}</li>))}
          </ul>
        </div>
      )}

      <div className={card}>
        <div className={head}>Suggested Investigation Files</div>
        {inv.suggested_files.length === 0 ? (
          <div className="text-[12px] text-[var(--text-dim)]">None derived.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {inv.suggested_files.map((f) => (<code key={f} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">{f}</code>))}
          </div>
        )}
      </div>

      {inv.related_patterns.length > 0 && (
        <div className={card}>
          <div className={head}>Related Patterns</div>
          <ul className="space-y-1">
            {inv.related_patterns.map((p, i) => (<li key={i} className="text-[12px] text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">{p.pattern}</b> · {p.count}</li>))}
          </ul>
        </div>
      )}

      <div className={card}>
        <div className={head}>Module Health · {inv.module_health_snapshot.module ?? "—"}</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([["Total", inv.module_health_snapshot.total], ["Open", inv.module_health_snapshot.open], ["Urgent", inv.module_health_snapshot.urgent], ["Reopened", inv.module_health_snapshot.reopened], ["Duplicates", inv.module_health_snapshot.duplicates]] as const).map(([k, v]) => (
            <div key={k} className="rounded-lg bg-[var(--bg-surface)] py-2">
              <div className="text-[16px] font-bold tabular-nums text-[var(--text-primary)]">{v}</div>
              <div className="text-[9.5px] uppercase tracking-wider text-[var(--text-dim)]">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="px-1 text-[10.5px] text-[var(--text-dim)]">Findings derived deterministically from issue history — verify before acting.</p>
    </div>
  );
}
