import "server-only";

/* ---------------------------------------------------------------------------
   Shipping — the provider contract.

   Every source of freight prices implements this and nothing else. The UI, the
   API routes and the engine never import a provider directly and never see a
   provider's own response shape; swapping or adding one is a registry edit.

   That indirection is the point. The freight data market is a mess of
   contract-gated APIs, and Koleex must not be rebuilt the day a provider is
   signed, dropped, or changes its JSON.

   ── A provider may legitimately return nothing ─────────────────────────────
   `unconfigured` is a first-class outcome, not a failure: an adapter with no
   credentials reports it and the app carries on with the sources it does have.
   Nothing here ever fabricates a rate to fill a gap.
   --------------------------------------------------------------------------- */

import type { ProviderResult, RateQuery, ShippingMode, SourceCadence } from "@/lib/shipping/types";

export interface ProviderCapabilities {
  modes: ShippingMode[];
  /** How fresh this source's data is. Drives the UI badge — see SourceCadence. */
  cadence: SourceCadence;
  /** True when the provider itemises surcharges rather than quoting freight alone. */
  itemisesSurcharges: boolean;
  /** True when the provider states a validity window on its rates. */
  statesValidity: boolean;
  /** Free-text, shown in the provider panel: what a credential would unlock. */
  requires?: string;
}

export interface ProviderContext {
  tenantId: string;
  /** Resolves a UN/LOCODE or IATA code the provider needs to be told differently. */
  tradeCodeFor?: (code: string) => string | null;
  signal?: AbortSignal;
}

export interface FreightRateProvider {
  id: string;
  label: string;
  /** Which of the four kinds this provider's numbers are. Never mixed. */
  kind: import("@/lib/shipping/types").RateKind;
  capabilities: ProviderCapabilities;

  /**
   * Whether this provider can answer at all right now. False when it has no
   * credentials, is switched off by env, or its terms have not been accepted.
   * Called before every search so a missing key is a quiet skip, not an error.
   */
  isEnabled(): boolean;
  /** Why it is off, for the provider panel. */
  disabledReason?(): string | undefined;

  getRates(query: RateQuery, ctx: ProviderContext): Promise<ProviderResult>;
}

/** Shared deadline. Matches the house AI-provider convention. */
export const PROVIDER_TIMEOUT_MS = 20_000;

export function providerDeadline(outer?: AbortSignal): AbortSignal | undefined {
  const own = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
    ? AbortSignal.timeout(PROVIDER_TIMEOUT_MS)
    : undefined;
  if (!own) return outer;
  if (!outer) return own;
  return "any" in AbortSignal ? (AbortSignal as unknown as { any(s: AbortSignal[]): AbortSignal }).any([own, outer]) : own;
}

/** A failure, shaped so the UI can say something true without leaking internals. */
export function providerError(
  providerId: string,
  kind: NonNullable<ProviderResult["error"]>["kind"],
  detail?: string,
  elapsedMs?: number,
): ProviderResult {
  return { providerId, rates: [], error: { kind, detail }, elapsedMs };
}
