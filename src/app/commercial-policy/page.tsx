"use client";

/* ---------------------------------------------------------------------------
   /commercial-policy — Phase 2 shell.
   Read-only view of every section of the Koleex Commercial Policy. The
   data comes from the commercial_* tables seeded in Phase 1, so what
   you see here is what the pricing engine will (once Phase 4 rewires
   it) use. Edits come in Phase 3.

   Access: gated server-side at /api/commercial-policy (super_admin /
   admin / general_manager only). The AuthGate handles the sign-in
   wall; the API 403 surfaces a clear "not authorised" message for
   non-admin signed-in users.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGate from "@/components/admin/AuthGate";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import CommercialPolicyIcon from "@/components/icons/CommercialPolicyIcon";
import InfoIcon from "@/components/icons/ui/InfoIcon";
import type {
  CommercialPolicySnapshot,
  ProductLevelRow,
  CustomerTierRow,
  MarketBandRow,
  BandCountryRow,
  ChannelMultiplierRow,
  DiscountTierRow,
  CommissionTierRow,
  ApprovalAuthorityRow,
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

function CommercialPolicyView() {
  const [snapshot, setSnapshot] = useState<CommercialPolicySnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/commercial-policy", { credentials: "include" });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          if (!cancelled) setError(body.error ?? `Failed to load (${res.status}).`);
          return;
        }
        const data = (await res.json()) as CommercialPolicySnapshot;
        if (!cancelled) setSnapshot(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* Header */}
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
            Read-only view · Edits arrive in the next release
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
          {loading && <LoadingState />}
          {!loading && error && <ErrorState message={error} />}
          {!loading && !error && snapshot && <PolicyBody s={snapshot} />}
        </div>
      </div>
    </div>
  );
}

/* ─── States ──────────────────────────────────────────────── */

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
        <div className="text-[13px] font-semibold text-red-300">Can't load the policy</div>
        <div className="text-[12px] text-[var(--text-dim)] mt-1">{message}</div>
      </div>
    </div>
  );
}

/* ─── Body ────────────────────────────────────────────────── */

function PolicyBody({ s }: { s: CommercialPolicySnapshot }) {
  return (
    <>
      <InfoBanner />
      <SettingsSection settings={s.settings} />
      <ProductLevelsSection rows={s.productLevels} />
      <CustomerTiersSection rows={s.customerTiers} />
      <MarketBandsSection bands={s.marketBands} countries={s.bandCountries} />
      <ChannelMultipliersSection rows={s.channelMultipliers} />
      <DiscountTiersSection rows={s.discountTiers} />
      <CommissionTiersSection rows={s.commissionTiers} />
      <ApprovalAuthoritySection rows={s.approvalAuthority} />
    </>
  );
}

function InfoBanner() {
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-5 py-4 flex items-start gap-3">
      <InfoIcon className="h-4 w-4 text-[var(--text-dim)] mt-0.5 shrink-0" />
      <div className="min-w-0 text-[12px] text-[var(--text-muted)] leading-relaxed">
        These are the rules the pricing engine will use once Phase 4 wires
        them through. Numbers below are seeded verbatim from the published
        Commercial Policy. Editing lands in the next release — this page
        is read-only for now.
      </div>
    </div>
  );
}

/* ─── Section: Settings ─── */

function SettingsSection({ settings }: { settings: CommercialPolicySnapshot["settings"] }) {
  if (!settings) {
    return (
      <Section title="Settings" description="No settings row yet for this tenant.">
        <div className="text-[12px] text-[var(--text-dim)]">—</div>
      </Section>
    );
  }
  return (
    <Section title="Settings" description="Tenant-level knobs that apply to the whole policy.">
      <KpiGrid>
        <Kpi label="FX · CNY per USD" value={settings.fx_cny_per_usd.toFixed(4)} />
        <Kpi
          label="Sales sees cost"
          value={settings.sales_sees_cost ? "Yes" : "No"}
          tone={settings.sales_sees_cost ? "warn" : "ok"}
          hint={settings.sales_sees_cost ? "Sales users can view KOLEEX cost — policy says No." : "Sales users cannot view KOLEEX cost."}
        />
        <Kpi label="Policy version" value={settings.policy_version} />
      </KpiGrid>
    </Section>
  );
}

/* ─── Section: Product Levels ─── */

function ProductLevelsSection({ rows }: { rows: ProductLevelRow[] }) {
  return (
    <Section title="Product Levels" description="KOLEEX cost (CNY) auto-detects the level; level carries the default + minimum margin.">
      <DataTable
        columns={[
          { key: "code",               label: "Code" },
          { key: "name",               label: "Name" },
          { key: "range",              label: "Cost Range (CNY)" },
          { key: "margin_percent",     label: "Default Margin", align: "right" },
          { key: "min_margin_percent", label: "Min Margin",     align: "right" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          code: r.code,
          name: r.name,
          range: `${fmtInt(r.min_cost_cny)} – ${r.max_cost_cny === null ? "∞" : fmtInt(r.max_cost_cny)}`,
          margin_percent: fmtPct(r.margin_percent),
          min_margin_percent: fmtPct(r.min_margin_percent),
        }))}
      />
    </Section>
  );
}

/* ─── Section: Customer Tiers ─── */

function CustomerTiersSection({ rows }: { rows: CustomerTierRow[] }) {
  return (
    <Section title="Customer Tiers" description="Classification for every customer. Drives discount caps, credit, and market rights.">
      <DataTable
        columns={[
          { key: "level_number",         label: "Level" },
          { key: "name",                 label: "Tier" },
          { key: "real_name",            label: "Commercial Role" },
          { key: "discount_cap_percent", label: "Discount Cap", align: "right" },
          { key: "credit",               label: "Credit" },
          { key: "credit_days",          label: "Credit Days", align: "right" },
          { key: "market_rights",        label: "Market Rights" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          level_number: r.level_number,
          name: r.name,
          real_name: r.real_name ?? "—",
          discount_cap_percent: fmtPct(r.discount_cap_percent),
          credit: r.has_credit
            ? r.credit_multiplier
              ? `${r.credit_multiplier}× avg monthly`
              : "Contract-based"
            : "None",
          credit_days: r.credit_days !== null ? r.credit_days : "—",
          market_rights: r.market_rights ?? "—",
        }))}
      />
    </Section>
  );
}

/* ─── Section: Market Bands ─── */

function MarketBandsSection({
  bands,
  countries,
}: {
  bands: MarketBandRow[];
  countries: BandCountryRow[];
}) {
  const counts = new Map<string, number>();
  for (const c of countries) counts.set(c.band_id, (counts.get(c.band_id) ?? 0) + 1);

  return (
    <Section title="Market Bands" description="Retail-price adjustment by market. Each country maps to one band.">
      <DataTable
        columns={[
          { key: "code",               label: "Band" },
          { key: "label",              label: "Label" },
          { key: "adjustment_percent", label: "Retail Adjustment", align: "right" },
          { key: "flex",               label: "Flex Range" },
          { key: "countries",          label: "Countries Mapped", align: "right" },
        ]}
        rows={bands.map((b) => ({
          id: b.id,
          code: b.code,
          label: b.label ?? b.name,
          adjustment_percent: fmtSignedPct(b.adjustment_percent),
          flex: b.is_flexible
            ? `${fmtSignedPct(b.flex_min_percent ?? 0)} to ${fmtSignedPct(b.flex_max_percent ?? 0)}`
            : "—",
          countries: counts.get(b.id) ?? 0,
        }))}
      />
    </Section>
  );
}

/* ─── Section: Channel Multipliers ─── */

function ChannelMultipliersSection({ rows }: { rows: ChannelMultiplierRow[] }) {
  return (
    <Section title="Channel Multipliers" description="Sequential ladder applied to the base price to derive each channel's selling price.">
      <DataTable
        columns={[
          { key: "sort_order",     label: "Step", align: "right" },
          { key: "name",           label: "Channel" },
          { key: "applies_to_tier",label: "Customer Tier" },
          { key: "multiplier",     label: "Multiplier", align: "right" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          sort_order: r.sort_order,
          name: r.name,
          applies_to_tier: r.applies_to_tier ?? "—",
          multiplier: `×${r.multiplier.toFixed(4)}`,
        }))}
      />
    </Section>
  );
}

/* ─── Section: Discount Tiers ─── */

function DiscountTiersSection({ rows }: { rows: DiscountTierRow[] }) {
  return (
    <Section title="Discount Approval Tiers" description="Who can approve what size of discount.">
      <DataTable
        columns={[
          { key: "label",          label: "Tier" },
          { key: "range",          label: "Discount Range", align: "right" },
          { key: "approver_role",  label: "Approver Role" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          label: r.label,
          range: `${fmtPct(r.min_percent)} – ${r.max_percent === null ? "unlimited" : fmtPct(r.max_percent)}`,
          approver_role: r.approver_role,
        }))}
      />
    </Section>
  );
}

/* ─── Section: Commission Tiers ─── */

function CommissionTiersSection({ rows }: { rows: CommissionTierRow[] }) {
  return (
    <Section title="Commission Tiers" description="Applied to invoice amount (not margin). Never reduced by discounts.">
      <DataTable
        columns={[
          { key: "name",         label: "Tier" },
          { key: "rate_percent", label: "Rate", align: "right" },
          { key: "applies_to",   label: "Applies To" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          name: r.name,
          rate_percent: fmtPct(r.rate_percent),
          applies_to: r.applies_to,
        }))}
      />
    </Section>
  );
}

/* ─── Section: Approval Authority ─── */

function ApprovalAuthoritySection({ rows }: { rows: ApprovalAuthorityRow[] }) {
  return (
    <Section title="Approval Authority" description="Who can approve which decisions. No one can approve above their level — requests auto-escalate up the chain.">
      <DataTable
        columns={[
          { key: "level",      label: "Level", align: "right" },
          { key: "role_label", label: "Role" },
          { key: "can_approve",label: "Can Approve" },
        ]}
        rows={rows.map((r) => ({
          id: r.id,
          level: r.level,
          role_label: r.role_label,
          can_approve: r.can_approve.length
            ? r.can_approve.map((s) => s.replace(/_/g, " ")).join(", ")
            : "—",
        }))}
      />
    </Section>
  );
}

/* ─── Reusable bits ─────────────────────────────────────────── */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-[var(--border-subtle)]">
        <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">{title}</h2>
        {description && (
          <p className="text-[11px] text-[var(--text-dim)] mt-1">{description}</p>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{children}</div>;
}

function Kpi({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string | number;
  tone?: "ok" | "warn" | "neutral";
  hint?: string;
}) {
  const toneClass =
    tone === "warn"
      ? "text-amber-300"
      : tone === "ok"
        ? "text-emerald-300"
        : "text-[var(--text-primary)]";
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </div>
      <div className={`text-[18px] font-semibold tabular-nums mt-1 ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-[var(--text-dim)] mt-1 leading-relaxed">{hint}</div>}
    </div>
  );
}

interface Col<R> {
  key: keyof R | string;
  label: string;
  align?: "left" | "right";
}

function DataTable<R extends { id: string } & Record<string, unknown>>({
  columns,
  rows,
}: {
  columns: Col<R>[];
  rows: R[];
}) {
  if (rows.length === 0) {
    return (
      <div className="text-[12px] text-[var(--text-dim)] py-2">No data.</div>
    );
  }
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
            {columns.map((c) => (
              <th
                key={String(c.key)}
                className={`px-5 pb-2 text-${c.align ?? "left"} whitespace-nowrap`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-t border-[var(--border-subtle)]/60 hover:bg-[var(--bg-surface-subtle)]/40 transition-colors"
            >
              {columns.map((c) => (
                <td
                  key={String(c.key)}
                  className={`px-5 py-2.5 text-${c.align ?? "left"} text-[var(--text-primary)] tabular-nums whitespace-nowrap`}
                >
                  {String(row[c.key as keyof R] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Formatters ────────────────────────────────────────────── */

function fmtInt(n: number): string {
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtPct(n: number): string {
  // Strip trailing zeros. 5.000 -> 5%, 2.500 -> 2.5%
  const v = Number(n);
  const s = v.toFixed(3).replace(/\.?0+$/, "");
  return `${s}%`;
}
function fmtSignedPct(n: number): string {
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${fmtPct(v)}`;
}
