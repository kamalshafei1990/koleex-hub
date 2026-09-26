"use client";

/* ---------------------------------------------------------------------------
   Koleex AI on a report section (Reports Phase 2D) — the buttons in the
   section's head and the proposal under its text.

   FILL, NEVER SAVE. Koleex AI's answer is shown as a proposal; nothing
   touches the section until the author picks Use it / Replace / Add below,
   and even then it is only the draft's text (the author still reads it and
   still sends it). Discard leaves the section exactly as it was.

   The buttons glow Hub Blue (kx-ai-glow — every AI action does, standing
   rule) and never truncate (the ring is drawn outside the box). The
   assistant is only ever "Koleex AI".

   DICTATION (SectionMic) is the browser's own speech recognition through the
   Hub's useDictation — no key, no server. One section listens at a time; the
   words land at the end of that section when the author taps stop. The chip
   beside the mic is the language SPOKEN (EN / ع / 中), independent of the
   screen's; Arabic listens as Egyptian Arabic (ar-EG).
   --------------------------------------------------------------------------- */

import { useCallback, useState } from "react";
import RrIcon from "@/components/ui/RrIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { AI_LIMITS, canWrite, type AiAction, type AiDraftRequest } from "@/lib/reports/ai-draft";
import type { ReportTemplateDef } from "@/lib/reports/templates";
import { askReportAi } from "@/lib/work-reports";
import type { T } from "./shared";

export type AiSlot = { busy?: AiAction; action?: AiAction; text?: string; error?: string };

/** One report's AI state, per section. */
export function useSectionAi(reportId: string, t: T) {
  const [slots, setSlots] = useState<Record<string, AiSlot>>({});
  const set = (sid: string, v: AiSlot | null) => setSlots((m) => { const n = { ...m }; if (v) n[sid] = v; else delete n[sid]; return n; });
  const run = useCallback(async (req: AiDraftRequest) => {
    setSlots((m) => ({ ...m, [req.section]: { busy: req.action } }));
    const res = await askReportAi(reportId, req);
    if (res.ok && res.data.text.trim()) setSlots((m) => ({ ...m, [req.section]: { action: req.action, text: res.data.text } }));
    else {
      const error = !res.ok && res.status === 429 ? t("ai.busy") : !res.ok && res.error === "no_material" ? t("ai.noMaterial")
        : !res.ok && res.error === "no_facts" ? t("ai.noFacts") : !res.ok && res.error === "too_short" ? t("ai.tooShort") : t("ai.failed");
      setSlots((m) => ({ ...m, [req.section]: { error } }));
    }
  }, [reportId, t]);
  /* `fail`: said without asking (a list with nothing of its own to write from). */
  return { slots, run, fail: (sid: string, error: string) => set(sid, { error }), clear: (sid: string) => set(sid, null) };
}

const AI_BTN =
  "kx-ai-glow inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border border-[#567FB2]/40 bg-[#567FB2]/10 px-2.5 text-[11.5px] font-medium text-[var(--text-primary)] disabled:opacity-50";

/** The section head's AI buttons: "Tidy up" once there is something to
 *  tidy, "Write it" where Koleex AI can write the section. */
export function SectionAiButtons({ t, template, sectionId, text, slot, onTidy, onWrite }: {
  t: T; template: ReportTemplateDef; sectionId: string; text: string; slot?: AiSlot;
  onTidy: () => void; onWrite: () => void;
}) {
  const writable = canWrite(template, sectionId);
  const tidyable = text.trim().length >= AI_LIMITS.tidyMin;
  if (!writable && !tidyable) return null;
  const busy = !!slot?.busy;
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {tidyable && (
        <button type="button" onClick={onTidy} disabled={busy} title={t("ai.tidyHint")} className={AI_BTN}>
          {slot?.busy === "tidy" ? <SpinnerIcon size={11} /> : <RrIcon name="bulb" size={11} />}{t("ai.tidy")}
        </button>
      )}
      {writable && (
        <button type="button" onClick={onWrite} disabled={busy} title={t("ai.writeHint")} className={AI_BTN}>
          {slot?.busy === "write" ? <SpinnerIcon size={11} /> : <RrIcon name="pencil" size={11} />}{t("ai.write")}
        </button>
      )}
    </span>
  );
}

/** Under the section: the work in progress, the proposal, or why not. */
export function SectionAiProposal({ t, slot, current, onApply, onClose }: {
  t: T; slot?: AiSlot; current: string;
  onApply: (mode: "replace" | "append") => void; onClose: () => void;
}) {
  if (!slot) return null;
  if (slot.busy) {
    return <p className="mt-2 flex items-center gap-2 text-[12px] text-[var(--text-dim)]" aria-live="polite"><SpinnerIcon size={12} />{t("ai.working")}</p>;
  }
  if (slot.error) {
    return (
      <p role="status" className="mt-2 flex items-start justify-between gap-3 text-[12px] text-amber-500">
        <span>{slot.error}</span>
        <button type="button" onClick={onClose} aria-label={t("ai.discard")} className="shrink-0 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><RrIcon name="cross" size={10} /></button>
      </p>
    );
  }
  if (!slot.text) return null;
  /* Tidying replaces what was there; writing into a section that already
     has words offers both, the author's own words first. */
  const hasText = !!current.trim();
  return (
    <div className="mt-2 rounded-xl border border-[#567FB2]/35 bg-[#567FB2]/[0.07] p-3" aria-live="polite">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--text-dim)]">
        <RrIcon name="bulb" size={11} />{t("ai.suggests")}
      </p>
      <div dir="auto" className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-primary)]">{slot.text}</div>
      <p className="mt-2 text-[11px] text-[var(--text-dim)]">{t("ai.review")}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {slot.action === "write" && hasText ? (
          <>
            <button type="button" onClick={() => onApply("append")} className="h-8 rounded-lg bg-[var(--bg-inverted)] px-3 text-[12px] font-semibold text-[var(--text-inverted)]">{t("ai.addBelow")}</button>
            <button type="button" onClick={() => onApply("replace")} className="h-8 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] font-medium text-[var(--text-primary)]">{t("ai.replace")}</button>
          </>
        ) : (
          <button type="button" onClick={() => onApply("replace")} className="h-8 rounded-lg bg-[var(--bg-inverted)] px-3 text-[12px] font-semibold text-[var(--text-inverted)]">{t("ai.use")}</button>
        )}
        <button type="button" onClick={onClose} className="h-8 rounded-lg border border-[var(--border-subtle)] px-3 text-[12px] text-[var(--text-secondary)]">{t("ai.discard")}</button>
      </div>
    </div>
  );
}

const LANG_CHIP: Record<"en" | "zh" | "ar", string> = { en: "EN", ar: "ع", zh: "中" };

/** The section head's dictation: the spoken language, then the mic. */
export function SectionMic({ t, dictLang, active, busyElsewhere, onToggle, onCycleLang }: {
  t: T; dictLang: "en" | "zh" | "ar"; active: boolean; busyElsewhere: boolean;
  onToggle: () => void; onCycleLang: () => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {!active && (
        <button type="button" onClick={onCycleLang} disabled={busyElsewhere} title={t("dict.lang")} aria-label={`${t("dict.lang")}: ${LANG_CHIP[dictLang]}`}
          className="grid h-7 min-w-7 place-items-center rounded-lg border border-[var(--border-subtle)] px-1.5 text-[11px] font-semibold text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-40">
          {LANG_CHIP[dictLang]}
        </button>
      )}
      <button type="button" onClick={onToggle} disabled={busyElsewhere} aria-pressed={active} aria-label={active ? t("dict.stop") : t("dict.start")} title={active ? t("dict.stop") : t("dict.start")}
        className={`grid h-7 w-7 place-items-center rounded-lg border transition-colors disabled:opacity-40 ${active
          ? "animate-pulse border-red-500/60 bg-red-500/15 text-red-500"
          : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
        {active ? <span className="block h-2.5 w-2.5 rounded-[2px] bg-current" aria-hidden /> : <RrIcon name="microphone" size={12} />}
      </button>
    </span>
  );
}

/** Under the section while it listens, or why it could not. */
export function DictStatus({ t, listening, elapsed, problem, onClose }: {
  t: T; listening: boolean; elapsed: number; problem: string | null; onClose: () => void;
}) {
  if (listening) {
    const m = Math.floor(elapsed / 60), s = elapsed % 60;
    return (
      <p className="mt-2 flex items-center gap-2 text-[12px] text-red-500" aria-live="polite">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
        <span className="tabular-nums">{m}:{String(s).padStart(2, "0")}</span>
        <span className="text-[var(--text-dim)]">{t("dict.listening")}</span>
      </p>
    );
  }
  if (!problem) return null;
  return (
    <p role="status" className="mt-2 flex items-start justify-between gap-3 text-[12px] text-amber-500">
      <span>{problem}</span>
      <button type="button" onClick={onClose} aria-label={t("ai.discard")} className="shrink-0 text-[var(--text-dim)] hover:text-[var(--text-primary)]"><RrIcon name="cross" size={10} /></button>
    </p>
  );
}
