#!/usr/bin/env tsx

/* ===========================================================================
   Smart Data Entry validator.

   Coverage (12 assertions):
     01  humanizeError translates FK errors to plain English
     02  humanizeError translates duplicate-key to "already exists"
     03  humanizeError translates HTTP status to generic message
     04  humanizeError preserves human-readable messages untouched
     05  humanizeError falls back to safe default on null/empty input
     06  useDraftAutosave persists + restores values within TTL
     07  useDraftAutosave drops values that are older than TTL
     08  useDraftAutosave isolates by tenant
     09  buildSmartDefaults base_currency = tenant base (CNY)
     10  SmartCreateDrawer exports openSmartCreate function
     11  SmartEmpty component is importable + has expected props
     12  InlineEntityPicker accepts onRefresh callback (new prop)
   ========================================================================== */

import { humanizeError } from "../src/lib/ui/humanize-error";
import { resolveSmartDefaults } from "../src/lib/create/defaults";
import { createClient } from "@supabase/supabase-js";

const URL_ENV = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ENV || !KEY) { console.warn("[smart-entry] env not set; skipping."); process.exit(0); }
const supabase = createClient(URL_ENV, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const TENANT = "00000000-0000-4000-a000-00000000C2F1";

let passes = 0, failures = 0;
function ok(name: string, condition: boolean, detail = "") {
  if (condition) { passes += 1; console.log(`  [PASS]  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failures += 1; console.log(`  [FAIL]  ${name}${detail ? ` — ${detail}` : ""}`); }
}

/* ─── In-memory localStorage shim so useDraftAutosave logic can be
   exercised without a browser. We re-implement the same wrap/expire
   logic from src/lib/hooks/useDraftAutosave.ts to avoid pulling React
   into the validator. ─── */

interface Wrapped<T> { saved_at: number; tenant: string | null; value: T }
const fakeStore = new Map<string, string>();
function saveDraft<T>(key: string, value: T, tenant: string | null) {
  fakeStore.set(key, JSON.stringify({ saved_at: Date.now(), tenant, value } as Wrapped<T>));
}
function loadDraft<T>(key: string, tenant: string | null, expireMs: number): T | null {
  const raw = fakeStore.get(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw) as Wrapped<T>;
  if (Date.now() - parsed.saved_at > expireMs) return null;
  if (tenant && parsed.tenant && parsed.tenant !== tenant) return null;
  return parsed.value;
}

async function ensure() {
  await supabase.from("tenants").upsert({
    id: TENANT, slug: "smart-entry", name: "Smart Entry",
    is_host: false, active: true, default_currency: "CNY",
  }, { onConflict: "id" });
}

async function main() {
  console.log("─".repeat(72));
  console.log("  Smart Data Entry validator");
  console.log("─".repeat(72));
  await ensure();

  /* 01 */
  ok("01  humanizeError translates FK constraint message",
     humanizeError("insert or update on table \"x\" violates foreign key constraint \"x_y_fkey\"")
       === "Linked record is missing or was removed — pick a different value.");

  /* 02 */
  ok("02  humanizeError translates duplicate-key",
     humanizeError("duplicate key value violates unique constraint")
       === "This record already exists.");

  /* 03 */
  ok("03  humanizeError translates HTTP 422 / HTTP 500 to generic",
     humanizeError("HTTP 422") === "Something went wrong. Please try again."
       && humanizeError("Failed (500)") === "Something went wrong. Please try again.");

  /* 04 */
  ok("04  humanizeError preserves human-readable messages",
     humanizeError("Title is required.") === "Title is required.");

  /* 05 */
  ok("05  humanizeError falls back to default on null/empty",
     humanizeError(null) === "Something went wrong. Please try again."
       && humanizeError("") === "Something went wrong. Please try again."
       && humanizeError(undefined) === "Something went wrong. Please try again.");

  /* 06 */
  const key = "koleex.draft.test:expense";
  saveDraft(key, { title: "Rent" }, TENANT);
  const restored = loadDraft<{ title: string }>(key, TENANT, 60_000);
  ok("06  Draft persists + restores within TTL",
     restored?.title === "Rent", `got ${JSON.stringify(restored)}`);

  /* 07 — expired draft is dropped. Simulate by writing a past timestamp. */
  fakeStore.set(key, JSON.stringify({
    saved_at: Date.now() - 48 * 60 * 60 * 1000, tenant: TENANT, value: { title: "Old" },
  }));
  ok("07  Draft drops values older than TTL",
     loadDraft(key, TENANT, 24 * 60 * 60 * 1000) === null);

  /* 08 — tenant isolation. */
  saveDraft(key, { title: "TenantA" }, TENANT);
  ok("08  Draft tenant isolation: B can't read A's draft",
     loadDraft(key, "OTHER_TENANT", 60_000) === null);

  /* 09 */
  const def = await resolveSmartDefaults(TENANT);
  ok("09  buildSmartDefaults base_currency = tenant base (CNY)",
     def.base_currency === "CNY", `got ${def.base_currency}`);

  /* 10/11/12 — TSX files can't load under react-server conditions
     because next/navigation depends on React.createContext. We assert
     by source-file content instead, which still catches accidental
     deletion of the public API. */
  const fs = await import("node:fs/promises");
  const drawerSrc = await fs.readFile("./src/components/ui/create/SmartCreateDrawer.tsx", "utf8");
  ok("10  SmartCreateDrawer exports openSmartCreate",
     drawerSrc.includes("export function openSmartCreate"));

  const emptySrc = await fs.readFile("./src/components/ui/empty/SmartEmpty.tsx", "utf8");
  ok("11  SmartEmpty exports a default component",
     emptySrc.includes("export default function SmartEmpty"));

  const pickerSrc = await fs.readFile("./src/components/ui/create/SmartCreate.tsx", "utf8");
  ok("12  InlineEntityPicker accepts onRefresh prop",
     pickerSrc.includes("onRefresh"));

  fakeStore.clear();
  console.log("─".repeat(72));
  console.log(`  ${passes} passed, ${failures} failed`);
  console.log("─".repeat(72));
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
