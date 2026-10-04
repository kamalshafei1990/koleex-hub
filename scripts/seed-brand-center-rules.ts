#!/usr/bin/env tsx

/* ===========================================================================
   seed-brand-center-rules — writes the rules of a built section (plan steps
   C19–C39) into its items (brand_items.rules), from
   supabase/seed/brand-center-rules/<section>.json:
     { "section": "stationery", "items": { "<item key>": ItemRules, … } }

   The owner's own edits win: an item whose rules are already filled is left
   alone unless --force names it. Every key must be an item of the section.
   An item's forbidden choices (rules.notAllowed) are kept as they are.

     npx tsx scripts/seed-brand-center-rules.ts stationery            # dry run
     npx tsx scripts/seed-brand-center-rules.ts stationery --write    # write
     … --write --force=letterhead,envelopes                          # overwrite these
   =========================================================================== */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cleanRules, hasRules, type ItemRules } from "../src/lib/brand-center/rules";

process.loadEnvFile(join(__dirname, "..", ".env.local"));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
const section = process.argv[2];
const WRITE = process.argv.includes("--write");
const force = new Set((process.argv.find((a) => a.startsWith("--force="))?.slice(8) ?? "").split(",").filter(Boolean));

async function main() {
  if (!section || section.startsWith("--")) throw new Error("name the section, e.g. stationery");
  const file = JSON.parse(readFileSync(join(__dirname, "..", "supabase", "seed", "brand-center-rules", `${section}.json`), "utf8")) as { section: string; items: Record<string, unknown> };
  if (file.section !== section) throw new Error(`the file is for ${file.section}`);

  const { data: acc } = await sb.from("accounts").select("tenant_id").eq("username", "kamal").maybeSingle();
  const tenant = (acc as { tenant_id: string } | null)?.tenant_id;
  if (!tenant) throw new Error("owner account not found");
  const { data: sec } = await sb.from("brand_sections").select("id").eq("tenant_id", tenant).eq("key", section).maybeSingle();
  if (!sec) throw new Error(`section ${section} not in the library`);
  const { data: rows, error } = await sb.from("brand_items").select("id, key, rules").eq("tenant_id", tenant).eq("section_id", sec.id);
  if (error || !rows) throw new Error(error?.message ?? "no items");
  const byKey = new Map(rows.map((r) => [r.key as string, r as { id: string; key: string; rules: ItemRules | null }]));

  const unknown = Object.keys(file.items).filter((k) => !byKey.has(k));
  if (unknown.length) throw new Error(`not items of ${section}: ${unknown.join(", ")}`);
  const missing = rows.map((r) => r.key as string).filter((k) => !(k in file.items));

  let written = 0, kept = 0;
  for (const [key, raw] of Object.entries(file.items)) {
    const rules = cleanRules(raw);
    if (!rules || !hasRules(rules)) throw new Error(`${key}: empty or malformed rules`);
    const row = byKey.get(key)!;
    if (hasRules(row.rules) && !force.has(key)) { kept++; continue; }
    /* the forbidden choices are seeded on their own (seed-brand-center-not-allowed) — keep them */
    if (row.rules?.notAllowed?.length && !rules.notAllowed) rules.notAllowed = row.rules.notAllowed;
    if (WRITE) {
      const { error: e } = await sb.from("brand_items").update({ rules, updated_at: new Date().toISOString() }).eq("id", row.id);
      if (e) throw new Error(`${key}: ${e.message}`);
    }
    written++;
  }
  console.log(`${section}: ${Object.keys(file.items).length} in the file · ${written} ${WRITE ? "written" : "to write"} · ${kept} kept (already filled)${missing.length ? ` · no rules yet: ${missing.join(", ")}` : ""}`);
  if (!WRITE) { console.log("dry run — add --write"); return; }

  /* read back — a write that "ran" is not a write that landed */
  const { data: after } = await sb.from("brand_items").select("key, rules").eq("tenant_id", tenant).eq("section_id", sec.id);
  const filled = (after ?? []).filter((r) => hasRules(r.rules as ItemRules)).length;
  console.log(`in the database: ${filled}/${after?.length ?? 0} items of ${section} have rules`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
