import "server-only";

/* ---------------------------------------------------------------------------
   commercial-policy — typed server-side reader for the editable Commercial
   Policy configuration (Phase 1: read-only).

   Every call is tenant-scoped. Data source is the `commercial_*` tables
   seeded from the Koleex Commercial Policy spec. Writes land in a later
   phase — this file is the single source of truth that the production
   pricing engine, the admin app, and any future quotation/approval
   code should call into.

   All rows return in `sort_order` so the UI and the engine iterate in the
   policy's canonical order (L1 before L2, Silver before Gold, Band A
   before Band B, Salesperson before CEO, …).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "./supabase-server";

/* ─── Types (mirror the DB columns exactly) ──────────────── */

export interface CommercialSettingsRow {
  id: string;
  tenant_id: string;
  fx_cny_per_usd: number;
  sales_sees_cost: boolean;
  /** Aggregate uplift applied to raw KOLEEX cost to approximate the
   *  Net Internal Cost (export docs, packaging, bank charges, warranty
   *  reserve − tax refund). Single-knob until the full breakdown is
   *  modelled. Defaults to 0 so legacy callers keep their numbers. */
  cost_uplift_percent: number;
  /** Feature flag for the policy-driven pricing engine (Phase 4).
   *  When true, the engine falls back to computing from the
   *  commercial_* tables (12-step flow) for lines without an explicit
   *  override or market price. Defaults to false — legacy behaviour. */
  use_policy_engine: boolean;
  policy_version: string;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface ProductLevelRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  sort_order: number;
  min_cost_cny: number;
  max_cost_cny: number | null;
  margin_percent: number;
  /** Portal-aligned margin range; engine picks a value inside it
   *  based on customer / region / competition. Falls back to
   *  margin_percent when null. */
  margin_min_percent: number | null;
  margin_max_percent: number | null;
  min_margin_percent: number;
  is_active: boolean;
}

export interface CustomerTierRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  real_name: string | null;
  level_number: number;
  sort_order: number;
  has_credit: boolean;
  credit_multiplier: number | null;
  credit_days: number | null;
  discount_cap_percent: number;
  market_rights: string | null;
  is_active: boolean;
}

export interface MarketBandRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  label: string | null;
  adjustment_percent: number;
  is_flexible: boolean;
  flex_min_percent: number | null;
  flex_max_percent: number | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface BandCountryRow {
  id: string;
  tenant_id: string;
  band_id: string;
  country_code: string;
}

export interface ChannelMultiplierRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  applies_to_tier: string | null;
  multiplier: number;
  /** Portal-aligned true-margin range. Engine applies
   *  Price = Parent / (1 − margin%) using a value inside this range.
   *  Falls back to `multiplier` when null (terminal channels like
   *  retail_global typically have null). */
  margin_min_percent: number | null;
  margin_max_percent: number | null;
  sort_order: number;
  is_active: boolean;
}

export interface VolumeDiscountTierRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  min_order_usd: number;
  max_order_usd: number | null;
  discount_min_percent: number;
  discount_max_percent: number;
  sort_order: number;
  is_active: boolean;
}

export interface DiscountTierRow {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  min_percent: number;
  max_percent: number | null;
  approver_role: string;
  sort_order: number;
  is_active: boolean;
}

export interface CommissionTierRow {
  id: string;
  tenant_id: string;
  code: string;
  name: string;
  rate_percent: number;
  applies_to: string;
  sort_order: number;
  is_active: boolean;
}

export interface ApprovalAuthorityRow {
  id: string;
  tenant_id: string;
  level: number;
  role_slug: string;
  role_label: string;
  can_approve: string[];
  sort_order: number;
  is_active: boolean;
}

/** Full snapshot of the commercial policy for a tenant. Convenient for
 *  the admin app (load once, render all sections) and for the pricing
 *  engine's config-resolve step. */
export interface CommercialPolicySnapshot {
  settings: CommercialSettingsRow | null;
  productLevels: ProductLevelRow[];
  customerTiers: CustomerTierRow[];
  marketBands: MarketBandRow[];
  bandCountries: BandCountryRow[];
  channelMultipliers: ChannelMultiplierRow[];
  discountTiers: DiscountTierRow[];
  commissionTiers: CommissionTierRow[];
  approvalAuthority: ApprovalAuthorityRow[];
  volumeDiscountTiers: VolumeDiscountTierRow[];
}

/* ─── Readers ─────────────────────────────────────────────── */

export async function getSettings(tenantId: string): Promise<CommercialSettingsRow | null> {
  const { data } = await supabaseServer
    .from("commercial_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  return (data as CommercialSettingsRow | null) ?? null;
}

export async function getProductLevels(tenantId: string): Promise<ProductLevelRow[]> {
  const { data } = await supabaseServer
    .from("commercial_product_levels")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (data as ProductLevelRow[]) ?? [];
}

export async function getCustomerTiers(tenantId: string): Promise<CustomerTierRow[]> {
  const { data } = await supabaseServer
    .from("commercial_customer_tiers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (data as CustomerTierRow[]) ?? [];
}

export async function getMarketBands(tenantId: string): Promise<MarketBandRow[]> {
  const { data } = await supabaseServer
    .from("commercial_market_bands")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (data as MarketBandRow[]) ?? [];
}

export async function getBandCountries(tenantId: string): Promise<BandCountryRow[]> {
  const { data } = await supabaseServer
    .from("commercial_band_countries")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("country_code", { ascending: true });
  return (data as BandCountryRow[]) ?? [];
}

export async function getChannelMultipliers(tenantId: string): Promise<ChannelMultiplierRow[]> {
  const { data } = await supabaseServer
    .from("commercial_channel_multipliers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (data as ChannelMultiplierRow[]) ?? [];
}

export async function getDiscountTiers(tenantId: string): Promise<DiscountTierRow[]> {
  const { data } = await supabaseServer
    .from("commercial_discount_tiers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (data as DiscountTierRow[]) ?? [];
}

export async function getCommissionTiers(tenantId: string): Promise<CommissionTierRow[]> {
  const { data } = await supabaseServer
    .from("commercial_commission_tiers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (data as CommissionTierRow[]) ?? [];
}

export async function getApprovalAuthority(tenantId: string): Promise<ApprovalAuthorityRow[]> {
  const { data } = await supabaseServer
    .from("commercial_approval_authority")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("level", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data as ApprovalAuthorityRow[]) ?? [];
}

export async function getVolumeDiscountTiers(tenantId: string): Promise<VolumeDiscountTierRow[]> {
  const { data } = await supabaseServer
    .from("commercial_volume_discount_tiers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });
  return (data as VolumeDiscountTierRow[]) ?? [];
}

/** Load every section in parallel. One network round-trip to Supabase
 *  (supabaseServer uses HTTP keep-alive + pools), ~9 parallel queries.
 *  Admin app uses this to render the whole policy page without a stagger. */
export async function getPolicySnapshot(tenantId: string): Promise<CommercialPolicySnapshot> {
  const [
    settings,
    productLevels,
    customerTiers,
    marketBands,
    bandCountries,
    channelMultipliers,
    discountTiers,
    commissionTiers,
    approvalAuthority,
    volumeDiscountTiers,
  ] = await Promise.all([
    getSettings(tenantId),
    getProductLevels(tenantId),
    getCustomerTiers(tenantId),
    getMarketBands(tenantId),
    getBandCountries(tenantId),
    getChannelMultipliers(tenantId),
    getDiscountTiers(tenantId),
    getCommissionTiers(tenantId),
    getApprovalAuthority(tenantId),
    getVolumeDiscountTiers(tenantId),
  ]);

  return {
    settings,
    productLevels,
    customerTiers,
    marketBands,
    bandCountries,
    channelMultipliers,
    discountTiers,
    commissionTiers,
    approvalAuthority,
    volumeDiscountTiers,
  };
}

/* ─── Helpers (pure — no DB round-trip) ─────────────────────── */

/** Pick the product level for a given KOLEEX cost (in CNY). Assumes the
 *  levels array is sorted by sort_order ascending and that cost bands
 *  are contiguous. Returns null if no level matches (should never happen
 *  with the seeded data: L4 is open-ended). */
export function detectProductLevel(
  levels: ProductLevelRow[],
  costCny: number,
): ProductLevelRow | null {
  for (const lvl of levels) {
    if (!lvl.is_active) continue;
    if (costCny < lvl.min_cost_cny) continue;
    if (lvl.max_cost_cny === null || costCny <= lvl.max_cost_cny) return lvl;
  }
  return null;
}

/** Get the band for a given country code (ISO-2). Returns the full
 *  MarketBandRow or null if the country isn't mapped. Caller decides
 *  what to do on null — typically fall back to Band B (Balanced). */
export function resolveCountryBand(
  bands: MarketBandRow[],
  bandCountries: BandCountryRow[],
  countryCode: string,
): MarketBandRow | null {
  const mapping = bandCountries.find((bc) => bc.country_code === countryCode);
  if (!mapping) return null;
  return bands.find((b) => b.id === mapping.band_id) ?? null;
}

/** Walk the discount tiers to find the one that should approve a given
 *  percent. Returns null if no tier covers it (should never happen —
 *  the top tier has max_percent=NULL meaning "unlimited"). */
export function resolveDiscountApprover(
  tiers: DiscountTierRow[],
  percent: number,
): DiscountTierRow | null {
  for (const tier of tiers) {
    if (!tier.is_active) continue;
    const max = tier.max_percent;
    if (percent >= tier.min_percent && (max === null || percent < max)) return tier;
  }
  return null;
}
