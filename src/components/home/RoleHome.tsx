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
import { useTranslation } from "@/lib/i18n";
import { homeT } from "@/lib/translations/home";
import Link from "next/link";
import {
  ErpEyebrow, ErpHairline, ErpKpi, ErpPage,
  ErpQuickAction, ErpStatusDot,
  type ErpStatus,
} from "@/components/ui/erp/ErpUi";
import RrIcon from "@/components/ui/RrIcon";
import { APP_REGISTRY } from "@/lib/navigation";
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
  const { t } = useTranslation(homeT);
  const [exp, setExp] = useState<Experience | null>(null);
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [setupCompletion, setSetupCompletion] = useState<number>(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    /* Coalesced (SYS-2): remounting /home inside the TTL reuses the bodies
       instead of refiring three round-trips. Saving preferences invalidates
       its entry (see PersonalizeDrawer.save). */
    const { cachedGet } = await import("@/lib/client-cache");
    const [eJ, sJ, setupJ] = await Promise.all([
      cachedGet<{ experience?: Experience }>("/api/me/preferences", 60_000).catch(() => null),
      cachedGet<WorkflowStatus>("/api/workflows/status", 30_000).catch(() => null),
      cachedGet<{ snapshot?: { completion?: number } }>("/api/finance/setup/status", 60_000).catch(() => null),
    ]);
    if (eJ?.experience) setExp(eJ.experience);
    if (sJ) setStatus(sJ);
    if (setupJ?.snapshot?.completion != null) setSetupCompletion(setupJ.snapshot.completion);
  }, []);

  useEffect(() => { void load(); }, [load]);

  /* Standard banner if base setup isn't done — applies regardless of role. */
  const showSetupBanner = setupCompletion < 0.3 && exp?.dashboard_role !== "warehouse";

  return (
    <ErpPage
      title={t("home", "Home")}
      subtitle={exp
        ? t("subtitle", "{role} dashboard · {mode} mode")
            .replace("{role}", t(`role.${exp.dashboard_role}`, ROLE_LABEL[exp.dashboard_role]))
            .replace("{mode}", t(exp.ui_mode === "simple" ? "mode.simple" : "mode.advanced", exp.ui_mode === "simple" ? "Simple" : "Advanced"))
        : t("loading", "Loading…")}
      icon="home"
      action={
        /* flex-wrap: on 375px the four actions overflowed and "Personalize"
           was clipped off-screen — wrapping keeps every control reachable. */
        <div className="flex flex-wrap items-center gap-2">
          {/* Universal Smart-Create launcher — opens the drawer everywhere.
              Uses the Hub's canonical primary CTA style (inverted) to match
              quotations/invoices/sales. */}
          <button
            type="button" onClick={() => openSmartCreate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[var(--bg-inverted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-inverted)] transition-opacity hover:opacity-90"
            aria-label={t("createAria", "Open Smart Create drawer (shortcut: c)")}
            title={t("createTitle", "Create (c)")}
          >
            <RrIcon name="plus" size={12} />{t("create", "Create")}</button>
          {/* "Data Entry" — answer to "how do I put data in manually". */}
          {/* prefetch={false}: an App Router Link warms its route's client
              chunks on viewport, and this one points into /finance — see the
              note on ErpQuickAction. Home must not download the Finance
              bundle just for showing a shortcut to it. */}
          <Link
            prefetch={false}
            href="/finance/data-entry"
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
            title={t("dataEntryTitle", "Where to put finance data manually")}
          >
            <RrIcon name="pencil" size={12} />{t("dataEntry", "Data Entry")}</Link>
          <NotificationBell />
          <FocusToggle />
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]"
          >
            <RrIcon name="tools" size={12} />{t("personalize", "Personalize")}</button>
        </div>
      }
    >
      {showSetupBanner && (
        <Link
          prefetch={false}
          href="/finance/setup"
          className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[12px] text-amber-700 hover:bg-amber-500/15 dark:text-amber-200"
        >
          <RrIcon name="shield-check" size={14} />
          Finance setup is only {Math.round(setupCompletion * 100)}% complete. Finish onboarding to unlock posting flows.
          <span className="ml-auto text-amber-600 dark:text-amber-300">→</span>
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
                <ErpEyebrow>{t("drawer.pinned", "Pinned workflows")}</ErpEyebrow>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {exp.pinned_workflows.map((w) => (
                    <ErpQuickAction key={w} href={`/workflows/${w}`} icon="contract" label={`${w[0].toUpperCase()}${w.slice(1)} workflow`} hint={t("hint.openTimeline", "Open timeline")} />
                  ))}
                </div>
              </div>
            )}
            {exp.favorite_apps.length > 0 && (
              <div>
                <ErpEyebrow>{t("drawer.favorites", "Favorite apps")}</ErpEyebrow>
                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {exp.favorite_apps.map((id) => {
                    /* Show the app's REAL registry name and route — the raw
                       slug ("product-data") used to leak into the card. */
                    const reg = APP_REGISTRY.find((a) => a.id === id);
                    return (
                      <ErpQuickAction key={id} href={reg?.route ?? `/${id}`} icon="box-open" label={reg?.name ?? id} hint={t("hint.pinned", "Pinned")} />
                    );
                  })}
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
          { label: t("home", "Home"),           icon: "home",          href: "/" },
          /* Mobile Create opens the SmartCreateDrawer instead of
             routing — keeps the operator in the current workflow. */
          { label: t("create", "Create"),       icon: "plus",          onClick: () => openSmartCreate(), tone: "primary" },
          { label: t("nav.ops", "Ops"),         icon: "signal-stream", href: "/operations" },
          { label: t("nav.finance", "Finance"), icon: "bank",          href: "/finance/workspace" },
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
  const { t } = useTranslation(homeT);
  const p = status?.procurement ?? {};
  const s = status?.sales ?? {};
  const f = status?.finance ?? {};
  const i = status?.inventory ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label={t("kpi.activeSO", "Active sales orders")} value={String((s.so_confirmed ?? 0) + (s.so_partial ?? 0))} hint={t("hint.confirmedPartial", "Confirmed + partial")} tone="positive" />
        <ErpKpi label={t("kpi.activePO", "Active POs")}          value={String((p.po_confirmed ?? 0) + (p.po_partial ?? 0))} hint={t("hint.confirmedPartial", "Confirmed + partial")} tone="info" />
        <ErpKpi label={t("kpi.draftJournals", "Draft journals")}      value={String(f.journals_draft ?? 0)}                       hint={t("hint.awaitingReview", "Awaiting review")}     tone="warning" />
        <ErpKpi label={t("kpi.inventoryItems", "Inventory items")}     value={String(i.items ?? 0)}                                hint={t("hint.universalMaster", "Universal master")} />
      </div>
      <ErpHairline />
      <Quicks heading={t("qa.topActions", "Top actions")}>
        <ErpQuickAction href="/finance/visual"            icon="balance-scale-left" label={t("qa.statements", "Statements")}       hint={t("hint.statements", "Income · Balance · Cash flow")} />
        <ErpQuickAction href="/finance/accounting/queue"  icon="clock"              label={t("qa.accountingQueue", "Accounting queue")} hint={t("hint.approveDrafts", "Approve drafts")} />
        <ErpQuickAction href="/workflows"                 icon="contract"           label={t("qa.workflows", "Workflows")}        hint={t("hint.endToEndPlural", "End-to-end timelines")} />
      </Quicks>
    </div>
  );
}

function AccountantDashboard({ exp, status }: { exp: Experience; status: WorkflowStatus | null }) {
  const { t } = useTranslation(homeT);
  void exp;
  const f = status?.finance ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label={t("kpi.draftJournals", "Draft journals")}   value={String(f.journals_draft ?? 0)} hint={t("hint.awaitingPost", "Awaiting post")} tone="warning" />
        <ErpKpi label={t("kpi.cogsDrafts", "COGS drafts")}      value={String(f.cogs_draft ?? 0)}     hint={t("hint.fromShipments", "From shipments")} tone="info" />
        <ErpKpi label={t("kpi.pendingExp", "Pending expenses")} value={String(f.expenses_submitted ?? 0)} hint={t("hint.submittedNotApproved", "Submitted, not approved")} tone="warning" />
        <ErpKpi label={t("kpi.postedExp", "Posted expenses")}  value={String(f.expenses_posted ?? 0)} hint={t("hint.inTheGL", "In the GL")} tone="positive" />
      </div>
      <ErpHairline />
      <Quicks heading={t("qa.topActions", "Top actions")}>
        <ErpQuickAction href="/finance/accounting/queue"  icon="clock"              label={t("qa.accountingQueue", "Accounting queue")} hint={t("hint.draftPostVoid", "Draft / post / void")} />
        <ErpQuickAction href="/finance/visual"            icon="balance-scale-left" label={t("qa.statements", "Statements")}       hint={t("hint.statements", "Income · Balance · Cash flow")} />
        <ErpQuickAction href="/finance/workspace"         icon="bank"               label={t("qa.workspace", "Workspace")}        hint={t("hint.approvalsBanks", "Approvals · banks · activity")} />
      </Quicks>
    </div>
  );
}

function SalesDashboard({ status }: { status: WorkflowStatus | null }) {
  const { t } = useTranslation(homeT);
  const s = status?.sales ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label={t("kpi.activeSOShort", "Active SOs")}       value={String((s.so_confirmed ?? 0) + (s.so_partial ?? 0))} tone="positive" hint={t("hint.confirmedPartial", "Confirmed + partial")} />
        <ErpKpi label={t("kpi.shipments", "Shipments")}        value={String(s.shipments_posted ?? 0)} hint="Posted" />
        <ErpKpi label={t("kpi.invoicesIssued", "Invoices issued")}  value={String(s.invoices_issued ?? 0)}  tone="info" />
        <ErpKpi label={t("kpi.paymentsRecv", "Payments received")} value={String(s.payments_in ?? 0)}     tone="positive" />
      </div>
      <ErpHairline />
      <Quicks heading={t("qa.topActions", "Top actions")}>
        <ErpQuickAction href="/sales/orders"      icon="contract"            label={t("kpi.salesOrders", "Sales orders")}   hint={t("hint.createShipTrack", "Create · ship · track")} />
        <ErpQuickAction href="/invoices"          icon="file-invoice-dollar" label={t("kpi.invoices", "Invoices")}       hint={t("hint.issueCollect", "Issue + collect")} />
        <ErpQuickAction href="/workflows/sales"   icon="contract"            label={t("wf.sales", "Sales workflow")} hint={t("wf.salesDesc", "Quote → SO → ship → invoice → pay")} />
      </Quicks>
    </div>
  );
}

function WarehouseDashboard({ status }: { status: WorkflowStatus | null }) {
  const { t } = useTranslation(homeT);
  const i = status?.inventory ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label={t("kpi.items", "Items")}          value={String(i.items ?? 0)}     hint={t("hint.universalMaster", "Universal master")} />
        <ErpKpi label={t("kpi.movements", "Movements")}      value={String(i.movements ?? 0)} hint={t("hint.postedInOut", "Posted IN/OUT")} tone="info" />
        <ErpKpi label={t("kpi.stockBalances", "Stock balances")} value={String(i.balances ?? 0)}   hint={t("hint.perItemLocation", "Per item × location")} />
        <ErpKpi label={t("kpi.warehouses", "Warehouses")}     value={String(i.warehouses ?? 0)} hint={t("hint.storageLocations", "Storage locations")} />
      </div>
      <ErpHairline />
      <Quicks heading={t("qa.topActions", "Top actions")}>
        <ErpQuickAction href="/inventory/items"       icon="box-open"        label={t("kpi.items", "Items")}             hint={t("hint.masterClassify", "Master · classify · archive")} />
        <ErpQuickAction href="/inventory/movements"   icon="file-invoice"    label={t("kpi.movements", "Movements")}         hint={t("hint.appendOnlyLedger", "Append-only ledger")} />
        <ErpQuickAction href="/workflows/inventory"   icon="box-open"        label={t("wf.inventory", "Inventory workflow")} hint={t("hint.endToEnd", "End-to-end timeline")} />
      </Quicks>
    </div>
  );
}

function PurchasingDashboard({ status }: { status: WorkflowStatus | null }) {
  const { t } = useTranslation(homeT);
  const p = status?.procurement ?? {};
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <ErpKpi label={t("kpi.draftPO", "Draft POs")}        value={String(p.po_draft ?? 0)}        tone="warning" />
        <ErpKpi label={t("kpi.activePO", "Active POs")}       value={String((p.po_confirmed ?? 0) + (p.po_partial ?? 0))} tone="info" />
        <ErpKpi label={t("kpi.postedReceipts", "Posted receipts")}  value={String(p.receipts_posted ?? 0)} tone="positive" />
        <ErpKpi label={t("kpi.billsPosted", "Bills posted")}     value={String(p.bills_posted ?? 0)}    tone="positive" />
      </div>
      <ErpHairline />
      <Quicks heading={t("qa.topActions", "Top actions")}>
        <ErpQuickAction href="/purchase"                 icon="contract"         label={t("kpi.purchaseOrders", "Purchase orders")}      hint={t("hint.draftConfirmReceive", "Draft · confirm · receive")} />
        <ErpQuickAction href="/suppliers"                icon="arrow-up-right"   label={t("kpi.suppliers", "Suppliers")}            hint={t("hint.masterBalances", "Master + balances")} />
        <ErpQuickAction href="/workflows/procurement"    icon="box-circle-check" label={t("wf.procurement", "Procurement workflow")} hint={t("wf.procurementDesc", "Supplier → PO → receipt → bill → pay")} />
      </Quicks>
    </div>
  );
}

function MarketingDashboard() {
  const { t } = useTranslation(homeT);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <ErpKpi label={t("qa.website", "Website")} value="—" hint={t("hint.editContentPages", "Edit content + pages")} />
        <ErpKpi label={t("kpi.catalogs", "Catalogs")} value="—" hint={t("hint.publicCatalog", "Public catalog")} />
        <ErpKpi label={t("kpi.events", "Events")} value="—" hint={t("hint.exhibitionPlanning", "Exhibition planning")} />
      </div>
      <ErpHairline />
      <Quicks heading={t("qa.topActions", "Top actions")}>
        <ErpQuickAction href="/website"   icon="megaphone" label={t("qa.website", "Website")}   hint={t("hint.pagesContent", "Pages + content")} />
        <ErpQuickAction href="/catalogs"  icon="books"     label={t("kpi.catalogs", "Catalogs")}  hint={t("hint.publicCatalogMgmt", "Public catalog management")} />
        <ErpQuickAction href="/products"  icon="box-open"  label={t("kpi.products", "Products")}  hint={t("hint.customerFacing", "Customer-facing catalog")} />
      </Quicks>
    </div>
  );
}

function HrDashboard() {
  const { t } = useTranslation(homeT);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <ErpKpi label={t("kpi.employees", "Employees")}    value="—" hint={t("hint.activeRoster", "Active roster")} />
        <ErpKpi label={t("kpi.departments", "Departments")}  value="—" hint={t("hint.orgStructure", "Org structure")} />
        <ErpKpi label={t("kpi.hrDocs", "HR docs")}      value="—" hint={t("hint.contractsIds", "Contracts + IDs")} />
      </div>
      <ErpHairline />
      <Quicks heading={t("qa.topActions", "Top actions")}>
        <ErpQuickAction href="/employees"   icon="id-badge"        label={t("kpi.employees", "Employees")} hint={t("hint.personnelRecords", "Personnel records")} />
        <ErpQuickAction href="/hr"          icon="graduation-cap"  label={t("qa.hrHub", "HR Hub")}    hint={t("hint.orgLeaveAppraisals", "Org + leave + appraisals")} />
        <ErpQuickAction href="/management"  icon="briefcase"       label={t("qa.management", "Management")} hint={t("hint.deptStructure", "Department structure")} />
      </Quicks>
    </div>
  );
}

/* No hook here on purpose: `heading` arrives already translated from the
   dashboard that renders it. */
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
  const { t } = useTranslation(homeT);
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
      /* Drop the coalesced copy so the next /home mount reads the saved
         preferences, not the 60s-old cached body. */
      const { invalidateCachedGet } = await import("@/lib/client-cache");
      invalidateCachedGet("/api/me/preferences");
      onSaved(j.experience as Experience);
    } finally { setSaving(false); }
  };

  const ROLES = useMemo(() => Object.keys(ROLE_DESC) as DashboardRole[], []);

  return (
    <div className="fixed inset-0 z-[120] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="kx-slide-in-end flex w-full max-w-lg flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] border-l border-[var(--border-subtle)]">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
          <div>
            <h2 className="text-[14px] font-semibold">{t("personalize", "Personalize")}</h2>
            <p className="text-[11px] text-[var(--text-tertiary)]">{t("drawer.desc", "Choose how the home screen behaves for you.")}</p>
          </div>
          <button onClick={onClose} aria-label={t("close", "Close")} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] text-[20px] leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{t("drawer.role", "Dashboard role")}</div>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => {
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-md border px-2.5 py-2 text-left text-[11.5px] transition-colors ${
                      active ? "border-[var(--border-strong)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <div className="font-medium">{ROLE_LABEL[r]}</div>
                    <div className="text-[10.5px] text-[var(--text-tertiary)]">{ROLE_DESC[r]}</div>
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{t("drawer.mode", "Mode")}</div>
            <div className="flex gap-2 text-[11.5px]">
              {(["simple","advanced"] as UiMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md border px-3 py-2 text-left transition-colors ${
                    mode === m ? "border-[var(--border-strong)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  <div className="font-medium">{t(m === "simple" ? "mode.simple" : "mode.advanced", m === "simple" ? "Simple" : "Advanced")}</div>
                  <div className="text-[10.5px] text-[var(--text-tertiary)]">{m === "simple"
                    ? t("mode.simpleDesc", "Operational actions, fewer accounting details.")
                    : t("mode.advancedDesc", "Accounting, journals, reconciliation, adjustments.")}
                  </div>
                </button>
              ))}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{t("drawer.pinned", "Pinned workflows")}</div>
            <div className="flex flex-wrap gap-1.5 text-[11.5px]">
              {WORKFLOW_OPTIONS.map((w) => {
                const active = pinned.includes(w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => toggle(pinned, setPinned, w.id)}
                    className={`rounded-md border px-2.5 py-1 transition-colors ${
                      active ? "border-[var(--border-strong)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {w.label}
                  </button>
                );
              })}
            </div>
          </section>
          <section>
            <div className="mb-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{t("drawer.favorites", "Favorite apps")}</div>
            <div className="flex flex-wrap gap-1.5 text-[11.5px]">
              {APP_OPTIONS.map((a) => {
                const active = favorites.includes(a.id);
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => toggle(favorites, setFavorites, a.id)}
                    className={`rounded-md border px-2.5 py-1 transition-colors ${
                      active ? "border-[var(--border-strong)] bg-[var(--bg-surface-hover)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </section>
          {error && <div className="rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-700 dark:text-rose-300">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--border-subtle)] px-4 py-3">
          <button onClick={onClose} className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-[12px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]">{t("cancel", "Cancel")}</button>
          <button onClick={save} disabled={saving} className="rounded-md border border-[var(--border-strong)] bg-[var(--bg-surface-hover)] px-3 py-1.5 text-[12px] hover:bg-[var(--bg-elevated)] disabled:opacity-50">{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
