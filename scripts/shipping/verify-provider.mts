#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   shipping:verify-provider — prove an adapter before it is allowed on screen.

   WHY THIS EXISTS. Every freight-rate adapter in this module was written from
   a vendor's PUBLISHED DOCUMENTATION, not from a live call, because no
   credential existed when it was written. The Awice file says so in its own
   header. A parser written that way fails in the one way nobody notices:
   it reads defensively, finds nothing where it expected a field, and returns
   `undefined` — so the screen shows a confident rate card with a missing
   surcharge, a missing validity, or a freight figure that was actually the
   all-in total. Nothing throws. Nothing logs. The number is simply wrong.

   So no provider may be switched on by credentials alone. Two switches, and
   they mean different things:

     SHIPPING_<ID>_TERMS_REVIEWED=yes   a human read the API terms — LEGAL
     SHIPPING_<ID>_VERIFIED=yes         this script passed — TECHNICAL

   What it does:
     1. forces the provider on for this process only (never writes to the DB),
     2. tees every HTTP response the adapter receives to a file, so the RAW
        vendor payload can be read beside the parsed output,
     3. calls it on a real lane,
     4. checks the normalised FreightRates against the provider's OWN declared
        capabilities and against the query it was given,
     5. prints a field-by-field report and exits non-zero on anything that
        would put a wrong number in front of an operator.

   It never writes to shipping_rate_quotes: verification must not seed the
   cache with rates from a parser that has not yet been trusted.

   Run:  npm run shipping:verify-provider -- <providerId> [--lane CNNBO:EGPSD] [--mode ocean_fcl]
   --------------------------------------------------------------------------- */

import fs from "node:fs";
import path from "node:path";

/* ── env, the same way the seed scripts read it ───────────────────────────── */
const ROOT = process.cwd();
for (const line of fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n")) {
  if (!line.includes("=") || line.trim().startsWith("#")) continue;
  const i = line.indexOf("=");
  process.env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const argv = process.argv.slice(2);
const providerId = argv.find((a) => !a.startsWith("--"));
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

if (!providerId) {
  console.error("usage: npm run shipping:verify-provider -- <providerId> [--lane CNNBO:EGPSD] [--mode ocean_fcl] [--equipment 40HQ]");
  process.exit(2);
}

const [originCode, destinationCode] = (flag("lane") ?? "CNNBO:EGPSD").split(":");
const mode = (flag("mode") ?? "ocean_fcl") as "ocean_fcl" | "ocean_lcl" | "air";
const equipment = flag("equipment");

/* ── capture every vendor response, raw ───────────────────────────────────
   A tee on global fetch, so this works for ANY adapter without the adapter
   knowing it is being watched. The raw body is what you compare the parsed
   output against when a field comes back undefined. */
const CAPTURE_DIR = path.join(ROOT, "scripts/shipping/.cache/verify");
fs.mkdirSync(CAPTURE_DIR, { recursive: true });
const captured: { url: string; status: number; file: string; bytes: number }[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const res = await realFetch(input as never, init as never);
  try {
    const clone = res.clone();
    const body = await clone.text();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    const file = path.join(CAPTURE_DIR, `${providerId}-${captured.length + 1}-${res.status}.txt`);
    fs.writeFileSync(file, `${url}\nstatus ${res.status}\n\n${body}`);
    captured.push({ url, status: res.status, file, bytes: body.length });
  } catch { /* a body that cannot be re-read is not a reason to fail the call */ }
  return res;
}) as typeof fetch;

const ID = providerId.toUpperCase();

const { providerById } = await import("../../src/lib/server/shipping/registry");
const provider = providerById(providerId);
if (!provider) {
  console.error(`✗ no provider with id "${providerId}". Known: see src/lib/server/shipping/registry.ts`);
  process.exit(2);
}

/* ⚠️ ASK BEFORE FORCING. A provider that is already on needs no credential
   and no terms review — koleex_landed_cost reads Koleex's own table. Telling
   its operator to set two environment variables nothing consults is how a
   checklist stops being believed, so the closing advice below is decided by
   this answer, taken while the environment is still untouched. */
const wasAlreadyOn = provider.isEnabled();

/* ── force the provider on, for this process only ─────────────────────────
   Verification has to be able to run BEFORE the switches are set — that is
   the whole point. The adapters read process.env inside isEnabled(), so this
   takes effect without re-importing. Nothing here is persisted. */
for (const suffix of ["TERMS_REVIEWED", "VERIFIED"]) process.env[`SHIPPING_${ID}_${suffix}`] = "yes";
if (providerId === "freightos_public") process.env.SHIPPING_FREIGHTOS_PUBLIC = "on";

let failures = 0;
const fail = (m: string) => { failures++; console.log(`  ✗ ${m}`); };
const ok = (m: string) => console.log(`  ✓ ${m}`);
const note = (m: string) => console.log(`  · ${m}`);

console.log(`\nverifying "${provider.label}" (${provider.id})`);
console.log(`  kind ${provider.kind} · declared cadence ${provider.capabilities.cadence}`);
console.log(`  lane ${originCode} → ${destinationCode} · ${mode}${equipment ? ` · ${equipment}` : ""}\n`);

if (!provider.isEnabled()) {
  console.log(`✗ the provider still reports itself disabled even with both switches forced on:`);
  console.log(`  ${provider.disabledReason?.() ?? "(no reason given)"}`);
  console.log(`\n  That is a credential problem, not a parser problem. Set the keys and run again.`);
  process.exit(1);
}

const query = {
  mode,
  originCode, destinationCode,
  originCodeSystem: mode === "air" ? "iata" : "unlocode",
  destinationCodeSystem: mode === "air" ? "iata" : "unlocode",
  equipment: mode === "ocean_fcl" ? [equipment ?? "40HQ"] : undefined,
  cbm: mode === "ocean_lcl" ? 12 : undefined,
  grossKg: mode === "air" ? 850 : mode === "ocean_lcl" ? 4200 : undefined,
} as never;

const started = Date.now();
const result = await provider.getRates(query, { tenantId: "verify", signal: undefined } as never);
const elapsed = Date.now() - started;

console.log(`── the call ─────────────────────────────────────────────────────`);
note(`${elapsed} ms, ${captured.length} HTTP response(s) captured`);
for (const c of captured) note(`${c.status} ${c.bytes}B ${c.url.slice(0, 90)} → ${path.relative(ROOT, c.file)}`);

if (result.error) {
  console.log(`\n✗ the provider returned an error: ${result.error.kind}${result.error.detail ? ` — ${result.error.detail}` : ""}`);
  if (captured.length) console.log(`  Read the captured response above before changing the parser.`);
  process.exit(1);
}

console.log(`\n── what the adapter produced ────────────────────────────────────`);
if (!result.rates.length) {
  /* ⚠️ INCONCLUSIVE, NOT FAILED — and the difference matters. A provider that
     genuinely has no price on this lane is behaving correctly; a parser that
     read a priced payload and found nothing is the bug this script hunts.
     Nothing here can tell those apart automatically, so it says so and refuses
     to pass, rather than accusing a working adapter or blessing a broken one.
     Re-run against a lane you KNOW is priced before touching the parser. */
  console.log(`  ? no rates parsed — INCONCLUSIVE`);
  console.log(`\n  Either this lane genuinely has no price, or the parser read a priced`);
  console.log(`  payload and found nothing. Open the captured response above and check`);
  console.log(`  which it is, then re-run on a lane you know is priced.`);
  console.log(`\n✗ not verified. Do NOT set SHIPPING_${ID}_VERIFIED=yes.`);
  process.exit(1);
}
ok(`${result.rates.length} rate(s) parsed`);

/* ── each rate against the query and the provider's own claims ───────────── */
const caps = provider.capabilities;
for (const [i, r] of result.rates.entries()) {
  console.log(`\n  rate ${i + 1}: ${r.equipment ?? r.weightBreak ?? "—"} ${r.currency} ${r.amount ?? "(null)"}`);

  if (r.amount == null && r.amountLow == null) {
    note(`amount is null — a legitimate "we asked and there is no rate", but verify that is what the payload says`);
  } else if (r.amount != null && (!Number.isFinite(r.amount) || r.amount <= 0)) {
    fail(`amount ${r.amount} is not a positive number`);
  } else ok(`amount parses`);

  if (!/^[A-Z]{3}$/.test(r.currency)) fail(`currency "${r.currency}" is not a 3-letter code`);
  else ok(`currency ${r.currency}`);

  /* ⚠️ The lane must come back as the lane we ASKED for. A provider that
     answers about a neighbouring port is a real behaviour, and silently
     relabelling it ours would file another port's price under this lane. */
  if (r.originCode !== originCode || r.destinationCode !== destinationCode) {
    fail(`lane came back as ${r.originCode}→${r.destinationCode}, not ${originCode}→${destinationCode}`);
  } else ok(`lane matches the query`);
  if (!r.originCodeSystem || !r.destinationCodeSystem) fail(`a code travelled without its register`);

  const wantUnit = mode === "ocean_fcl" ? "container" : mode === "ocean_lcl" ? "cbm" : "kg";
  if (r.unit !== wantUnit && r.unit !== "shipment") fail(`unit "${r.unit}" is neither ${wantUnit} nor shipment`);
  else ok(`unit ${r.unit}`);

  if (mode === "ocean_fcl" && !r.equipment) fail(`FCL rate with no container type`);

  if (caps.itemisesSurcharges) {
    if (!r.surcharges.length) fail(`provider declares itemisesSurcharges:true but parsed NONE — check the payload`);
    else {
      ok(`${r.surcharges.length} surcharge(s): ${r.surcharges.map((s) => `${s.code} ${s.amount}`).join(", ")}`);
      const bad = r.surcharges.filter((s) => !Number.isFinite(s.amount) || s.amount <= 0 || !/^[A-Z]{3}$/.test(s.currency));
      if (bad.length) fail(`${bad.length} surcharge(s) have an unusable amount or currency`);
    }
  }

  if (caps.statesValidity) {
    if (!r.validUntil) fail(`provider declares statesValidity:true but no validUntil was parsed`);
    else if (Number.isNaN(Date.parse(r.validUntil))) fail(`validUntil "${r.validUntil}" is not a date`);
    else ok(`valid until ${r.validUntil}`);
  }

  if (!r.retrievedAt || Number.isNaN(Date.parse(r.retrievedAt))) fail(`retrievedAt is missing or unparseable`);

  /* ⚠️ THE CADENCE CLAIM IS CHECKED, NOT TAKEN. "Real-time" is the single
     most load-bearing word on a rate card and the one vendors are loosest
     with — Awice's marketing says real-time and every page of their own
     documentation says daily.

     What counts as proof depends on what the number IS, and conflating the
     two would block an honest source while passing a dishonest one:

       a BOOKABLE rate (provider / forwarder) claiming realtime must carry
       something that ties it to a moment — a validity window, an ETD/ETA, a
       vessel or voyage. Without one there is nothing to distinguish it from
       a figure cached last week.

       a MARKET band is computed on request and has nothing to be valid
       until; "realtime" there means the calculation is fresh, not that the
       price is committed. What it must instead prove is that it still
       presents AS a band — an estimate, with a low and a high — because a
       band flattened into a single `amount` reads on screen as a quotation. */
  if (caps.cadence === "realtime") {
    if (r.kind === "market") {
      if (!r.isEstimate) fail(`a market band came back with isEstimate:false — it would read as bookable`);
      else if (r.amountLow == null || r.amountHigh == null) {
        fail(`a market band parsed to a single amount with no low/high. A range flattened ` +
             `into one number is read as a quotation by every operator who sees it.`);
      } else ok(`presents as a band: ${r.amountLow}–${r.amountHigh} ${r.currency}, estimate`);
    } else {
      const proof = r.validUntil || r.etd || r.eta || r.vessel || r.voyage;
      if (!proof) {
        fail(`cadence is declared "realtime" but nothing in the parsed rate ties it to a moment ` +
             `(no validity, no ETD/ETA, no vessel). Either the payload carries it and the parser misses it, ` +
             `or the cadence claim is the vendor's marketing and belongs as "daily".`);
      } else ok(`realtime claim is backed by ${r.validUntil ? "a validity window" : r.etd ? "an ETD" : "vessel/voyage data"}`);
    }
  }

  if (r.kind !== provider.kind) fail(`rate kind "${r.kind}" does not match the provider's declared "${provider.kind}"`);
  if (r.sourceCadence !== caps.cadence) fail(`rate cadence "${r.sourceCadence}" does not match the declared "${caps.cadence}"`);
}

console.log(`\n────────────────────────────────────────────────────────────────`);
if (failures) {
  console.log(`✗ ${failures} problem(s). Do NOT set SHIPPING_${ID}_VERIFIED=yes.`);
  console.log(`  The captured payloads are in ${path.relative(ROOT, CAPTURE_DIR)} (gitignored).`);
  process.exit(1);
}
console.log(`✓ the adapter parses a real ${provider.label} response correctly.`);

if (!wasAlreadyOn) {
  console.log(`\n  Two things remain, and they are not this script's to give:`);
  console.log(`   1. a human must read the provider's API terms → SHIPPING_${ID}_TERMS_REVIEWED=yes`);
  console.log(`   2. set SHIPPING_${ID}_VERIFIED=yes to record that this check passed`);
  console.log(`  Both belong in Vercel's environment, not in the repo.`);
} else {
  console.log(`  This provider needs no credential and no terms review — nothing to set.`);
}
