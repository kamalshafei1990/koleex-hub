"use client";

/* ---------------------------------------------------------------------------
   Brand Center — one item: /brand-center/item/<id>

   Everything about one branded item: who uses it, its types and the choices
   we use, its designs. Readers see it; with the Brand Center "edit" right
   every field is edited IN PLACE (no drawer), each save on its own.
   Requests on open: ONE.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { brandCenterNamesT } from "@/lib/translations/brand-center-names";
import { brandCenterLibraryT } from "@/lib/translations/brand-center-library";
import { bc, type BcItemData } from "@/lib/brand-center/client";
import PageHeader from "@/components/ui/PageHeader";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import BrandCenterIcon from "@/components/icons/BrandCenterIcon";
import { CARD } from "@/components/travel/fields";
import { FIELD, ImportanceChip, StatusChip } from "./ui";
import ItemTypes from "./ItemTypes";
import ItemDesigns from "./ItemDesigns";

const WORDS = { ...brandCenterNamesT, ...brandCenterLibraryT };
type Field = "name" | "use" | "note" | "importance" | "status";

export default function BrandItemApp({ itemId }: { itemId: string }) {
  const { t } = useTranslation(WORDS);
  const router = useRouter();
  const [data, setData] = useState<BcItemData | null>(null);
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [askRetire, setAskRetire] = useState(false);

  const load = useCallback(async () => {
    const res = await bc.item(itemId);
    if (res.ok) { setData(res.data); setError(false); } else setError(true);
  }, [itemId]);
  /* First load inside the effect (state set only when the answer arrives,
     and never after leaving the page); `load` is for reloads after a change. */
  useEffect(() => {
    let alive = true;
    void bc.item(itemId).then((res) => {
      if (!alive) return;
      if (res.ok) { setData(res.data); setError(false); } else setError(true);
    });
    return () => { alive = false; };
  }, [itemId]);

  const save = async (field: Field, value: string) => {
    setSaving("saving");
    const res = await bc.editItem(itemId, { [field]: value });
    setSaving(res.ok ? "saved" : "error");
    if (res.ok) await load();
  };

  if (error) return <Shell><div className={`${CARD} p-6 text-center`}><p className="text-[var(--text-secondary)]">{t("load.error")}</p>
    <button type="button" onClick={() => void load()} className="mt-3 text-[13px] font-semibold underline underline-offset-4">{t("load.retry")}</button></div></Shell>;
  if (!data) return <Shell><div className="flex items-center justify-center py-20 text-[var(--text-secondary)]"><SpinnerIcon size={28} /></div></Shell>;

  const { item, section, group, canEdit } = data;
  return (
    <Shell>
      <PageHeader title={item.name} subtitle={[group?.name, item.use_text].filter(Boolean).join(" · ")} icon={<BrandCenterIcon size={16} />} showTabs={false}
        backHref={section ? `/brand-center/${section.key}` : "/brand-center"} backLabel={section ? t(`sec.${section.key}`) : t("back.center")} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ImportanceChip t={t} value={item.importance} />
        <StatusChip t={t} value={item.status} />
        <span aria-live="polite" className="ms-auto text-[12px] text-[var(--text-dim)]">
          {saving === "saving" ? t("saving") : saving === "saved" ? t("saved") : saving === "error" ? <span className="text-red-500">{t("save.error")}</span> : ""}
        </span>
      </div>

      {!canEdit && <p className="mt-3 text-[12.5px] text-[var(--text-dim)]">{t("item.readOnly")}</p>}

      {canEdit && (
        <section data-kx-pane className={`${CARD} mt-4 grid grid-cols-1 gap-3 px-4 py-4 md:grid-cols-2`}>
          <Edit key={`n-${item.name}`} label={t("item.name")} value={item.name} onSave={(v) => { if (v.trim()) void save("name", v); }} id="bc-item-name" single wide />
          <Edit key={`u-${item.use_text ?? ""}`} label={t("item.use")} value={item.use_text ?? ""} onSave={(v) => void save("use", v)} id="bc-item-use" wide />
          <label className="block text-[12px] text-[var(--text-secondary)]">{t("item.importance")}
            <select id="bc-item-importance" value={item.importance} onChange={(e) => void save("importance", e.target.value)} className={`${FIELD} mt-1`}>
              {(["core", "optional", "later"] as const).map((v) => <option key={v} value={v}>{t(`imp.${v}`)}</option>)}
            </select>
          </label>
          <label className="block text-[12px] text-[var(--text-secondary)]">{t("item.status")}
            <select id="bc-item-status" value={item.status} onChange={(e) => void save("status", e.target.value)} className={`${FIELD} mt-1`}>
              {(["draft", "approved", "retired"] as const).map((v) => <option key={v} value={v}>{t(`st.${v}`)}</option>)}
            </select>
          </label>
          <Edit key={`o-${item.note ?? ""}`} label={t("item.notes")} value={item.note ?? ""} onSave={(v) => void save("note", v)} id="bc-item-note" wide />
        </section>
      )}
      {!canEdit && (item.note || item.owner_note) ? (
        <section dir="auto" className={`${CARD} mt-4 px-4 py-3.5 text-[13px] leading-6 text-[var(--text-secondary)]`}>{item.note}{item.owner_note ? <><br />{t("item.ownerNote")}: {item.owner_note}</> : null}</section>
      ) : null}
      {canEdit && item.owner_note ? <p className="mt-2 text-[12.5px] text-[var(--text-secondary)]">{t("item.ownerNote")}: {item.owner_note}</p> : null}

      <ItemTypes t={t} itemId={item.id} types={data.types} canEdit={canEdit} onChanged={load} />
      <ItemDesigns t={t} itemId={item.id} types={data.types} designs={data.designs} canEdit={canEdit} onChanged={load} />

      <section data-kx-pane className={`${CARD} mt-4 px-4 py-4`}>
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("item.rules")}</h2>
        <p className="mt-1 text-[12.5px] text-[var(--text-secondary)]">{t("item.rulesSoon")}</p>
      </section>

      {canEdit && item.status !== "retired" && (
        <div className="mt-6">
          {!askRetire ? (
            <button type="button" data-kx-keep-hover onClick={() => setAskRetire(true)} className="rounded-xl px-3 py-2 text-[12.5px] font-medium text-[var(--text-dim)] transition-colors hover:bg-red-500/10 hover:text-red-500">{t("item.retire")}</button>
          ) : (
            <div className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-[12.5px] text-[var(--text-secondary)]">
              <p>{t("item.retireAsk")}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={async () => { const r = await bc.retireItem(item.id); if (r.ok) router.push(section ? `/brand-center/${section.key}` : "/brand-center"); else setSaving("error"); }} className="rounded-lg bg-red-500/85 px-3 py-1.5 font-semibold text-white">{t("item.retireYes")}</button>
                <button type="button" onClick={() => setAskRetire(false)} className="rounded-lg border border-[var(--border-subtle)] px-3 py-1.5">{t("item.cancel")}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-full"><div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-8">{children}</div></div>;
}

/** A text field that saves when it loses focus, only if it changed. The
 *  caller keys it by the saved value, so a fresh save starts it fresh. */
function Edit({ label, value, onSave, id, wide, single }: { label: string; value: string; onSave: (v: string) => void; id: string; wide?: boolean; single?: boolean }) {
  const [v, setV] = useState(value);
  const blur = () => { if (v.trim() !== value.trim()) onSave(v); };
  return (
    <label className={`block text-[12px] text-[var(--text-secondary)] ${wide ? "md:col-span-2" : ""}`}>{label}
      {single
        ? <input id={id} value={v} onChange={(e) => setV(e.target.value)} onBlur={blur} className={`${FIELD} mt-1`} />
        : <textarea id={id} rows={2} value={v} onChange={(e) => setV(e.target.value)} onBlur={blur} className={`${FIELD} mt-1 resize-y`} />}
    </label>
  );
}
