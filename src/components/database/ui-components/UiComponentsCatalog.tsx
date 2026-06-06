"use client";

/* ---------------------------------------------------------------------------
   UiComponentsCatalog — the Visual Library "UI Components" section.

   A single, organized catalog of every UI component in the Koleex Hub:
     • Live primitives — the canonical design-system building blocks rendered
       for real (buttons, KPI cards, badges, pills, inputs, states).
     • Full inventory — every component in the codebase, grouped by module and
       searchable, generated from the source tree (manifest.ts) so nothing is
       left out.

   KOLEEX design system: monochrome surfaces, a single blue accent reserved for
   interaction, generous whitespace, calm structure. No decorative colour.
   --------------------------------------------------------------------------- */

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import KpiCard from "@/components/ui/KpiCard";
import { UI_COMPONENT_MODULES, UI_COMPONENT_TOTALS } from "./manifest";

/* Pretty labels for the raw folder keys. Unknown keys fall back to Title Case. */
const LABELS: Record<string, string> = {
  ui: "Core UI Primitives", icons: "Icons", layout: "Layout & Shell",
  home: "Home & Launchers", create: "Create / Data Entry", settings: "Settings",
  admin: "Admin", ai: "AI Assistant", qa: "QA · Issue Reports", database: "Database",
  attachments: "Attachments", approval: "Approvals", workflows: "Workflows",
  reports: "Reports", executive: "Executive",
  finance: "Finance", expenses: "Expenses", inventory: "Inventory", sales: "Sales",
  purchase: "Purchase", invoices: "Invoices", "invoices-doc": "Invoice Documents",
  quotations: "Quotations", hr: "HR", employees: "Employees", crm: "CRM",
  contacts: "Contacts", suppliers: "Suppliers", projects: "Projects",
  operations: "Operations", planning: "Planning", "landed-cost": "Landed Cost",
  "price-calculator": "Price Calculator", payment: "Payments",
  "commercial-policy": "Commercial Policy", markets: "Markets",
  knowledge: "Knowledge Base", "product-templates": "Product Templates",
  "product-preview": "Product Preview", notes: "Notes", discuss: "Discuss",
  website: "Website",
};

/* Super-categories — an ordered grouping so the catalog reads top-down. */
const CATEGORIES: { title: string; keys: string[] }[] = [
  { title: "Foundations & Primitives", keys: ["ui", "icons", "layout"] },
  { title: "Workspace & System", keys: ["home", "create", "settings", "admin", "ai", "qa", "database", "attachments", "approval", "workflows", "reports", "executive"] },
  { title: "Business Modules", keys: ["finance", "expenses", "inventory", "sales", "purchase", "invoices", "invoices-doc", "quotations", "hr", "employees", "crm", "contacts", "suppliers", "projects", "operations", "planning", "landed-cost", "price-calculator", "payment", "commercial-policy", "markets"] },
  { title: "Content & Knowledge", keys: ["knowledge", "product-templates", "product-preview", "notes", "discuss", "website"] },
];

function labelFor(key: string): string {
  return LABELS[key] ?? key.replace(/(^|[-_])([a-z])/g, (_, __, c) => " " + c.toUpperCase()).trim();
}

const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4";
const head = "text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]";
const chip = "rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 font-mono text-[11px] text-[var(--text-secondary)]";

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-4 py-2.5 text-center">
      <div className="text-[20px] font-bold tabular-nums text-[var(--text-primary)]">{value.toLocaleString()}</div>
      <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
    </div>
  );
}

/* ── Live primitive showcases ─────────────────────────────────────────────── */
function PrimitiveBlock({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-3.5">
      <div className="mb-2.5 flex items-center gap-2">
        <span className="font-mono text-[11.5px] font-semibold text-[var(--text-primary)]">{name}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const SEVERITY_TONE: Record<string, string> = {
  Low: "bg-[var(--bg-surface)] text-[var(--text-dim)]",
  Medium: "bg-blue-500/12 text-blue-600 dark:text-blue-300",
  High: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  Critical: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
};
const PILL = "rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide";

function LivePrimitives() {
  const input = "h-9 w-44 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]";
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <PrimitiveBlock name="Button — variants">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </PrimitiveBlock>
      <PrimitiveBlock name="Button — sizes & states">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <Button loading>Loading</Button>
        <Button disabled>Disabled</Button>
      </PrimitiveBlock>
      <PrimitiveBlock name="KpiCard">
        <div className="grid w-full grid-cols-2 gap-2">
          <KpiCard label="Stock Items" value="142" icon="box-open" />
          <KpiCard label="Overdue" value="$5,200" icon="info" tone="rose" hint="3 invoices" />
        </div>
      </PrimitiveBlock>
      <PrimitiveBlock name="Severity / status pills">
        {Object.entries(SEVERITY_TONE).map(([k, c]) => (
          <span key={k} className={`${PILL} ${c}`}>{k}</span>
        ))}
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-300">Fixed</span>
        <span className="rounded bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">Neutral</span>
      </PrimitiveBlock>
      <PrimitiveBlock name="Inputs & select">
        <input className={input} placeholder="Text input…" />
        <select className="h-9 rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]">
          <option>Select…</option>
        </select>
        <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]"><input type="checkbox" className="h-3.5 w-3.5 accent-[var(--accent)]" /> Checkbox</label>
      </PrimitiveBlock>
      <PrimitiveBlock name="Surfaces & states">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">Card</div>
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent text-[var(--text-dim)]" />
        <span className="rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">Accent</span>
      </PrimitiveBlock>
    </div>
  );
}

/* ── Module group (collapsible) ───────────────────────────────────────────── */
function ModuleGroup({ k, components, q, forceOpen }: { k: string; components: string[]; q: string; forceOpen: boolean }) {
  const [open, setOpen] = useState(false);
  const filtered = q ? components.filter((c) => c.toLowerCase().includes(q)) : components;
  if (q && filtered.length === 0) return null;
  const expanded = forceOpen || open;
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[var(--bg-surface-subtle)]"
      >
        <span className="text-[13.5px] font-semibold text-[var(--text-primary)]">{labelFor(k)}</span>
        <span className="rounded-full bg-[var(--bg-surface)] px-2 py-0.5 text-[10.5px] font-semibold tabular-nums text-[var(--text-dim)]">{filtered.length}</span>
        <span className="ms-auto text-[12px] text-[var(--text-dim)]">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-faint)] p-3">
          {filtered.map((c) => <span key={c} className={chip}>{c}</span>)}
        </div>
      )}
    </div>
  );
}

export default function UiComponentsCatalog() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const byKey = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const mod of UI_COMPONENT_MODULES) m[mod.key] = mod.components;
    return m;
  }, []);

  // Keys not covered by an explicit category go into "Other".
  const categorized = useMemo(() => {
    const used = new Set(CATEGORIES.flatMap((c) => c.keys));
    const others = UI_COMPONENT_MODULES.map((m) => m.key).filter((k) => !used.has(k));
    return others.length ? [...CATEGORIES, { title: "Other", keys: others }] : CATEGORIES;
  }, []);

  const showPrimitives = !query || "buttons kpi card badge pill input select primitive".includes(query);

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-[var(--text-primary)]">UI Components</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-dim)]">Every UI component in the system, organized by module — built on the KOLEEX design system.</p>
        </div>
        <div className="flex gap-2">
          <Stat value={UI_COMPONENT_TOTALS.components} label="Components" />
          <Stat value={UI_COMPONENT_TOTALS.files} label="Files" />
          <Stat value={UI_COMPONENT_TOTALS.modules} label="Modules" />
        </div>
      </div>

      {/* Search */}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search components by name…"
        className="h-10 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] px-3.5 text-[13px] text-[var(--text-primary)] outline-none transition-colors focus:border-[var(--border-focus)] placeholder:text-[var(--text-ghost)]"
      />

      {/* Live primitives */}
      {showPrimitives && (
        <div className={card}>
          <div className="mb-3 flex items-center justify-between">
            <span className={head}>Design system · live primitives</span>
            <span className="text-[11px] text-[var(--text-dim)]">Rendered for real</span>
          </div>
          <LivePrimitives />
        </div>
      )}

      {/* Full inventory, grouped */}
      {categorized.map((cat) => {
        const keys = cat.keys.filter((k) => byKey[k]);
        if (keys.length === 0) return null;
        // When searching, drop categories whose modules have no match.
        const anyMatch = !query || keys.some((k) => byKey[k].some((c) => c.toLowerCase().includes(query)));
        if (!anyMatch) return null;
        return (
          <section key={cat.title} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className={head}>{cat.title}</span>
              <span className="h-px flex-1 bg-[var(--border-faint)]" />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {keys.map((k) => (
                <ModuleGroup key={k} k={k} components={byKey[k]} q={query} forceOpen={!!query} />
              ))}
            </div>
          </section>
        );
      })}

      <p className="px-1 pb-2 text-[11px] text-[var(--text-dim)]">
        Inventory generated from the source tree. Component names are the React identifiers used in code.
      </p>
    </div>
  );
}
