"use client";

/* ---------------------------------------------------------------------------
   HomeDashboard — the full dashboard living on the Home page (owner call,
   2026-08-20: "I want the full dashboard in home page", in the slab style
   cloned from his reference cards).

   Data: ONE request to /api/dashboard (no-store — the products HTTP-cache
   revert can never happen here), refreshed when the tab regains visibility.
   Every widget arrives already permission-filtered by the server; a widget
   the account can't view is null and simply doesn't render. Numbers are
   REAL or absent — never decorative.

   Layout stability (the no-shift-after-paint rule): once an account has seen
   the dashboard, a localStorage flag reserves the space on the next visits
   so the app grid never jumps. First-ever load appears once, then the flag
   holds the slot forever.
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import {
  type Payload, type LayoutItem, allowedDef, defOf, renderFace, kit,
  SIZE_CLASS, loadPins, savePins, useWidgetDrag,
} from "@/components/dashboard/widget-kit";
import s from "./home-dashboard.module.css";

const SEEN_KEY = "kx_home_dash_seen";
const OPEN_KEY = "kx_home_dash_open";

const PERIOD_TABS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
] as const;

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

/* Real series → smooth SVG path (Catmull-Rom → bézier). */
function curvePath(series: number[], w: number, h: number): { d: string; peak: { x: number; y: number } } {
  const max = Math.max(...series, 1);
  const pad = 14;
  const pts = series.map((v, i) => ({
    x: pad + (i * (w - pad * 2)) / (series.length - 1),
    y: h - pad - (v / max) * (h - pad * 2),
  }));
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  const peakIdx = series.indexOf(Math.max(...series));
  return { d, peak: pts[peakIdx] ?? pts[pts.length - 1] };
}

export default function HomeDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  const [period, setPeriod] = useState("month");
  /* Show/hide (owner, 2026-08-20). Lazy init like the reserve flag — the
     first paint is already in the remembered state, so nothing jumps. */
  const [open, setOpen] = useState(() => {
    try { return window.localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
  });
  /* Bumped on every expand — keys the curve so its draw-in replays. */
  const [drawKey, setDrawKey] = useState(0);
  /* THE FLIGHT (owner's pick after two rejected styles): every card flies
     INTO the toggle button on hide and BURSTS back out of it on show —
     each along its own measured trajectory. Toggle-only; page open stays
     at the near-imperceptible tier. */
  const [animOn, setAnimOn] = useState(false);
  /* true only WHILE cards are traveling — it lifts the clip so the flight
     is visible right at the button, then re-clips (and re-blocks pointer
     events on the hidden deck) the moment the flight ends. */
  const [flying, setFlying] = useState(false);
  const flyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  /* ═══ THE PINNED BOARD (owner, 2026-08-20): any card of the Dashboard app
     can be added to Home, and Home is where it is edited/organized — the
     iOS grammar (jiggle, drag, minus, size), powered by the shared drag
     engine. Pins persist in kx_home_pins_v1 (same store the Dashboard app's
     "＋ Home" buttons write). ═══ */
  const [pins, setPins] = useState<LayoutItem[]>(() => loadPins());
  const [editing, setEditing] = useState(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const dragEngine = useWidgetDrag({ canvasRef, layout: pins, setLayout: setPins, editing });

  /* THE FLIGHT, driven by the Web Animations API — not CSS keyframes.
     Chrome samples custom properties inside @keyframes ONCE at animation
     start; on show that start races the layout effect that writes them,
     locking the translate at 0 — the cards scaled in place and the burst
     was never seen (the owner's "nothing changed"). WAAPI takes literal
     numbers per card, so there is nothing to race. */
  const runFlight = (dir: "in" | "out") => {
    const root = rootRef.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const btn = root.querySelector("[data-dash-toggle]");
    if (!btn) return;
    const b = btn.getBoundingClientRect();
    const bx = b.left + b.width / 2, by = b.top + b.height / 2;
    const cards = Array.from(root.querySelectorAll<HTMLElement>("[data-flight]"));
    const n = cards.length;
    cards.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const away = `translate(${bx - (r.left + r.width / 2)}px, ${by - (r.top + r.height / 2)}px) scale(0.04) rotate(${i % 2 === 0 ? -8 : 7}deg)`;
      const home = "translate(0px, 0px) scale(1) rotate(0deg)";
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        dir === "in"
          ? [{ transform: away, opacity: 0 }, { transform: home, opacity: 1 }]
          : [{ transform: home, opacity: 1 }, { transform: away, opacity: 0 }],
        {
          duration: 820,
          /* time mirror: show deals hero-first, hide returns hero-last */
          delay: (dir === "in" ? i : n - 1 - i) * 60,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          fill: "both",
        },
      );
    });
  };

  const toggle = () => {
    /* No side effects inside updaters — StrictMode runs them twice. */
    const next = !open;
    setAnimOn(true);
    setFlying(true);
    if (flyTimer.current) clearTimeout(flyTimer.current);
    flyTimer.current = setTimeout(() => setFlying(false), 1300);
    if (!next) runFlight("out"); /* hiding: cards are at rest — fly them out */
    setOpen(next);
    if (next) setDrawKey((k) => k + 1);
    try { window.localStorage.setItem(OPEN_KEY, next ? "1" : "0"); } catch { /* fine */ }
  };

  /* On SHOW the cards render at rest first; this layout effect flies them
     in BEFORE paint, so the first visible frame is already at the button. */
  useLayoutEffect(() => {
    if (open && animOn) runFlight("in");
  }, [open, animOn]);
  /* Lazy init, not an effect: this component is dynamic({ssr:false}), so
     localStorage exists at first render — and reading it here means the
     reserved slot is present in the very first paint (no shift). */
  const [reserve] = useState(() => {
    try { return window.localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/dashboard?period=${period}`, { credentials: "include", cache: "no-store" });
        if (!r.ok) { if (!cancelled) setFailed(true); return; }
        const j = (await r.json()) as Payload;
        if (cancelled) return;
        setData(j);
        const any = j.widgets && Object.values(j.widgets).some((w) => w !== null);
        try { window.localStorage.setItem(SEEN_KEY, any ? "1" : "0"); } catch { /* fine */ }
      } catch { if (!cancelled) setFailed(true); }
    };
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); };
  }, [period]);

  const q = data?.widgets.quotations ?? null;
  const p = data?.widgets.products ?? null;
  const td = data?.widgets.todo ?? null;
  const pr = data?.widgets.presence ?? null;
  const sys = data?.widgets.system ?? null;

  const curve = useMemo(
    () => (q && !q.error && q.series?.length ? curvePath(q.series, 760, 150) : null),
    [q],
  );

  /* Nothing visible for this account → render nothing (and don't reserve). */
  const empty = data !== null && !q && !p && !td && !pr && !sys;
  if (failed || empty) return null;

  /* Loading: hold the slot only for accounts that have seen it before. */
  if (!data) {
    if (!reserve) return null;
    return (
      <div className={s.grid} aria-hidden="true">
        <div className={`kx-glass ${s.slab} ${s.hero} ${s.skel}`}><span className={s.skelDot} /></div>
        <div className={s.side}>
          <div className={`kx-glass ${s.slab} ${s.kpi}`} />
          <div className={`kx-glass ${s.slab} ${s.kpi}`} />
          <div className={`kx-glass ${s.slab} ${s.kpi}`} />
        </div>
      </div>
    );
  }

  /* pins render only what the account can view — hidden, never deleted:
     grant the module back and the card reappears where it was */
  const visiblePins = pins.filter((it) => allowedDef(defOf(it.key), data));

  const doneEditing = () => { setEditing(false); savePins(pins); };
  const removePin = (id: string) => {
    dragEngine.snapshotRects();
    setPins((l) => { const next = l.filter((it) => it.id !== id); savePins(next); return next; });
  };
  const cyclePinSize = (id: string) => {
    dragEngine.snapshotRects();
    setPins((l) => l.map((it) => {
      if (it.id !== id) return it;
      const sizes = defOf(it.key)?.sizes ?? [it.size];
      return { ...it, size: sizes[(sizes.indexOf(it.size) + 1) % sizes.length] };
    }));
  };

  const pulse = q && !q.error
    ? (typeof q.openValue === "number" ? `${money(q.openValue)} · ${q.openCount} open` : `${q.openCount} open quotations`)
    : null;

  return (
    <div ref={rootRef}>
      {/* period chips + the show/hide control. When hidden, the chips give
          way to a live one-line pulse so the company's heartbeat never
          fully leaves the Home. */}
      <div className={s.tabs}>
        {open ? (
          PERIOD_TABS.map((t) => (
            <button key={t.key} type="button"
              className={`${s.tab} ${period === t.key ? s.tabOn : ""}`}
              onClick={() => setPeriod(t.key)}>
              {t.label}
            </button>
          ))
        ) : (
          <span className={s.pulseLine}>{pulse ?? "Dashboard"}</span>
        )}
        {open && <span className={s.tabsHint}>LIVE · {data.gatewayMs}ms</span>}
        <button type="button" onClick={toggle} data-dash-toggle="" className={`${s.tab} ${s.toggleBtn} ${!open && animOn ? s.toggleCaught : ""}`}
          aria-expanded={open} aria-label={open ? "Hide dashboard" : "Show dashboard"}>
          <AngleDownIcon size={11} className={`${s.chev} ${open ? "" : s.chevClosed}`} aria-hidden="true" />
          {open ? "Hide" : "Show"}
        </button>
      </div>
    <div className={`${s.collapser} ${open ? "" : s.collapsed} ${flying ? s.flying : ""}`} aria-hidden={!open}>
    <div className={s.collapseInner}>

      {/* ═══ HERO — quotations pipeline, the real headline. The ONE special
          card: fixed above the board, not a pin. ═══ */}
      {q && !q.error && (
        <Link href="/quotations" className={`kx-glass ${s.slab} ${s.hero} ${s.heroWide}`} style={{ textDecoration: "none", color: "inherit" }} data-flight="">
          <div className={s.bp} />
          <div className={s.klabel}>
            <span>Quotations — created per week · 12w</span>
            <span className={s.mini}>LIVE</span>
          </div>
          {curve && (
            <div className={s.curve}>
              <svg viewBox="0 0 760 150" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <defs>
                  <filter id="kxdlg" x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="4" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="kxddg" x="-300%" y="-300%" width="700%" height="700%">
                    <feGaussianBlur stdDeviation="6" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <linearGradient id="kxdgr" x1="0" y1="0" x2="760" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#8FA9C9" stopOpacity=".5" />
                    <stop offset=".55" stopColor="#C9DEF7" />
                    <stop offset="1" stopColor="#8FA9C9" stopOpacity=".6" />
                  </linearGradient>
                </defs>
                <path key={drawKey} pathLength={1} className={s.curveDraw} d={curve.d} stroke="url(#kxdgr)" strokeWidth="4" strokeLinecap="round" filter="url(#kxdlg)" />
                <circle cx={curve.peak.x} cy={curve.peak.y} r="7" fill="#EAF4FF" filter="url(#kxddg)" />
                <circle cx={curve.peak.x} cy={curve.peak.y} r="11" fill="none" stroke="rgba(160,210,255,.35)" strokeWidth="1" />
              </svg>
            </div>
          )}
          <div className={s.heroNum}>
            <div className={s.heroLbl}>Open pipeline</div>
            <div className={s.heroBig}>
              {typeof q.openValue === "number" ? money(q.openValue) : q.openCount}
            </div>
            <div className={s.heroSub}>
              {q.openCount} open quotation{q.openCount === 1 ? "" : "s"}
              {` · ${q.createdInPeriod} created ${q.period === "today" ? "today" : `this ${q.period}`}`}
              {q.expiringSoon > 0 ? ` · ${q.expiringSoon} expiring within 7 days` : ""}
              {typeof q.wonValueInPeriod === "number" && q.wonValueInPeriod > 0 ? ` · won ${q.period === "today" ? "today" : `this ${q.period}`} ${money(q.wonValueInPeriod)}` : ""}
            </div>
          </div>
        </Link>
      )}

      {/* ═══ THE PINNED BOARD — every card here came from the Dashboard app
          and is organized HERE: jiggle, drag, resize, remove (iOS grammar).
          "＋ Add cards" lives in the Dashboard app — the full summary IS the
          gallery. ═══ */}
      <div className={s.deckHead}>
        <span className={s.deckTitle}>YOUR CARDS</span>
        {editing && <Link href="/dashboard" className={s.deckAdd}>＋ Add cards from the Dashboard</Link>}
        <button type="button" className={`${s.tab} ${editing ? s.tabOn : ""}`} onClick={() => (editing ? doneEditing() : setEditing(true))}>
          {editing ? "Done" : "Edit"}
        </button>
      </div>
      <div ref={canvasRef} className={`${kit.canvas} ${editing ? kit.editing : ""}`}>
        {visiblePins.map((it) => {
          const def = defOf(it.key);
          const cls = `kx-glass ${kit.w} ${kit[SIZE_CLASS[it.size] as keyof typeof kit]} ${def?.kind === "shortcut" ? kit.shortcut : ""} ${dragEngine.dragId === it.id ? kit.dragLift : ""}`;
          return (
            <div
              key={it.id}
              data-wid={it.id}
              data-flight=""
              className={cls}
              onPointerDown={(e) => dragEngine.onPointerDown(e, it.id)}
              onPointerMove={dragEngine.onPointerMove}
              onPointerUp={dragEngine.onPointerUp}
              onPointerCancel={dragEngine.onPointerUp}
              onClick={() => { if (!editing && def?.href) router.push(def.href); }}
              role={def?.href && !editing ? "link" : undefined}
              style={{ cursor: !editing && def?.href ? "pointer" : undefined }}
              data-kx-keep-hover=""
            >
              {editing && (
                <>
                  <button type="button" className={kit.minus} aria-label={`Remove ${def?.title}`} onClick={(e) => { e.stopPropagation(); removePin(it.id); }}>−</button>
                  {(def?.sizes.length ?? 0) > 1 && (
                    <button type="button" className={kit.sizeDot} aria-label="Change size" onClick={(e) => { e.stopPropagation(); cyclePinSize(it.id); }}>
                      {it.size}
                    </button>
                  )}
                </>
              )}
              {renderFace(it.key, it.size, data)}
            </div>
          );
        })}
        {visiblePins.length === 0 && (
          <div className={s.deckEmpty}>
            No cards pinned yet — open the <Link href="/dashboard">Dashboard</Link> and tap ＋ HOME on any card.
          </div>
        )}
      </div>
    </div>
    </div>
    </div>
  );
}
