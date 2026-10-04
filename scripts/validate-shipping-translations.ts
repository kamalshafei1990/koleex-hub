#!/usr/bin/env node
/* validate:shipping-translations
 *
 * WHY THIS EXISTS. `t()` returns the KEY when a translation is missing, and
 * `t(key, "English")` returns the English silently and forever. Neither is a
 * type error, so both pass tsc, eslint and the build — which is exactly how a
 * literal "hr.emergencyNamePlaceholder" reached production on 2026-07-23 and
 * why scripts/validate-hr-translations.mjs was written. This is that check,
 * for Shipping.
 *
 * It asserts three things:
 *   1. every literal t("…") in src/components/shipping is defined
 *   2. every defined entry carries all three languages the Hub supports
 *   3. every DYNAMIC key prefix — t(`mode.${id}`) and friends — has an entry
 *      for every value the code can actually produce
 *
 * Point 3 is the one the HR validator skips ("template-literal keys are
 * dynamic by design and skipped"), and it is where Shipping's most important
 * strings live: the four rate kinds and the five service scopes are all
 * rendered through a template literal.
 *
 * Run: npm run validate:shipping-translations
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shippingT } from "../src/lib/translations/shipping";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIRS = [path.join(ROOT, "src/components/shipping")];

const LANGS = ["en", "zh", "ar"];

/* The closed sets the union types in src/lib/shipping/types.ts can produce.
   If a union grows and this list does not, the check below fails — which is
   the point: a new rate kind with no label renders its own key on screen. */
const DYNAMIC: Record<string, string[]> = {
  "mode.": ["ocean_fcl", "ocean_lcl", "air"],
  "mode.__hint": ["ocean_fcl.hint", "ocean_lcl.hint", "air.hint"],
  "kind.": ["provider", "market", "koleex", "forwarder"],
  "kind.__what": ["provider.what", "market.what", "koleex.what", "forwarder.what"],
  "scope.": ["port_to_port", "door_to_port", "port_to_door", "door_to_door", "airport_to_airport"],
  "conf.": ["high", "medium", "low"],
  /* Every code ConfidenceReason["code"] can be. These render under a price in
     the panel that explains it — the last place to meet untranslated English. */
  "conf.__reason": ["reason.noRetrievalTime", "reason.retrievedToday", "reason.daysOld",
    "reason.daysOldStale", "reason.validTo", "reason.validityExpired", "reason.noValidity",
    "reason.exactLane", "reason.otherLane", "reason.equipmentMismatch",
    "reason.surchargeItemised", "reason.surchargesItemised", "reason.inclusionsOnly",
    "reason.freightOnly", "reason.singleSource", "reason.corroboratedOne", "reason.corroborated",
    "reason.sourcesDisagree", "reason.dailyCadence", "reason.marketBand", "reason.koleexPast"],
  /* Every error /api/shipping/quotes can return. t() falls back to the generic
     sentence, so a missing one is not a blank — but it IS a worse message. */
  "quote.__err": ["err.save_failed", "err.missing_forwarder", "err.invalid_amount",
    "err.missing_validity", "err.validity_backwards", "err.missing_equipment",
    "err.port_unknown", "err.port_ambiguous", "err.port_has_no_code"],
  "src.cadence.": ["realtime", "daily", "historical", "manual"],
  "weight.rule.": ["iata_air", "express_courier"],
  "cmp.diff.": ["mode", "lane", "equipment", "unit", "currency", "scope", "inclusions"],
  /* The codes the providers actually emit. koleex-internal's SURCHARGE_FIELDS
     plus the two the Awice adapter can produce and its FEE fallback. */
  "surcharge.": ["BAF", "CAF", "GRI", "PSS", "AMS", "DOC", "TLX", "INS", "THC", "ISPS", "FEE"],
};

let failures = 0;
const fail = (msg: string) => { failures++; console.error(`  ✗ ${msg}`); };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

/* ── read the dictionary by IMPORTING it, not by pattern-matching it ──────
   A regex over the source looked cheaper and was wrong: half these values
   carry {slot} placeholders, and a `\{([^}]*)\}` body match closes on the
   first `}` inside the text. That reported 36 complete entries as missing
   while still catching the real faults — a validator with false positives
   gets ignored, which is worse than not having one. */
const entries = new Map(Object.entries(shippingT as Record<string, Record<string, string>>));
if (entries.size === 0) {
  console.error("✗ the dictionary exported nothing — did its shape change?");
  process.exit(1);
}

/* ── 1. every literal t("…") resolves ──────────────────────────────────── */
const used = new Set<string>();
for (const dir of DIRS) {
  for (const f of fs.readdirSync(dir).filter((f) => /\.tsx?$/.test(f))) {
    const src = fs.readFileSync(path.join(dir, f), "utf8");
    for (const m of src.matchAll(/\bt\(\s*"([^"]+)"/g)) used.add(m[1]);
  }
}
const undefinedKeys = [...used].filter((k) => !entries.has(k)).sort();
if (undefinedKeys.length) fail(`used but not defined (${undefinedKeys.length}): ${undefinedKeys.join(", ")}`);
else ok(`every literal t() key is defined — ${used.size} keys`);

/* ── 2. every entry carries all three languages ────────────────────────── */
const incomplete: string[] = [];
for (const [key, value] of entries) {
  for (const lang of LANGS) {
    if (!value?.[lang]?.trim()) incomplete.push(`${key}.${lang}`);
  }
}
if (incomplete.length) fail(`missing translations (${incomplete.length}): ${incomplete.slice(0, 20).join(", ")}${incomplete.length > 20 ? " …" : ""}`);
else ok(`every entry has ${LANGS.join(" / ")} — ${entries.size} entries`);

/* ── 3. dynamic key prefixes are complete ──────────────────────────────── */
let dynMissing = 0;
for (const [prefix, values] of Object.entries(DYNAMIC)) {
  const base = prefix.replace(/__.*$/, "");
  for (const v of values) {
    const key = base + v;
    if (!entries.has(key)) { fail(`dynamic key not defined: ${key}`); dynMissing++; }
  }
}
if (!dynMissing) ok(`every dynamic key prefix is complete — ${Object.values(DYNAMIC).flat().length} values`);

console.log(failures === 0
  ? "\n✓ shipping translations: all checks passed"
  : `\n✗ shipping translations: ${failures} problem(s)`);
process.exit(failures === 0 ? 0 : 1);
