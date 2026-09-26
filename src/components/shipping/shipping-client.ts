"use client";

/* ---------------------------------------------------------------------------
   Shipping — the browser's client for /api/shipping/*.

   No database access, no provider knowledge. Reference lookups go through
   cachedGet so a picker that reopens does not pay the platform's per-request
   floor again; the rate search never caches, because a rate is the one thing
   that must be current or honestly labelled stale.
   --------------------------------------------------------------------------- */

import { cachedGet } from "@/lib/client-cache";
import type { PlaceNames } from "@/lib/shipping/place-names";
import type {
  ContainerEquipment, FreightRate, RateKind, RateQuery, ShippingMode, VolumetricRule,
} from "@/lib/shipping/types";

/** Mirrors CanonicalPort on the server. The two identifier fields are separate
    on purpose; see the header of src/lib/server/shipping/port-resolver.ts. */
export interface PortHit {
  id: string;
  /** UN/LOCODE, and only ever a UN/LOCODE. */
  locode: string | null;
  /** IATA, and only ever IATA. Set on airports. */
  iata?: string | null;
  codeSystem?: "unlocode" | "iata";
  name: string;
  nameOfficial: string | null;
  countryCode: string;
  countryName: string | null;
  lat: number | null;
  lng: number | null;
  seaRegion: string | null;
  harborSize: string | null;
  isContainer: boolean | null;
  inKoleexList: boolean;
  /** Approved Arabic / Chinese names — shown, never used to find a port. */
  names?: PlaceNames;
}

export interface AirportHit {
  id: string; iata: string; icao: string | null; locode: string | null;
  name: string; country_code: string; municipality: string | null;
  lat: number | null; lng: number | null; size: "large" | "medium";
}

export interface PortCountry { code: string; name: string | null; ports: number }

/* Reference data is identical for everyone and changes twice a year. An hour
   in memory means reopening the picker costs nothing. */
const REF_TTL = 60 * 60_000;

/** `nv`: the approved names' version (from loadRoutes). Part of the URL, so
 *  the hour-long cache is a new entry the moment a name is approved. */
export function searchPorts(opts: { q?: string; country?: string; origin?: boolean; limit?: number; nv?: string }): Promise<{ ports: PortHit[] }> {
  const p = new URLSearchParams({ kind: "ports" });
  if (opts.q) p.set("q", opts.q);
  if (opts.country) p.set("country", opts.country);
  if (opts.origin) p.set("origin", "1");
  if (opts.limit) p.set("limit", String(opts.limit));
  if (opts.nv) p.set("nv", opts.nv);
  return cachedGet<{ ports: PortHit[] }>(`/api/shipping/reference?${p}`, REF_TTL);
}

export function searchAirports(opts: { q?: string; country?: string; limit?: number }): Promise<{ airports: AirportHit[] }> {
  const p = new URLSearchParams({ kind: "airports" });
  if (opts.q) p.set("q", opts.q);
  if (opts.country) p.set("country", opts.country);
  if (opts.limit) p.set("limit", String(opts.limit));
  return cachedGet<{ airports: AirportHit[] }>(`/api/shipping/reference?${p}`, REF_TTL);
}

export function loadCountries(): Promise<{ countries: PortCountry[] }> {
  return cachedGet<{ countries: PortCountry[] }>("/api/shipping/reference?kind=countries", REF_TTL);
}

export interface ProviderStatusView {
  id: string; label: string; kind: RateKind;
  cadence: "realtime" | "daily" | "historical" | "manual";
  modes: ShippingMode[]; enabled: boolean; reason?: string; requires?: string;
}

export interface ComparisonGroupView {
  key: { mode: string; originCode: string; destinationCode: string; equipment: string; unit: string; currency: string; scope: string; inclusions: string };
  rates: FreightRate[];
  byKind: Record<RateKind, FreightRate[]>;
  best?: { rate: FreightRate; amount: number };
  spread?: { low: number; high: number; currency: string };
}

/** One provider's answer, successes and failures alike. The UI reads only the
    error KIND from this — a provider's name or message never reaches a rate
    card, only the Rate Sources section. */
export interface ProviderResultView {
  providerId: string;
  rates: FreightRate[];
  error?: { kind: string; detail?: string };
  elapsedMs?: number;
}

export interface RateSearchResponse {
  query: RateQuery;
  results: ProviderResultView[];
  byKind: Record<RateKind, FreightRate[]>;
  groups: ComparisonGroupView[];
  refusals: { a: string; b: string; reasons: string[] }[];
  providers: ProviderStatusView[];
  servedFromCache: boolean;
  searchedAt: string;
  unavailable?: { reason: "no_sources" | "no_rates"; detail?: string };
  origin: PortHit;
  destination: PortHit;
  weight?: {
    grossKg: number; volumetricKg: number; chargeableKg: number;
    basis: "gross" | "volumetric" | "equal"; rule: VolumetricRule; divisor: number; cbm: number;
  };
}

/** Shaped so the caller can show a real sentence instead of a status code. */
export class RateSearchError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail?: { side?: string; input?: string; port?: string; candidates?: PortHit[]; retryAfterSec?: number },
  ) {
    super(code);
    this.name = "RateSearchError";
  }
}

export interface RateSearchInput {
  mode: ShippingMode;
  origin: string;
  destination: string;
  originCountry?: string;
  destinationCountry?: string;
  equipment?: ContainerEquipment[];
  cbm?: number;
  grossKg?: number;
  dimensionsCm?: { l: number; w: number; h: number; qty?: number }[];
  volumetricRule?: VolumetricRule;
  force?: boolean;
}

export async function searchRates(input: RateSearchInput, signal?: AbortSignal): Promise<RateSearchResponse> {
  const res = await fetch("/api/shipping/rates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal,
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new RateSearchError(
      String(body.error ?? "search_failed"),
      res.status,
      {
        side: typeof body.side === "string" ? body.side : undefined,
        input: typeof body.input === "string" ? body.input : undefined,
        port: typeof body.port === "string" ? body.port : undefined,
        candidates: Array.isArray(body.candidates) ? (body.candidates as PortHit[]) : undefined,
        retryAfterSec: typeof body.retryAfterSec === "number" ? body.retryAfterSec : undefined,
      },
    );
  }
  return body as unknown as RateSearchResponse;
}

export interface SavedRoute {
  id: string;
  mode: ShippingMode;
  origin_code: string;
  destination_code: string;
  origin_label: string | null;
  destination_label: string | null;
  params: Record<string, unknown>;
  label?: string | null;
  run_count?: number;
  last_run_at?: string;
}

export interface RoutesPayload {
  recent: SavedRoute[];
  favorites: SavedRoute[];
  /** Approved names of the lanes' sea ports, by UN/LOCODE. */
  names?: Record<string, PlaceNames>;
  /** Changes whenever a name is approved — see searchPorts' `nv`. */
  namesVersion?: string;
  /** Shipping · edit: may open Port names. */
  canReviewNames?: boolean;
}

export function loadRoutes(): Promise<RoutesPayload> {
  return fetch("/api/shipping/routes", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { recent: [], favorites: [] }))
    .catch(() => ({ recent: [], favorites: [] }));
}

export function saveRoute(body: {
  action: "record" | "favorite" | "unfavorite";
  mode: ShippingMode;
  originCode: string; destinationCode: string;
  originLabel?: string; destinationLabel?: string;
  params?: Record<string, unknown>;
  label?: string;
}): Promise<boolean> {
  return fetch("/api/shipping/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.ok).catch(() => false);
}

/* ── forwarder quotes ──────────────────────────────────────────────────────
   The only rate source an operator can fill themselves. Everything here is a
   plain write: no cache, because a price that was just typed must be visible
   on the very next search. */

export interface ForwarderQuoteInput {
  mode: ShippingMode;
  /** Sent as the picker showed it — the server resolves it the same way the
      search does, so the stored lane and the searched lane cannot drift. */
  origin: string;
  destination: string;
  originCountry?: string;
  destinationCountry?: string;

  forwarder: string;
  amount: number;
  currency: string;
  /** FCL only. */
  equipment?: ContainerEquipment;
  /** Air only, as the forwarder wrote it: 'MIN', '+45', '+100'… */
  weightBreak?: string;
  /** true when the price covers the whole shipment rather than each unit. */
  lumpSum?: boolean;
  minCharge?: number;

  scope?: string;
  /** "yes" | "no" | undefined — undefined means the quote did not say, and is
      kept as its own answer rather than being read as "no". */
  includesOriginCharges?: "yes" | "no";
  includesDestinationCharges?: "yes" | "no";
  includesCustoms?: "yes" | "no";
  incoterm?: string;

  surcharges?: { code: string; label: string; amount: number; currency: string; per: string }[];

  validFrom?: string;
  validUntil: string;
  transitDaysMin?: number;
  transitDaysMax?: number;
  carrier?: string;
  /** true only when the forwarder called it indicative. */
  isEstimate?: boolean;
  notes?: string;
}

export interface ForwarderQuoteRow {
  id: string;
  source_label: string | null;
  mode: ShippingMode;
  origin_code: string;
  destination_code: string;
  equipment: ContainerEquipment | null;
  unit: string;
  amount: number | null;
  currency: string;
  total_estimate: number | null;
  valid_from: string | null;
  valid_until: string | null;
  transit_days_min: number | null;
  transit_days_max: number | null;
  carrier: string | null;
  is_estimate: boolean;
  notes: string | null;
  created_at: string;
}

/** Shaped like RateSearchError so one `describe()` can explain both. */
export async function saveForwarderQuote(input: ForwarderQuoteInput): Promise<{ id: string }> {
  const res = await fetch("/api/shipping/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new RateSearchError(String(body.error ?? "save_failed"), res.status, {
      side: typeof body.side === "string" ? body.side : undefined,
      input: typeof body.input === "string" ? body.input : undefined,
      port: typeof body.port === "string" ? body.port : undefined,
      candidates: Array.isArray(body.candidates) ? (body.candidates as PortHit[]) : undefined,
    });
  }
  return { id: String(body.id ?? "") };
}

export function listForwarderQuotes(lane?: {
  mode: ShippingMode; originCode: string; destinationCode: string;
}): Promise<{ quotes: ForwarderQuoteRow[] }> {
  const p = new URLSearchParams();
  if (lane) {
    p.set("mode", lane.mode);
    p.set("originCode", lane.originCode);
    p.set("destinationCode", lane.destinationCode);
  }
  const qs = p.toString();
  return fetch(`/api/shipping/quotes${qs ? `?${qs}` : ""}`, { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : { quotes: [] }))
    .catch(() => ({ quotes: [] }));
}

export function deleteForwarderQuote(id: string): Promise<boolean> {
  return fetch(`/api/shipping/quotes?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    .then((r) => r.ok).catch(() => false);
}
