"use client";

/* ---------------------------------------------------------------------------
   ProductDataHome — the landing screen for /product-data.

   WHY THIS EXISTS. The owner compared opening Product Data against opening
   Inventory and Purchase and preferred those two without being able to name
   the difference. Measured on prod, it was not the loading screen (all three
   render the same BrandLoading), not speed (Product Data's first paint is
   124ms against Inventory's 548ms) and not the images (242 of 244 are lazy).
   It was the SHAPE of the first screen:

     Inventory / Purchase → 1.3–1.8 screens: a hero, a tab strip, a few
       numbers and "what do you want to do". A screen that has finished.
     Product Data → 17 screens (13,646px) of raw catalogue the moment it
       opens. A screen that is still work.

   So this is the same landing shape the other two workspaces have, using the
   same primitives (TodayTile / QuickActionCard / SectionEyebrow copied from
   PurchaseHome so the visual rhythm is identical), and the catalogue moves
   one click away to /product-data/catalog.

   NO NEW SERVER WORK. Every number here comes from the two endpoints the
   catalogue already calls — /api/products/signals and /api/products?view=list
   — so opening this screen costs nothing the catalogue was not already
   spending, and both land warm in the query cache for the catalogue tab.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import RrIcon from "@/components/ui/RrIcon";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";

/* ── Primitives — deliberately identical to PurchaseHome / InventoryDashboard.
      Shared rhythm is the whole point of this screen. ── */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
      {children}
    </h2>
  );
}

/* value === null means "not known yet" — it renders an em dash, never a 0.
   Stating 0 products while the count is still in flight is the same defect as
   "No supplier linked" flipping to a real supplier a second later. */
function StatTile({ label, value, href }: { label: string; value: number | null; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-hover)]"
    >
      <div className="flex-1 text-[12px] text-[var(--text-muted)]">{label}</div>
      <div className="text-[15px] font-medium tabular-nums text-[var(--text-primary)]">
        {value === null ? "—" : value}
      </div>
    </Link>
  );
}

function AlertCard({ href, label, count, tone }: { href: string; label: string; count: number | null; tone: "rose" | "amber" | "blue" }) {
  const dot = tone === "rose" ? "bg-rose-500" : tone === "amber" ? "bg-amber-500" : "bg-blue-500";
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5 transition-colors hover:bg-[var(--bg-surface-hover)]"
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0 flex-1 text-[12.5px] text-[var(--text-primary)]">{label}</div>
      <div className="text-[16px] font-medium tabular-nums text-[var(--text-primary)]">
        {count === null ? "—" : count}
      </div>
    </Link>
  );
}

function QuickActionCard({ href, icon, label, hint, tone }: {
  href: string;
  icon: React.ComponentProps<typeof RrIcon>["name"];
  label: string;
  hint: string;
  tone: "blue" | "teal" | "amber" | "violet";
}) {
  const accentBar =
    tone === "blue" ? "bg-blue-500/60" :
    tone === "teal" ? "bg-teal-500/60" :
    tone === "amber" ? "bg-amber-500/60" :
                       "bg-violet-500/60";
  return (
    <Link
      href={href}
      className="group relative flex h-full min-h-[120px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 shadow-sm transition-colors hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)]"
    >
      <span aria-hidden className={`absolute left-4 top-0 h-px w-12 ${accentBar}`} />
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <RrIcon name={icon} size={16} />
        </span>
        <div className="text-[14px] font-medium tracking-tight text-[var(--text-primary)]">{label}</div>
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--text-dim)]">{hint}</p>
      <div className="mt-auto pt-2 text-[11px] text-[var(--text-dim)] opacity-0 transition-opacity group-hover:opacity-100">→</div>
    </Link>
  );
}

/* ── Data ── */

interface Stats {
  total: number | null;
  published: number | null;
  draft: number | null;
  hidden: number | null;
  needsData: number | null;
  noPrice: number | null;
  noSupplier: number | null;
  readiness: number | null;
}

const EMPTY: Stats = {
  total: null, published: null, draft: null, hidden: null,
  needsData: null, noPrice: null, noSupplier: null, readiness: null,
};

interface SignalLite {
  readiness: number | null;
  missing?: string[];
  cost: number | null;
  pricingMode?: "fixed" | "from" | "on_request";
  visible?: boolean;
  supplier?: { name: string } | null;
}

export default function ProductDataHome() {
  const { t } = useTranslation(PRODUCTS_UI_I18N);
  const [stats, setStats] = useState<Stats>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();

    (async () => {
      /* Both requests are the catalogue's own. Fired together, not chained:
         neither needs the other's answer. */
      const [listRes, sigRes] = await Promise.allSettled([
        fetch("/api/products?view=list", { credentials: "include", signal: ctrl.signal }),
        fetch("/api/products/signals", { credentials: "include", signal: ctrl.signal }),
      ]);
      if (cancelled) return;

      const next: Stats = { ...EMPTY };

      if (listRes.status === "fulfilled" && listRes.value.ok) {
        try {
          const json = (await listRes.value.json()) as { rows?: { status?: string | null }[] };
          const rows = json.rows ?? [];
          next.total = rows.length;
          next.published = rows.filter((r) => (r.status || "draft") === "active").length;
          next.draft = next.total - next.published;
        } catch { /* leave as unknown — an em dash beats a wrong number */ }
      }

      if (sigRes.status === "fulfilled" && sigRes.value.ok) {
        try {
          const json = (await sigRes.value.json()) as { signals?: Record<string, SignalLite> };
          const sigs = Object.values(json.signals ?? {});
          if (sigs.length) {
            next.needsData = sigs.filter((s) => (s.missing?.length ?? 0) > 0).length;
            /* on_request means "quoted per configuration" — an empty cost
               there is the ANSWER, not a gap. Counting it would tell the
               owner to go fix rows that are already correct. */
            next.noPrice = sigs.filter((s) => s.cost == null && s.pricingMode !== "on_request").length;
            next.noSupplier = sigs.filter((s) => !s.supplier).length;
            next.hidden = sigs.filter((s) => s.visible === false).length;
            const scored = sigs.map((s) => s.readiness).filter((r): r is number => typeof r === "number");
            next.readiness = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
          }
        } catch { /* same — unknown stays unknown */ }
      }

      if (!cancelled) setStats(next);
    })();

    return () => { cancelled = true; ctrl.abort(); };
  }, []);

  const cat = "/product-data/catalog";

  return (
    <div className="space-y-6">
      {/* ── The numbers ── */}
      <section>
        <SectionEyebrow>{t("home.catalogue", "Catalogue")}</SectionEyebrow>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <StatTile label={t("home.total", "Products")} value={stats.total} href={cat} />
          <StatTile label={t("home.published", "Live for customers")} value={stats.published} href={`${cat}?status=active`} />
          <StatTile label={t("home.draft", "Draft")} value={stats.draft} href={`${cat}?status=draft`} />
          <StatTile label={t("home.readiness", "Avg. completeness")} value={stats.readiness} href={cat} />
        </div>
      </section>

      {/* ── What needs doing ── */}
      <section>
        <SectionEyebrow>{t("home.needsWork", "Needs work")}</SectionEyebrow>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <AlertCard href={cat} label={t("home.missingData", "Missing data")} count={stats.needsData} tone="amber" />
          <AlertCard href={cat} label={t("home.noPrice", "No cost price")} count={stats.noPrice} tone="rose" />
          <AlertCard href={`${cat}?supplier=`} label={t("home.noSupplier", "No supplier linked")} count={stats.noSupplier} tone="blue" />
        </div>
      </section>

      {/* ── What do you want to do ── */}
      <section>
        <SectionEyebrow>{t("home.quickActions", "Quick actions")}</SectionEyebrow>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <QuickActionCard
            href={cat}
            icon="box-open"
            tone="blue"
            label={t("home.openCatalogue", "Open catalogue")}
            hint={t("home.openCatalogueHint", "Browse, filter and edit every product.")}
          />
          <QuickActionCard
            href="/product-data/new"
            icon="clipboard"
            tone="teal"
            label={t("action.addProduct", "Add product")}
            hint={t("home.addProductHint", "Create a new product record from scratch.")}
          />
          <QuickActionCard
            href="/product-data/settings"
            icon="tools"
            tone="amber"
            label={t("list.controlPanel", "Control panel")}
            hint={t("home.controlPanelHint", "Divisions, categories and spec templates.")}
          />
          <QuickActionCard
            href="/database"
            icon="database"
            tone="violet"
            label={t("home.visualLibrary", "Visual library")}
            hint={t("home.visualLibraryHint", "Specs, attributes and the icon registry.")}
          />
        </div>
      </section>
    </div>
  );
}
