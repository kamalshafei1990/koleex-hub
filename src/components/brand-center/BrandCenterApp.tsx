"use client";

/* ---------------------------------------------------------------------------
   Brand Center — /brand-center (owner, 28/09/2026)

   The KOLEEX brand as a working tool: the library of every branded item, the
   full guidelines, fill-in templates, a page per profession, and requests.
   This first screen shows what each part holds; the parts fill in step by
   step (the plan's ledger). Open to every employee; only the owner edits.

   Requests on open: NONE — the numbers ship with the page.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { brandCenterT } from "@/lib/translations/brand-center";
import { brandCenterNamesT } from "@/lib/translations/brand-center-names";
import { BRAND_SECTIONS, GUIDELINE_PARTS } from "@/lib/brand-center/overview";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import SharedKpiCard from "@/components/ui/KpiCard";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";
import BrandCenterIcon from "@/components/icons/BrandCenterIcon";
import { CARD } from "@/components/travel/fields";
import { RequestsPanel, RolesPanel, TemplatesPanel } from "./panels";

const WORDS = { ...brandCenterT, ...brandCenterNamesT };
type Tab = "library" | "guidelines" | "templates" | "roles" | "requests";

const SECTION_ICON: Record<string, RrIconName> = {
  stationery: "clipboard", gifts: "gift", packaging: "box-open", uniforms: "id-badge", machine: "tools",
  shipping: "truck-container", paperwork: "document", print: "newspaper", digital: "laptop", video: "camera",
  documents: "file", offices: "building", factory: "hard-hat", showroom: "eye", signage: "flag-alt",
  exhibitions: "megaphone", events: "microphone", vehicles: "delivery-truck", dealers: "handshake",
  occasions: "calendar", employees: "users",
};

const fill = (s: string, n: number) => s.replace("{n}", n.toLocaleString());

export default function BrandCenterApp() {
  const { t } = useTranslation(WORDS);
  const [tab, setTab] = useState<Tab>("library");
  const [query, setQuery] = useState("");

  const totals = useMemo(() => ({
    items: BRAND_SECTIONS.reduce((n, s) => n + s.items, 0),
    types: BRAND_SECTIONS.reduce((n, s) => n + s.types, 0),
  }), []);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? BRAND_SECTIONS.filter((s) => t(`sec.${s.id}`).toLowerCase().includes(q)) : BRAND_SECTIONS;
  }, [query, t]);

  const nav = (key: Tab, icon: RrIconName, count?: number) => ({
    key, icon, label: t(`nav.${key}`), count, active: tab === key, onClick: () => setTab(key),
  });

  return (
    <div className="min-h-full">
      <div className="mx-auto w-full max-w-[1500px] px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-8">
        <PageHeader title={t("app.title")} subtitle={t("app.subtitle")} icon={<BrandCenterIcon size={16} />} showTabs={false} />

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
          <SharedKpiCard label={t("kpi.sections")} value={String(BRAND_SECTIONS.length)} icon="palette" />
          <SharedKpiCard label={t("kpi.items")} value={totals.items.toLocaleString()} icon="box-open" />
          <SharedKpiCard label={t("kpi.types")} value={totals.types.toLocaleString()} icon="list-check" />
          <SharedKpiCard label={t("kpi.parts")} value={String(GUIDELINE_PARTS.length)} icon="books" />
        </div>

        <div className="mt-4 mb-4">
          <AppHomeMenu
            searchPlaceholder={t("search.placeholder")}
            onSearchSubmit={(term) => { setQuery(term); setTab("library"); }}
            navItems={[
              nav("library", "box-open", BRAND_SECTIONS.length),
              nav("guidelines", "books", GUIDELINE_PARTS.length),
              nav("templates", "file"),
              nav("roles", "users"),
              nav("requests", "paper-plane"),
            ]}
          />
        </div>

        {tab === "library" && (
          <section data-kx-pane>
            <p className="mb-4 max-w-3xl text-[14px] leading-6 text-[var(--text-secondary)]">{t("library.lead")}</p>
            {sections.length === 0 ? (
              <div className={`${CARD} px-6 py-10 text-center text-[var(--text-secondary)]`}>{t("library.none")}</div>
            ) : (
              <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {sections.map((s) => (
                  <li key={s.id}>
                    <Link href={`/brand-center/${s.id}`} className={`${CARD} flex h-full items-start gap-3 px-4 py-3.5 transition-colors hover:border-[var(--border-strong)]`}>
                    <span className="mt-0.5 text-[var(--text-dim)]" aria-hidden><RrIcon name={SECTION_ICON[s.id] ?? "box-open"} size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-baseline gap-2 text-[14px] font-semibold text-[var(--text-primary)]">
                        <span className="font-mono text-[11px] font-medium text-[var(--text-faint)] tabular-nums">{String(s.no).padStart(2, "0")}</span>
                        <span className="truncate">{t(`sec.${s.id}`)}</span>
                      </p>
                      <p className="mt-1 text-[12px] text-[var(--text-secondary)] tabular-nums">
                        {fill(t("library.items"), s.items)} · {fill(t("library.types"), s.types)} · {fill(t("library.groups"), s.groups)}
                      </p>
                    </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {tab === "guidelines" && (
          <section data-kx-pane>
            <p className="mb-4 max-w-3xl text-[14px] leading-6 text-[var(--text-secondary)]">{t("guide.lead")}</p>
            <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {GUIDELINE_PARTS.map((p) => (
                <li key={p.id} className={`${CARD} flex items-baseline gap-3 px-4 py-3.5`}>
                  <span className="font-mono text-[11px] text-[var(--text-faint)] tabular-nums">{String(p.no).padStart(2, "0")}</span>
                  <span className="flex-1 text-[14px] font-semibold text-[var(--text-primary)]">{t(`part.${p.id}`)}</span>
                  <span className="text-[12px] text-[var(--text-secondary)] tabular-nums">{fill(t("guide.sections"), p.sections)}</span>
                </li>
              ))}
            </ul>
            <div className={`${CARD} mt-4 flex flex-wrap items-center gap-3 px-4 py-3.5`}>
              <p className="flex-1 text-[13px] text-[var(--text-secondary)]">{t("guide.currentHint")}</p>
              <Link href="/knowledge/brand-guidelines" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-primary)] underline-offset-4 hover:underline">
                <RrIcon name="books" size={14} />{t("guide.current")}
              </Link>
            </div>
          </section>
        )}

        {tab === "templates" && <TemplatesPanel t={t} />}
        {tab === "roles" && <RolesPanel t={t} />}
        {tab === "requests" && <RequestsPanel t={t} />}
      </div>
    </div>
  );
}
