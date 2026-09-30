"use client";

/* Brand Center item — its designs (owner: "maybe later I need to add my own
   designs"). Any number per item, or per some of its choices; one is the
   default. Readers see the designs in use and download their files; in the
   editor (the edit right): add, make default, put in use, retire, and add
   or remove the design's files (DesignFiles). */

import { useState } from "react";
import Link from "next/link";
import { bc, type BcDesign, type BcType } from "@/lib/brand-center/client";
import { CARD, SELECTED_CHIP } from "@/components/travel/fields";
import { FIELD, StatusChip } from "./ui";
import DesignFiles from "./DesignFiles";

type T = (k: string) => string;
const KINDS = ["print_file", "editable", "logo_pack", "mockup", "photo", "vendor_brief", "template", "other"] as const;

export default function ItemDesigns({ t, itemId, types, designs, canEdit, onChanged }: { t: T; itemId: string; types: BcType[]; designs: BcDesign[];
  /** The editor (the edit right, "Edit" on): every design, and the actions. */
  canEdit: boolean; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const optionLabel = new Map(types.flatMap((ty) => ty.options.map((o) => [o.id, o.label] as const)));

  const run = async (key: string, job: () => Promise<{ ok: boolean }>) => {
    setBusy(key); setFailed(false);
    const r = await job();
    setBusy(null);
    if (!r.ok) { setFailed(true); return false; }
    await onChanged();
    return true;
  };

  const shown = designs.filter((d) => canEdit || d.status === "active");
  if (!canEdit && !shown.length) return null;
  return (
    <section data-kx-pane className={`${CARD} mt-4 px-4 py-4`}>
      <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("des.title")}</h2>
      {canEdit ? <p className="mt-0.5 text-[12px] text-[var(--text-dim)]">{t("des.hint")}</p> : null}
      {failed ? <p role="alert" className="mt-2 text-[12px] text-red-500">{t("save.error")}</p> : null}

      {shown.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-[var(--text-secondary)]">{t("des.none")}</p>
      ) : (
        <ul className="mt-3 grid [&>*]:min-w-0 gap-2">
          {shown.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[var(--border-subtle)] px-3 py-2.5">
              <span dir="auto" className="text-[13px] font-semibold text-[var(--text-primary)]">{d.name}</span>
              {d.is_default ? <span className={`rounded-full border px-1.5 text-[10px] font-semibold ${SELECTED_CHIP}`}>{t("des.default")}</span> : null}
              {canEdit ? <StatusChip t={t} value={d.status} /> : null}
              <span className="text-[12px] text-[var(--text-secondary)]">{t(`kind.${d.kind}`)}</span>
              <span dir="auto" className="text-[12px] text-[var(--text-dim)]">
                {d.option_ids.length ? d.option_ids.map((id) => optionLabel.get(id)).filter(Boolean).join(" · ") : t("des.whole")}
              </span>
              {canEdit && (
                <span className="ms-auto flex flex-wrap gap-1.5">
                  {!d.is_default && d.status !== "retired" && <Small busy={busy === `def-${d.id}`} onClick={() => void run(`def-${d.id}`, () => bc.editDesign(d.id, { isDefault: true }))}>{t("des.makeDefault")}</Small>}
                  {d.status !== "active" && <Small busy={busy === `act-${d.id}`} onClick={() => void run(`act-${d.id}`, () => bc.editDesign(d.id, { status: "active" }))}>{t("des.activate")}</Small>}
                  {d.status !== "retired" && <Small busy={busy === `ret-${d.id}`} onClick={() => void run(`ret-${d.id}`, () => bc.retireDesign(d.id))}>{t("des.retire")}</Small>}
                </span>
              )}
              {/* a designer's template with its SVG: open it to fill in (C18) */}
              {d.kind === "template" && (d.status === "active" || canEdit) && (d.files ?? []).some((f) => f.purpose === "svg") ? (
                <Link href={`/brand-center/templates/svg-${d.id}`} className="rounded-lg bg-[var(--bg-inverted)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--text-inverted)]">{t("svgt.fill")}</Link>
              ) : null}
              <DesignFiles t={t} designId={d.id} files={d.files ?? []} canEdit={canEdit} onChanged={onChanged} />
              {canEdit && d.kind === "template" ? <p className="w-full text-[11.5px] leading-5 text-[var(--text-dim)]">{t("svgt.rules")}</p> : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit && <AddDesign t={t} types={types} busy={busy === "add"} onAdd={(b) => run("add", () => bc.addDesign(itemId, b))} />}
    </section>
  );
}

function Small({ children, onClick, busy }: { children: React.ReactNode; onClick: () => void; busy: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className="rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-[11.5px] font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50">
      {children}
    </button>
  );
}

function AddDesign({ t, types, busy, onAdd }: { t: T; types: BcType[]; busy: boolean; onAdd: (b: { name: string; kind: string; optionIds: string[] }) => Promise<boolean> }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string>("print_file");
  const [picked, setPicked] = useState<string[]>([]);
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const add = async () => {
    if (!name.trim() || busy) return;
    if (await onAdd({ name: name.trim(), kind, optionIds: picked })) { setName(""); setPicked([]); }
  };
  const chosen = types.map((ty) => ({ ...ty, options: ty.options.filter((o) => o.chosen) })).filter((ty) => ty.options.length);
  return (
    <div className="mt-4 rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-3">
      <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("des.add")}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_220px_auto]">
        <input id="bc-design-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("des.name")} className={FIELD} />
        <select id="bc-design-kind" aria-label={t("des.kind")} value={kind} onChange={(e) => setKind(e.target.value)} className={FIELD}>
          {KINDS.map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}
        </select>
        <button type="button" onClick={() => void add()} disabled={busy || !name.trim()} className="rounded-xl bg-[var(--bg-inverted)] px-4 py-2 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">{t("des.save")}</button>
      </div>
      {chosen.length ? (
        <div className="mt-3">
          <p className="text-[11.5px] text-[var(--text-dim)]">{t("des.for")}</p>
          <div className="mt-1.5 grid gap-1.5">
            {chosen.map((ty) => (
              <div key={ty.id} className="flex flex-wrap items-center gap-1.5">
                <span dir="auto" className="me-1 text-[11.5px] text-[var(--text-secondary)]">{ty.label}</span>
                {ty.options.map((o) => (
                  <button key={o.id} type="button" dir="auto" aria-pressed={picked.includes(o.id)} onClick={() => toggle(o.id)}
                    className={`rounded-lg border px-2 py-0.5 text-[11.5px] ${picked.includes(o.id) ? SELECTED_CHIP : "border-[var(--border-subtle)] text-[var(--text-secondary)]"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
