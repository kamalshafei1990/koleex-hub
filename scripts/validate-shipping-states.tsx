#!/usr/bin/env tsx
/* validate:shipping-states
 *
 * WHY THIS EXISTS. An empty rate card used to say only "Rate unavailable", and
 * the owner had to ask where the results were — a state that explains nothing
 * reads as a fault in the app. Each empty state now names what is actually
 * true, and the mapping from "what the search found" to "what the card says"
 * is the kind of logic that silently rots: add a provider kind, or a new error
 * kind, and a card starts claiming the wrong thing with no test failing.
 *
 * Two guarantees matter more than the rest and are asserted last:
 *   · a Koleex HISTORICAL rate is never counted as a current rate
 *   · a rate past its validity is never counted as a current rate
 * Either one breaking means the screen shows a stale number as today's price.
 *
 * Run: npm run validate:shipping-states
 */
import { reasonFor, currentRates } from "../src/components/shipping/RateResults";
import type { RateSearchResponse } from "../src/components/shipping/shipping-client";
import type { FreightRate } from "../src/lib/shipping/types";

const base = (over: Partial<FreightRate> = {}): FreightRate => ({
  kind: "provider", sourceId: "x", sourceLabel: "x", sourceCadence: "daily",
  mode: "ocean_fcl", originCode: "CNSGH", destinationCode: "EGALY",
  originCodeSystem: "unlocode", destinationCodeSystem: "unlocode",
  scope: "port_to_port", unit: "container", amount: 1000, currency: "USD",
  surcharges: [], retrievedAt: new Date().toISOString(), isEstimate: false, ...over,
});

const resp = (providers: { id: string; kind: string; enabled: boolean }[],
               results: { providerId: string; error?: { kind: string } }[] = []): RateSearchResponse =>
  ({ query: { mode: "ocean_fcl" }, providers: providers.map(p => ({ ...p, modes: ["ocean_fcl"] })), results } as never);

const cases: [string, RateSearchResponse, FreightRate[], string][] = [
  ["no external provider at all",
    resp([{ id: "koleex_landed_cost", kind: "koleex", enabled: true }]), [], "provider_disconnected"],
  ["externals exist but all off",
    resp([{ id: "awice", kind: "provider", enabled: false }, { id: "freightos_public", kind: "market", enabled: false }]), [], "provider_disconnected"],
  ["external on, nothing returned",
    resp([{ id: "awice", kind: "provider", enabled: true }]), [], "no_rate"],
  ["external on, timed out",
    resp([{ id: "awice", kind: "provider", enabled: true }], [{ providerId: "awice", error: { kind: "timeout" } }]), [], "provider_error"],
  ["external on, rate-limited",
    resp([{ id: "awice", kind: "provider", enabled: true }], [{ providerId: "awice", error: { kind: "quota" } }]), [], "provider_error"],
  ["external on, provider says no route",
    resp([{ id: "awice", kind: "provider", enabled: true }], [{ providerId: "awice", error: { kind: "no_route" } }]), [], "no_rate"],
  ["an error from a provider that is OFF must not count",
    resp([{ id: "awice", kind: "provider", enabled: true }, { id: "freightos_public", kind: "market", enabled: false }],
         [{ providerId: "freightos_public", error: { kind: "timeout" } }]), [], "no_rate"],
  ["a rate exists but its validity has passed",
    resp([{ id: "awice", kind: "provider", enabled: true }]),
    [base({ validUntil: "2020-01-01" })], "expired"],
  ["one expired, one still valid -> not the expired state",
    resp([{ id: "awice", kind: "provider", enabled: true }]),
    [base({ validUntil: "2020-01-01" }), base({ validUntil: "2099-01-01" })], "no_rate"],
  ["only a Koleex historical rate is NOT a current rate",
    resp([{ id: "koleex_landed_cost", kind: "koleex", enabled: true }]),
    [base({ kind: "koleex", validUntil: undefined })], "provider_disconnected"],
];

let fail = 0;
for (const [name, data, rates, want] of cases) {
  const got = reasonFor(data, rates);
  const ok = got === want;
  if (!ok) fail++;
  console.log(`${ok ? "  ✓" : "  ✗"} ${name}\n      want ${want}, got ${got}`);
}
/* the separate guarantee: historical never counts as a current rate */
const hist = [base({ kind: "koleex" })];
const cur = currentRates(hist);
const ok2 = cur.length === 0;
if (!ok2) fail++;
console.log(`${ok2 ? "  ✓" : "  ✗"} currentRates() excludes historical — got ${cur.length}`);
const stale = currentRates([base({ validUntil: "2020-01-01" })]);
const ok3 = stale.length === 0;
if (!ok3) fail++;
console.log(`${ok3 ? "  ✓" : "  ✗"} currentRates() excludes an expired rate — got ${stale.length}`);
console.log(fail === 0 ? "\nall states correct" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
