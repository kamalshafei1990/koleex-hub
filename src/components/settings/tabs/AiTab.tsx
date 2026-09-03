"use client";

/* ---------------------------------------------------------------------------
   Settings → Koleex AI — how Koleex AI speaks to me, and what it remembers.

   The owner put ChatGPT's Personalization and Memory screens next to ours
   and asked what fitted. This tab is the answer: a base style, four dials
   (warmth, enthusiasm, headings & lists, emoji), standing instructions in
   the user's own words, the suggestion tiles switch, and memory — on/off,
   a nickname, an occupation, a few lines about themselves, and the list of
   facts Koleex AI has kept, each with a way to forget it.

   ONE SAVE. Everything on the screen edits a draft; Save sends the draft
   through PUT /api/ai/personalization, which normalises it (the shared
   rules in lib/ai-personalization.ts) and merges it atomically into the
   account's preferences. Forgetting a fact saves at once — it is a
   deletion, and a deletion that waits for a Save button is a surprise.

   THE SETTINGS SHAPE TONE ONLY, and the footer says so in the user's
   language: nothing here changes permissions or what Koleex AI can reach.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import {
  AI_LEVELS,
  AI_PERSONALIZATION_LIMITS,
  AI_STYLES,
  type AiLevel,
  type AiPersonalization,
  type AiStyle,
  normalizeAiPersonalization,
} from "@/lib/ai-personalization";
import { ControlRow, Segmented, SelectControl, SettingsGroup, SwitchRow } from "@/components/settings/tabs/ui";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";

const API = "/api/ai/personalization";

const FIELD_CLASS =
  "w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-focus)]";

export default function AiTab({ account, onChanged }: {
  account: AccountWithLinks;
  onChanged: () => void;
}) {
  const { t } = useTranslation(settingsT);

  /* The account arrives with its preferences, so the form has a first
     value before the fetch answers; the fetch adds the memory facts and
     the server's normalised view of the same settings. */
  const [saved, setSaved] = useState<AiPersonalization>(() => normalizeAiPersonalization(account.preferences?.ai));
  const [draft, setDraft] = useState<AiPersonalization>(saved);
  const [memory, setMemory] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [forgetting, setForgetting] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(API, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { personalization?: unknown; memory?: Record<string, string> } | null) => {
        if (!alive || !j) return;
        const p = normalizeAiPersonalization(j.personalization);
        setSaved(p);
        setDraft(p);
        setMemory(j.memory ?? {});
        setLoaded(true);
      })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, []);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const set = <K extends keyof AiPersonalization>(k: K, v: AiPersonalization[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    if (!dirty || saving) return;
    setSaving(true); setError(null); setToast(null);
    try {
      const res = await fetch(API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personalization: draft }),
      });
      const j = (await res.json().catch(() => null)) as { personalization?: unknown; error?: string } | null;
      if (!res.ok) throw new Error(j?.error || t("ai.error"));
      const p = normalizeAiPersonalization(j?.personalization);
      setSaved(p); setDraft(p);
      setToast(t("ai.saved"));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ai.error"));
    } finally {
      setSaving(false);
    }
  }

  async function forget(keys: string[] | "all") {
    const label = keys === "all" ? "*" : keys[0];
    setForgetting(label); setError(null);
    try {
      const res = await fetch(API, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(keys === "all" ? { forgetAll: true } : { forget: keys }),
      });
      const j = (await res.json().catch(() => null)) as { memory?: Record<string, string>; error?: string } | null;
      if (!res.ok) throw new Error(j?.error || t("ai.error"));
      setMemory(j?.memory ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : t("ai.error"));
    } finally {
      setForgetting(null);
    }
  }

  const levelOptions: { value: AiLevel; label: string }[] = AI_LEVELS.map((v) => ({ value: v, label: t(`ai.level.${v}`) }));
  const styleOptions: { value: AiStyle; label: string }[] = AI_STYLES.map((v) => ({ value: v, label: t(`ai.style.${v}`) }));
  const facts = Object.entries(memory);
  const L = AI_PERSONALIZATION_LIMITS;

  return (
    <div className="space-y-6">
      <SettingsGroup header={t("ai.tone.title")} footer={t("ai.guard")}>
        <ControlRow label={t("ai.style")} hint={t(`ai.style.${draft.style}.hint`)}>
          <SelectControl value={draft.style} onChange={(v) => set("style", v)} options={styleOptions} />
        </ControlRow>
        <ControlRow label={t("ai.warmth")}>
          <Segmented value={draft.warmth} onChange={(v) => set("warmth", v)} options={levelOptions} />
        </ControlRow>
        <ControlRow label={t("ai.enthusiasm")}>
          <Segmented value={draft.enthusiasm} onChange={(v) => set("enthusiasm", v)} options={levelOptions} />
        </ControlRow>
        <ControlRow label={t("ai.formatting")} hint={t("ai.formatting.hint")}>
          <Segmented value={draft.formatting} onChange={(v) => set("formatting", v)} options={levelOptions} />
        </ControlRow>
        <ControlRow label={t("ai.emoji")}>
          <Segmented value={draft.emoji} onChange={(v) => set("emoji", v)} options={levelOptions} />
        </ControlRow>
        <SwitchRow
          label={t("ai.suggestions")}
          hint={t("ai.suggestions.hint")}
          checked={draft.suggestions}
          onChange={(v) => set("suggestions", v)}
          last
        />
      </SettingsGroup>

      <SettingsGroup header={t("ai.instructions")} footer={t("ai.instructions.hint")} flush={false}>
        <textarea
          value={draft.instructions}
          onChange={(e) => set("instructions", e.target.value.slice(0, L.instructions))}
          rows={4}
          maxLength={L.instructions}
          placeholder={t("ai.instructions.ph")}
          className={`${FIELD_CLASS} resize-y min-h-[96px]`}
        />
        <p className="text-end text-[11px] text-[var(--text-dim)]">{draft.instructions.length}/{L.instructions}</p>
      </SettingsGroup>

      <SettingsGroup header={t("ai.memory.title")} footer={t("ai.memory.hint")}>
        <SwitchRow
          label={t("ai.memory")}
          checked={draft.memory}
          onChange={(v) => set("memory", v)}
        />
        <div className="py-3 space-y-3 border-b border-[var(--border-faint)]">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--text-primary)]">{t("ai.nickname")}</span>
            <input
              value={draft.nickname}
              onChange={(e) => set("nickname", e.target.value.slice(0, L.nickname))}
              maxLength={L.nickname}
              className={FIELD_CLASS}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--text-primary)]">{t("ai.occupation")}</span>
            <input
              value={draft.occupation}
              onChange={(e) => set("occupation", e.target.value.slice(0, L.occupation))}
              maxLength={L.occupation}
              className={FIELD_CLASS}
              autoComplete="off"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-[var(--text-primary)]">{t("ai.about")}</span>
            <textarea
              value={draft.about}
              onChange={(e) => set("about", e.target.value.slice(0, L.about))}
              rows={3}
              maxLength={L.about}
              className={`${FIELD_CLASS} resize-y`}
            />
          </label>
        </div>

        {/* WHAT IT REMEMBERED — facts the assistant stored from conversations.
            Read from the server, deleted on the server, one tap each. */}
        <div className="py-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <p className="text-[13px] font-medium text-[var(--text-primary)]">{t("ai.remembered")}</p>
            {facts.length > 0 && (
              <button
                type="button"
                onClick={() => { if (window.confirm(t("ai.forgetAll.confirm"))) void forget("all"); }}
                disabled={forgetting !== null}
                className="text-[12px] text-[#FF3333] hover:underline disabled:opacity-40"
              >
                {t("ai.forgetAll")}
              </button>
            )}
          </div>
          {!loaded ? (
            <SpinnerIcon className="h-4 w-4 text-[var(--text-dim)]" />
          ) : facts.length === 0 ? (
            <p className="text-[12px] text-[var(--text-dim)]">{t("ai.remembered.empty")}</p>
          ) : (
            <ul className="space-y-1.5">
              {facts.map(([k, v]) => (
                <li key={k} className="flex items-start gap-3 rounded-xl border border-[var(--border-faint)] bg-[var(--bg-surface)] px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--text-dim)]">{k.replace(/_/g, " ")}</p>
                    <p className="text-[13px] text-[var(--text-primary)] break-words">{v}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void forget([k])}
                    disabled={forgetting !== null}
                    aria-label={t("ai.forget")}
                    title={t("ai.forget")}
                    className="h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-[var(--text-dim)] hover:text-[#FF3333] disabled:opacity-40"
                  >
                    {forgetting === k ? <SpinnerIcon className="h-4 w-4" /> : <TrashIcon className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </SettingsGroup>

      {/* Same bar as Profile: sticky, and clear of the floating dock's gutter. */}
      <div className="kx-bar-host sticky bottom-0 pt-2 pb-1 bg-gradient-to-t from-[var(--bg-primary)] via-[var(--bg-primary)] to-transparent">
        <div aria-hidden className="kx-glass-bar" />
        <div className="flex items-center justify-end gap-3 pe-14">
          {error && <span className="text-[12px] text-[#FF3333] flex-1">{error}</span>}
          {toast && !error && <span className="text-[12px] text-emerald-400 flex-1 flex items-center gap-1.5"><CheckIcon size={12} />{toast}</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg"
          >
            {saving ? <SpinnerIcon className="h-4 w-4" /> : <CheckIcon size={14} />}
            {saving ? t("ai.saving") : t("ai.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
