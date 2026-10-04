"use client";

/* ---------------------------------------------------------------------------
   Dashboard app — TWO functions (owner, 2026-08-20): "real full dashboard of
   all the system, and widgets and cards."

   · DASHBOARD view — the composed, read-first summary of the whole system:
     Overview (attention + team + system) then every data section, no pin
     chrome. This is the screen you READ.
   · WIDGETS view — every app of the Hub, its icon BIG and clear, with the
     cards it offers; every card carries the ＋ pin that sends it to Home
     (organizing stays on Home). Apps without data cards yet offer their
     launcher card, auto-generated from APP_REGISTRY.

   Aurora: the segment layout carries kx-app + the ground; tabs are the
   canonical TabStrip; tab content enters via the keyed kx-tab-in wrapper.
   Permission-filtered server-side (`modules` covers every governable app).
   DARK-LAUNCHED: production 404s until the flag flips.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { notFound, useRouter } from "next/navigation";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TabStrip from "@/components/ui/TabStrip";
import {
  CATALOG, LAUNCHER_DEFS, type WidgetDef, allowedDef, defOf, renderFace, kit,
  SIZE_CLASS, loadPins, savePins, type LayoutItem, type Payload,
  useDashboardPayload,
} from "@/components/dashboard/widget-kit";
import { APP_REGISTRY, type AppDef } from "@/lib/navigation";
import AppsIcon from "@/components/icons/ui/AppsIcon";
import s from "./dashboard.module.css";

const DASH_ON =
  process.env.NEXT_PUBLIC_HOME_DASHBOARD === "1" || process.env.NODE_ENV === "development";

/* ── the DASHBOARD view's composition ──
   1. Overview composes cross-app + team + system into one tight 6×2 block.
   2. Inside a section, cards sort widest-first so the dense grid packs with
      no holes (XL → L → M → S; the full-width strip closes the section). */
const SECTION_ORDER = [
  "Overview", "Quotations", "Invoices", "CRM", "Customers", "Contacts",
  "Products", "Purchases", "Suppliers", "Projects", "Calendar", "To-do",
  "Notes", "Documents", "Expenses", "Employees", "Issue Reports",
  "Database", "Mail", "Knowledge",
];
const SIZE_RANK: Record<string, number> = { XL: 0, L: 1, M: 2, S: 3, F: 4 };
const largest = (d: WidgetDef) => d.sizes[d.sizes.length - 1];
const bySize = (a: WidgetDef, b: WidgetDef) => (SIZE_RANK[largest(a)] ?? 9) - (SIZE_RANK[largest(b)] ?? 9);

function composeDashboard(defs: WidgetDef[]): Array<{ section: string; defs: WidgetDef[] }> {
  const groups = new Map<string, WidgetDef[]>();
  for (const d of defs) {
    if (d.kind === "shortcut") continue; /* the read view holds data, not launchers */
    const key = d.section ?? d.app;
    const g = groups.get(key);
    if (g) g.push(d);
    else groups.set(key, [d]);
  }
  const out = [...groups.entries()].map(([section, list]) => ({ section, defs: list.sort(bySize) }));
  out.sort((a, b) => {
    const ia = SECTION_ORDER.indexOf(a.section), ib = SECTION_ORDER.indexOf(b.section);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return out;
}

/* ── the WIDGETS view: one section PER APP, its icon BIG and clear ── */
type AppSection = { app: string; icon: AppDef["icon"] | null; defs: WidgetDef[] };
function composeWidgets(data: Payload): AppSection[] {
  const allowed = (d: WidgetDef) => allowedDef(d, data);
  const out: AppSection[] = [];
  /* curated apps first, in catalog order, each headed by its registry icon */
  for (const d of CATALOG.filter(allowed)) {
    const g = out.find((x) => x.app === d.app);
    if (g) g.defs.push(d);
    else out.push({ app: d.app, icon: APP_REGISTRY.find((a) => a.name === d.app)?.icon ?? null, defs: [d] });
  }
  for (const g of out) g.defs.sort(bySize);
  /* then every remaining app of the Hub as a launcher card */
  const launchers = LAUNCHER_DEFS.filter(allowed);
  if (launchers.length) out.push({ app: "All the other apps", icon: null, defs: launchers });
  return out;
}

export default function DashboardApp() {
  const router = useRouter();
  const { data } = useDashboardPayload("month");
  const [view, setView] = useState<"dashboard" | "widgets">("dashboard");
  const [pins, setPins] = useState<LayoutItem[]>(() => loadPins());

  if (!DASH_ON) notFound();

  const pinned = (key: string) => pins.some((p) => p.key === key);
  const togglePin = (key: string) => {
    const def = defOf(key);
    if (!def) return;
    setPins((prev) => {
      const next = prev.some((p) => p.key === key)
        ? prev.filter((p) => p.key !== key)
        : [...prev, { id: key, key, size: def.sizes[def.sizes.length - 1] }];
      savePins(next);
      return next;
    });
  };

  const renderCard = (def: WidgetDef, withPin: boolean) => {
    const size = def.sizes[def.sizes.length - 1];
    const cls = `kx-glass ${kit.w} ${kit[SIZE_CLASS[size] as keyof typeof kit]} ${def.kind === "shortcut" ? kit.shortcut : ""}`;
    return (
      <div
        key={def.key}
        className={cls}
        onClick={() => { if (def.href) router.push(def.href); }}
        role={def.href ? "link" : undefined}
        style={{ cursor: def.href ? "pointer" : undefined }}
        data-kx-keep-hover=""
      >
        {withPin && (
          <button
            type="button"
            className={`${kit.pinBtn} ${pinned(def.key) ? kit.pinOn : ""}`}
            aria-pressed={pinned(def.key)}
            aria-label={pinned(def.key) ? `Remove ${def.title} from Home` : `Add ${def.title} to Home`}
            title={pinned(def.key) ? "On Home — tap to remove" : "Add to Home"}
            onClick={(e) => { e.stopPropagation(); togglePin(def.key); }}
          >
            {pinned(def.key) ? "✓" : "＋"}
          </button>
        )}
        {renderFace(def.key, size, data)}
      </div>
    );
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <div className={s.title}>Dashboard</div>
          <div className={s.subtitle}>
            {view === "dashboard"
              ? "THE FULL PICTURE OF THE SYSTEM · LIVE"
              : "EVERY APP'S CARDS · PIN ANY CARD TO HOME"}
          </div>
        </div>
        <div className={s.headBtns}>
          <TabStrip
            ariaLabel="Dashboard views"
            shape="pill"
            items={[
              { key: "dashboard", label: "Dashboard", active: view === "dashboard", onClick: () => setView("dashboard") },
              { key: "widgets", label: "Widgets", active: view === "widgets", onClick: () => setView("widgets") },
            ]}
          />
        </div>
      </div>

      {!data ? (
        <div className={s.loading}><SpinnerIcon size={28} /></div>
      ) : (
        /* keyed wrapper: tab content must ENTER, never pop (canon E) */
        <div key={view} className="kx-tab-in">
          {view === "dashboard" ? (
            composeDashboard(CATALOG.filter((d) => allowedDef(d, data))).map((g) => (
              <section key={g.section} className={s.section}>
                <div className={s.secHead}>
                  <span className={s.secDot} aria-hidden />
                  <span className={s.secTitle}>{g.section}</span>
                  <span className={s.secRule} />
                </div>
                <div className={kit.canvas}>
                  {g.defs.map((def) => renderCard(def, false))}
                </div>
              </section>
            ))
          ) : (
            <>
              <div className={s.pinHint}>{pins.length} on Home · organize them from the Home page</div>
              {composeWidgets(data).map((g) => {
                const Icon = g.icon ?? AppsIcon;
                return (
                <section key={g.app} className={s.section}>
                  <div className={s.appHead}>
                    <span className={s.appIcon}><Icon size={22} /></span>
                    <span className={s.appName}>{g.app}</span>
                    <span className={s.secRule} />
                    <span className={s.secCount}>{g.defs.length}</span>
                  </div>
                  <div className={kit.canvas}>
                    {g.defs.map((def) => renderCard(def, true))}
                  </div>
                </section>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
