"use client";

/* ---------------------------------------------------------------------------
   Note side panels — a drawer on the editor's inline-end edge (full width
   on phones) hosting:
     · HistoryPanel — the note's versions; preview one, restore it (the
       editor snapshots the current content first, so a restore is never
       destructive).
     · AiPanel — Koleex AI: Summarise / Action items, then "Insert into note".
   Plus Backlinks, rendered under the note body.

   Everything talks to the API through src/lib/notes.ts. The drawer is a
   labelled complementary region (not modal): Escape closes it, focus moves
   into it on open and back to the opener on close.
   --------------------------------------------------------------------------- */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { generateHTML } from "@tiptap/core";
import { notesSchemaExtensions } from "@/lib/notes-schema";
import {
  fetchBacklinks,
  fetchVersion,
  fetchVersions,
  runNoteAi,
  formatNoteTimestamp,
  type BacklinkRow,
  type NoteAiResult,
  type NoteVersionFull,
  type NoteVersionRow,
} from "@/lib/notes";
import { formatDatePref } from "@/lib/display-prefs";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import HistoryIcon from "@/components/icons/ui/HistoryIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";

type T = (k: string) => string;

/** Schema-serialized HTML for read-only previews (text is escaped by the
 *  DOM serializer; nothing from the note is ever parsed as markup). */
export function docToHtml(doc: unknown): string {
  try {
    return generateHTML((doc ?? { type: "doc", content: [] }) as Parameters<typeof generateHTML>[0], notesSchemaExtensions());
  } catch {
    return "";
  }
}

function stamp(iso: string): string {
  const d = new Date(iso);
  return `${formatDatePref(d, "dmy")} ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
}

/* ── Drawer shell ───────────────────────────────────────────────────────── */

export function PanelShell({
  title,
  icon,
  onClose,
  t,
  children,
}: {
  title: string;
  icon: ReactNode;
  onClose: () => void;
  t: T;
  children: ReactNode;
}) {
  const headingId = useId();
  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    rootRef.current?.focus();
    return () => { try { opener?.focus?.(); } catch { /* gone */ } };
  }, []);
  return (
    <aside
      ref={rootRef}
      tabIndex={-1}
      aria-labelledby={headingId}
      onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } }}
      className="kx-glass-pop absolute inset-y-0 end-0 z-30 w-full sm:w-[360px] flex flex-col bg-[var(--bg-secondary)] border-s border-[var(--border-color)] shadow-2xl outline-none"
    >
      <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
        <span className="text-[#567FB2] dark:text-[#7FA9D6]">{icon}</span>
        <h2 id={headingId} className="flex-1 text-[13.5px] font-semibold text-[var(--text-primary)]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("dialog.close")}
          className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
        >
          <CrossIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </aside>
  );
}

/* ── History ────────────────────────────────────────────────────────────── */

export function HistoryPanel({
  noteId,
  canRestore,
  onRestore,
  onClose,
  refreshKey,
  t,
}: {
  noteId: string;
  canRestore: boolean;
  /** Ask the editor to restore (it confirms, snapshots, applies). */
  onRestore: (v: NoteVersionFull) => void;
  onClose: () => void;
  /** Bump to reload the list (after Save version / restore). */
  refreshKey: number;
  t: T;
}) {
  const [list, setList] = useState<{ available: boolean; versions: NoteVersionRow[] } | null | "error">(null);
  const [open, setOpen] = useState<NoteVersionFull | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchVersions(noteId).then((r) => { if (!cancelled) setList(r ?? "error"); });
    return () => { cancelled = true; };
  }, [noteId, refreshKey]);

  const openVersion = async (id: string) => {
    setLoadingId(id);
    const v = await fetchVersion(noteId, id);
    setLoadingId(null);
    if (v) setOpen(v);
  };

  return (
    <PanelShell title={t("history.title")} icon={<HistoryIcon className="h-4 w-4" />} onClose={onClose} t={t}>
      {open ? (
        <div className="flex flex-col h-full">
          <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 border-b border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setOpen(null)}
              className="h-7 px-2 rounded-md flex items-center gap-1 text-[11.5px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
            >
              <ArrowLeftIcon className="h-3 w-3 rtl:-scale-x-100" />
              {t("history.list")}
            </button>
            <span className="flex-1 text-end text-[11px] text-[var(--text-dim)] tabular-nums">{stamp(open.created_at)}</span>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div dir="auto" className="text-[17px] font-bold text-[var(--text-primary)] mb-2">{open.title || t("untitled")}</div>
            <div className="notes-editor text-[14px]" dangerouslySetInnerHTML={{ __html: docToHtml(open.body_json) }} />
          </div>
          {canRestore && (
            <div className="shrink-0 px-4 py-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => onRestore(open)}
                className="w-full h-9 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12.5px] font-semibold hover:opacity-90"
              >
                {t("history.restore")}
              </button>
            </div>
          )}
        </div>
      ) : list === null ? (
        <div className="p-6 flex items-center justify-center gap-2 text-[12px] text-[var(--text-dim)]" role="status">
          <SpinnerIcon className="h-4 w-4" /> {t("list.loading")}
        </div>
      ) : list === "error" ? (
        <p className="p-4 text-[12.5px] text-[var(--text-muted)]">{t("error.generic")}</p>
      ) : !list.available ? (
        <p className="p-4 text-[12.5px] text-[var(--text-muted)]">{t("history.unavailable")}</p>
      ) : list.versions.length === 0 ? (
        <p className="p-4 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{t("history.empty")}</p>
      ) : (
        <ul className="p-2 space-y-0.5" aria-label={t("history.list")}>
          {list.versions.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => { void openVersion(v.id); }}
                className="w-full text-start px-3 py-2 rounded-lg hover:bg-[var(--bg-surface)] focus-visible:bg-[var(--bg-surface)] outline-none"
              >
                <span className="flex items-center gap-2">
                  <span className="flex-1 text-[12.5px] font-semibold text-[var(--text-primary)] tabular-nums">{stamp(v.created_at)}</span>
                  {loadingId === v.id && <SpinnerIcon className="h-3 w-3" />}
                </span>
                <span dir="auto" className="block truncate text-[11.5px] text-[var(--text-muted)]">
                  {v.title || t("untitled")}
                  {v.author_name ? ` · ${t("history.by")} ${v.author_name}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PanelShell>
  );
}

/* ── Koleex AI ──────────────────────────────────────────────────────────── */

export function AiPanel({
  noteId,
  canInsert,
  onInsert,
  onClose,
  t,
}: {
  noteId: string;
  canInsert: boolean;
  onInsert: (r: Extract<NoteAiResult, { ok: true }>) => void;
  onClose: () => void;
  t: T;
}) {
  const [busy, setBusy] = useState<"summary" | "actions" | null>(null);
  const [result, setResult] = useState<NoteAiResult | null>(null);

  // (The parent keys this panel by note id, so a different note starts clean.)

  const run = async (action: "summary" | "actions") => {
    setBusy(action);
    setResult(null);
    const r = await runNoteAi(noteId, action);
    setBusy(null);
    setResult(r);
  };

  const btn = (action: "summary" | "actions", label: string) => (
    <button
      type="button"
      disabled={busy !== null}
      onClick={() => { void run(action); }}
      aria-pressed={result?.ok ? result.kind === action : undefined}
      className="flex-1 h-9 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[12.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-50 flex items-center justify-center gap-1.5"
    >
      {busy === action ? <SpinnerIcon className="h-3.5 w-3.5" /> : <SparklesIcon className="h-3.5 w-3.5 text-[#567FB2] dark:text-[#7FA9D6]" />}
      {label}
    </button>
  );

  return (
    <PanelShell title={t("act.ai")} icon={<SparklesIcon className="h-4 w-4" />} onClose={onClose} t={t}>
      <div className="p-4 space-y-3">
        <p className="text-[12px] leading-relaxed text-[var(--text-muted)]">{t("ai.intro")}</p>
        <div className="flex gap-2">
          {btn("summary", t("ai.summary"))}
          {btn("actions", t("ai.actions"))}
        </div>
        <p className="text-[10.5px] text-[var(--text-dim)]">{t("ai.unsaved")}</p>

        <div aria-live="polite">
          {busy && (
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] py-2" role="status">
              <SpinnerIcon className="h-3.5 w-3.5" /> {t("ai.working")}
            </div>
          )}
          {result && !result.ok && (
            <p className="text-[12.5px] text-red-700 dark:text-red-400" role="alert">
              {t(result.reason === "busy" ? "ai.busy" : result.reason === "forbidden" ? "ai.forbidden" : result.reason === "empty" ? "ai.empty" : "ai.failed")}
            </p>
          )}
          {result?.ok && (
            <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 space-y-3">
              <div className="text-[9.5px] uppercase tracking-[1.2px] font-semibold text-[var(--text-dim)]">
                {t(result.kind === "summary" ? "ai.summaryHeading" : "ai.actionsHeading")}
              </div>
              {result.kind === "summary" ? (
                <p dir="auto" className="text-[13px] leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{result.text}</p>
              ) : result.items.length === 0 ? (
                <p className="text-[12.5px] text-[var(--text-muted)]">{t("ai.noActions")}</p>
              ) : (
                <ul className="space-y-1.5">
                  {result.items.map((it, i) => (
                    <li key={i} dir="auto" className="flex gap-2 text-[13px] text-[var(--text-primary)]">
                      <span aria-hidden className="mt-[3px] h-3.5 w-3.5 shrink-0 rounded border border-[var(--border-color)]" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                {canInsert && (result.kind === "summary" || result.items.length > 0) && (
                  <button
                    type="button"
                    onClick={() => onInsert(result)}
                    className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90"
                  >
                    {t("ai.insert")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { void run(result.kind); }}
                  className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
                >
                  {t("ai.again")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PanelShell>
  );
}

/* ── Backlinks ──────────────────────────────────────────────────────────── */

export function Backlinks({
  noteId,
  refreshKey,
  onOpen,
  t,
}: {
  noteId: string;
  refreshKey: number;
  onOpen: (id: string) => void;
  t: T;
}) {
  // Answers are tagged with what they answer, so a stale list never shows.
  const key = `${noteId}:${refreshKey}`;
  const [state, setState] = useState<{ key: string; rows: BacklinkRow[] | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void fetchBacklinks(noteId).then((r) => { if (!cancelled) setState({ key: `${noteId}:${refreshKey}`, rows: r }); });
    return () => { cancelled = true; };
  }, [noteId, refreshKey]);
  const rows = state && state.key === key ? state.rows : undefined;

  // Not available (migration pending) or still loading → render nothing.
  if (rows === null || rows === undefined) return null;
  return (
    <section aria-label={t("backlinks.title")} className="mt-10 pt-4 border-t border-[var(--border-subtle)]">
      <h2 className="flex items-center gap-1.5 text-[10px] uppercase tracking-[1.4px] font-semibold text-[var(--text-dim)] mb-2">
        <Link2Icon className="h-3 w-3" /> {t("backlinks.title")}
        {rows.length > 0 && <span className="tabular-nums">· {rows.length}</span>}
      </h2>
      {rows.length === 0 ? (
        <p className="text-[12px] text-[var(--text-dim)]">{t("backlinks.empty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                title={formatNoteTimestamp(r.updated_at, t)}
                className="h-7 max-w-[240px] px-2.5 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[#567FB2]/40 truncate"
              >
                <span dir="auto">{r.title || t("untitled")}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
