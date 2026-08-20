"use client";

/* ---------------------------------------------------------------------------
   Dashboard app — W1 engine + W2-lite editing DEMO (owner: "let us try demo
   without push"). DARK-LAUNCHED like the Home dashboard: renders only in
   development or when NEXT_PUBLIC_HOME_DASHBOARD=1; production 404s, so a
   sibling session pushing main cannot expose it.

   What this demo proves (the plan's W1+W2 core):
   • widget CATALOG: data / shortcut kinds, per-widget allowed sizes
   • a 6-unit canvas (2 on phone), grid-auto-flow dense — iOS-style packing
   • iOS editing grammar: jiggle, ➖ delete, size cycling, drag to rearrange,
     ➕ gallery, save-once-on-Done
   • data still arrives in the ONE /api/dashboard request (no per-widget
     fetches); shortcuts cost zero
   Demo shortcuts: layout persists in localStorage (kx_ prefix — wiped on
   sign-out); the real W1 stores it per-account server-side.
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import s from "./dashboard.module.css";

const DASH_ON =
  process.env.NEXT_PUBLIC_HOME_DASHBOARD === "1" || process.env.NODE_ENV === "development";

const LAYOUT_KEY = "kx_dash_layout_demo_v1";

/* ── payload from the ONE gateway request (same shape as Home) ── */
type Person = { name: string; initials: string; avatar: string | null; active: boolean };
type Payload = {
  widgets: {
    quotations: { openCount: number; expiringSoon: number; stages: Record<string, number>; series: number[]; openValue?: number } | null;
    products: { total: number; active: number; draft: number; draftAging: number } | null;
    todo: { open: number } | null;
    presence: { activeToday: number; teamSize: number; hoursToday: number; people?: Person[] } | null;
    system: { pendingMembership: number; notifyErrorsToday: number } | null;
  };
  showMoney: boolean;
};

/* ── the catalog: every widget an app offers, its kind and allowed sizes ── */
type Size = "S" | "M" | "L" | "XL";
const SIZE_CLASS: Record<Size, string> = { S: "s11", M: "s21", L: "s22", XL: "s42" };

type WidgetDef = {
  key: string;
  app: string;
  title: string;
  kind: "data" | "shortcut";
  sizes: Size[];
  href?: string;
};

const CATALOG: WidgetDef[] = [
  { key: "quotations.value", app: "Quotations", title: "Open pipeline", kind: "data", sizes: ["S", "M", "XL"], href: "/quotations" },
  { key: "quotations.stages", app: "Quotations", title: "Pipeline by stage", kind: "data", sizes: ["XL"], href: "/quotations" },
  { key: "products.catalogue", app: "Products", title: "Catalogue health", kind: "data", sizes: ["M", "L"], href: "/product-data" },
  { key: "todo.open", app: "To-do", title: "My to-dos", kind: "data", sizes: ["S", "M"], href: "/todo" },
  { key: "presence.team", app: "Team", title: "Team today", kind: "data", sizes: ["M", "L"] },
  { key: "shortcut.newQuotation", app: "Quotations", title: "New quotation", kind: "shortcut", sizes: ["S"], href: "/quotations" },
  { key: "shortcut.addProduct", app: "Product Data", title: "Add product", kind: "shortcut", sizes: ["S"], href: "/product-data/new" },
  { key: "shortcut.discuss", app: "Discuss", title: "Open Discuss", kind: "shortcut", sizes: ["S"], href: "/discuss" },
];
const defOf = (key: string) => CATALOG.find((d) => d.key === key);

type LayoutItem = { id: string; key: string; size: Size };
const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "a", key: "quotations.value", size: "XL" },
  { id: "b", key: "products.catalogue", size: "L" },
  { id: "c", key: "shortcut.newQuotation", size: "S" },
  { id: "d", key: "shortcut.addProduct", size: "S" },
  { id: "e", key: "todo.open", size: "M" },
  { id: "f", key: "presence.team", size: "M" },
  { id: "g", key: "quotations.stages", size: "XL" },
  { id: "h", key: "shortcut.discuss", size: "S" },
];

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

const STAGE_ORDER = ["draft", "sent", "negotiation", "won", "lost"] as const;

export default function DashboardApp() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    try {
      const raw = window.localStorage.getItem(LAYOUT_KEY);
      if (raw) return JSON.parse(raw) as LayoutItem[];
    } catch { /* fall through */ }
    return DEFAULT_LAYOUT;
  });
  const [editing, setEditing] = useState(false);

  /* ═══ THE iOS DRAG ENGINE v2 (owner: "too many glitches") ═══
     The three classic drag glitches, each killed structurally:
     1. THE JUMPING LIFT — v1 moved the card by a delta from its ORIGINAL
        spot, but live reorders move its layout slot, so the same delta
        teleported it. v2 positions the lift ABSOLUTELY every frame:
        transform = pointer − grabOffset − currentLayoutPos, where layout
        pos comes from offsetLeft/offsetTop (layout truth, immune to
        transforms). Reorders can move its slot freely; the card stays
        glued to the finger.
     2. THE SWAP FLUTTER — v1 hit-tested elementsFromPoint against cards
        MID-FLIP (transforms move hit-testing too), so decisions were made
        against moving targets and the order flip-flopped. v2 hit-tests
        against LAYOUT rects (offsets + container origin) — animation
        never fools it — plus a 140ms reorder cooldown.
     3. FRAME FLOOD — pointermove can outrun the display; v2 gates all
        work behind requestAnimationFrame.                                  */
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<{
    id: string; el: HTMLElement;
    grabX: number; grabY: number;         /* pointer offset inside the card */
    lastX: number; lastY: number;         /* latest pointer position */
    lastProcessAt: number; lastReorderAt: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const rectsRef = useRef<Map<string, DOMRect>>(new Map());
  const layoutRef = useRef(layout);
  useLayoutEffect(() => { layoutRef.current = layout; }, [layout]);

  /* layout-truth rect: where the element LIVES, regardless of transforms */
  const layoutRect = (el: HTMLElement) => {
    const c = canvasRef.current;
    if (!c) return el.getBoundingClientRect();
    const base = c.getBoundingClientRect();
    return new DOMRect(base.left + el.offsetLeft, base.top + el.offsetTop, el.offsetWidth, el.offsetHeight);
  };

  const snapshotRects = () => {
    const m = new Map<string, DOMRect>();
    canvasRef.current?.querySelectorAll<HTMLElement>("[data-wid]").forEach((el) => {
      m.set(el.dataset.wid as string, el.getBoundingClientRect());
    });
    rectsRef.current = m;
  };

  /* glue the lift to the finger, in absolute terms */
  const positionLift = () => {
    const d = drag.current;
    if (!d) return;
    const r = layoutRect(d.el);
    const dx = d.lastX - d.grabX - r.left;
    const dy = d.lastY - d.grabY - r.top;
    d.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.04)`;
  };

  /* FLIP: after any layout mutation, glide every non-lifted card from its
     previous visual rect to its new one; re-glue the lift immediately. */
  useLayoutEffect(() => {
    positionLift();
    const prev = rectsRef.current;
    if (!prev.size) return;
    canvasRef.current?.querySelectorAll<HTMLElement>("[data-wid]").forEach((el) => {
      const id = el.dataset.wid as string;
      if (id === drag.current?.id) return;
      const was = prev.get(id);
      if (!was) return;
      const now = el.getBoundingClientRect();
      const dx = was.left - now.left, dy = was.top - now.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      el.getAnimations().forEach((a) => a.cancel()); /* restartable mid-glide */
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 380, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    });
    rectsRef.current = new Map();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>, id: string) => {
    if (!editing) return;
    if ((e.target as HTMLElement).closest("button")) return; /* minus / size dot */
    const el = e.currentTarget;
    const r = layoutRect(el);
    drag.current = {
      id, el,
      grabX: e.clientX - r.left, grabY: e.clientY - r.top,
      lastX: e.clientX, lastY: e.clientY,
      lastProcessAt: 0, lastReorderAt: 0,
    };
    setDragId(id);
    /* capture is best-effort: synthetic/pen pointers can refuse it, and the
       shared drag.current + per-card move handlers work either way */
    try { el.setPointerCapture(e.pointerId); } catch { /* fine */ }
    el.style.zIndex = "40";
    el.style.boxShadow = "0 18px 44px rgba(0,0,0,.55), 0 0 0 1.5px rgba(127,169,214,.4)";
    positionLift();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    d.lastX = e.clientX; d.lastY = e.clientY;
    /* frame-rate throttle WITHOUT rAF — rAF freezes in hidden tabs, and
       the engine must behave identically wherever it runs */
    const now = performance.now();
    if (now - d.lastProcessAt < 16) return;
    d.lastProcessAt = now;
    {
      const dd = drag.current;
      if (!dd) return;
      positionLift();
      /* reorder against LAYOUT rects, with a flutter cooldown */
      if (performance.now() - dd.lastReorderAt < 140) return;
      const cards = [...(canvasRef.current?.querySelectorAll<HTMLElement>("[data-wid]") ?? [])];
      const over = cards.find((el) => {
        if (el.dataset.wid === dd.id) return false;
        const r = layoutRect(el);
        return dd.lastX >= r.left && dd.lastX <= r.right && dd.lastY >= r.top && dd.lastY <= r.bottom;
      });
      if (!over) return;
      const overId = over.dataset.wid as string;
      const l = layoutRef.current;
      const from = l.findIndex((x) => x.id === dd.id);
      const to = l.findIndex((x) => x.id === overId);
      if (from < 0 || to < 0 || from === to) return;
      dd.lastReorderAt = performance.now();
      snapshotRects();
      setLayout(() => {
        const next = [...l];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
  };

  const onPointerUp = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    const el = d.el;
    const current = el.style.transform;
    el.style.transform = "";
    el.style.boxShadow = "";
    if (current && current !== "none") {
      el.animate(
        [{ transform: current }, { transform: "translate(0, 0) scale(1)" }],
        { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    }
    window.setTimeout(() => { el.style.zIndex = ""; }, 430);
    setDragId(null);
  };

  useEffect(() => {
    if (!DASH_ON) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/dashboard?period=month", { credentials: "include", cache: "no-store" });
        if (r.ok && !cancelled) setData((await r.json()) as Payload);
      } catch { /* the canvas renders shortcuts regardless */ }
    };
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!DASH_ON) notFound();

  /* ── edit actions — all client-side; ONE save on Done ── */
  const done = () => {
    setEditing(false);
    try { window.localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* best-effort */ }
  };
  const remove = (id: string) => { snapshotRects(); setLayout((l) => l.filter((it) => it.id !== id)); };
  const cycleSize = (id: string) => {
    snapshotRects();
    setLayout((l) => l.map((it) => {
      if (it.id !== id) return it;
      const sizes = defOf(it.key)?.sizes ?? ["S"];
      const next = sizes[(sizes.indexOf(it.size) + 1) % sizes.length];
      return { ...it, size: next };
    }));
  };
  const addWidget = (key: string) => {
    const def = defOf(key);
    if (!def) return;
    snapshotRects();
    setLayout((l) => [...l, { id: `${key}-${l.length}-${l.map((x) => x.id).join("").length}`, key, size: def.sizes[0] }]);
  };
  const available = CATALOG.filter((d) => !layout.some((it) => it.key === d.key));

  /* ── one widget instance → its face ── */
  const renderFace = (it: LayoutItem) => {
    const def = defOf(it.key);
    if (!def) return <div className={s.empty}>unknown widget</div>;
    const w = data?.widgets;
    switch (def.key) {
      case "quotations.value": {
        const q = w?.quotations;
        return (
          <>
            <div className={s.lbl}><span>Open pipeline</span><span>LIVE</span></div>
            <div className={`${s.val} ${it.size !== "S" ? s.valBig : ""}`}>
              {q ? (typeof q.openValue === "number" ? money(q.openValue) : q.openCount) : "…"}
              {q && it.size !== "S" ? <span className={s.unit}> · {q.openCount} open</span> : null}
            </div>
            {q && it.size !== "S" && (
              <div className={s.sm}>{q.expiringSoon > 0 ? <span className={s.warnTone}>{q.expiringSoon} expiring soon</span> : <span className={s.goodTone}>nothing expiring this week</span>}</div>
            )}
            {q && it.size === "XL" && (
              <div className={s.sparks}>
                {q.series.map((v, i) => {
                  const max = Math.max(...q.series, 1);
                  return <i key={i} className={v === max && v > 0 ? s.hot : undefined} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />;
                })}
              </div>
            )}
          </>
        );
      }
      case "quotations.stages": {
        const q = w?.quotations;
        const max = Math.max(1, ...STAGE_ORDER.map((k) => q?.stages?.[k] ?? 0));
        return (
          <>
            <div className={s.lbl}><span>Pipeline by stage</span></div>
            <div className={s.bars}>
              {STAGE_ORDER.filter((k) => (q?.stages?.[k] ?? 0) > 0 || ["draft", "sent", "won"].includes(k)).map((k) => {
                const v = q?.stages?.[k] ?? 0;
                return (
                  <div key={k} className={s.bar} style={{ height: `${Math.max(8, (v / max) * 100)}%` }}>
                    <b>{v}</b><em>{k.toUpperCase().slice(0, 6)}</em>
                  </div>
                );
              })}
            </div>
          </>
        );
      }
      case "products.catalogue": {
        const p = w?.products;
        const pct = p && p.total ? Math.round((p.active / p.total) * 100) : 0;
        return (
          <>
            <div className={s.lbl}><span>Catalogue</span></div>
            <div className={s.ringRow}>
              <div className={s.ringWrap}>
                <div className={s.ring} style={{ ["--pct" as string]: `${pct}%` }} />
                <div className={s.ringTxt}>{pct}%</div>
              </div>
              <div>
                <div className={s.val} style={{ marginBlockStart: 0 }}>{p?.active ?? "…"} <span className={s.unit}>/ {p?.total ?? "…"}</span></div>
                {it.size === "L" && p && <div className={s.sm}>{p.draft} in draft · <span className={s.warnTone}>{p.draftAging} aging</span></div>}
              </div>
            </div>
          </>
        );
      }
      case "todo.open": {
        const t = w?.todo;
        return (
          <>
            <div className={s.lbl}><span>My to-dos</span></div>
            <div className={s.val}>{t ? t.open : "…"} <span className={s.unit}>open</span></div>
            {it.size === "M" && <div className={s.sm}>tap to open the list</div>}
          </>
        );
      }
      case "presence.team": {
        const pr = w?.presence;
        return (
          <>
            <div className={s.lbl}><span>Team today</span></div>
            <div className={s.val}>{pr ? pr.activeToday : "…"} <span className={s.unit}>/ {pr?.teamSize ?? "…"} · {pr?.hoursToday ?? "…"}h</span></div>
            {it.size === "L" && pr?.people && (
              <div className={s.people}>
                {pr.people.slice(0, 8).map((person) => (
                  <span key={person.name} className={`${s.pv} ${person.active ? s.pvOn : ""}`} title={person.name}>
                    {person.avatar
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={person.avatar} alt={person.name} className={s.pvImg} />
                      : person.initials}
                  </span>
                ))}
              </div>
            )}
          </>
        );
      }
      default:
        /* shortcuts */
        return (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {def.key === "shortcut.newQuotation" && (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6" /><path d="M9 15h6" /></>)}
              {def.key === "shortcut.addProduct" && (<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)}
              {def.key === "shortcut.discuss" && (<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />)}
            </svg>
            <span className={s.nm}>{def.title}</span>
          </>
        );
    }
  };

  return (
    <div className={s.page}>
      <div className={s.head}>
        <div>
          <div className={s.title}>Dashboard</div>
          <div className={s.subtitle}>WIDGET CANVAS · DEMO · DARK-LAUNCHED</div>
        </div>
        <div className={s.headBtns}>
          {editing && available.length > 0 && <span className={s.pill} style={{ pointerEvents: "none", opacity: 0.7 }}>gallery below ↓</span>}
          <button type="button" className={`${s.pill} ${editing ? s.pillOn : ""}`} onClick={() => (editing ? done() : setEditing(true))}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      <div ref={canvasRef} className={`${s.canvas} ${editing ? s.editing : ""}`}>
        {layout.map((it) => {
          const def = defOf(it.key);
          const cls = `kx-glass ${s.w} ${s[SIZE_CLASS[it.size] as keyof typeof s]} ${def?.kind === "shortcut" ? s.shortcut : ""} ${dragId === it.id ? s.dragLift : ""}`;
          return (
            <div
              key={it.id}
              data-wid={it.id}
              className={cls}
              onPointerDown={(e) => onPointerDown(e, it.id)}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onClick={() => { if (!editing && def?.href) router.push(def.href); }}
              role={def?.href && !editing ? "link" : undefined}
              style={{ cursor: !editing && def?.href ? "pointer" : undefined }}
              data-kx-keep-hover=""
            >
              {editing && (
                <>
                  <button type="button" className={s.minus} aria-label={`Remove ${def?.title}`} onClick={(e) => { e.stopPropagation(); remove(it.id); }}>−</button>
                  {(defOf(it.key)?.sizes.length ?? 0) > 1 && (
                    <button type="button" className={s.sizeDot} aria-label="Change size" onClick={(e) => { e.stopPropagation(); cycleSize(it.id); }}>
                      {it.size}
                    </button>
                  )}
                </>
              )}
              {renderFace(it)}
            </div>
          );
        })}
      </div>

      {editing && (
        <div className={s.sheet}>
          <h4>＋ Widget Gallery <span style={{ color: "#667", fontWeight: 400 }}>· tap Add — it lands in the canvas</span></h4>
          {available.length === 0 ? (
            <div className={s.empty}>Every available widget is already on the canvas.</div>
          ) : (
            <div className={s.gRow}>
              {available.map((d) => (
                <div key={d.key} className={s.gCard}>
                  <div className={s.t}>{d.title}</div>
                  <div className={s.k}>{d.app} · {d.kind} · {d.sizes.join(" / ")}</div>
                  <button type="button" className={s.gAdd} onClick={() => addWidget(d.key)}>Add</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
