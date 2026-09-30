#!/usr/bin/env tsx

/* ===========================================================================
   seed-brand-center-not-allowed — marks the workshop choices the standing
   rules forbid (brand_items.rules.notAllowed), from
   supabase/seed/brand-center-rules/not-allowed.json:
     { "<section>": { "<item key>": [{ "option": "<type>.<option>", "why": "…" }] } }

   Only that list is written; the rest of an item's rules stays as it is. An
   item whose list the owner already set is left alone unless --force names
   it. Every item and every choice must exist.

     npx tsx scripts/seed-brand-center-not-allowed.ts            # dry run
     npx tsx scripts/seed-brand-center-not-allowed.ts --write    # write
   =========================================================================== */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { cleanRules, optionRef, type ItemRules } from "../src/lib/brand-center/rules";

process.loadEnvFile(join(__dirname, "..", ".env.local"));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
const WRITE = process.argv.includes("--write");
const force = new Set((process.argv.find((a) => a.startsWith("--force="))?.slice(8) ?? "").split(",").filter(Boolean));

type Entry = { option: string; why: string };

async function main() {
  const file = JSON.parse(readFileSync(join(__dirname, "..", "supabase", "seed", "brand-center-rules", "not-allowed.json"), "utf8")) as Record<string, Record<string, Entry[]>>;
  const { data: acc } = await sb.from("accounts").select("tenant_id").eq("username", "kamal").maybeSingle();
  const tenant = (acc as { tenant_id: string } | null)?.tenant_id;
  if (!tenant) throw new Error("owner account not found");

  let written = 0, kept = 0, marks = 0;
  for (const [section, items] of Object.entries(file)) {
    const { data: sec } = await sb.from("brand_sections").select("id").eq("tenant_id", tenant).eq("key", section).maybeSingle();
    if (!sec) throw new Error(`section ${section} not in the library`);
    const { data: rows, error } = await sb.from("brand_items").select("id, key, rules").eq("tenant_id", tenant).eq("section_id", sec.id).in("key", Object.keys(items));
    if (error || !rows) throw new Error(error?.message ?? "no items");
    const byKey = new Map(rows.map((r) => [r.key as string, r as { id: string; key: string; rules: ItemRules | null }]));
    /* the section's choices, read once: "<type>.<option>" per item */
    const ids = rows.map((r) => r.id as string);
    const [types, options] = await Promise.all([
      sb.from("brand_item_types").select("id, key").in("item_id", ids),
      sb.from("brand_item_options").select("item_id, type_id, key").in("item_id", ids),
    ]);
    if (types.error || options.error || !types.data || !options.data) throw new Error(`${section}: ${types.error?.message ?? options.error?.message ?? "no choices read"}`);
    if (options.data.length >= 1000) throw new Error(`${section}: over 1000 choices — read in pages`);
    const typeKey = new Map(types.data.map((ty) => [ty.id as string, ty.key as string]));
    for (const [key, list] of Object.entries(items)) {
      const row = byKey.get(key);
      if (!row) throw new Error(`${section}/${key}: not an item`);
      /* every choice named must be one of the item's */
      const refs = new Set(options.data.filter((o) => o.item_id === row.id).map((o) => optionRef(typeKey.get(o.type_id as string) ?? "", o.key as string)));
      const wrong = list.filter((x) => !refs.has(x.option)).map((x) => x.option);
      if (wrong.length) throw new Error(`${section}/${key}: no such choice ${wrong.join(", ")}`);
      if (row.rules?.notAllowed?.length && !force.has(key)) { kept++; continue; }
      const rules = cleanRules({ ...(row.rules ?? {}), notAllowed: list });
      if (!rules?.notAllowed?.length) throw new Error(`${section}/${key}: malformed list`);
      if (WRITE) {
        const { error: e } = await sb.from("brand_items").update({ rules, updated_at: new Date().toISOString() }).eq("id", row.id);
        if (e) throw new Error(`${section}/${key}: ${e.message}`);
      }
      written++; marks += list.length;
    }
  }
  console.log(`not allowed: ${marks} choices in ${written} items ${WRITE ? "written" : "to write"} · ${kept} kept (already set)`);
  if (!WRITE) { console.log("dry run — add --write"); return; }

  /* read back — a write that "ran" is not a write that landed */
  const { data: after } = await sb.from("brand_items").select("rules").eq("tenant_id", tenant).not("rules->notAllowed", "is", null);
  console.log(`in the database: ${(after ?? []).length} items carry a not-allowed list`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
