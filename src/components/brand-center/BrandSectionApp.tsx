"use client";

/* ---------------------------------------------------------------------------
   Brand Center — one section of the library: /brand-center/<section>

   The section's items in their groups; each opens its own page. Anyone who
   may read Brand Center sees it; with the Brand Center "create" right the
   group rows offer "Add an item". Requests on open: ONE.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { brandCenterNamesT } from "@/lib/translations/brand-center-names";
import { brandCenterLibraryT } from "@/lib/translations/brand-center-library";
import { bc, type BcItem, type BcSectionData } from "@/lib/brand-center/client";
import PageHeader from "@/components/ui/PageHeader";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import RrIcon from "@/components/ui/RrIcon";
import BrandCenterIcon from "@/components/icons/BrandCenterIcon";
import { CARD } from "@/components/travel/fields";
import { FIELD, ImportanceChip, StatusChip, fill } from "./ui";

const WORDS = { ...brandCenterNamesT, ...brandCenterLibraryT };

export default function BrandSectionApp({ sectionKey }: { sectionKey: string }) {
  const { t } = useTranslation(WORDS);
  const [data, setData] = useState<BcSectionData | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const res = await bc.section(sectionKey);
    if (res.ok) { setData(res.data); setError(false); } else setError(true);
  }, [sectionKey]);
  /* First load inside the effect (state set only when the answer arrives,
     and never after leaving the page); `load` is for reloads after a change. */
  useEffect(() => {
    let alive = true;
    void bc.section(sectionKey).then((res) => {
      if (!alive) return;
      if (res.ok) { setData(res.data); setError(false); } else setError(true);
    });
    return () => { alive = false; };
  }, [sectionKey]);

  const groups = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    const match = (i: BcItem) => !q || i.name.toLowerCase().includes(q) || (i.use_text ?? "").toLowerCase().includes(q);
    const rows = data.groups.map((g) => ({ id: g.id as string | null, name: g.name, items: data.items.filter((i) => i.group_id === g.id && match(i)) }));
    const loose = data.items.filter((i) => !i.group_id && match(i));
    if (loose.length) rows.push({ id: null, name: t("sec.noGroup"), items: loose });
    return rows.filter((g) => g.items.length || (!q && data.canEdit));
  }, [data, query, t]);

  const title = data ? t(`sec.${data.section.key}`) === `sec.${data.section.key}` ? data.section.name : t(`sec.${data.section.key}`) : "";

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-8">
        <PageHeader title={title || "…"} subtitle={data ? fill(t("sec.items"), { n: data.items.length }) : ""} icon={<BrandCenterIcon size={16} />} showTabs={false}
          backHref="/brand-center" backLabel={t("back.center")} />

        {error ? (
          <div className={`${CARD} mt-5 p-6 text-center`}>
            <p className="text-[var(--text-secondary)]">{t("load.error")}</p>
            <button type="button" onClick={() => void load()} className="mt-3 text-[13px] font-semibold text-[var(--text-primary)] underline underline-offset-4">{t("load.retry")}</button>
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]"><SpinnerIcon size={28} /></div>
        ) : (
          <>
            <div className="mt-5 mb-4">
              <input id="bc-section-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("sec.search")} className={FIELD} />
            </div>
            {groups.length === 0 && <div className={`${CARD} px-6 py-10 text-center text-[var(--text-secondary)]`}>{t("sec.empty")}</div>}
            {groups.map((g) => (
              <section key={g.id ?? "loose"} data-kx-pane className="mb-6">
                <h2 className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">{g.name}</h2>
                <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-3">
                  {g.items.map((i) => {
                    const all = i.types.reduce((n, ty) => n + ty.options.length, 0);
                    const chosen = i.types.reduce((n, ty) => n + ty.options.filter((o) => o.chosen).length, 0);
                    return (
                      <li key={i.id}>
                        <Link href={`/brand-center/item/${i.id}`} className={`${CARD} flex h-full flex-col gap-1.5 px-4 py-3.5 transition-colors hover:border-[var(--border-strong)]`}>
                          <span className="flex items-center gap-2">
                            <span dir="auto" className="flex-1 truncate text-start text-[14px] font-semibold text-[var(--text-primary)]">{i.name}</span>
                            <ImportanceChip t={t} value={i.importance} />
                          </span>
                          {i.use_text ? <span dir="auto" className="line-clamp-2 text-start text-[12.5px] text-[var(--text-secondary)]">{i.use_text}</span> : null}
                          <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11.5px] text-[var(--text-dim)] tabular-nums">
                            <StatusChip t={t} value={i.status} />
                            <span>{fill(t("count.chosen"), { n: chosen, m: all })}</span>
                            {i.designs.length ? <span>{fill(t("count.designs"), { n: i.designs.length })}</span> : null}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                  {data.canEdit && g.id && <AddItem t={t} sectionId={data.section.id} groupId={g.id} onAdded={load} />}
                </ul>
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function AddItem({ t, sectionId, groupId, onAdded }: { t: (k: string) => string; sectionId: string; groupId: string; onAdded: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const add = async () => {
    if (!name.trim() || busy) return;
    setBusy(true); setErr(false);
    const res = await bc.addItem({ sectionId, groupId, name: name.trim() });
    setBusy(false);
    if (!res.ok) { setErr(true); return; }
    setName("");
    await onAdded();
  };
  return (
    <li className={`${CARD} flex flex-col gap-2 border-dashed px-4 py-3.5`}>
      <span className="text-[12px] font-semibold text-[var(--text-secondary)]">{t("sec.addItem")}</span>
      <span className="flex gap-2">
        <input id={`bc-add-item-${groupId}`} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void add(); }} placeholder={t("sec.addHint")} className={FIELD} />
        <button type="button" onClick={() => void add()} disabled={busy || !name.trim()} className="shrink-0 rounded-xl bg-[var(--bg-inverted)] px-3 text-[12.5px] font-semibold text-[var(--text-inverted)] disabled:opacity-50">
          {busy ? <SpinnerIcon size={13} /> : <RrIcon name="plus" size={13} />}
        </button>
      </span>
      {err ? <span role="alert" className="text-[12px] text-red-500">{t("save.error")}</span> : null}
    </li>
  );
}
