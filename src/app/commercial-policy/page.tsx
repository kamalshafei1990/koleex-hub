"use client";

/* ---------------------------------------------------------------------------
   /commercial-policy — Phase 3 (editable).
   Each section has an Edit button. Click it → rows become inputs →
   Save PATCHes /api/commercial-policy/<section> → the local snapshot
   patches in place with the fresh server response. Cancel reverts to
   the last-saved state without another round-trip.

   Data + wire format lives in src/lib/server/commercial-policy.ts.
   Country-to-band assignments and row add/delete are deliberately out
   of scope here — they need a different UI pattern (see Phase 3b).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/admin/AuthGate";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import CommercialPolicyIcon from "@/components/icons/CommercialPolicyIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import type {
  CommercialPolicySnapshot,
  CommercialSettingsRow,
  ProductLevelRow,
  CustomerTierRow,
  MarketBandRow,
  BandCountryRow,
  ChannelMultiplierRow,
  DiscountTierRow,
  CommissionTierRow,
  ApprovalAuthorityRow,
  VolumeDiscountTierRow,
} from "@/lib/server/commercial-policy";

export default function CommercialPolicyPage() {
  return (
    <AuthGate
      title="Commercial Policy"
      subtitle="The editable source of truth for Koleex pricing and approvals"
    >
      <CommercialPolicyView />
    </AuthGate>
  );
}

/* ─── Top-level view ──────────────────────────────────────── */

function CommercialPolicyView() {
  const [snapshot, setSnapshot] = useState<CommercialPolicySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commercial-policy", { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Failed to load (${res.status}).`);
        return;
      }
      const data = (await res.json()) as CommercialPolicySnapshot;
      setSnapshot(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const patchSection = useCallback(
    <K extends keyof CommercialPolicySnapshot>(key: K, payload: CommercialPolicySnapshot[K]) => {
      setSnapshot((prev) => (prev ? { ...prev, [key]: payload } : prev));
    },
    [],
  );

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full relative"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
            <Link
              href="/"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                <CommercialPolicyIcon className="h-4 w-4" />
              </div>
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                Commercial Policy
              </h1>
            </div>
          </div>
          <p className="text-[12px] text-[var(--text-dim)] mb-4 ml-0 md:ml-11">
            Editable · Changes sync to the pricing engine immediately
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && snapshot && (
            <PolicyBody s={snapshot} onPatch={patchSection} onToast={setToast} />
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 end-5 z-40 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.12] backdrop-blur px-4 py-3 text-[12px] font-medium text-emerald-300 flex items-center gap-2 shadow-lg">
          <CheckCircleIcon className="h-4 w-4" />
          {toast}
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
    </div>
  );
}
function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-6 flex items-start gap-3">
      <InfoIcon className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-red-300">Can&apos;t load the policy</div>
        <div className="text-[12px] text-[var(--text-dim)] mt-1">{message}</div>
      </div>
    </div>
  );
}

/* ─── Body ────────────────────────────────────────────────── */

interface BodyProps {
  s: CommercialPolicySnapshot;
  onPatch: <K extends keyof CommercialPolicySnapshot>(key: K, payload: CommercialPolicySnapshot[K]) => void;
  onToast: (msg: string) => void;
}

function PolicyBody({ s, onPatch, onToast }: BodyProps) {
  return (
    <>
      <InfoBanner />
      <SettingsSection row={s.settings} onPatch={(r) => { onPatch("settings", r); onToast("Settings saved"); }} />
      <ProductLevelsSection rows={s.productLevels} onPatch={(r) => { onPatch("productLevels", r); onToast("Product levels saved"); }} />
      <CustomerTiersSection rows={s.customerTiers} onPatch={(r) => { onPatch("customerTiers", r); onToast("Customer tiers saved"); }} />
      <MarketBandsSection bands={s.marketBands} countries={s.bandCountries} onPatch={(r) => { onPatch("marketBands", r); onToast("Market bands saved"); }} />
      <ChannelMultipliersSection rows={s.channelMultipliers} onPatch={(r) => { onPatch("channelMultipliers", r); onToast("Channel multipliers saved"); }} />
      <VolumeDiscountTiersSection rows={s.volumeDiscountTiers} onPatch={(r) => { onPatch("volumeDiscountTiers", r); onToast("Volume discount tiers saved"); }} />
      <DiscountTiersSection rows={s.discountTiers} onPatch={(r) => { onPatch("discountTiers", r); onToast("Discount tiers saved"); }} />
      <CommissionTiersSection rows={s.commissionTiers} onPatch={(r) => { onPatch("commissionTiers", r); onToast("Commission tiers saved"); }} />
      <ApprovalAuthoritySection rows={s.approvalAuthority} onPatch={(r) => { onPatch("approvalAuthority", r); onToast("Approval authority saved"); }} />
    </>
  );
}

function InfoBanner() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-4 flex items-start gap-3">
      <InfoIcon className="h-4 w-4 text-[var(--text-dim)] mt-0.5 shrink-0" />
      <div className="min-w-0 text-[12px] text-[var(--text-muted)] leading-relaxed">
        Click <span className="text-[var(--text-primary)] font-semibold">Edit</span> on any
        section to change values. Saves are applied per-section and sync to the pricing engine
        immediately. Country-to-band re-assignments and adding/removing rows arrive in the next release.
      </div>
    </div>
  );
}

/* ─── Generic editable-section scaffolding ───────────────── */

function SectionShell({
  title,
  description,
  editing,
  saving,
  onEditStart,
  onCancel,
  onSave,
  canSave = true,
  children,
}: {
  title: string;
  description?: string;
  editing: boolean;
  saving: boolean;
  onEditStart: () => void;
  onCancel: () => void;
  onSave: () => void;
  canSave?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border-subtle)] flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
          {description && (
            <p className="text-[11px] text-[var(--text-dim)] mt-1">{description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!editing && (
            <button
              type="button"
              onClick={onEditStart}
              className="h-8 px-3 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors"
            >
              Edit
            </button>
          )}
          {editing && (
            <>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={saving || !canSave}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold uppercase tracking-wide bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {saving && <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />}
                Save
              </button>
            </>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Generic hook: holds edit state for a section.
 *  `initial` is the snapshot coming in from the server; `buildBody`
 *  turns the local draft (+ any row ids queued for deletion) into the
 *  PATCH body. deletedIds is only meaningful for list sections; the
 *  settings singleton ignores it. */
function useSectionEditor<Draft>(
  initial: Draft,
  endpoint: string,
  buildBody: (draft: Draft, deletedIds: string[]) => unknown,
) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft>(initial);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Reset draft + pending deletes whenever the upstream data changes
  // OR we leave edit mode — prevents stale state if the snapshot
  // refreshes while the user is editing (shouldn't happen, but safe).
  useEffect(() => {
    if (!editing) {
      setDraft(initial);
      setDeletedIds([]);
    }
  }, [initial, editing]);

  const begin = () => {
    setDraft(initial);
    setDeletedIds([]);
    setError(null);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setError(null);
  };
  const queueDelete = (id: string) => {
    setDeletedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const save = async (): Promise<Draft | null> => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(draft, deletedIds)),
      });
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; payload?: unknown; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? `Save failed (${res.status})`);
        return null;
      }
      setEditing(false);
      setDeletedIds([]);
      return body.payload as Draft;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      return null;
    } finally {
      setSaving(false);
    }
  };

  return { editing, saving, draft, setDraft, deletedIds, queueDelete, error, begin, cancel, save };
}

/** New-row factory for a list section. Assigns id: null so the server
 *  knows to INSERT, and sort_order = (max of existing) + 1 so the
 *  fresh row appears at the bottom. `extras` fills in the required
 *  non-null fields the UI doesn't always surface. */
function blankRow<R extends { id: string | null; sort_order: number }>(
  rows: Array<{ sort_order: number }>,
  extras: Omit<R, "id" | "sort_order">,
): R {
  const maxOrder = rows.length ? Math.max(...rows.map((r) => r.sort_order)) : 0;
  return { id: null, sort_order: maxOrder + 1, ...extras } as R;
}

/* ─── Sections ───────────────────────────────────────────── */

/* ── Settings (singleton) ── */

function SettingsSection({
  row,
  onPatch,
}: {
  row: CommercialSettingsRow | null;
  onPatch: (r: CommercialSettingsRow | null) => void;
}) {
  const ed = useSectionEditor<CommercialSettingsRow | null>(
    row,
    "/api/commercial-policy/settings",
    (draft) =>
      draft
        ? {
            row: {
              fx_cny_per_usd: Number(draft.fx_cny_per_usd),
              sales_sees_cost: !!draft.sales_sees_cost,
              cost_uplift_percent: Number(draft.cost_uplift_percent ?? 0),
              use_policy_engine: !!draft.use_policy_engine,
              notes: draft.notes ?? null,
            },
          }
        : { row: null },
  );
  // Settings has no add/delete — it's a singleton.

  const d = ed.draft;
  if (!d) {
    return (
      <SectionShell title="Settings" editing={false} saving={false} onEditStart={() => {}} onCancel={() => {}} onSave={() => {}} canSave={false}>
        <div className="text-[12px] text-[var(--text-dim)]">No settings row yet.</div>
      </SectionShell>
    );
  }
  return (
    <SectionShell
      title="Settings"
      description="Tenant-level knobs that apply to the whole policy."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => {
        const fresh = await ed.save();
        if (fresh !== null) onPatch(fresh);
      }}
    >
      <KpiGrid>
        <KpiEditable
          label="FX · CNY per USD"
          value={d.fx_cny_per_usd}
          editing={ed.editing}
          type="number"
          step="0.0001"
          onChange={(v) => ed.setDraft({ ...d, fx_cny_per_usd: Number(v) })}
          renderValue={(v) => Number(v).toFixed(4)}
        />
        <KpiBool
          label="Sales sees cost"
          value={d.sales_sees_cost}
          editing={ed.editing}
          onChange={(v) => ed.setDraft({ ...d, sales_sees_cost: v })}
          hintTrue="Sales users will see KOLEEX cost — override the policy default."
          hintFalse="Sales users cannot view KOLEEX cost (matches the Commercial Policy)."
        />
        <KpiEditable
          label="Cost uplift %"
          value={d.cost_uplift_percent ?? 0}
          editing={ed.editing}
          type="number"
          step="0.1"
          onChange={(v) => ed.setDraft({ ...d, cost_uplift_percent: Number(v) })}
          renderValue={(v) => `${Number(v).toFixed(2)}%`}
        />
        <KpiBool
          label="Policy engine active"
          value={!!d.use_policy_engine}
          editing={ed.editing}
          onChange={(v) => ed.setDraft({ ...d, use_policy_engine: v })}
          hintTrue="Pricing engine falls back to the 12-step Commercial Policy flow when no override / market price matches."
          hintFalse="Legacy mode — lines without an explicit price stay unresolved. Flip on when you're ready to use the policy as the source of truth."
        />
        <KpiReadonly label="Policy version" value={d.policy_version} />
      </KpiGrid>
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Product Levels ── */

type DraftProductLevel = Omit<ProductLevelRow, "id"> & { id: string | null };

function ProductLevelsSection({
  rows,
  onPatch,
}: {
  rows: ProductLevelRow[];
  onPatch: (r: ProductLevelRow[]) => void;
}) {
  const ed = useSectionEditor<DraftProductLevel[]>(
    rows as DraftProductLevel[],
    "/api/commercial-policy/product-levels",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          name: r.name,
          min_cost_cny: Number(r.min_cost_cny),
          max_cost_cny: r.max_cost_cny === null ? null : Number(r.max_cost_cny),
          margin_percent: Number(r.margin_percent),
          margin_min_percent: r.margin_min_percent === null ? null : Number(r.margin_min_percent),
          margin_max_percent: r.margin_max_percent === null ? null : Number(r.margin_max_percent),
          min_margin_percent: Number(r.min_margin_percent),
          is_active: r.is_active,
          sort_order: r.sort_order,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftProductLevel, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        code: "",
        name: "",
        sort_order: maxOrder + 1,
        min_cost_cny: 0,
        max_cost_cny: null,
        margin_percent: 0,
        margin_min_percent: null,
        margin_max_percent: null,
        min_margin_percent: 0,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Product Levels"
      description="KOLEEX cost (CNY) auto-detects the level; level carries the default + minimum margin."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as ProductLevelRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Code", "Name", "Min Cost (CNY)", "Max Cost (CNY)", "Margin Range %", "Default %", "Floor %", "Active", ""]
          : ["Code", "Name", "Min Cost (CNY)", "Max Cost (CNY)", "Margin Range %", "Default %", "Floor %", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td>{r.code || <span className="text-[var(--text-dim)]">—</span>}</Td>
            <Td><TextIn editing={ed.editing} value={r.name} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { name: v }))} /></Td>
            <Td align="right"><NumIn editing={ed.editing} value={r.min_cost_cny} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { min_cost_cny: v }))} /></Td>
            <Td align="right"><NullableNumIn editing={ed.editing} value={r.max_cost_cny} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { max_cost_cny: v }))} nullLabel="∞" /></Td>
            <Td align="right">
              <RangeIn editing={ed.editing} lo={r.margin_min_percent} hi={r.margin_max_percent}
                onLo={(v) => ed.setDraft(updateAt(ed.draft, i, { margin_min_percent: v }))}
                onHi={(v) => ed.setDraft(updateAt(ed.draft, i, { margin_max_percent: v }))}
                suffix="%" />
            </Td>
            <Td align="right"><PctIn editing={ed.editing} value={r.margin_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { margin_percent: v }))} /></Td>
            <Td align="right"><PctIn editing={ed.editing} value={r.min_margin_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { min_margin_percent: v }))} /></Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add level" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Customer Tiers ── */

type DraftCustomerTier = Omit<CustomerTierRow, "id"> & { id: string | null };

function CustomerTiersSection({
  rows,
  onPatch,
}: {
  rows: CustomerTierRow[];
  onPatch: (r: CustomerTierRow[]) => void;
}) {
  const ed = useSectionEditor<DraftCustomerTier[]>(
    rows as DraftCustomerTier[],
    "/api/commercial-policy/customer-tiers",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          name: r.name,
          real_name: r.real_name,
          level_number: r.level_number,
          discount_cap_percent: Number(r.discount_cap_percent),
          has_credit: r.has_credit,
          credit_multiplier: r.credit_multiplier === null ? null : Number(r.credit_multiplier),
          credit_days: r.credit_days === null ? null : Number(r.credit_days),
          market_rights: r.market_rights,
          is_active: r.is_active,
          sort_order: r.sort_order,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftCustomerTier, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    const maxLevel = ed.draft.length ? Math.max(...ed.draft.map((r) => r.level_number)) : -1;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        code: "",
        name: "",
        real_name: null,
        level_number: maxLevel + 1,
        sort_order: maxOrder + 1,
        has_credit: false,
        credit_multiplier: null,
        credit_days: null,
        discount_cap_percent: 0,
        market_rights: null,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Customer Tiers"
      description="Classification for every customer. Drives discount caps, credit, and market rights."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as CustomerTierRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Level", "Tier", "Commercial Role", "Discount Cap %", "Has Credit", "Credit ×", "Credit Days", "Market Rights", "Active", ""]
          : ["Level", "Tier", "Commercial Role", "Discount Cap %", "Has Credit", "Credit ×", "Credit Days", "Market Rights", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td align="right">
              {ed.editing
                ? <NumIn editing value={r.level_number} integer onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { level_number: v ?? 0 }))} />
                : r.level_number}
            </Td>
            <Td><TextIn editing={ed.editing} value={r.name} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { name: v }))} /></Td>
            <Td><TextIn editing={ed.editing} value={r.real_name ?? ""} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { real_name: v || null }))} /></Td>
            <Td align="right"><PctIn editing={ed.editing} value={r.discount_cap_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { discount_cap_percent: v }))} /></Td>
            <Td><BoolIn editing={ed.editing} value={r.has_credit} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { has_credit: v }))} /></Td>
            <Td align="right"><NullableNumIn editing={ed.editing} value={r.credit_multiplier} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { credit_multiplier: v }))} nullLabel="—" /></Td>
            <Td align="right"><NullableNumIn editing={ed.editing} value={r.credit_days} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { credit_days: v }))} integer nullLabel="—" /></Td>
            <Td><TextIn editing={ed.editing} value={r.market_rights ?? ""} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { market_rights: v || null }))} /></Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add tier" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Market Bands (metadata only — country mapping in Phase 3b) ── */

type DraftMarketBand = Omit<MarketBandRow, "id"> & { id: string | null };

function MarketBandsSection({
  bands,
  countries,
  onPatch,
}: {
  bands: MarketBandRow[];
  countries: BandCountryRow[];
  onPatch: (r: MarketBandRow[]) => void;
}) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of countries) m.set(c.band_id, (m.get(c.band_id) ?? 0) + 1);
    return m;
  }, [countries]);

  const ed = useSectionEditor<DraftMarketBand[]>(
    bands as DraftMarketBand[],
    "/api/commercial-policy/market-bands",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          name: r.name,
          label: r.label,
          adjustment_percent: Number(r.adjustment_percent),
          is_flexible: r.is_flexible,
          flex_min_percent: r.flex_min_percent === null ? null : Number(r.flex_min_percent),
          flex_max_percent: r.flex_max_percent === null ? null : Number(r.flex_max_percent),
          description: r.description,
          is_active: r.is_active,
          sort_order: r.sort_order,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftMarketBand, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        code: "",
        name: "",
        label: null,
        adjustment_percent: 0,
        is_flexible: false,
        flex_min_percent: null,
        flex_max_percent: null,
        description: null,
        sort_order: maxOrder + 1,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Market Bands"
      description="Retail-price adjustment by market. Country assignments editable in the next release."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as MarketBandRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Band", "Label", "Adjustment %", "Flexible", "Flex Min %", "Flex Max %", "Countries", "Active", ""]
          : ["Band", "Label", "Adjustment %", "Flexible", "Flex Min %", "Flex Max %", "Countries", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td>{r.code || <span className="text-[var(--text-dim)]">—</span>}</Td>
            <Td><TextIn editing={ed.editing} value={r.label ?? ""} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { label: v || null }))} /></Td>
            <Td align="right"><SignedPctIn editing={ed.editing} value={r.adjustment_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { adjustment_percent: v }))} /></Td>
            <Td><BoolIn editing={ed.editing} value={r.is_flexible} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_flexible: v }))} /></Td>
            <Td align="right"><NullableNumIn editing={ed.editing && r.is_flexible} value={r.flex_min_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { flex_min_percent: v }))} nullLabel="—" /></Td>
            <Td align="right"><NullableNumIn editing={ed.editing && r.is_flexible} value={r.flex_max_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { flex_max_percent: v }))} nullLabel="—" /></Td>
            <Td align="right">{r.id ? (counts.get(r.id) ?? 0) : 0}</Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add band" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Channel Multipliers ── */

type DraftChannelMultiplier = Omit<ChannelMultiplierRow, "id"> & { id: string | null };

function ChannelMultipliersSection({
  rows,
  onPatch,
}: {
  rows: ChannelMultiplierRow[];
  onPatch: (r: ChannelMultiplierRow[]) => void;
}) {
  const ed = useSectionEditor<DraftChannelMultiplier[]>(
    rows as DraftChannelMultiplier[],
    "/api/commercial-policy/channel-multipliers",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          name: r.name,
          applies_to_tier: r.applies_to_tier,
          multiplier: Number(r.multiplier),
          margin_min_percent: r.margin_min_percent === null ? null : Number(r.margin_min_percent),
          margin_max_percent: r.margin_max_percent === null ? null : Number(r.margin_max_percent),
          sort_order: r.sort_order,
          is_active: r.is_active,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftChannelMultiplier, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        code: "",
        name: "",
        applies_to_tier: null,
        multiplier: 1,
        margin_min_percent: null,
        margin_max_percent: null,
        sort_order: maxOrder + 1,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Channel Multipliers"
      description="Sequential ladder applied to the base price to derive each channel's selling price."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as ChannelMultiplierRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Step", "Channel", "Customer Tier", "Margin Range %", "Multiplier (fallback)", "Active", ""]
          : ["Step", "Channel", "Customer Tier", "Margin Range %", "Multiplier (fallback)", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td align="right">
              {ed.editing
                ? <NumIn editing value={r.sort_order} integer onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { sort_order: v ?? 0 }))} />
                : r.sort_order}
            </Td>
            <Td><TextIn editing={ed.editing} value={r.name} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { name: v }))} /></Td>
            <Td><TextIn editing={ed.editing} value={r.applies_to_tier ?? ""} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { applies_to_tier: v || null }))} /></Td>
            <Td align="right">
              <RangeIn editing={ed.editing} lo={r.margin_min_percent} hi={r.margin_max_percent}
                onLo={(v) => ed.setDraft(updateAt(ed.draft, i, { margin_min_percent: v }))}
                onHi={(v) => ed.setDraft(updateAt(ed.draft, i, { margin_max_percent: v }))}
                suffix="%" />
            </Td>
            <Td align="right">
              {ed.editing ? (
                <NumIn editing value={r.multiplier} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { multiplier: v }))} step="0.0001" />
              ) : (
                <span className="tabular-nums">×{Number(r.multiplier).toFixed(4)}</span>
              )}
            </Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add channel" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Discount Tiers ── */

type DraftDiscountTier = Omit<DiscountTierRow, "id"> & { id: string | null };

function DiscountTiersSection({
  rows,
  onPatch,
}: {
  rows: DiscountTierRow[];
  onPatch: (r: DiscountTierRow[]) => void;
}) {
  const ed = useSectionEditor<DraftDiscountTier[]>(
    rows as DraftDiscountTier[],
    "/api/commercial-policy/discount-tiers",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          label: r.label,
          min_percent: Number(r.min_percent),
          max_percent: r.max_percent === null ? null : Number(r.max_percent),
          approver_role: r.approver_role,
          is_active: r.is_active,
          sort_order: r.sort_order,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftDiscountTier, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        code: "",
        label: "",
        min_percent: 0,
        max_percent: null,
        approver_role: "salesperson",
        sort_order: maxOrder + 1,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Discount Approval Tiers"
      description="Who can approve what size of discount."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as DiscountTierRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Tier", "Min %", "Max %", "Approver Role", "Active", ""]
          : ["Tier", "Min %", "Max %", "Approver Role", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td><TextIn editing={ed.editing} value={r.label} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { label: v }))} /></Td>
            <Td align="right"><PctIn editing={ed.editing} value={r.min_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { min_percent: v }))} /></Td>
            <Td align="right"><NullableNumIn editing={ed.editing} value={r.max_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { max_percent: v }))} nullLabel="unlimited" suffix="%" /></Td>
            <Td><TextIn editing={ed.editing} value={r.approver_role} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { approver_role: v }))} /></Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add tier" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Commission Tiers ── */

type DraftCommissionTier = Omit<CommissionTierRow, "id"> & { id: string | null };

function CommissionTiersSection({
  rows,
  onPatch,
}: {
  rows: CommissionTierRow[];
  onPatch: (r: CommissionTierRow[]) => void;
}) {
  const ed = useSectionEditor<DraftCommissionTier[]>(
    rows as DraftCommissionTier[],
    "/api/commercial-policy/commission-tiers",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          name: r.name,
          rate_percent: Number(r.rate_percent),
          applies_to: r.applies_to,
          is_active: r.is_active,
          sort_order: r.sort_order,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftCommissionTier, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        code: "",
        name: "",
        rate_percent: 0,
        applies_to: "All sales",
        sort_order: maxOrder + 1,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Commission Tiers"
      description="Applied to invoice amount (not margin). Never reduced by discounts."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as CommissionTierRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Tier", "Rate %", "Applies To", "Active", ""]
          : ["Tier", "Rate %", "Applies To", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td><TextIn editing={ed.editing} value={r.name} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { name: v }))} /></Td>
            <Td align="right"><PctIn editing={ed.editing} value={r.rate_percent} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { rate_percent: v }))} /></Td>
            <Td><TextIn editing={ed.editing} value={r.applies_to} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { applies_to: v }))} /></Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add tier" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Volume Discount Tiers ── */

type DraftVolumeDiscountTier = Omit<VolumeDiscountTierRow, "id"> & { id: string | null };

function VolumeDiscountTiersSection({
  rows,
  onPatch,
}: {
  rows: VolumeDiscountTierRow[];
  onPatch: (r: VolumeDiscountTierRow[]) => void;
}) {
  const ed = useSectionEditor<DraftVolumeDiscountTier[]>(
    rows as DraftVolumeDiscountTier[],
    "/api/commercial-policy/volume-discount-tiers",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          name: r.name,
          min_order_usd: Number(r.min_order_usd),
          max_order_usd: r.max_order_usd === null ? null : Number(r.max_order_usd),
          discount_min_percent: Number(r.discount_min_percent),
          discount_max_percent: Number(r.discount_max_percent),
          sort_order: r.sort_order,
          is_active: r.is_active,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftVolumeDiscountTier, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        code: "",
        name: "",
        min_order_usd: 0,
        max_order_usd: null,
        discount_min_percent: 0,
        discount_max_percent: 0,
        sort_order: maxOrder + 1,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Volume Discount Tiers"
      description="Auto-applied discount steps based on order size. Separate from the approval-gated discount tiers above."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as VolumeDiscountTierRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Tier", "Min Order (USD)", "Max Order (USD)", "Discount Range %", "Active", ""]
          : ["Tier", "Min Order (USD)", "Max Order (USD)", "Discount Range %", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td><TextIn editing={ed.editing} value={r.name} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { name: v }))} /></Td>
            <Td align="right"><NumIn editing={ed.editing} value={r.min_order_usd} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { min_order_usd: v }))} /></Td>
            <Td align="right"><NullableNumIn editing={ed.editing} value={r.max_order_usd} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { max_order_usd: v }))} nullLabel="∞" /></Td>
            <Td align="right">
              <RangeIn editing={ed.editing} lo={r.discount_min_percent} hi={r.discount_max_percent}
                onLo={(v) => ed.setDraft(updateAt(ed.draft, i, { discount_min_percent: v ?? 0 }))}
                onHi={(v) => ed.setDraft(updateAt(ed.draft, i, { discount_max_percent: v ?? 0 }))}
                suffix="%" />
            </Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add tier" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ── Approval Authority ── */

type DraftApprovalAuthority = Omit<ApprovalAuthorityRow, "id"> & { id: string | null };

function ApprovalAuthoritySection({
  rows,
  onPatch,
}: {
  rows: ApprovalAuthorityRow[];
  onPatch: (r: ApprovalAuthorityRow[]) => void;
}) {
  const ed = useSectionEditor<DraftApprovalAuthority[]>(
    rows as DraftApprovalAuthority[],
    "/api/commercial-policy/approval-authority",
    (draft, deletedIds) => ({
      rows: draft.map((r) => {
        const body = {
          level: Number(r.level),
          role_label: r.role_label,
          can_approve: r.can_approve,
          is_active: r.is_active,
          sort_order: r.sort_order,
        };
        return r.id ? { id: r.id, ...body } : body;
      }),
      deletedIds,
    }),
  );

  const handleDelete = (row: DraftApprovalAuthority, idx: number) => {
    if (row.id) ed.queueDelete(row.id);
    ed.setDraft(removeAt(ed.draft, idx));
  };
  const handleAdd = () => {
    const maxOrder = ed.draft.length ? Math.max(...ed.draft.map((r) => r.sort_order)) : 0;
    const maxLevel = ed.draft.length ? Math.max(...ed.draft.map((r) => r.level)) : 0;
    ed.setDraft([
      ...ed.draft,
      {
        id: null,
        tenant_id: "",
        level: maxLevel + 1,
        role_slug: "",
        role_label: "",
        can_approve: [],
        sort_order: maxOrder + 1,
        is_active: true,
      },
    ]);
  };

  return (
    <SectionShell
      title="Approval Authority"
      description="Who can approve which decisions. No one can approve above their level — requests auto-escalate."
      editing={ed.editing}
      saving={ed.saving}
      onEditStart={ed.begin}
      onCancel={ed.cancel}
      onSave={async () => { const fresh = await ed.save(); if (fresh) onPatch(fresh as ApprovalAuthorityRow[]); }}
    >
      <ResponsiveTable
        head={ed.editing
          ? ["Level", "Role", "Can Approve (comma-separated)", "Active", ""]
          : ["Level", "Role", "Can Approve (comma-separated)", "Active"]}
        rows={ed.draft.map((r, i) => (
          <tr key={r.id ?? `new-${i}`} className="border-t border-[var(--border-subtle)]/60">
            <Td align="right">
              {ed.editing ? (
                <NumIn editing value={r.level} integer onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { level: v ?? 1 }))} />
              ) : (
                r.level
              )}
            </Td>
            <Td><TextIn editing={ed.editing} value={r.role_label} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { role_label: v }))} /></Td>
            <Td>
              {ed.editing ? (
                <input
                  type="text"
                  value={r.can_approve.join(", ")}
                  onChange={(e) =>
                    ed.setDraft(
                      updateAt(ed.draft, i, {
                        can_approve: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                    )
                  }
                  className={inputCls}
                />
              ) : (
                <span className="text-[12px] text-[var(--text-muted)]">
                  {r.can_approve.length ? r.can_approve.map((s) => s.replace(/_/g, " ")).join(", ") : "—"}
                </span>
              )}
            </Td>
            <Td><BoolIn editing={ed.editing} value={r.is_active} onChange={(v) => ed.setDraft(updateAt(ed.draft, i, { is_active: v }))} /></Td>
            {ed.editing && <Td align="right"><DeleteRowBtn onClick={() => handleDelete(r, i)} /></Td>}
          </tr>
        ))}
      />
      {ed.editing && <AddRowButton onClick={handleAdd} label="Add role" />}
      {ed.error && <ErrorLine message={ed.error} />}
    </SectionShell>
  );
}

/* ─── Tiny input & display primitives ─────────────────────── */

const inputCls =
  "w-full min-w-0 h-7 px-2 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] tabular-nums";

function TextIn({
  editing, value, onChange,
}: { editing: boolean; value: string; onChange: (v: string) => void }) {
  if (!editing) return <span>{value || "—"}</span>;
  return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />;
}

function NumIn({
  editing, value, onChange, step, integer,
}: {
  editing: boolean;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  integer?: boolean;
}) {
  if (!editing) {
    return <span className="tabular-nums">{fmtInt(value)}</span>;
  }
  return (
    <input
      type="number"
      step={step ?? (integer ? "1" : "any")}
      value={value}
      onChange={(e) => {
        const n = integer ? parseInt(e.target.value, 10) : Number(e.target.value);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      className={inputCls + " text-right"}
    />
  );
}

function PctIn({
  editing, value, onChange,
}: { editing: boolean; value: number; onChange: (v: number) => void }) {
  if (!editing) return <span className="tabular-nums">{fmtPct(value)}</span>;
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={inputCls + " text-right max-w-[96px]"}
      />
      <span className="text-[11px] text-[var(--text-dim)]">%</span>
    </div>
  );
}

function SignedPctIn({
  editing, value, onChange,
}: { editing: boolean; value: number; onChange: (v: number) => void }) {
  if (!editing) return <span className="tabular-nums">{fmtSignedPct(value)}</span>;
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        step="0.1"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={inputCls + " text-right max-w-[96px]"}
      />
      <span className="text-[11px] text-[var(--text-dim)]">%</span>
    </div>
  );
}

/** Two-value min/max range editor (e.g. "7 – 12 %"). Both values
 *  share the same suffix; accepts nulls so a partially-filled row
 *  shows "—" in read-only mode. */
function RangeIn({
  editing, lo, hi, onLo, onHi, suffix,
}: {
  editing: boolean;
  lo: number | null;
  hi: number | null;
  onLo: (v: number | null) => void;
  onHi: (v: number | null) => void;
  suffix?: string;
}) {
  if (!editing) {
    if (lo === null && hi === null) return <span className="text-[var(--text-dim)]">—</span>;
    if (lo === null || hi === null) {
      const val = lo ?? hi ?? 0;
      return <span className="tabular-nums">{fmtPct(val)}</span>;
    }
    if (lo === hi) return <span className="tabular-nums">{fmtPct(lo)}</span>;
    return <span className="tabular-nums">{fmtInt(lo)}{suffix ?? ""} – {fmtInt(hi)}{suffix ?? ""}</span>;
  }
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        value={lo ?? ""}
        step="0.1"
        onChange={(e) => {
          const raw = e.target.value.trim();
          onLo(raw === "" ? null : Number(raw));
        }}
        className={inputCls + " text-right max-w-[72px]"}
        placeholder="min"
      />
      <span className="text-[11px] text-[var(--text-dim)]">–</span>
      <input
        type="number"
        value={hi ?? ""}
        step="0.1"
        onChange={(e) => {
          const raw = e.target.value.trim();
          onHi(raw === "" ? null : Number(raw));
        }}
        className={inputCls + " text-right max-w-[72px]"}
        placeholder="max"
      />
      {suffix && <span className="text-[11px] text-[var(--text-dim)]">{suffix}</span>}
    </div>
  );
}

function NullableNumIn({
  editing, value, onChange, nullLabel, integer, suffix,
}: {
  editing: boolean;
  value: number | null;
  onChange: (v: number | null) => void;
  nullLabel: string;
  integer?: boolean;
  suffix?: string;
}) {
  if (!editing) {
    return (
      <span className="tabular-nums">
        {value === null ? nullLabel : integer ? fmtInt(value) : `${fmtInt(value)}${suffix ?? ""}`}
      </span>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      <input
        type="number"
        value={value ?? ""}
        step={integer ? "1" : "any"}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") return onChange(null);
          const n = integer ? parseInt(raw, 10) : Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
        className={inputCls + " text-right max-w-[110px]"}
        placeholder={nullLabel}
      />
      {suffix && <span className="text-[11px] text-[var(--text-dim)]">{suffix}</span>}
    </div>
  );
}

function BoolIn({
  editing, value, onChange,
}: { editing: boolean; value: boolean; onChange: (v: boolean) => void }) {
  if (!editing) {
    return (
      <span className={`text-[11px] font-semibold ${value ? "text-emerald-300" : "text-[var(--text-dim)]"}`}>
        {value ? "Yes" : "No"}
      </span>
    );
  }
  return (
    <label className="inline-flex items-center gap-1 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-[var(--bg-inverted)]"
      />
      <span className="text-[11px] text-[var(--text-muted)]">{value ? "Yes" : "No"}</span>
    </label>
  );
}

function Td({
  children, align,
}: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <td
      className={`px-5 py-2.5 text-${align ?? "left"} text-[var(--text-primary)] text-[12px] tabular-nums`}
      style={{ whiteSpace: align === "right" ? "nowrap" : undefined }}
    >
      {children}
    </td>
  );
}

function ResponsiveTable({
  head, rows,
}: { head: string[]; rows: React.ReactNode }) {
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {head.map((h, i) => (
              <th key={i} className={`px-5 pb-2 ${h === "Active" || h.endsWith("%") || h.startsWith("Credit ×") || h === "Credit Days" || h === "Step" || h === "Level" ? "text-right" : "text-left"} whitespace-nowrap`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
  );
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>;
}

function KpiReadonly({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      <div className="text-[18px] font-semibold tabular-nums mt-1 text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function KpiEditable({
  label, value, editing, onChange, renderValue, type = "text", step,
}: {
  label: string;
  value: string | number;
  editing: boolean;
  onChange: (v: string | number) => void;
  renderValue?: (v: string | number) => string;
  type?: "text" | "number";
  step?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      {!editing ? (
        <div className="text-[18px] font-semibold tabular-nums mt-1 text-[var(--text-primary)]">
          {renderValue ? renderValue(value) : value}
        </div>
      ) : (
        <input
          type={type}
          step={step}
          value={value}
          onChange={(e) => onChange(type === "number" ? Number(e.target.value) : e.target.value)}
          className={inputCls + " mt-1 text-[16px] h-9"}
        />
      )}
    </div>
  );
}

function KpiBool({
  label, value, editing, onChange, hintTrue, hintFalse,
}: {
  label: string;
  value: boolean;
  editing: boolean;
  onChange: (v: boolean) => void;
  hintTrue?: string;
  hintFalse?: string;
}) {
  const tone = value ? "text-amber-300" : "text-emerald-300";
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">{label}</div>
      {!editing ? (
        <>
          <div className={`text-[18px] font-semibold mt-1 ${tone}`}>{value ? "Yes" : "No"}</div>
          {(value ? hintTrue : hintFalse) && (
            <div className="text-[10px] text-[var(--text-dim)] mt-1 leading-relaxed">
              {value ? hintTrue : hintFalse}
            </div>
          )}
        </>
      ) : (
        <label className="mt-2 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-[var(--bg-inverted)] h-4 w-4"
          />
          <span className="text-[14px] text-[var(--text-primary)]">{value ? "Yes" : "No"}</span>
        </label>
      )}
    </div>
  );
}

function ErrorLine({ message }: { message: string }) {
  return (
    <div className="mt-4 text-[11px] text-red-300 bg-red-500/[0.08] border border-red-500/20 rounded-lg px-3 py-2">
      {message}
    </div>
  );
}

/* ─── Pure helpers ────────────────────────────────────────── */

function updateAt<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
}
function removeAt<T>(arr: T[], i: number): T[] {
  return arr.filter((_, idx) => idx !== i);
}

/** Small trash icon used inline in the row when editing. Kept as a
 *  local component to avoid pulling in a second icon library just for
 *  this one glyph. */
function DeleteRowBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Delete row"
      title="Delete row"
      className="h-7 w-7 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-red-400 hover:border-red-500/30 flex items-center justify-center transition-colors"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </svg>
    </button>
  );
}

/** "+ Add row" pill below each editable table. Full width, dashed
 *  border so it's clearly a target; collapses visually when the
 *  section is read-only (the caller only renders it while editing). */
function AddRowButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 w-full h-9 rounded-xl border border-dashed border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)] transition-colors flex items-center justify-center gap-1.5"
    >
      <span className="text-[14px] leading-none">+</span>
      <span>{label}</span>
    </button>
  );
}
function fmtInt(n: number): string {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}
function fmtPct(n: number): string {
  const v = Number(n);
  const s = v.toFixed(3).replace(/\.?0+$/, "");
  return `${s}%`;
}
function fmtSignedPct(n: number): string {
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${fmtPct(v)}`;
}
