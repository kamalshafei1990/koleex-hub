"use client";

/* ---------------------------------------------------------------------------
   Dashboard app — the simplified widget platform (owner-approved catalog:
   THREE faces only — number / list / shortcut — and at most 3 cards per app).

   DARK-LAUNCHED like the Home dashboard: renders only in development or when
   NEXT_PUBLIC_HOME_DASHBOARD=1; production 404s, so a sibling session pushing
   main cannot expose it. The registry entry flips with the SAME flag.

   PERMISSIONS ARE THE CATALOG (owner: "the cards and widget for each app it
   depends on the account roles and permissions"):
   • /api/dashboard returns `modules` — the list of module names this account
     can_view (SA bypass, overrides win, openAccess default, fail-closed).
   • A widget renders ONLY when its owning module is in that list. The gallery
     offers only what's allowed. A card whose permission is revoked later is
     HIDDEN, not deleted — grant it back and it reappears where it was.
   • Data widgets are additionally gated server-side: the gateway never even
     computes a provider the account can't view. Money stays SA-only.
   • The canvas holds until the first payload: rendering cards before the
     permission list arrives would flash-then-remove them (content shift).

   Data still arrives in the ONE /api/dashboard request; shortcuts cost zero.
   Layout persists in localStorage (kx_ prefix — wiped on sign-out); the
   per-account server-side copy is the next wave.
   --------------------------------------------------------------------------- */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { notFound, useRouter } from "next/navigation";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import s from "./dashboard.module.css";

const DASH_ON =
  process.env.NEXT_PUBLIC_HOME_DASHBOARD === "1" || process.env.NODE_ENV === "development";

const LAYOUT_KEY = "kx_dash_layout_v2";

/* ── payload from the ONE gateway request ── */
type Person = { name: string; initials: string; avatar: string | null; active: boolean };
type ListRow = { a: string; b: string; warn?: boolean };
type Payload = {
  widgets: {
    quotations: {
      openCount: number; expiringSoon: number; series: number[]; openValue?: number;
      expiring: Array<{ no: string; name: string; days: number }>;
    } | null;
    products: {
      total: number; active: number; draft: number; draftAging: number;
      drafts: Array<{ name: string; days: number }>;
    } | null;
    todo: { open: number; items: Array<{ title: string }> } | null;
    customers: { total: number; newThisMonth: number; latest: Array<{ name: string; days: number }> } | null;
    presence: { activeToday: number; teamSize: number; hoursToday: number; people?: Person[] } | null;
    system: { pendingMembership: number; notifyErrorsToday: number } | null;
  };
  modules: string[];
  isSuperAdmin: boolean;
  showMoney: boolean;
};

/* ── THE catalog: three faces, at most 3 cards per app ──
   `module` is the permission gate — the app-registry display name, exactly
   what koleex_permissions.module_name stores. "__sa" = super admin only. */
type Size = "S" | "M" | "L";
const SIZE_CLASS: Record<Size, string> = { S: "s11", M: "s21", L: "s22" };

type WidgetDef = {
  key: string;
  module: string;
  app: string;
  title: string;
  kind: "number" | "list" | "shortcut";
  sizes: Size[];
  href?: string;
};

const CATALOG: WidgetDef[] = [
  /* Quotations */
  { key: "quotations.open",      module: "Quotations",   app: "Quotations", title: "Open pipeline",   kind: "number",   sizes: ["S", "M"], href: "/quotations" },
  { key: "quotations.expiring",  module: "Quotations",   app: "Quotations", title: "Expiring soon",   kind: "list",     sizes: ["L"],      href: "/quotations" },
  { key: "quotations.new",       module: "Quotations",   app: "Quotations", title: "New quotation",   kind: "shortcut", sizes: ["S"],      href: "/quotations" },
  /* Products */
  { key: "products.catalogue",   module: "Products",     app: "Products",   title: "Catalogue",       kind: "number",   sizes: ["S", "M"], href: "/products" },
  { key: "products.drafts",      module: "Products",     app: "Products",   title: "Oldest drafts",   kind: "list",     sizes: ["L"],      href: "/product-data" },
  { key: "products.add",         module: "Product Data", app: "Product Data", title: "Add product",   kind: "shortcut", sizes: ["S"],      href: "/product-data/new" },
  /* Customers */
  { key: "customers.new",        module: "Customers",    app: "Customers",  title: "New customers",   kind: "number",   sizes: ["S", "M"], href: "/customers" },
  { key: "customers.latest",     module: "Customers",    app: "Customers",  title: "Newest customers", kind: "list",    sizes: ["L"],      href: "/customers" },
  /* To-do */
  { key: "todo.open",            module: "To-do",        app: "To-do",      title: "My to-dos",       kind: "number",   sizes: ["S", "M"], href: "/todo" },
  { key: "todo.list",            module: "To-do",        app: "To-do",      title: "Open tasks",      kind: "list",     sizes: ["L"],      href: "/todo" },
  { key: "todo.new",             module: "To-do",        app: "To-do",      title: "New task",        kind: "shortcut", sizes: ["S"],      href: "/todo" },
  /* Team */
  { key: "team.active",          module: "Management",   app: "Team",       title: "Team today",      kind: "number",   sizes: ["S", "M"] },
  /* Apps whose data cards come in the next wave — shortcuts cost zero */
  { key: "calendar.open",        module: "Calendar",     app: "Calendar",   title: "Open Calendar",   kind: "shortcut", sizes: ["S"],      href: "/calendar" },
  { key: "discuss.open",         module: "Discuss",      app: "Discuss",    title: "Open Discuss",    kind: "shortcut", sizes: ["S"],      href: "/discuss" },
  { key: "notes.new",            module: "Notes",        app: "Notes",      title: "New note",        kind: "shortcut", sizes: ["S"],      href: "/notes" },
  /* System — super admin only */
  { key: "system.membership",    module: "__sa",         app: "System",     title: "Membership",      kind: "number",   sizes: ["S"],      href: "/accounts" },
  { key: "system.errors",        module: "__sa",         app: "System",     title: "Notify errors",   kind: "number",   sizes: ["S"] },
];
const defOf = (key: string) => CATALOG.find((d) => d.key === key);

type LayoutItem = { id: string; key: string; size: Size };
const DEFAULT_LAYOUT: LayoutItem[] = [
  { id: "a", key: "quotations.open",     size: "M" },
  { id: "b", key: "quotations.expiring", size: "L" },
  { id: "c", key: "quotations.new",      size: "S" },
  { id: "d", key: "todo.new",            size: "S" },
  { id: "e", key: "products.catalogue",  size: "M" },
  { id: "f", key: "todo.open",           size: "S" },
  { id: "g", key: "team.active",         size: "S" },
  { id: "h", key: "customers.latest",    size: "L" },
  { id: "i", key: "products.drafts",     size: "L" },
];

function money(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export default function DashboardApp() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    try {
      window.localStorage.removeItem("kx_dash_layout_demo_v1"); /* the demo's key, dead */
      const raw = window.localStorage.getItem(LAYOUT_KEY);
      if (raw) {
        /* a catalog key that no longer exists must not silently pin a hole in
           the saved layout — prune it; an emptied layout falls back to default */
        const saved = (JSON.parse(raw) as LayoutItem[]).filter((it) => defOf(it.key));
        if (saved.length > 0) return saved;
      }
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
     3. FRAME FLOOD — pointermove can outrun the display; v2 throttles by
        timestamp (rAF freezes in hidden tabs).                              */
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
    positionLift();
    /* reorder against LAYOUT rects, with a flutter cooldown */
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

  useEffect(() => {
    if (!DASH_ON) return;
    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch("/api/dashboard?period=month", { credentials: "include", cache: "no-store" });
        if (r.ok && !cancelled) setData((await r.json()) as Payload);
      } catch { /* keep the last payload; the spinner covers first load */ }
    };
    load();
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (!DASH_ON) notFound();

  /* ── permissions decide the catalog ── */
  const allowedDef = (def: WidgetDef | undefined): boolean => {
    if (!def || !data) return false;
    if (def.module === "__sa") return data.isSuperAdmin;
    return data.modules.includes(def.module);
  };

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
      const sizes = defOf(it.key)?.sizes ?? ["S" as Size];
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

  /* hidden ≠ deleted: a revoked module's cards stay in the saved layout and
     reappear the moment the permission comes back */
  const visible = layout.filter((it) => allowedDef(defOf(it.key)));
  const available = CATALOG.filter((d) => allowedDef(d) && !layout.some((it) => it.key === d.key));

  /* ── the three faces ── */
  const NumberFace = ({ label, value, unit, sub, spark, warn }: {
    label: string; value: string; unit?: string; sub?: React.ReactNode; spark?: number[]; warn?: boolean;
  }) => (
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

  const ListFace = ({ label, rows, emptyText }: { label: string; rows: ListRow[]; emptyText: string }) => (
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

  /* one widget instance → its face, from the ONE payload */
  const renderFace = (it: LayoutItem) => {
    const def = defOf(it.key);
    if (!def) return <div className={s.empty}>unknown widget</div>;
    const w = data?.widgets;
    switch (def.key) {
      case "quotations.open": {
        const q = w?.quotations;
        if (!q) return <NumberFace label="Open pipeline" value="…" />;
        return (
          <NumberFace
            label="Open pipeline"
            value={typeof q.openValue === "number" ? money(q.openValue) : String(q.openCount)}
            unit={typeof q.openValue === "number" ? `· ${q.openCount} open` : "open"}
            sub={it.size === "M" ? (q.expiringSoon > 0
              ? <span className={s.warnTone}>{q.expiringSoon} expiring within a week</span>
              : <span className={s.goodTone}>nothing expiring this week</span>) : undefined}
            spark={it.size === "M" ? q.series : undefined}
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
      case "products.catalogue": {
        const p = w?.products;
        const pct = p && p.total ? Math.round((p.active / p.total) * 100) : 0;
        return (
          <NumberFace
            label="Catalogue"
            value={p ? `${pct}%` : "…"}
            unit={p ? `· ${p.active} / ${p.total} active` : undefined}
            sub={it.size === "M" && p ? <>{p.draft} in draft · <span className={s.warnTone}>{p.draftAging} aging</span></> : undefined}
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
            value={c ? String(c.newThisMonth) : "…"}
            unit="this month"
            sub={it.size === "M" && c ? `${c.total} total` : undefined}
          />
        );
      }
      case "customers.latest": {
        const c = w?.customers;
        return (
          <ListFace
            label="Newest customers"
            rows={(c?.latest ?? []).map((r) => ({
              a: r.name,
              b: r.days === 0 ? "today" : `${r.days}d ago`,
            }))}
            emptyText="No customers yet."
          />
        );
      }
      case "todo.open": {
        const t = w?.todo;
        return <NumberFace label="My to-dos" value={t ? String(t.open) : "…"} unit="open" sub={it.size === "M" ? "tap to open the list" : undefined} />;
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
            <div className={s.val}>{pr ? pr.activeToday : "…"} <span className={s.unit}>/ {pr?.teamSize ?? "…"} · {pr?.hoursToday ?? "…"}h</span></div>
            {it.size === "M" && pr?.people && (
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
      case "system.membership": {
        const sys = w?.system;
        return <NumberFace label="Membership" value={sys ? String(sys.pendingMembership) : "…"} unit="pending" warn={(sys?.pendingMembership ?? 0) > 0} />;
      }
      case "system.errors": {
        const sys = w?.system;
        return <NumberFace label="Notify errors" value={sys ? String(sys.notifyErrorsToday) : "…"} unit="today" warn={(sys?.notifyErrorsToday ?? 0) > 0} />;
      }
      default:
        /* shortcuts */
        return (
          <>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {def.key === "quotations.new" && (<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 12v6" /><path d="M9 15h6" /></>)}
              {def.key === "products.add" && (<><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>)}
              {def.key === "todo.new" && (<><path d="M9 11l3 3 8-8" /><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" /></>)}
              {def.key === "discuss.open" && (<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />)}
              {def.key === "calendar.open" && (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>)}
              {def.key === "notes.new" && (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>)}
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
          <div className={s.subtitle}>YOUR WIDGETS · SHAPED BY YOUR PERMISSIONS</div>
        </div>
        <div className={s.headBtns}>
          {editing && available.length > 0 && <span className={s.pill} style={{ pointerEvents: "none", opacity: 0.7 }}>gallery below ↓</span>}
          <button type="button" className={`${s.pill} ${editing ? s.pillOn : ""}`} onClick={() => (editing ? done() : setEditing(true))}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      </div>

      {!data ? (
        /* hold the canvas until the permission list arrives — rendering cards
           first and removing them after would shift painted content */
        <div className={s.loading}><SpinnerIcon size={28} /></div>
      ) : (
        <>
          <div ref={canvasRef} className={`${s.canvas} ${editing ? s.editing : ""}`}>
            {visible.map((it) => {
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
            {visible.length === 0 && (
              <div className={s.empty} style={{ gridColumn: "1 / -1", padding: "40px 0", textAlign: "center" }}>
                No widgets yet — tap Edit to add from your gallery.
              </div>
            )}
          </div>

          {editing && (
            <div className={s.sheet}>
              <h4>＋ Widget Gallery <span style={{ color: "#667", fontWeight: 400 }}>· only what your role can see</span></h4>
              {available.length === 0 ? (
                <div className={s.empty}>Every widget your role can see is already on the canvas.</div>
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
        </>
      )}
    </div>
  );
}
