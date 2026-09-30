"use client";

/* Brand Center item — its types and the choices on each, as the owner edits
   them. A filled chip is a choice we use (the owner's pick in the workshop);
   a tap switches it, and a new choice or a new type can be added. A choice
   the rules forbid is marked, with the reason (the rules' "Not allowed"). */

import { useState } from "react";
import { bc, type BcType } from "@/lib/brand-center/client";
import RrIcon from "@/components/ui/RrIcon";
import { CARD, SELECTED_CHIP } from "@/components/travel/fields";
import { notAllowedOf, optionRef, type ItemRules } from "@/lib/brand-center/rules";
import { FIELD } from "./ui";

type T = (k: string) => string;

export default function ItemTypes({ t, itemId, types, rules, canEdit, onChanged }: { t: T; itemId: string; types: BcType[]; rules: ItemRules | null; canEdit: boolean; onChanged: () => Promise<void> }) {
  const no = notAllowedOf(rules);
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const run = async (key: string, job: () => Promise<{ ok: boolean }>) => {
    setBusy(key); setFailed(false);
    const r = await job();
    setBusy(null);
    if (!r.ok) { setFailed(true); return; }
    await onChanged();
  };

  return (
    <section data-kx-pane className={`${CARD} mt-4 px-4 py-4`}>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("item.types")}</h2>
      <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">{t("item.typesHint")}</p>
      {failed ? <p role="alert" className="mt-2 text-[12px] text-red-500">{t("save.error")}</p> : null}
      <div className="mt-3 grid gap-3">
        {types.map((ty) => (
          <div key={ty.id} className="grid grid-cols-1 gap-2 md:grid-cols-[160px_1fr] md:items-start">
            <span dir="auto" className="pt-1 text-[12.5px] text-[var(--text-secondary)]">{ty.label}</span>
            <div className="flex flex-wrap gap-1.5">
              {ty.options.map((o) => {
                const why = no.get(optionRef(ty.key, o.key));
                const cls = `inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[12.5px] ${o.chosen ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-dim)] line-through decoration-[var(--text-faint)]"}${why ? " !border-red-500/60" : ""}`;
                const mark = why ? <span aria-hidden className="font-semibold text-red-500">✕</span> : null;
                return canEdit ? (
                  <button key={o.id} type="button" dir="auto" aria-pressed={o.chosen} disabled={busy === o.id} title={why}
                    onClick={() => void run(o.id, () => bc.editOption(o.id, { chosen: !o.chosen }))} className={cls}>
                    {mark}{o.label}
                  </button>
                ) : (
                  <span key={o.id} dir="auto" title={why} className={cls}>{mark}{o.label}</span>
                );
              })}
              {canEdit && <AddInline id={`bc-add-opt-${ty.id}`} placeholder={t("item.addOption")} busy={busy === `opt-${ty.id}`}
                onAdd={(label) => run(`opt-${ty.id}`, () => bc.addOption(ty.id, label))} />}
            </div>
          </div>
        ))}
        {canEdit && (
          <div className="md:ms-[172px]">
            <AddInline id={`bc-add-type-${itemId}`} placeholder={t("item.addType")} busy={busy === "type"}
              onAdd={(label) => run("type", () => bc.addType(itemId, label))} />
          </div>
        )}
      </div>
    </section>
  );
}

/** A small "type and press Enter" box with an add button. */
export function AddInline({ id, placeholder, busy, onAdd }: { id: string; placeholder: string; busy: boolean; onAdd: (label: string) => Promise<void> }) {
  const [v, setV] = useState("");
  const go = async () => { const label = v.trim(); if (!label || busy) return; await onAdd(label); setV(""); };
  return (
    <span className="inline-flex max-w-full items-center gap-1.5">
      <input id={id} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void go(); }}
        placeholder={placeholder} className={`${FIELD} !w-52 !py-1 !text-[12.5px]`} />
      <button type="button" aria-label={placeholder} onClick={() => void go()} disabled={busy || !v.trim()}
        className="rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40">
        <RrIcon name="plus" size={12} />
      </button>
    </span>
  );
}
