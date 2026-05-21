"use client";

/* ---------------------------------------------------------------------------
   /home — role-aware landing dashboard.

   Renders one of seven layouts based on the user's resolved
   dashboard_role. Each layout uses the same ErpUi primitives so the
   surface stays unified: a KPI strip, a stage / shortcut block, and a
   recent-activity feed.

   A personalization drawer lets the user pick role, UI mode, favorite
   apps, and pinned workflows. Stored in accounts.preferences (JSONB),
   so no schema work needed.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpKpi, ErpPage,
  ErpQuickAction, ErpStatusDot,
  type ErpStatus,
} from "@/components/ui/erp/ErpUi";
import RrIcon from "@/components/ui/RrIcon";
import NotificationBell from "@/components/operations/NotificationBell";
import MobileActionBar from "@/components/ui/mobile/MobileActionBar";
import { openSmartCreate } from "@/components/ui/create/SmartCreateDrawer";
import { FocusBoundary, FocusToggle } from "@/components/ui/focus/FocusMode";

type DashboardRole = "ceo" | "accountant" | "sales" | "warehouse" | "purchasing" | "marketing" | "hr";
type UiMode = "simple" | "advanced";

interface Experience {
  account_id: string;
  dashboard_role: DashboardRole;
  ui_mode: UiMode;
  favorite_apps: string[];
  pinned_workflows: string[];
  can_see_cost_data: boolean;
  can_see_bank_balances: boolean;
  can_see_profit: boolean;
  is_super_admin: boolean;
}

const ROLE_LABEL: Record<DashboardRole, string> = {
  ceo: "Executive", accountant: "Accountant", sales: "Sales",
  warehouse: "Warehouse", purchasing: "Purchasing",
  marketing: "Marketing", hr: "HR",
};

interface WorkflowStatus {
  procurement: Record<string, number>;
  sales: Record<string, number>;
  finance: Record<string, number>;
  inventory: Record<string, number>;
}

export default function RoleHome() {
  const [exp, setExp] = useState<Experience | null>(null);
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [setupCompletion, setSetupCompletion] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    const [eRes, sRes, setRes] = await Promise.all([
      fetch("/api/me/preferences", { credentials: "include", cache: "no-store" }),
      fetch("/api/workflows/status", { credentials: "include", cache: "no-store" }),
      fetch("/api/finance/setup/status", { credentials: "include", cache: "no-store" }),
    ]);
    const eJ = await eRes.json();
    const sJ = sRes.ok ? await sRes.json() : null;
    const setupJ = setRes.ok ? await setRes.json() : null;
    if (eRes.ok) setExp(eJ.experience as Experience);
    if (sJ) setStatus(sJ as WorkflowStatus);
    if (setupJ?.snapshot?.completion != null) setSetupCompletion(setupJ.snapshot.completion);
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* Standard banner if base setup isn't done — applies regardless of role. */
  const showSetupBanner = setupCompletion < 0.3 && exp?.dashboard_role !== "warehouse";

  return (
    <ErpPage
      title="Home"
      subtitle={exp ? `${ROLE_LABEL[exp.dashboard_role]} dashboard · ${exp.ui_mode === "simple" ? "Simple" : "Advanced"} mode` : "Loading…"}
      icon="coins"
      action={
        <div className="flex items-center gap-2">
          {/* Universal Smart-Create launcher — opens the drawer everywhere.
              Uses the Hub's canonical primary CTA style (inverted) to match
              quotations/invoices/sales. */}
          <button
            type="button" onClick={() => openSmartCreate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
            aria-label="Open Smart Create drawer (shortcut: c)"
            title="Create (c)"
          >
            <RrIcon name="plus" size={12} />
            Create
          </button>
          {/* "Data Entry" — answer to "how do I put data in manually". */}
          <Link
            href="/finance/data-entry"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
            title="Where to put finance data manually"
          >
            <RrIcon name="pencil" size={12} />
            Data Entry
          </Link>
          <NotificationBell />
          <FocusToggle />
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 text-[12px] hover:bg-white/[0.06]"
          >
            <RrIcon name="tools" size={12} />
            Personalize
          </button>
        </div>
      }
    >
      {showSetupBanner && (
        <Link
          href="/finance/setup"
          className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-500/[0.06] px-4 py-3 text-[12px] text-amber-200 hover:bg-amber-500/[0.10]"
        >
          <RrIcon name="shield-check" size={14} />
          Finance setup is only {Math.round(setupCompletion * 100)}% complete. Finish onboarding to unlock posting flows.
          <span className="ml-auto text-amber-300">→</span>
        </Link>
      )}

      {exp && (
        <>
          {exp.dashboard_role === "ceo"        && <CeoDashboard exp={exp} status={status} />}
          {exp.dashboard_role === "accountant" && <AccountantDashboard exp={exp} status={status} />}
          {exp.dashboard_role === "sales"      && <SalesDashboard status={status} />}
          {exp.dashboard_role === "warehouse"  && <WarehouseDashboard status={status} />}
          {exp.dashboard_role === "purchasing" && <PurchasingDashboard status={status} />}
          {exp.dashboard_role === "marketing"  && <MarketingDashboard />}
          {exp.dashboard_role === "hr"         && <HrDashboard />}
        </>
      )}

      {/* Favorites + Pins (shared). Hidden under Focus Mode — these
          are personalization, not operational essentials. */}
      {exp && (exp.favorite_apps.length > 0 || exp.pinned_workflows.length > 0) && (
        <FocusBoundary>
          <ErpHairline />
          <section className="space-y-4">
            {exp.pinned_workflows.length > 0 && (
              <div>
                <ErpEyebrow>Pinned workflows</ErpEyebrow>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {exp.pinned_workflows.map((w) => (
                    <ErpQuickAction key={w} href={`/workflows/${w}`} icon="contract" label={`${w[0].toUpperCase()}${w.slice(1)} workflow`} hint="Open timeline" />
                  ))}
                </div>
              </div>
            )}
            {exp.favorite_apps.length > 0 && (
              <div>
                <ErpEyebrow>Favorite apps</ErpEyebrow>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {exp.favorite_apps.map((id) => (
                    <ErpQuickAction key={id} href={`/${id}`} icon="box-open" label={id} hint="Pinned" />
                  ))}
                </div>
              </div>
            )}
          </section>
        </FocusBoundary>
      )}

      {drawerOpen && exp && (
        <PersonalizeDrawer exp={exp} onClose={() => setDrawerOpen(false)} onSaved={(next) => { setExp(next); setDrawerOpen(false); }} />
      )}

      {/* Sticky mobile quick actions — desktop unchanged. */}
      <MobileActionBar
        actions={[
          { label: "Home",    icon: "home",          href: "/" },
          /* Mobile Create opens the SmartCreateDrawer instead of
             routing — keeps the operator in the current workflow. */
          { label: "Create",  icon: "plus",          onClick: () => openSmartCreate(), tone: "primary" },
          { label: "Ops",     icon: "signal-stream", href: "/operations" },
          { label: "Finance", icon: "bank",          href: "/finance/workspace" },
        ]}
      />
    </ErpPage>
  );
}

/* ═════════════════════════════════════════════════════════════
   ROLE LAYOUTS
   ═════════════════════════════════════════════════════════════ */

function kpiStatus(n: number): ErpStatus { return n > 0 ? "started" : "empty"; }

function CeoDashboard({ exp, status }: { exp: Experience; status: WorkflowStatus | null }) {
  const p = status?.procurement ?? {};
  const s = status?.sales ?? {};
  const f = status?.finance ?? {};
  const i = status?.inventory ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label="Active sales orders" value={String((s.so_confirmed ?? 0) + (s.so_partial ?? 0))} hint="Confirmed + partial" tone="positive" />
        <ErpKpi label="Active POs"          value={String((p.po_confirmed ?? 0) + (p.po_partial ?? 0))} hint="Confirmed + partial" tone="info" />
        <ErpKpi label="Draft journals"      value={String(f.journals_draft ?? 0)}                       hint="Awaiting review"     tone="warning" />
        <ErpKpi label="Inventory items"     value={String(i.items ?? 0)}                                hint="Universal master" />
      </div>
      <ErpHairline />
      <Quicks heading="Top actions">
        <ErpQuickAction href="/finance/visual"            icon="balance-scale-left" label="Statements"       hint="Income · Balance · Cash flow" />
        <ErpQuickAction href="/finance/accounting/queue"  icon="clock"              label="Accounting queue" hint="Approve drafts" />
        <ErpQuickAction href="/workflows"                 icon="contract"           label="Workflows"        hint="End-to-end timelines" />
      </Quicks>
    </div>
  );
}

function AccountantDashboard({ exp, status }: { exp: Experience; status: WorkflowStatus | null }) {
  void exp;
  const f = status?.finance ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label="Draft journals"   value={String(f.journals_draft ?? 0)} hint="Awaiting post" tone="warning" />
        <ErpKpi label="COGS drafts"      value={String(f.cogs_draft ?? 0)}     hint="From shipments" tone="info" />
        <ErpKpi label="Pending expenses" value={String(f.expenses_submitted ?? 0)} hint="Submitted, not approved" tone="warning" />
        <ErpKpi label="Posted expenses"  value={String(f.expenses_posted ?? 0)} hint="In the GL" tone="positive" />
      </div>
      <ErpHairline />
      <Quicks heading="Top actions">
        <ErpQuickAction href="/finance/accounting/queue"  icon="clock"              label="Accounting queue" hint="Draft / post / void" />
        <ErpQuickAction href="/finance/visual"            icon="balance-scale-left" label="Statements"       hint="Income · Balance · Cash flow" />
        <ErpQuickAction href="/finance/workspace"         icon="bank"               label="Workspace"        hint="Approvals · banks · activity" />
      </Quicks>
    </div>
  );
}

function SalesDashboard({ status }: { status: WorkflowStatus | null }) {
  const s = status?.sales ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label="Active SOs"       value={String((s.so_confirmed ?? 0) + (s.so_partial ?? 0))} tone="positive" hint="Confirmed + partial" />
        <ErpKpi label="Shipments"        value={String(s.shipments_posted ?? 0)} hint="Posted" />
        <ErpKpi label="Invoices issued"  value={String(s.invoices_issued ?? 0)}  tone="info" />
        <ErpKpi label="Payments received" value={String(s.payments_in ?? 0)}     tone="positive" />
      </div>
      <ErpHairline />
      <Quicks heading="Top actions">
        <ErpQuickAction href="/sales/orders"      icon="contract"            label="Sales orders"   hint="Create · ship · track" />
        <ErpQuickAction href="/invoices"          icon="file-invoice-dollar" label="Invoices"       hint="Issue + collect" />
        <ErpQuickAction href="/workflows/sales"   icon="contract"            label="Sales workflow" hint="Quote → SO → ship → invoice → pay" />
      </Quicks>
    </div>
  );
}

function WarehouseDashboard({ status }: { status: WorkflowStatus | null }) {
  const i = status?.inventory ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label="Items"          value={String(i.items ?? 0)}     hint="Universal master" />
        <ErpKpi label="Movements"      value={String(i.movements ?? 0)} hint="Posted IN/OUT" tone="info" />
        <ErpKpi label="Stock balances" value={String(i.balances ?? 0)}  hint="Per item × location" />
        <ErpKpi label="Locations"      value={String(i.balances ?? 0)}  hint="Warehouses + virtual" />
      </div>
      <ErpHairline />
      <Quicks heading="Top actions">
        <ErpQuickAction href="/inventory/items"       icon="box-open"        label="Items"             hint="Master · classify · archive" />
        <ErpQuickAction href="/inventory/movements"   icon="file-invoice"    label="Movements"         hint="Append-only ledger" />
        <ErpQuickAction href="/workflows/inventory"   icon="box-open"        label="Inventory workflow" hint="End-to-end timeline" />
      </Quicks>
    </div>
  );
}

function PurchasingDashboard({ status }: { status: WorkflowStatus | null }) {
  const p = status?.procurement ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label="Draft POs"        value={String(p.po_draft ?? 0)}        tone="warning" />
        <ErpKpi label="Active POs"       value={String((p.po_confirmed ?? 0) + (p.po_partial ?? 0))} tone="info" />
        <ErpKpi label="Posted receipts"  value={String(p.receipts_posted ?? 0)} tone="positive" />
        <ErpKpi label="Bills posted"     value={String(p.bills_posted ?? 0)}    tone="positive" />
      </div>
      <ErpHairline />
      <Quicks heading="Top actions">
        <ErpQuickAction href="/purchase"                 icon="contract"         label="Purchase orders"      hint="Draft · confirm · receive" />
        <ErpQuickAction href="/suppliers"                icon="arrow-up-right"   label="Suppliers"            hint="Master + balances" />
        <ErpQuickAction href="/workflows/procurement"    icon="box-circle-check" label="Procurement workflow" hint="Supplier → PO → receipt → bill → pay" />
      </Quicks>
    </div>
  );
}

function MarketingDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <ErpKpi label="Website" value="—" hint="Edit content + pages" />
        <ErpKpi label="Catalogs" value="—" hint="Public catalog" />
        <ErpKpi label="Events" value="—" hint="Exhibition planning" />
      </div>
      <ErpHairline />
      <Quicks heading="Top actions">
        <ErpQuickAction href="/website"   icon="megaphone" label="Website"   hint="Pages + content" />
        <ErpQuickAction href="/catalogs"  icon="books"     label="Catalogs"  hint="Public catalog management" />
        <ErpQuickAction href="/products"  icon="box-open"  label="Products"  hint="Customer-facing catalog" />
      </Quicks>
    </div>
  );
}

function HrDashboard() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <ErpKpi label="Employees"    value="—" hint="Active roster" />
        <ErpKpi label="Departments"  value="—" hint="Org structure" />
        <ErpKpi label="HR docs"      value="—" hint="Contracts + IDs" />
      </div>
      <ErpHairline />
      <Quicks heading="Top actions">
        <ErpQuickAction href="/employees"   icon="id-badge"        label="Employees" hint="Personnel records" />
        <ErpQuickAction href="/hr"          icon="graduation-cap"  label="HR Hub"    hint="Org + leave + appraisals" />
        <ErpQuickAction href="/management"  icon="briefcase"       label="Management" hint="Department structure" />
      </Quicks>
    </div>
  );
}

function Quicks({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <section>
      <ErpEyebrow>{heading}</ErpEyebrow>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════════
   PERSONALIZATION DRAWER
   ═════════════════════════════════════════════════════════════ */

const ROLE_DESC: Record<DashboardRole, string> = {
  ceo:        "Executive view — KPIs, reports, approvals.",
  accountant: "Accounting Queue, journals, reconciliation.",
  sales:      "Quotations, customers, sales orders, invoices.",
  warehouse:  "Items, movements, locations.",
  purchasing: "Suppliers, POs, receiving, bills.",
  marketing:  "Website, catalogs, products, markets.",
  hr:         "Employees, departments, HR hub.",
};

const WORKFLOW_OPTIONS = [
  { id: "procurement", label: "Procurement" },
  { id: "sales",       label: "Sales" },
  { id: "finance",     label: "Finance" },
  { id: "inventory",   label: "Inventory" },
] as const;

const APP_OPTIONS = [
  { id: "finance",        label: "Finance" },
  { id: "inventory",      label: "Inventory" },
  { id: "sales",          label: "Sales" },
  { id: "purchase",       label: "Purchase" },
  { id: "quotations",     label: "Quotations" },
  { id: "invoices",       label: "Invoices" },
  { id: "customers",      label: "Customers" },
  { id: "suppliers",      label: "Suppliers" },
  { id: "expenses",       label: "Expenses" },
  { id: "products",       label: "Products" },
  { id: "catalogs",       label: "Catalogs" },
  { id: "employees",      label: "Employees" },
] as const;

function PersonalizeDrawer({ exp, onClose, onSaved }: { exp: Experience; onClose: () => void; onSaved: (e: Experience) => void }) {
  const [role, setRole] = useState<DashboardRole>(exp.dashboard_role);
  const [mode, setMode] = useState<UiMode>(exp.ui_mode);
  const [favorites, setFavorites] = useState<string[]>(exp.favorite_apps);
  const [pinned, setPinned] = useState<string[]>(exp.pinned_workflows);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/me/preferences", {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dashboard_role: role, ui_mode: mode, favorite_apps: favorites, pinned_workflows: pinned }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error ?? "Failed"); return; }
      onSaved(j.experience as Experience);
    } finally { setSaving(false); }
  };

  const ROLES = useMemo(() => Object.keys(ROLE_DESC) as DashboardRole[], []);

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-lg flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-white/[0.08]">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">Personalize</h2>
            <p className="text-[11px] text-gray-500">Choose how the home screen behaves for you.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-300 text-[20px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-gray-500">Dashboard role</div>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-md border px-2.5 py-2 text-left text-[11.5px] transition-colors ${
                      active ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    <div className="font-medium">{ROLE_LABEL[r]}</div>
                    <div className="text-[10.5px] text-gray-500">{ROLE_DESC[r]}</div>
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-gray-500">Mode</div>
            <div className="flex gap-2 text-[11.5px]">
              {(["simple","advanced"] as UiMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors ${
                    mode === m ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <div className="font-medium">{m === "simple" ? "Simple" : "Advanced"}</div>
                  <div className="text-[10.5px] text-gray-500">{m === "simple"
                    ? "Operational actions, fewer accounting details."
                    : "Accounting, journals, reconciliation, adjustments."}
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-gray-500">Pinned workflows</div>
            <div className="flex flex-wrap gap-1.5 text-[11.5px]">
              {WORKFLOW_OPTIONS.map((w) => {
                const active = pinned.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggle(pinned, setPinned, w.id)}
                    className={`rounded-md border px-2.5 py-1 transition-colors ${
                      active ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-gray-500">Favorite apps</div>
            <div className="flex flex-wrap gap-1.5 text-[11.5px]">
              {APP_OPTIONS.map((a) => {
                const active = favorites.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(favorites, setFavorites, a.id)}
                    className={`rounded-md border px-2.5 py-1 transition-colors ${
                      active ? "border-white/[0.14] bg-white/[0.06] text-[var(--text-primary)]" : "border-white/[0.06] text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </section>
          {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/[0.06] px-4 py-3">
          <button onClick={onClose} className="rounded-md border border-white/[0.08] px-3 py-1.5 text-[12px] text-gray-400 hover:text-gray-200">Cancel</button>
          <button onClick={save} disabled={saving} className="rounded-md border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-[12px] hover:bg-white/[0.10] disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
