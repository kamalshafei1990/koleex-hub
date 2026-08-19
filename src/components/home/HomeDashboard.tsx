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

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import s from "./home-dashboard.module.css";

const SEEN_KEY = "kx_home_dash_seen";

type Quotations = {
  openCount: number; expiringSoon: number;
  stages: Record<string, number>; series: number[];
  openValue?: number; wonValueMtd?: number; error?: string;
};
type Products = { total: number; active: number; draft: number; draftAging: number; error?: string };
type Todo = { open: number; error?: string };
type Presence = { activeToday: number; teamSize: number; hoursToday: number; error?: string };
type Payload = {
  widgets: { quotations: Quotations | null; products: Products | null; todo: Todo | null; presence: Presence | null };
  showMoney: boolean; ts: number;
};

const STAGE_ORDER = ["draft", "sent", "negotiation", "won", "lost"] as const;
const STAGE_LABEL: Record<string, string> = {
  draft: "DRAFT", sent: "SENT", negotiation: "NEGOT.", won: "WON", lost: "LOST",
};

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
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
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
        const r = await fetch("/api/dashboard", { credentials: "include", cache: "no-store" });
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
  }, []);

  const q = data?.widgets.quotations ?? null;
  const p = data?.widgets.products ?? null;
  const td = data?.widgets.todo ?? null;
  const pr = data?.widgets.presence ?? null;

  const curve = useMemo(
    () => (q && !q.error && q.series?.length ? curvePath(q.series, 760, 150) : null),
    [q],
  );

  /* Nothing visible for this account → render nothing (and don't reserve). */
  const empty = data !== null && !q && !p && !td && !pr;
  if (failed || empty) return null;

  /* Loading: hold the slot only for accounts that have seen it before. */
  if (!data) {
    if (!reserve) return null;
    return (
      <div className={s.grid} aria-hidden="true">
        <div className={`${s.slab} ${s.hero} ${s.skel}`}><span className={s.skelDot} /></div>
        <div className={s.side}>
          <div className={`${s.slab} ${s.kpi}`} />
          <div className={`${s.slab} ${s.kpi}`} />
          <div className={`${s.slab} ${s.kpi}`} />
        </div>
      </div>
    );
  }

  const stages = q?.stages ?? {};
  const maxStage = Math.max(1, ...STAGE_ORDER.map((k) => stages[k] ?? 0));

  return (
    <div className={s.grid}>

      {/* ═══ HERO — quotations pipeline, the real headline ═══ */}
      {q && !q.error && (
        <Link href="/quotations" className={`${s.slab} ${s.hero}`} style={{ textDecoration: "none", color: "inherit" }}>
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
                <path d={curve.d} stroke="url(#kxdgr)" strokeWidth="4" strokeLinecap="round" filter="url(#kxdlg)" />
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
              {q.expiringSoon > 0 ? ` · ${q.expiringSoon} expiring within 7 days` : ""}
              {typeof q.wonValueMtd === "number" && q.wonValueMtd > 0 ? ` · won this month ${money(q.wonValueMtd)}` : ""}
            </div>
          </div>
        </Link>
      )}

      {/* ═══ side KPIs ═══ */}
      <div className={s.side}>
        {p && (
          <Link href="/product-data" className={`${s.slab} ${s.kpi}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className={s.klabel}><span>Catalogue</span></div>
            {p.error ? <div className={s.errCard}>⚠ can&apos;t read products</div> : (
              <>
                <div className={s.kval}>{p.active} <span className={s.unit}>/ {p.total} active</span></div>
                <div className={s.kdelta}>
                  {p.draft} in draft{p.draftAging > 0 ? <> · <span className={s.warnTone}>{p.draftAging} untouched &gt; 14d</span></> : null}
                </div>
              </>
            )}
          </Link>
        )}
        {td && (
          <Link href="/todo" className={`${s.slab} ${s.kpi}`} style={{ textDecoration: "none", color: "inherit" }}>
            <div className={s.klabel}><span>Your to-dos</span></div>
            {td.error ? <div className={s.errCard}>⚠ can&apos;t read to-dos</div> : (
              <>
                <div className={s.kval}>{td.open} <span className={s.unit}>open</span></div>
                <div className={s.kdelta}>{td.open === 0 ? <span className={s.good}>all clear</span> : "tap to open the list"}</div>
              </>
            )}
          </Link>
        )}
        {pr && (
          <div className={`${s.slab} ${s.kpi}`}>
            <div className={s.klabel}><span>Team today</span></div>
            {pr.error ? <div className={s.errCard}>⚠ can&apos;t read presence</div> : (
              <>
                <div className={s.kval}>{pr.activeToday} <span className={s.unit}>/ {pr.teamSize} active · {pr.hoursToday}h</span></div>
                <div className={s.kdelta}>from today&apos;s usage rollup</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ pipeline stages ═══ */}
      {q && !q.error && (
        <div className={`${s.slab} ${s.half} ${s.pipePad}`}>
          <div className={s.bp} />
          <div className={s.klabel}><span className={s.ttl}>Quotation pipeline</span><span className={s.unit}>BY STAGE</span></div>
          <div className={s.barsWrap}>
            {STAGE_ORDER.filter((k) => (stages[k] ?? 0) > 0 || ["draft", "sent", "won"].includes(k)).map((k) => {
              const v = stages[k] ?? 0;
              const hot = v === maxStage && v > 0;
              return (
                <div key={k} className={`${s.bar} ${hot ? s.barHot : ""}`} style={{ height: `${Math.max(6, (v / maxStage) * 100)}%` }}>
                  <b>{v}</b><em>{STAGE_LABEL[k] ?? k.toUpperCase()}</em>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══ attention — only rows that are TRUE right now ═══ */}
      <div className={`${s.slab} ${s.half}`}>
        <div className={s.klabel}><span className={s.ttl}>Attention needed</span><span className={s.unit}>CROSS-APP</span></div>
        <div style={{ marginBlockStart: 8 }}>
          {q && !q.error && q.expiringSoon > 0 && (
            <Link href="/quotations" className={s.attnRow}>
              <span className={`${s.sig} ${s.sigCrit}`} /><span><b>{q.expiringSoon} quotation{q.expiringSoon === 1 ? "" : "s"}</b> expire within 7 days</span><span className={s.go}>QUOTATIONS →</span>
            </Link>
          )}
          {p && !p.error && p.draftAging > 0 && (
            <Link href="/product-data" className={s.attnRow}>
              <span className={`${s.sig} ${s.sigWarn}`} /><span><b>{p.draftAging} product draft{p.draftAging === 1 ? "" : "s"}</b> untouched for 14+ days</span><span className={s.go}>PRODUCT DATA →</span>
            </Link>
          )}
          {td && !td.error && td.open > 0 && (
            <Link href="/todo" className={s.attnRow}>
              <span className={`${s.sig} ${s.sigWarn}`} /><span><b>{td.open} to-do{td.open === 1 ? "" : "s"}</b> waiting on you</span><span className={s.go}>TO-DO →</span>
            </Link>
          )}
          {(!q || q.error || q.expiringSoon === 0) && (!p || p.error || p.draftAging === 0) && (!td || td.error || td.open === 0) && (
            <div className={s.attnRow}>
              <span className={`${s.sig} ${s.sigOk}`} /><span><b>All clear</b> — nothing needs a human right now</span>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
