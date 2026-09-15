"use client";

/* ---------------------------------------------------------------------------
   Shipping — the browser's client for /api/shipping/*.

   No database access, no provider knowledge. Reference lookups go through
   cachedGet so a picker that reopens does not pay the platform's per-request
   floor again; the rate search never caches, because a rate is the one thing
   that must be current or honestly labelled stale.
   --------------------------------------------------------------------------- */

import { cachedGet } from "@/lib/client-cache";
import type {
  ContainerEquipment, FreightRate, RateKind, RateQuery, ShippingMode, VolumetricRule,
} from "@/lib/shipping/types";

export interface PortHit {
  id: string;
  locode: string | null;
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

export function searchPorts(opts: { q?: string; country?: string; origin?: boolean; limit?: number }): Promise<{ ports: PortHit[] }> {
  const p = new URLSearchParams({ kind: "ports" });
  if (opts.q) p.set("q", opts.q);
  if (opts.country) p.set("country", opts.country);
  if (opts.origin) p.set("origin", "1");
  if (opts.limit) p.set("limit", String(opts.limit));
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

export interface RateSearchResponse {
  query: RateQuery;
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

export function loadRoutes(): Promise<{ recent: SavedRoute[]; favorites: SavedRoute[] }> {
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
