"use client";

/* ---------------------------------------------------------------------------
   "My templates" (owner 29/09/2026: "save a style I did as my templates").

   A saved template is a fill of this template under a name: the style, the
   typeface, the lines, the QR codes and every switch. Using it puts all of
   that back; the chosen employee's details fill in over it. Pictures are
   never saved. Each person keeps their own; with the Brand Center "create"
   right a template can also be shared with the whole company.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { bc, type BcSaved } from "@/lib/brand-center/client";
import type { TemplateDef, TemplateValues } from "@/lib/brand-center/templates/types";
import { SELECTED_CHIP } from "@/components/travel/fields";
import { FIELD, fill } from "../ui";

type T = (k: string) => string;
const SMALL = "rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40";

export default function SavedTemplates({ t, def, values, onApply }: {
  t: T; def: TemplateDef; values: TemplateValues; onApply: (fill: TemplateValues) => void;
}) {
  const [list, setList] = useState<BcSaved[] | null>(null);
  const [canShare, setCanShare] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [keepPerson, setKeepPerson] = useState(false);
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [asking, setAsking] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void bc.saved(def.id).then((res) => {
      if (!alive) return;
      if (res.ok) { setList(res.data.saved); setCanShare(res.data.canShare); } else setList([]);
    });
    return () => { alive = false; };
  }, [def.id]);

  const toSave = (keep: boolean) => (def.forSaving ? def.forSaving(values, keep) : values) as Record<string, unknown>;
  const current = list?.find((s) => s.id === active) ?? null;

  const save = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setNote(null);
    const res = await bc.saveTemplate({ templateId: def.id, name: name.trim(), fill: toSave(keepPerson), shared: canShare && shared });
    setBusy(false);
    if (!res.ok) { setNote({ ok: false, text: t("saved.error") }); return; }
    setList((l) => [res.data.saved, ...(l ?? [])]);
    setActive(res.data.saved.id);
    setAdding(false); setName(""); setKeepPerson(false); setShared(false);
    setNote({ ok: true, text: fill(t("saved.done"), { name: res.data.saved.name }) });
  };
  const update = async () => {
    if (!current || busy) return;
    setBusy(true); setNote(null);
    /* Keeps the person's details only if the saved one had them. */
    const res = await bc.editSaved(current.id, { fill: toSave(typeof current.fill.name === "string" && !!current.fill.name) });
    setBusy(false);
    if (!res.ok) { setNote({ ok: false, text: t("saved.error") }); return; }
    setList((l) => (l ?? []).map((s) => (s.id === current.id ? res.data.saved : s)));
    setNote({ ok: true, text: fill(t("saved.done"), { name: current.name }) });
  };
  const remove = async (id: string) => {
    setBusy(true); setNote(null);
    const res = await bc.deleteSaved(id);
    setBusy(false); setAsking(null);
    if (!res.ok) { setNote({ ok: false, text: t("saved.error") }); return; }
    setList((l) => (l ?? []).filter((s) => s.id !== id));
    if (active === id) setActive(null);
  };

  return (
    <div>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("saved.title")}</h2>
      {list === null ? (
        <div className="mt-2 h-[30px] animate-pulse rounded-lg bg-[var(--bg-surface-subtle)]" />
      ) : list.length === 0 ? (
        <p className="mt-1 text-[12px] text-[var(--text-dim)]">{t("saved.none")}</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {list.map((s) => (
            <button key={s.id} type="button" aria-pressed={active === s.id} onClick={() => { setActive(s.id); setNote(null); onApply(s.fill as TemplateValues); }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] ${active === s.id ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>
              <span dir="auto">{s.name}</span>
              {s.shared ? <span className="rounded border border-current px-1 text-[9.5px] font-semibold uppercase opacity-70">{t("saved.company")}</span> : null}
            </button>
          ))}
        </div>
      )}

      {current?.mine ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" className={SMALL} disabled={busy} onClick={() => void update()}>{fill(t("saved.update"), { name: current.name })}</button>
          {asking === current.id ? (
            <>
              <span className="text-[12px] text-[var(--text-secondary)]">{fill(t("saved.removeAsk"), { name: current.name })}</span>
              <button type="button" className={`${SMALL} !text-red-500`} disabled={busy} onClick={() => void remove(current.id)}>{t("saved.removeYes")}</button>
              <button type="button" className={SMALL} onClick={() => setAsking(null)}>{t("saved.removeNo")}</button>
            </>
          ) : (
            <button type="button" className={SMALL} onClick={() => setAsking(current.id)}>{t("saved.remove")}</button>
          )}
        </div>
      ) : null}

      {adding ? (
        <div className="mt-2 grid gap-2 rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-3">
          <input id="bc-saved-name" dir="auto" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
            placeholder={t("saved.name")} aria-label={t("saved.name")} className={FIELD} />
          <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
            <input type="checkbox" checked={keepPerson} onChange={(e) => setKeepPerson(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--text-primary)]" />
            {t("saved.keepPerson")}
          </label>
          {canShare ? (
            <label className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)]">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--text-primary)]" />
              {t("saved.share")}
            </label>
          ) : null}
          <p className="text-[11px] leading-4 text-[var(--text-dim)]">{t("saved.pictures")}</p>
          <span className="flex gap-1.5">
            <button type="button" disabled={busy || !name.trim()} onClick={() => void save()}
              className="rounded-lg bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">{t("saved.save")}</button>
            <button type="button" className={SMALL} onClick={() => setAdding(false)}>{t("saved.cancel")}</button>
          </span>
        </div>
      ) : (
        <button type="button" className={`${SMALL} mt-2`} onClick={() => { setAdding(true); setNote(null); }}>{t("saved.saveNew")}</button>
      )}
      {note ? <p role={note.ok ? "status" : "alert"} className={`mt-1.5 text-[12px] ${note.ok ? "text-emerald-500" : "text-red-500"}`}>{note.text}</p> : null}
    </div>
  );
}
