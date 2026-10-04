import "server-only";

/* ---------------------------------------------------------------------------
   Shipping — the provider registry.

   The one place that knows which providers exist. Adding a source is a line
   here plus an adapter file; nothing in the UI, the API routes or the engine
   changes. Removing one is the same edit in reverse.

   Order matters only for display. The engine queries every enabled provider in
   parallel and never lets one source's answer stand in for another's.
   --------------------------------------------------------------------------- */

import type { FreightRateProvider } from "./providers/types";
import { awiceProvider } from "./providers/awice";
import { freightosPublicProvider } from "./providers/freightos-public";
import { koleexInternalProvider } from "./providers/koleex-internal";

export const PROVIDERS: readonly FreightRateProvider[] = [
  /* Always available: no credential, no third party, real money Koleex paid. */
  koleexInternalProvider,
  /* Public market band. Off until one live response has been verified. */
  freightosPublicProvider,
  /* The real rate engine, once an account exists and its terms are read. */
  awiceProvider,
] as const;

export const providerById = (id: string): FreightRateProvider | undefined =>
  PROVIDERS.find((p) => p.id === id);

export const enabledProviders = (): FreightRateProvider[] => PROVIDERS.filter((p) => p.isEnabled());

/** What the provider panel shows: every source and, when off, why. */
export interface ProviderStatus {
  id: string;
  label: string;
  kind: FreightRateProvider["kind"];
  cadence: FreightRateProvider["capabilities"]["cadence"];
  modes: FreightRateProvider["capabilities"]["modes"];
  enabled: boolean;
  reason?: string;
  requires?: string;
}

export function providerStatuses(): ProviderStatus[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    kind: p.kind,
    cadence: p.capabilities.cadence,
    modes: p.capabilities.modes,
    enabled: p.isEnabled(),
    reason: p.isEnabled() ? undefined : p.disabledReason?.(),
    requires: p.capabilities.requires,
  }));
}
