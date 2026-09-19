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
  signal?: AbortSignal;
  /* ⚠️ NO CODE TRANSLATOR HERE, DELIBERATELY. There was one, and it meant the
     engine rewrote a canonical UN/LOCODE into one provider's preferred
     spelling for EVERY provider. An adapter that needs a different spelling
     asks for its own — providers/trade-codes.ts — so the substitution lives
     and dies inside that one request. */
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

/**
 * ⚠️ CREDENTIALS ARE NOT PERMISSION TO SHOW A NUMBER.
 *
 * Every adapter here was written from a vendor's published documentation, not
 * from a live call — no credential existed when they were written, and each
 * file says so. A parser written that way fails silently: it reads
 * defensively, finds nothing where a field was expected, and returns
 * `undefined`. The screen then shows a confident rate card with a missing
 * surcharge, a missing validity, or a freight figure that was really the
 * all-in total. Nothing throws. The number is simply wrong.
 *
 * So a credentialed provider needs a second, orthogonal switch, set only after
 * `npm run shipping:verify-provider -- <id>` has parsed a REAL response:
 *
 *     SHIPPING_<ID>_TERMS_REVIEWED=yes   a human read the API terms — LEGAL
 *     SHIPPING_<ID>_VERIFIED=yes         the parser was proven — TECHNICAL
 *
 * Both live in the environment, never in the repo.
 */
export const verifiedSwitch = (providerId: string): boolean =>
  (process.env[`SHIPPING_${providerId.toUpperCase()}_VERIFIED`] ?? "").toLowerCase() === "yes";

export const verifiedReason = (providerId: string): string =>
  `Not yet verified against a live response. Run \`npm run shipping:verify-provider -- ${providerId}\`, ` +
  `then set SHIPPING_${providerId.toUpperCase()}_VERIFIED=yes.`;

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
