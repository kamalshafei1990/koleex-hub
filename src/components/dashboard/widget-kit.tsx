"use client";

/* ---------------------------------------------------------------------------
   Widget kit — the ONE definition of the Hub's dashboard cards, shared by:
   • the Dashboard app  — the full summary of everything the account can see,
   • the Home page      — the personal pinned board, organized iOS-style.

   The owner's architecture (2026-08-20): "dashboard is an app which can show
   the full summary of everything in the system through cards … each app can
   have cards with different styles and different information … I can add any
   card of this app to the home page and edit/organize it from the home page."

   One catalog, one set of faces, one drag engine, one pin store. Both pages
   read the SAME /api/dashboard payload (one request; permission-filtered
   server-side — `modules` is the account's viewable module list).
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import s from "./widget-kit.module.css";

/* ═══ types ═══ */

export type Person = { name: string; initials: string; avatar: string | null; active: boolean };
export type Payload = {
  widgets: {
    quotations: {
      openCount: number; expiringSoon: number; stages: Record<string, number>;
      series: number[]; createdInPeriod: number; period: string;
      openValue?: number; wonValueMtd?: number; wonValueInPeriod?: number;
      expiring: Array<{ no: string; name: string; days: number }>;
      error?: string;
    } | null;
    products: {
      total: number; active: number; draft: number; draftAging: number;
      drafts: Array<{ name: string; days: number }>; error?: string;
    } | null;
    todo: { open: number; items: Array<{ title: string }>; error?: string } | null;
    customers: { total: number; newThisMonth: number; latest: Array<{ name: string; days: number }>; error?: string } | null;
    presence: { activeToday: number; teamSize: number; hoursToday: number; people?: Person[]; error?: string } | null;
    system: { pendingMembership: number; notifyErrorsToday: number; error?: string } | null;
  };
  modules: string[];
  isSuperAdmin: boolean;
  showMoney: boolean;
  period: string;
  gatewayMs: number;
  ts: number;
};

export type Size = "S" | "M" | "L" | "XL" | "F";
export const SIZE_CLASS: Record<Size, string> = { S: "s11", M: "s21", L: "s22", XL: "s42", F: "s62" };

export type WidgetDef = {
  key: string;
  /** permission gate: the app-registry display name (= koleex_permissions
   *  module_name). "__sa" = super admin only. "__any" = any visible widget. */
  module: string;
  app: string;
  title: string;
  kind: "number" | "list" | "shortcut" | "special";
  sizes: Size[];
  href?: string;
};

/* ═══ THE catalog — simple faces (max 3 per app) + the Home specials ═══ */
export const CATALOG: WidgetDef[] = [
  /* Quotations */
  { key: "quotations.open",     module: "Quotations",   app: "Quotations",   title: "Open pipeline",    kind: "number",   sizes: ["S", "M"], href: "/quotations" },
  { key: "quotations.expiring", module: "Quotations",   app: "Quotations",   title: "Expiring soon",    kind: "list",     sizes: ["L"],      href: "/quotations" },
  { key: "quotations.stages",   module: "Quotations",   app: "Quotations",   title: "Pipeline by stage", kind: "special", sizes: ["XL"],     href: "/quotations" },
  { key: "quotations.new",      module: "Quotations",   app: "Quotations",   title: "New quotation",    kind: "shortcut", sizes: ["S"],      href: "/quotations" },
  /* Products */
  { key: "products.catalogue",  module: "Products",     app: "Products",     title: "Catalogue",        kind: "number",   sizes: ["S", "M"], href: "/products" },
  { key: "products.drafts",     module: "Products",     app: "Products",     title: "Oldest drafts",    kind: "list",     sizes: ["L"],      href: "/product-data" },
  { key: "products.add",        module: "Product Data", app: "Product Data", title: "Add product",      kind: "shortcut", sizes: ["S"],      href: "/product-data/new" },
  /* Customers */
  { key: "customers.new",       module: "Customers",    app: "Customers",    title: "New customers",    kind: "number",   sizes: ["S", "M"], href: "/customers" },
  { key: "customers.latest",    module: "Customers",    app: "Customers",    title: "Newest customers", kind: "list",     sizes: ["L"],      href: "/customers" },
  /* To-do */
  { key: "todo.open",           module: "To-do",        app: "To-do",        title: "My to-dos",        kind: "number",   sizes: ["S", "M"], href: "/todo" },
  { key: "todo.list",           module: "To-do",        app: "To-do",        title: "Open tasks",       kind: "list",     sizes: ["L"],      href: "/todo" },
  { key: "todo.new",            module: "To-do",        app: "To-do",        title: "New task",         kind: "shortcut", sizes: ["S"],      href: "/todo" },
  /* Team */
  { key: "team.active",         module: "Management",   app: "Team",         title: "Team today",       kind: "number",   sizes: ["S", "M"] },
  /* Cross-app + system specials (the approved Home look, now pinnable) */
  { key: "attention.feed",      module: "__any",        app: "Cross-app",    title: "Attention needed", kind: "special",  sizes: ["XL"] },
  { key: "system.strip",        module: "__sa",         app: "System",       title: "System strip",     kind: "special",  sizes: ["F"] },
  { key: "system.membership",   module: "__sa",         app: "System",       title: "Membership",       kind: "number",   sizes: ["S"],      href: "/accounts" },
  { key: "system.errors",       module: "__sa",         app: "System",       title: "Notify errors",    kind: "number",   sizes: ["S"] },
  /* Apps whose data cards come in the next wave — shortcuts cost zero */
  { key: "calendar.open",       module: "Calendar",     app: "Calendar",     title: "Open Calendar",    kind: "shortcut", sizes: ["S"],      href: "/calendar" },
  { key: "discuss.open",        module: "Discuss",      app: "Discuss",      title: "Open Discuss",     kind: "shortcut", sizes: ["S"],      href: "/discuss" },
  { key: "notes.new",           module: "Notes",        app: "Notes",        title: "New note",         kind: "shortcut", sizes: ["S"],      href: "/notes" },
];

export const defOf = (key: string) => CATALOG.find((d) => d.key === key);

export function allowedDef(def: WidgetDef | undefined, data: Payload | null): boolean {
  if (!def || !data) return false;
  if (def.module === "__sa") return data.isSuperAdmin;
  if (def.module === "__any") return Object.values(data.widgets).some((w) => w !== null);
  return data.modules.includes(def.module);
}

export function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

/* ═══ the pin store — which cards live on Home (kx_ prefix: wiped on
   sign-out; the per-account server copy is the next wave) ═══ */

export type LayoutItem = { id: string; key: string; size: Size };
const PINS_KEY = "kx_home_pins_v1";

/** The Home board an account starts with — mirrors the approved Home look. */
export const DEFAULT_PINS: LayoutItem[] = [
  { id: "products.catalogue", key: "products.catalogue", size: "M" },
  { id: "todo.open",          key: "todo.open",          size: "S" },
  { id: "team.active",        key: "team.active",        size: "M" },
  { id: "quotations.stages",  key: "quotations.stages",  size: "XL" },
  { id: "attention.feed",     key: "attention.feed",     size: "XL" },
  { id: "system.strip",       key: "system.strip",       size: "F" },
];

export function loadPins(): LayoutItem[] {
  try {
    const raw = window.localStorage.getItem(PINS_KEY);
    if (raw) {
      /* a catalog key that no longer exists must not pin a silent hole */
      const saved = (JSON.parse(raw) as LayoutItem[]).filter((it) => defOf(it.key));
      if (saved.length > 0) return saved;
    }
  } catch { /* fall through */ }
  return DEFAULT_PINS;
}

export function savePins(pins: LayoutItem[]): void {
  try { window.localStorage.setItem(PINS_KEY, JSON.stringify(pins)); } catch { /* best-effort */ }
}

/* ═══ the ONE payload (no per-widget fetches, ever) ═══ */

export function useDashboardPayload(period: string): { data: Payload | null; failed: boolean } {
  const [data, setData] = useState<Payload | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/dashboard?period=${period}`, { credentials: "include", cache: "no-store" });
        if (!r.ok) { if (!cancelled) setFailed(true); return; }
        const j = (await r.json()) as Payload;
        if (!cancelled) { setData(j); setFailed(false); }
      } catch { if (!cancelled) setFailed(true); }
    };
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); };
  }, [period]);
  return { data, failed };
}

/* ═══ THE iOS DRAG ENGINE v2 (owner: "too many glitches") — extracted as a
   hook so Home organizes with the exact engine the demo proved.
   The three classic drag glitches, each killed structurally:
   1. THE JUMPING LIFT — position the lift ABSOLUTELY every frame:
      transform = pointer − grabOffset − currentLayoutPos, where layout pos
      comes from offsetLeft/offsetTop (layout truth, immune to transforms).
   2. THE SWAP FLUTTER — hit-test LAYOUT rects (offsets + container origin),
      never mid-FLIP visual rects; plus a 140ms reorder cooldown.
   3. FRAME FLOOD — timestamp throttle (rAF freezes in hidden tabs). ═══ */

export function useWidgetDrag(opts: {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  layout: LayoutItem[];
  setLayout: React.Dispatch<React.SetStateAction<LayoutItem[]>>;
  editing: boolean;
}) {
  const { canvasRef, layout, setLayout, editing } = opts;
  const [dragId, setDragId] = useState<string | null>(null);
  const drag = useRef<{
    id: string; el: HTMLElement;
    grabX: number; grabY: number;
    lastX: number; lastY: number;
    lastProcessAt: number; lastReorderAt: number;
  } | null>(null);
  const rectsRef = useRef<Map<string, DOMRect>>(new Map());
  const layoutRef = useRef(layout);
  useLayoutEffect(() => { layoutRef.current = layout; }, [layout]);

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

  const positionLift = () => {
    const d = drag.current;
    if (!d) return;
    const r = layoutRect(d.el);
    d.el.style.transform = `translate(${d.lastX - d.grabX - r.left}px, ${d.lastY - d.grabY - r.top}px) scale(1.04)`;
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
      el.getAnimations().forEach((a) => a.cancel());
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }],
        { duration: 380, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
      );
    });
    rectsRef.current = new Map();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const onPointerDown = (e: React.PointerEvent<HTMLElement>, id: string) => {
    if (!editing) return;
    if ((e.target as HTMLElement).closest("button")) return; /* minus / size dot */
    const el = e.currentTarget as HTMLElement;
    const r = layoutRect(el);
    drag.current = {
      id, el,
      grabX: e.clientX - r.left, grabY: e.clientY - r.top,
      lastX: e.clientX, lastY: e.clientY,
      lastProcessAt: 0, lastReorderAt: 0,
    };
    setDragId(id);
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic/pen refuse it */ }
    el.style.zIndex = "40";
    el.style.boxShadow = "0 18px 44px rgba(0,0,0,.55), 0 0 0 1.5px rgba(127,169,214,.4)";
    positionLift();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    d.lastX = e.clientX; d.lastY = e.clientY;
    const now = performance.now();
    if (now - d.lastProcessAt < 16) return;
    d.lastProcessAt = now;
    positionLift();
    if (performance.now() - d.lastReorderAt < 140) return;
    const cards = [...(canvasRef.current?.querySelectorAll<HTMLElement>("[data-wid]") ?? [])];
    const over = cards.find((el) => {
      if (el.dataset.wid === d.id) return false;
      const r = layoutRect(el);
      return d.lastX >= r.left && d.lastX <= r.right && d.lastY >= r.top && d.lastY <= r.bottom;
    });
    if (!over) return;
    const overId = over.dataset.wid as string;
    const l = layoutRef.current;
    const from = l.findIndex((x) => x.id === d.id);
    const to = l.findIndex((x) => x.id === overId);
    if (from < 0 || to < 0 || from === to) return;
    d.lastReorderAt = performance.now();
    snapshotRects();
    setLayout(() => {
      const next = [...l];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
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

  return { dragId, snapshotRects, onPointerDown, onPointerMove, onPointerUp };
}

/* ═══ faces ═══ */

const STAGE_ORDER = ["draft", "sent", "negotiation", "won", "lost"] as const;
const STAGE_LABEL: Record<string, string> = {
  draft: "DRAFT", sent: "SENT", negotiation: "NEGOT.", won: "WON", lost: "LOST",
};

type ListRow = { a: string; b: string; warn?: boolean };

function NumberFace({ label, value, unit, sub, spark, warn }: {
  label: string; value: string; unit?: string; sub?: React.ReactNode; spark?: number[]; warn?: boolean;
}) {
  return (
    <>
      <div className={s.lbl}><span>{label}</span></div>
      <div className={`${s.val} ${warn ? s.warnTone : ""}`}>{value}{unit ? <span className={s.unit}> {unit}</span> : null}</div>
      {sub ? <div className={s.sm}>{sub}</div> : null}
      {spark && (
        <div className={s.sparks}>
          {spark.map((v, i) => {
            const max = Math.max(...spark, 1);
            return <i key={i} className={v === max && v > 0 ? s.hot : undefined} style={{ height: `${Math.max(8, (v / max) * 100)}%` }} />;
          })}
        </div>
      )}
    </>
  );
}

function ListFace({ label, rows, emptyText }: { label: string; rows: ListRow[]; emptyText: string }) {
  return (
    <>
      <div className={s.lbl}><span>{label}</span></div>
      {rows.length === 0
        ? <div className={s.listEmpty}>{emptyText}</div>
        : (
          <div className={s.rows}>
            {rows.slice(0, 5).map((r, i) => (
              <div key={i}><span className={s.rowA}>{r.a}</span><b className={r.warn ? s.warnTone : undefined}>{r.b}</b></div>
            ))}
          </div>
        )}
    </>
  );
}

/** One widget's content, from the ONE payload. Every card of every app renders
 *  through here — Home and the Dashboard app can never disagree on a face. */
export function renderFace(key: string, size: Size, data: Payload | null): React.ReactNode {
  const def = defOf(key);
  if (!def) return <div className={s.empty}>unknown widget</div>;
  const w = data?.widgets;
  switch (key) {
    case "quotations.open": {
      const q = w?.quotations;
      if (!q || q.error) return <NumberFace label="Open pipeline" value="…" />;
      return (
        <NumberFace
          label="Open pipeline"
          value={typeof q.openValue === "number" ? money(q.openValue) : String(q.openCount)}
          unit={typeof q.openValue === "number" ? `· ${q.openCount} open` : "open"}
          sub={size !== "S" ? (q.expiringSoon > 0
            ? <span className={s.warnTone}>{q.expiringSoon} expiring within a week</span>
            : <span className={s.goodTone}>nothing expiring this week</span>) : undefined}
          spark={size !== "S" ? q.series : undefined}
        />
      );
    }
    case "quotations.expiring": {
      const q = w?.quotations;
      return (
        <ListFace
          label="Expiring soon"
          rows={(q?.expiring ?? []).map((r) => ({ a: `${r.name} · ${r.no}`, b: `${r.days}d`, warn: r.days <= 5 }))}
          emptyText="No open quotation is near its deadline."
        />
      );
    }
    case "quotations.stages": {
      const q = w?.quotations;
      const stages = q?.stages ?? {};
      const max = Math.max(1, ...STAGE_ORDER.map((k) => stages[k] ?? 0));
      return (
        <>
          <div className={s.lbl}><span>Quotation pipeline</span><span>BY STAGE</span></div>
          <div className={s.barsWrap}>
            {STAGE_ORDER.filter((k) => (stages[k] ?? 0) > 0 || ["draft", "sent", "won"].includes(k)).map((k) => {
              const v = stages[k] ?? 0;
              const hot = v === max && v > 0;
              return (
                <div key={k} className={`${s.bar} ${hot ? s.barHot : ""}`} style={{ height: `${Math.max(6, (v / max) * 100)}%` }}>
                  <b>{v}</b><em>{STAGE_LABEL[k] ?? k.toUpperCase()}</em>
                </div>
              );
            })}
          </div>
        </>
      );
    }
    case "products.catalogue": {
      const p = w?.products;
      const pct = p && !p.error && p.total ? Math.round((p.active / p.total) * 100) : 0;
      return (
        <NumberFace
          label="Catalogue"
          value={p && !p.error ? `${pct}%` : "…"}
          unit={p && !p.error ? `· ${p.active} / ${p.total} active` : undefined}
          sub={size !== "S" && p && !p.error ? <>{p.draft} in draft · <span className={s.warnTone}>{p.draftAging} aging</span></> : undefined}
        />
      );
    }
    case "products.drafts": {
      const p = w?.products;
      return (
        <ListFace
          label="Oldest drafts"
          rows={(p?.drafts ?? []).map((r) => ({ a: r.name, b: `${r.days}d`, warn: r.days > 14 }))}
          emptyText="No product is sitting in draft."
        />
      );
    }
    case "customers.new": {
      const c = w?.customers;
      return (
        <NumberFace
          label="New customers"
          value={c && !c.error ? String(c.newThisMonth) : "…"}
          unit="this month"
          sub={size !== "S" && c && !c.error ? `${c.total} total` : undefined}
        />
      );
    }
    case "customers.latest": {
      const c = w?.customers;
      return (
        <ListFace
          label="Newest customers"
          rows={(c?.latest ?? []).map((r) => ({ a: r.name, b: r.days === 0 ? "today" : `${r.days}d ago` }))}
          emptyText="No customers yet."
        />
      );
    }
    case "todo.open": {
      const t = w?.todo;
      return <NumberFace label="My to-dos" value={t && !t.error ? String(t.open) : "…"} unit="open" sub={size !== "S" ? "tap to open the list" : undefined} />;
    }
    case "todo.list": {
      const t = w?.todo;
      return (
        <ListFace
          label="Open tasks"
          rows={(t?.items ?? []).map((r) => ({ a: r.title, b: "" }))}
          emptyText="Everything is done. 🎉"
        />
      );
    }
    case "team.active": {
      const pr = w?.presence;
      return (
        <>
          <div className={s.lbl}><span>Team today</span></div>
          <div className={s.val}>{pr && !pr.error ? pr.activeToday : "…"} <span className={s.unit}>/ {pr?.teamSize ?? "…"} · {pr?.hoursToday ?? "…"}h</span></div>
          {size !== "S" && pr?.people && (
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
    case "attention.feed": {
      const q = w?.quotations, p = w?.products, td = w?.todo, sys = w?.system;
      const rows: React.ReactNode[] = [];
      if (q && !q.error && q.expiringSoon > 0) rows.push(
        <Link key="q" href="/quotations" className={s.attnRow}>
          <span className={`${s.sig} ${s.sigCrit}`} /><span><b>{q.expiringSoon} quotation{q.expiringSoon === 1 ? "" : "s"}</b> expire within 7 days</span><span className={s.go}>QUOTATIONS →</span>
        </Link>,
      );
      if (p && !p.error && p.draftAging > 0) rows.push(
        <Link key="p" href="/product-data" className={s.attnRow}>
          <span className={`${s.sig} ${s.sigWarn}`} /><span><b>{p.draftAging} product draft{p.draftAging === 1 ? "" : "s"}</b> untouched for 14+ days</span><span className={s.go}>PRODUCT DATA →</span>
        </Link>,
      );
      if (sys && !sys.error && sys.pendingMembership > 0) rows.push(
        <Link key="m" href="/membership" className={s.attnRow}>
          <span className={`${s.sig} ${s.sigWarn}`} /><span><b>{sys.pendingMembership} membership request{sys.pendingMembership === 1 ? "" : "s"}</b> waiting review</span><span className={s.go}>MEMBERSHIP →</span>
        </Link>,
      );
      if (td && !td.error && td.open > 0) rows.push(
        <Link key="t" href="/todo" className={s.attnRow}>
          <span className={`${s.sig} ${s.sigWarn}`} /><span><b>{td.open} to-do{td.open === 1 ? "" : "s"}</b> waiting on you</span><span className={s.go}>TO-DO →</span>
        </Link>,
      );
      return (
        <>
          <div className={s.lbl}><span>Attention needed</span><span>CROSS-APP</span></div>
          <div style={{ marginBlockStart: 6 }}>
            {rows.length > 0 ? rows : (
              <div className={s.attnRow}>
                <span className={`${s.sig} ${s.sigOk}`} /><span><b>All clear</b> — nothing needs a human right now</span>
              </div>
            )}
          </div>
        </>
      );
    }
    case "system.strip": {
      const sys = w?.system;
      return (
        <div className={s.sysRow}>
          <span className={s.sysItem}><span className={`${s.sig} ${s.sigOk}`} /> API {data?.gatewayMs ?? "…"}ms</span>
          <span className={s.sysSep} />
          <span className={s.sysItem}><span className={`${s.sig} ${(sys?.notifyErrorsToday ?? 0) > 0 ? s.sigWarn : s.sigOk}`} /> Notify errors today {sys?.notifyErrorsToday ?? "…"}</span>
          <span className={s.sysSep} />
          <span className={s.sysItem}><span className={`${s.sig} ${(sys?.pendingMembership ?? 0) > 0 ? s.sigWarn : s.sigOk}`} /> Membership pending {sys?.pendingMembership ?? "…"}</span>
          <span className={s.sysEnd}>KOLEEX HUB · SHAPING THE FUTURE</span>
        </div>
      );
    }
    case "system.membership": {
      const sys = w?.system;
      return <NumberFace label="Membership" value={sys && !sys.error ? String(sys.pendingMembership) : "…"} unit="pending" warn={(sys?.pendingMembership ?? 0) > 0} />;
    }
    case "system.errors": {
      const sys = w?.system;
      return <NumberFace label="Notify errors" value={sys && !sys.error ? String(sys.notifyErrorsToday) : "…"} unit="today" warn={(sys?.notifyErrorsToday ?? 0) > 0} />;
    }
    default:
      /* shortcuts */
      return (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            {key === "quotations.new" && (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6" /><path d="M9 15h6" /></>)}
            {key === "products.add" && (<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)}
            {key === "todo.new" && (<><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>)}
            {key === "discuss.open" && (<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />)}
            {key === "calendar.open" && (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>)}
            {key === "notes.new" && (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>)}
          </svg>
          <span className={s.nm}>{defOf(key)?.title}</span>
        </>
      );
  }
}

/** The kit's own class names, for pages composing cards manually. */
export const kit = s;
