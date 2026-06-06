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
import { copyText } from "@/lib/ui/clipboard";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";
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
  const [tab, setTab] = useState<"overview" | "investigation" | "ai">("overview");
  const { t } = useTranslation(qaT);

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
      setError(e instanceof Error ? e.message : t("qa.ws.buildErr", "Couldn't build the workspace."));
    } finally { setLoading(false); setRegenerating(false); }
  }, [issueId, t]);

  useEffect(() => { void load(false); }, [load]);

  // Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function copyPrompt() {
    if (!ws) return;
    void copyText(ws.generated_prompt).then((ok) => {
      if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
      else setError(t("qa.ws.copyManual", "Couldn't copy — select the prompt text and copy manually."));
    });
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
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.6 5.7 21l2.3-7.2-6-4.4h7.6z" />
            </svg>
            <span className="text-[14px] font-bold text-[var(--text-primary)]">{t("qa.ws.title", "AI Debug Workspace")}</span>
            {ws && <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[9px] text-[var(--text-dim)]">v{ws.generation_version}{ws.cached ? ` · ${t("qa.ws.cached", "cached")}` : ` · ${t("qa.ws.fresh", "fresh")}`}</span>}
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            <button type="button" className={btn} onClick={() => load(true)} disabled={regenerating || loading}>{regenerating ? t("qa.ws.regenerating", "Regenerating…") : t("qa.ws.regenerate", "Regenerate")}</button>
            <button type="button" className={btn} onClick={copyPrompt} disabled={!ws}>{copied ? t("qa.common.copied", "Copied ✓") : t("qa.detail.copyPrompt", "Copy AI Prompt")}</button>
            <button type="button" aria-label="Close" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md text-[16px] text-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]">×</button>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="py-16 text-center text-[13px] text-[var(--text-dim)]">{t("qa.ws.building", "Building workspace…")}</div>
          ) : error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>
          ) : ws ? (
            <>
              {/* Tabs */}
              <div className="flex gap-1.5">
                <button type="button" onClick={() => setTab("overview")} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${tab === "overview" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>{t("qa.ws.tabOverview", "Overview")}</button>
                <button type="button" onClick={() => setTab("investigation")} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${tab === "investigation" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>
                  {t("qa.ws.tabInvestigation", "Investigation")}{ws.investigation ? ` · risk ${ws.investigation.risk_score}` : ""}
                </button>
                <button type="button" onClick={() => setTab("ai")} className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${tab === "ai" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"}`}>{t("qa.ws.tabAi", "AI Analysis")}</button>
              </div>

              {tab === "ai" ? (
                <AiAnalysisPanel issueId={issueId} />
              ) : tab === "investigation" ? (
                <InvestigationPanel inv={ws.investigation ?? null} />
              ) : (
              <>
              {/* Component info */}
              <div className={card}>
                <div className={head}>{t("qa.ws.componentContext", "Component & Context")}</div>
                <div className="text-[12.5px] text-[var(--text-secondary)]">
                  <div><b className="text-[var(--text-primary)]">{String(s.title ?? "—")}</b></div>
                  <div className="mt-1 text-[11.5px] text-[var(--text-dim)]">
                    {String(s.app_module ?? "—")} · {String(s.route ?? "—")}
                    {ws.debug_context.assignee_name ? ` · @${ws.debug_context.assignee_name}` : ""}
                    {ws.debug_context.watchers_count > 0 ? ` · ${ws.debug_context.watchers_count} ${t("qa.ws.watching", "watching")}` : ""}
                  </div>
                  {s.component_name ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px]">
                      {s.component_module ? <><span>{String(s.component_module)}</span><span className="text-[var(--text-ghost)]">→</span></> : null}
                      {s.component_section ? <><span>{String(s.component_section)}</span><span className="text-[var(--text-ghost)]">→</span></> : null}
                      <span className="font-semibold text-[var(--text-primary)]">{String(s.component_name)}</span>
                      {s.component_record_id ? <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10.5px]">#{String(s.component_record_id)}</span> : null}
                    </div>
                  ) : <div className="mt-1 text-[11.5px] text-[var(--text-dim)]">{t("qa.ws.wholePage", "Whole-page report (no component pinned).")}</div>}
                </div>
              </div>

              {/* Attachments */}
              {(ws.screenshot_url || ws.debug_context.comments.some((c) => c.attachments?.length)) && (
                <div className={card}>
                  <div className={head}>{t("qa.ws.attachments", "Attachments")}</div>
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
                <div className={head}>{t("qa.ws.relatedIssues", "Related Issues")}</div>
                {ws.related_issues.length === 0 ? (
                  <div className="text-[12px] text-[var(--text-dim)]">{t("qa.ws.relatedNone", "None found in the recent timeframe.")}</div>
                ) : (
                  <ul className="space-y-1.5">
                    {ws.related_issues.map((r) => (
                      <li key={r.id} className="text-[12px]">
                        <button type="button" onClick={() => onJump?.(r.id)} className="font-semibold text-[var(--accent)] hover:underline">{r.title}</button>
                        <span className="ms-1 rounded bg-[var(--bg-surface)] px-1 text-[10px] text-[var(--text-dim)]">{t("qa.status." + r.status, STATUS_LABEL[r.status] ?? r.status)}</span>
                        <div className="text-[10.5px] text-[var(--text-dim)]">{r.reasons.join(" · ")}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Timeline */}
              <div className={card}>
                <div className={head}>{t("qa.ws.timeline", "Timeline")}</div>
                {ws.debug_context.activity.length === 0 ? (
                  <div className="text-[12px] text-[var(--text-dim)]">{t("qa.ws.timelineNone", "No recorded activity.")}</div>
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
                  <span className={head + " mb-0"}>{t("qa.ws.generatedPrompt", "Generated AI Prompt")}</span>
                  <button type="button" className={btn} onClick={copyPrompt}>{copied ? t("qa.common.copied", "Copied ✓") : t("qa.common.copy", "Copy")}</button>
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
    : "bg-[var(--text-primary)]";
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
  const { t } = useTranslation(qaT);
  const card = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3";
  const head = "text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5";
  if (!inv) return <div className="py-10 text-center text-[12px] text-[var(--text-dim)]">{t("qa.inv.none", "No analysis available.")}</div>;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Gauge label={t("qa.inv.risk", "Risk")} value={inv.risk_score} tone="risk" />
        <Gauge label={t("qa.inv.confidence", "Confidence")} value={inv.confidence_score} tone="confidence" />
      </div>

      <div className={card}>
        <div className={head}>{t("qa.inv.summary", "Summary")}</div>
        <p className="text-[12.5px] text-[var(--text-secondary)]">{inv.generated_summary}</p>
      </div>

      <div className={card}>
        <div className={head}>{t("qa.inv.causes", "Possible Causes")}</div>
        {inv.possible_causes.length === 0 ? (
          <div className="text-[12px] text-[var(--text-dim)]">{t("qa.inv.causesNone", "No strong cause detected.")}</div>
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
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-300">{t("qa.inv.regression", "Regression Warnings")}</div>
          <ul className="space-y-1">
            {inv.regression_flags.map((f, i) => (<li key={i} className="text-[12px] text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">{f.label}:</b> {f.detail}</li>))}
          </ul>
        </div>
      )}

      {inv.hotspot_flags.length > 0 && (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-300">{t("qa.inv.hotspot", "Hotspot Warnings")}</div>
          <ul className="space-y-1">
            {inv.hotspot_flags.map((f, i) => (<li key={i} className="text-[12px] text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">{f.label}:</b> {f.detail}</li>))}
          </ul>
        </div>
      )}

      <div className={card}>
        <div className={head}>{t("qa.inv.suggestedFiles", "Suggested Investigation Files")}</div>
        {inv.suggested_files.length === 0 ? (
          <div className="text-[12px] text-[var(--text-dim)]">{t("qa.inv.filesNone", "None derived.")}</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {inv.suggested_files.map((f) => (<code key={f} className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--text-secondary)]">{f}</code>))}
          </div>
        )}
      </div>

      {inv.related_patterns.length > 0 && (
        <div className={card}>
          <div className={head}>{t("qa.inv.patterns", "Related Patterns")}</div>
          <ul className="space-y-1">
            {inv.related_patterns.map((p, i) => (<li key={i} className="text-[12px] text-[var(--text-secondary)]"><b className="text-[var(--text-primary)]">{p.pattern}</b> · {p.count}</li>))}
          </ul>
        </div>
      )}

      <div className={card}>
        <div className={head}>{t("qa.inv.moduleHealth", "Module Health")} · {inv.module_health_snapshot.module ?? "—"}</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          {([["qa.inv.total", "Total", inv.module_health_snapshot.total], ["qa.inv.open", "Open", inv.module_health_snapshot.open], ["qa.inv.urgent", "Urgent", inv.module_health_snapshot.urgent], ["qa.inv.reopened", "Reopened", inv.module_health_snapshot.reopened], ["qa.inv.duplicates", "Duplicates", inv.module_health_snapshot.duplicates]] as const).map(([key, label, v]) => (
            <div key={key} className="rounded-lg bg-[var(--bg-surface)] py-2">
              <div className="text-[16px] font-bold tabular-nums text-[var(--text-primary)]">{v}</div>
              <div className="text-[9.5px] uppercase tracking-wider text-[var(--text-dim)]">{t(key, label)}</div>
            </div>
          ))}
        </div>
      </div>

      <p className="px-1 text-[10.5px] text-[var(--text-dim)]">{t("qa.inv.footer", "Findings derived deterministically from issue history — verify before acting.")}</p>
    </div>
  );
}

/* ── AI Analysis panel (engineering analysis — NOT a chat) ───────────────── */
interface AiSession {
  id: string; issue_id: string; provider: string | null; model: string | null;
  status: "pending" | "completed" | "failed"; response_markdown: string | null;
  error: string | null; tokens_input: number | null; tokens_output: number | null;
  latency_ms: number | null; created_at: string; confidence?: string | null;
}

function confidenceTone(c: string | null | undefined): string {
  if (c === "High") return "border-emerald-500/30 text-emerald-600 dark:text-emerald-300";
  if (c === "Medium") return "border-amber-500/30 text-amber-600 dark:text-amber-300";
  if (c === "Low") return "border-rose-500/30 text-rose-600 dark:text-rose-300";
  return "border-[var(--border-color)] text-[var(--text-dim)]";
}

/* Minimal structured renderer: splits on "## " headers, bolds them, renders
   "- " bullets. Deliberately not a full markdown engine — engineering report. */
function AiReport({ markdown }: { markdown: string }) {
  const blocks = markdown.split(/\n(?=##\s)/g);
  return (
    <div className="space-y-2.5">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        const headerLine = lines[0]?.startsWith("##") ? lines[0].replace(/^#+\s*/, "") : null;
        const body = (headerLine ? lines.slice(1) : lines).filter((l) => l.trim());
        return (
          <div key={i} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3">
            {headerLine && <div className="mb-1 text-[12px] font-bold text-[var(--text-primary)]">{headerLine}</div>}
            <div className="space-y-1">
              {body.map((line, j) => {
                const t = line.trim();
                if (/^[-*]\s/.test(t)) return <div key={j} className="flex gap-1.5 text-[12px] text-[var(--text-secondary)]"><span className="text-[var(--text-ghost)]">•</span><span>{t.replace(/^[-*]\s/, "")}</span></div>;
                return <p key={j} className="text-[12px] leading-relaxed text-[var(--text-secondary)]">{t}</p>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AiAnalysisPanel({ issueId }: { issueId: string }) {
  const [sessions, setSessions] = useState<AiSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation(qaT);

  // Koleex AI actions: summarize / Arabic / Chinese / final solution + voice.
  type TxMode = "summary" | "ar" | "zh" | "solution";
  const [tx, setTx] = useState<{ mode: TxMode; text: string; lang: string } | null>(null);
  const [txBusy, setTxBusy] = useState<TxMode | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const card = "rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3";
  const head = "text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)] mb-1.5";
  const btn = "rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)] disabled:opacity-50";

  const loadSessions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/qa/${issueId}/ai/sessions`, { credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      const list = (j.sessions as AiSession[]) ?? [];
      setSessions(list);
      setActiveId((prev) => prev ?? list.find((s) => s.status === "completed")?.id ?? list[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qa.ai.sessionsErr", "Couldn't load AI sessions."));
    } finally { setLoading(false); }
  }, [issueId, t]);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  async function runAnalysis() {
    setRunning(true); setError(null);
    try {
      const res = await fetch(`/api/qa/${issueId}/ai/analyze`, { method: "POST", credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      const session = j.session as AiSession;
      setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)]);
      setActiveId(session.id);
      if (session.status === "failed") setError(session.error ?? t("qa.ai.runErr", "AI analysis failed."));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qa.ai.runErr", "AI analysis failed."));
    } finally { setRunning(false); }
  }

  const active = sessions.find((s) => s.id === activeId) ?? null;

  function copyActive() {
    if (!active?.response_markdown) return;
    void copyText(active.response_markdown).then((ok) => {
      if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
      else setError(t("qa.ws.copyManual", "Couldn't copy — select the prompt text and copy manually."));
    });
  }

  const TX_LANG: Record<TxMode, string> = { summary: "en-US", solution: "en-US", ar: "ar", zh: "zh-CN" };
  async function runTransform(mode: TxMode) {
    if (!active?.id || txBusy) return;
    stopSpeak();
    setTxBusy(mode); setError(null);
    try {
      const res = await fetch(`/api/qa/${issueId}/ai/transform`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId: active.id, mode }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setTx({ mode, text: (j.text as string) ?? "", lang: TX_LANG[mode] });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("qa.ai.txErr", "Koleex AI couldn't process that."));
    } finally { setTxBusy(null); }
  }

  /* Read-aloud via the browser's built-in speech synthesis (no backend).
     Reads whatever is currently shown — the transform result if present,
     else the analysis — in the matching language. */
  function speak() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setError(t("qa.ai.noTts", "Your browser doesn't support read-aloud."));
      return;
    }
    const text = tx?.text || active?.response_markdown || "";
    if (!text.trim()) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/[#*`>]/g, ""));
    u.lang = tx?.lang ?? "en-US";
    u.rate = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }
  function stopSpeak() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }
  // Stop any speech when the panel unmounts.
  useEffect(() => () => stopSpeak(), []);

  return (
    <div className="space-y-3">
      {/* Action bar */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={runAnalysis} disabled={running}
          className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] hover:opacity-90 disabled:opacity-50">
          {running ? t("qa.ai.analysing", "Analysing…") : sessions.length ? t("qa.ai.rerun", "Re-run AI Analysis") : t("qa.ai.ask", "Ask AI to Analyse")}
        </button>
        {active?.response_markdown && (
          <button type="button" className={btn} onClick={copyActive}>{copied ? t("qa.common.copied", "Copied ✓") : t("qa.common.copy", "Copy")}</button>
        )}
        <span className="ms-auto text-[10.5px] text-[var(--text-dim)]">{t("qa.ai.advisory", "Advisory only — never edits code.")}</span>
      </div>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-500 dark:text-rose-300">{error}</div>}

      {running && (
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 text-center text-[12px] text-[var(--text-dim)]">
          {t("qa.ai.running", "AI is analysing the deterministic workspace context…")}
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-[12px] text-[var(--text-dim)]">{t("qa.ai.loadingSessions", "Loading sessions…")}</div>
      ) : !sessions.length && !running ? (
        <div className={card}>
          <div className="text-[12px] text-[var(--text-secondary)]">{t("qa.ai.empty", "No AI analysis yet. Run one to get a structured engineering assessment (root cause, suspected files, regression risk, fix strategy). The AI only reads the sanitized workspace context — it never touches code.")}</div>
        </div>
      ) : null}

      {/* Active session */}
      {active && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {active.confidence && <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${confidenceTone(active.confidence)}`}>{active.confidence} {t("qa.ai.confidence", "confidence")}</span>}
            {/* Branded as Koleex AI — the underlying provider/model stays in the
                DB for audit but is never surfaced in the UI. */}
            <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">Koleex AI</span>
            {active.status === "failed" && <span className="rounded border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold text-rose-500 dark:text-rose-300">{t("qa.ai.failedBadge", "failed")}</span>}
            <span className="text-[10px] text-[var(--text-dim)]">{rel(active.created_at)}</span>
            {(active.tokens_input || active.tokens_output) && (
              <span className="text-[10px] text-[var(--text-dim)]">· {active.tokens_input ?? "?"}→{active.tokens_output ?? "?"} tok{active.latency_ms ? ` · ${(active.latency_ms / 1000).toFixed(1)}s` : ""}</span>
            )}
          </div>
          {active.status === "completed" && active.response_markdown
            ? <AiReport markdown={active.response_markdown} />
            : active.status === "failed"
              ? <div className="rounded-xl border border-rose-500/25 bg-rose-500/[0.06] p-3 text-[12px] text-[var(--text-secondary)]">{active.error ?? t("qa.ai.failed", "This analysis failed.")}</div>
              : <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3 text-[12px] text-[var(--text-dim)]">{t("qa.ai.processing", "This analysis is still processing. Re-run if it doesn’t resolve.")}</div>}

          {/* Koleex AI actions — reshape / translate / speak the analysis. */}
          {active.status === "completed" && active.response_markdown && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-2.5">
              <div className="mb-2 flex items-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent)]" aria-hidden><path d="M12 3v3M5.6 5.6l2.1 2.1M3 12h3M18 12h3M16.3 7.7l2.1-2.1M12 12l9 3-4 1-1 4-4-8Z"/></svg>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("qa.ai.koleexActions", "Koleex AI")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={btn} onClick={() => runTransform("summary")} disabled={!!txBusy}>
                  {txBusy === "summary" ? t("qa.ai.txWorking", "…") : t("qa.ai.summarize", "Summarize")}
                </button>
                <button type="button" className={btn} onClick={() => runTransform("solution")} disabled={!!txBusy}>
                  {txBusy === "solution" ? t("qa.ai.txWorking", "…") : t("qa.ai.solution", "Final solution")}
                </button>
                <button type="button" className={btn} onClick={() => runTransform("ar")} disabled={!!txBusy}>
                  {txBusy === "ar" ? t("qa.ai.txWorking", "…") : t("qa.ai.arabic", "العربية")}
                </button>
                <button type="button" className={btn} onClick={() => runTransform("zh")} disabled={!!txBusy}>
                  {txBusy === "zh" ? t("qa.ai.txWorking", "…") : t("qa.ai.chinese", "中文")}
                </button>
                <button type="button" className={btn} onClick={speaking ? stopSpeak : speak}>
                  {speaking ? `■ ${t("qa.ai.stop", "Stop")}` : `▶ ${t("qa.ai.readAloud", "Read aloud")}`}
                </button>
              </div>

              {tx && (
                <div className="mt-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-dim)]">
                      {tx.mode === "summary" ? t("qa.ai.summary", "Summary")
                        : tx.mode === "solution" ? t("qa.ai.proposedFix", "Proposed fix")
                        : tx.mode === "ar" ? "العربية" : "中文"}
                    </span>
                    <button type="button" onClick={() => { stopSpeak(); setTx(null); }} className="text-[11px] text-[var(--text-dim)] hover:text-[var(--text-primary)]" aria-label={t("qa.common.close", "Close")}>✕</button>
                  </div>
                  <p dir={tx.lang === "ar" ? "rtl" : "ltr"} className="whitespace-pre-wrap text-[12.5px] leading-relaxed text-[var(--text-secondary)]">{tx.text}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Previous sessions */}
      {sessions.length > 1 && (
        <div className={card}>
          <div className={head}>{t("qa.ai.prevSessions", "Previous Sessions")}</div>
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => setActiveId(s.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11.5px] ${s.id === activeId ? "bg-[var(--bg-surface)] text-[var(--text-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${s.status === "completed" ? "bg-emerald-500" : s.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`} />
                  <span className="flex-1 truncate">{rel(s.created_at)}{s.confidence ? ` · ${s.confidence}` : ""}</span>
                  <span className="text-[10px] text-[var(--text-dim)]">Koleex AI</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
