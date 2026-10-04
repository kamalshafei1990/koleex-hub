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
 * And its mirror, added when the forwarder-quote form shipped: a forwarder
 * quote INSIDE its validity MUST count as a current rate. If that ever stops
 * being true, an operator types a real price in from a real quotation and the
 * screen still tells them there is nothing on the lane.
 *
 * Run: npm run validate:shipping-states
 */
import { reasonFor, currentRates, shownRates } from "../src/components/shipping/RateResults";
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

/* ⚠️ THE MIRROR OF THE TWO ABOVE. The whole point of the quote form is that a
   price typed from a real quotation shows up as a CURRENT rate — not as
   history, and not behind a disclosure. */
const soon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
const live = currentRates([base({ kind: "forwarder", sourceCadence: "manual", validUntil: soon })]);
const ok4 = live.length === 1;
if (!ok4) fail++;
console.log(`${ok4 ? "  ✓" : "  ✗"} currentRates() KEEPS an in-validity forwarder quote — got ${live.length}`);

/* …and a lane whose only price is that quote is not an empty lane. */
const withQuote = reasonFor(
  resp([{ id: "awice", kind: "provider", enabled: true }]),
  [base({ kind: "forwarder", sourceCadence: "manual", validUntil: soon })],
);
const ok5 = currentRates([base({ kind: "forwarder", sourceCadence: "manual", validUntil: soon })]).length > 0;
if (!ok5) fail++;
console.log(`${ok5 ? "  ✓" : "  ✗"} a lane priced only by a forwarder quote is NOT empty (reasonFor would say "${withQuote}", but the card never asks)`);
/* ⚠️ THE WIRE DESTROYS OBJECT IDENTITY. compare() pushes the SAME rate object
   into group.rates and group.byKind[kind]; JSON.stringify writes each
   occurrence out in full and JSON.parse rebuilds them as independent objects.
   A card that picks its rows by comparing the two lists by reference therefore
   draws nothing in the browser while passing every server-side check. This
   asserts the row picker survives a round-trip. */
const quote = base({ kind: "forwarder", sourceCadence: "manual", validUntil: soon, sourceId: "fwd:x" });
const serverGroup = { key: {}, rates: [quote], byKind: { provider: [], market: [], koleex: [], forwarder: [quote] } };
const overTheWire = JSON.parse(JSON.stringify(serverGroup));
const sharesRefs = serverGroup.rates[0] === serverGroup.byKind.forwarder[0];
const stillShares = overTheWire.rates[0] === overTheWire.byKind.forwarder[0];
const drawn = shownRates(overTheWire);
const ok6 = sharesRefs && !stillShares && drawn.length === 1;
if (!ok6) fail++;
console.log(`${ok6 ? "  ✓" : "  ✗"} a card still draws its rows after JSON (server shares refs: ${sharesRefs}, wire does not: ${!stillShares}, rows drawn: ${drawn.length})`);

console.log(fail === 0 ? "\nall states correct" : `\n${fail} FAILED`);
process.exit(fail === 0 ? 0 : 1);
