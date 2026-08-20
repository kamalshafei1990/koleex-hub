"use client";

/* ---------------------------------------------------------------------------
   Dashboard app — THE FULL SUMMARY of everything in the system, through
   cards (owner's definition, 2026-08-20): every app's cards, permission-
   filtered, filling the screen. Organizing happens on HOME — here each card
   carries an "＋ Home" pin so any card can be sent to the Home board.

   DARK-LAUNCHED like the Home dashboard: renders only in development or when
   NEXT_PUBLIC_HOME_DASHBOARD=1; production 404s, so a sibling session pushing
   main cannot expose it. The registry entry flips with the SAME flag.

   Data: the ONE /api/dashboard request (permission-filtered server-side).
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { notFound, useRouter } from "next/navigation";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import {
  CATALOG, type WidgetDef, allowedDef, defOf, renderFace, kit,
  SIZE_CLASS, loadPins, savePins, type LayoutItem,
  useDashboardPayload,
} from "@/components/dashboard/widget-kit";
import s from "./dashboard.module.css";

const DASH_ON =
  process.env.NEXT_PUBLIC_HOME_DASHBOARD === "1" || process.env.NODE_ENV === "development";

/* group the catalog by app, preserving catalog order */
function groupByApp(defs: WidgetDef[]): Array<{ app: string; defs: WidgetDef[] }> {
  const out: Array<{ app: string; defs: WidgetDef[] }> = [];
  for (const d of defs) {
    const g = out.find((x) => x.app === d.app);
    if (g) g.defs.push(d);
    else out.push({ app: d.app, defs: [d] });
  }
  return out;
}

export default function DashboardApp() {
  const router = useRouter();
  const { data } = useDashboardPayload("month");
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

  const groups = data ? groupByApp(CATALOG.filter((d) => allowedDef(d, data))) : [];

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <div className={s.title}>Dashboard</div>
          <div className={s.subtitle}>THE FULL PICTURE · EVERY CARD YOUR ROLE CAN SEE · PIN ANY CARD TO HOME</div>
        </div>
        {data && (
          <div className={s.headBtns}>
            <span className={s.hint}>{pins.length} on Home · organize them from the Home page</span>
          </div>
        )}
      </div>

      {!data ? (
        <div className={s.loading}><SpinnerIcon size={28} /></div>
      ) : (
        groups.map((g) => (
          <section key={g.app} className={s.section}>
            <div className={s.secHead}>
              <span className={s.secTitle}>{g.app}</span>
              <span className={s.secRule} />
            </div>
            <div className={kit.canvas}>
              {g.defs.map((def) => {
                /* the summary shows every card at its LARGEST face — this is
                   the overview, not the personal board */
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
                    <button
                      type="button"
                      className={`${kit.pinBtn} ${pinned(def.key) ? kit.pinOn : ""}`}
                      aria-pressed={pinned(def.key)}
                      aria-label={pinned(def.key) ? `Remove ${def.title} from Home` : `Add ${def.title} to Home`}
                      onClick={(e) => { e.stopPropagation(); togglePin(def.key); }}
                    >
                      {pinned(def.key) ? "✓ ON HOME" : "＋ HOME"}
                    </button>
                    {renderFace(def.key, size, data)}
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
