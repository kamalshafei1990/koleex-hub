#!/usr/bin/env node
/* validate:products-freshness — the catalogue badges cannot lie, and their
 * timestamps cannot leak.
 *
 * Two things this guards, each tested in BOTH directions (a check that only
 * ever sees the passing input proves nothing — this repo has paid for that
 * twice):
 *
 *   1. The fold. freshnessBits/foldFreshness turn three moments into bits.
 *      A moment inside the window MUST set its bit; outside, or in the
 *      future, or unparseable, MUST NOT. The fold must drop every timestamp
 *      and must omit `fresh` entirely when it is 0 — that omission is the
 *      whole reason the response does not grow.
 *
 *   2. The seam. The list API must fold rows before it responds on BOTH
 *      list paths, and the freshness columns must never be part of
 *      LIST_PRODUCT_COLUMNS (which documents what the browser receives).
 *      Source checks, with the failure direction exercised on a mutated copy.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FRESHNESS_COLUMNS, FRESH_NEW, FRESH_PRICE, FRESH_UPDATED, FRESH_WINDOW_DAYS,
  foldFreshness, freshnessBadges, freshnessBits,
} from "../src/lib/products-freshness";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
const ok = (m: string) => console.log(`  ✓ ${m}`);
const fail = (m: string, why?: string) => { failed++; console.error(`  ✗ ${m}${why ? `\n      ${why}` : ""}`); };
const expect = (cond: boolean, m: string, why?: string) => (cond ? ok(m) : fail(m, why));

const DAY = 86_400_000;
const now = Date.parse("2026-09-19T12:00:00Z");
const iso = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

console.log("\n§1 the fold");
expect(freshnessBits({ published_at: iso(1) }, now) === FRESH_NEW, "published yesterday → NEW");
expect(freshnessBits({ published_at: iso(FRESH_WINDOW_DAYS - 0.5) }, now) === FRESH_NEW, "published 13.5 days ago → still NEW");
expect(freshnessBits({ published_at: iso(FRESH_WINDOW_DAYS) }, now) === 0, "published exactly 14 days ago → expired");
expect(freshnessBits({ published_at: iso(40) }, now) === 0, "published 40 days ago → nothing");
expect(freshnessBits({ published_at: iso(-1) }, now) === 0, "a moment in the FUTURE → nothing (clock skew cannot mint a badge)");
expect(freshnessBits({ published_at: "not a date" }, now) === 0, "garbage timestamp → nothing");
expect(freshnessBits({ published_at: null, content_updated_at: null, price_updated_at: null }, now) === 0, "all NULL → 0");
expect(freshnessBits({ content_updated_at: iso(3) }, now) === FRESH_UPDATED, "content 3 days ago → Updated only");
expect(freshnessBits({ price_updated_at: iso(3) }, now) === FRESH_PRICE, "price 3 days ago → Price only");
expect(
  freshnessBits({ published_at: iso(2), content_updated_at: iso(1), price_updated_at: iso(0.5) }, now) === (FRESH_NEW | FRESH_UPDATED | FRESH_PRICE),
  "all three inside → all three bits (the owner allows several at once)",
);
expect(
  freshnessBits({ published_at: iso(20), content_updated_at: iso(1), price_updated_at: iso(30) }, now) === FRESH_UPDATED,
  "mixed ages → only the fresh one",
);

const fresh = foldFreshness({ id: "a", product_name: "x", published_at: iso(1), content_updated_at: iso(50), price_updated_at: null } as Record<string, unknown>, now);
expect(fresh.fresh === FRESH_NEW, "fold: sets fresh from the moments");
expect(FRESHNESS_COLUMNS.every((c) => !(c in fresh)), "fold: every timestamp column removed", JSON.stringify(fresh));
expect(fresh.id === "a" && fresh.product_name === "x", "fold: other columns untouched");

const stale = foldFreshness({ id: "b", published_at: iso(90), content_updated_at: null, price_updated_at: iso(15) } as Record<string, unknown>, now);
expect(!("fresh" in stale), "fold: `fresh` OMITTED when 0 — not fresh:0, not null", JSON.stringify(stale));
expect(JSON.stringify(stale) === '{"id":"b"}', "fold: a stale row serialises to exactly its own columns", JSON.stringify(stale));

expect(freshnessBadges(0).length === 0 && freshnessBadges(undefined).length === 0, "badges: 0/undefined → none");
expect(freshnessBadges(FRESH_NEW | FRESH_PRICE).join(",") === "new,price", "badges: fixed display order new → updated → price");
expect(freshnessBadges(7).join(",") === "new,updated,price", "badges: all three in order");

console.log("\n§2 the seam");
const routePath = "src/app/api/products/route.ts";
const route = fs.readFileSync(path.join(ROOT, routePath), "utf8");
const access = fs.readFileSync(path.join(ROOT, "src/lib/server/product-access.ts"), "utf8");

/* Strip comments so a guard cannot trip on its own documentation. */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const folds = (src: string) => (code(src).match(/foldFreshness\(/g) ?? []).length;
expect(folds(route) >= 2, `${routePath} folds rows on both list paths (paged + unpaged) — ${folds(route)} call site(s)`,
  "each path that returns list rows must call foldFreshness before NextResponse.json");
expect(folds(route.replace(/foldFreshness\(/g, "identity(")) === 0, "  (the count check sees the failure direction)");

const selectsMoments = /FRESHNESS_COLUMNS\.join\(/.test(code(route));
expect(selectsMoments, `${routePath} appends FRESHNESS_COLUMNS to the list projection`,
  "without them in the SELECT the fold has nothing to read and every badge is silently off");

/* The LIST constant must not carry the timestamps: it documents the wire. */
const listBlockStart = access.indexOf("export const LIST_PRODUCT_COLUMNS");
const listBlockEnd = access.indexOf("].join", listBlockStart);
expect(listBlockStart >= 0 && listBlockEnd > listBlockStart, "LIST_PRODUCT_COLUMNS block located");
const listBlock = code(access.slice(listBlockStart, listBlockEnd));
const leaked = FRESHNESS_COLUMNS.filter((c) => new RegExp(`"${c}"`).test(listBlock));
expect(leaked.length === 0, "LIST_PRODUCT_COLUMNS carries no freshness timestamp", leaked.join(", "));
expect(
  FRESHNESS_COLUMNS.filter((c) => new RegExp(`"${c}"`).test(listBlock + '\n  "published_at",')).length === 1,
  "  (the leak check sees the failure direction)",
);

/* The public response must be shaped by the same helper the card reads. */
const card = code(fs.readFileSync(path.join(ROOT, "src/components/admin/ProductList.tsx"), "utf8"));
expect(/freshnessBadges\(fresh\)/.test(card) && /<FreshnessTags fresh=\{p\.fresh\}/.test(card),
  "ProductCard hands p.fresh to FreshnessTags, which reads it through freshnessBadges()");
expect(!/published_at|content_updated_at|price_updated_at/.test(card), "ProductCard never reads a timestamp — bits only");

console.log(failed ? `\n✗ products freshness: ${failed} check(s) failed\n` : "\n✓ products freshness: all checks passed\n");
process.exit(failed ? 1 : 0);
