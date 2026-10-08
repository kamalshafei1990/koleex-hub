#!/usr/bin/env tsx

/* ===========================================================================
   seed-brand-center — fills the Brand Center library (plan step C3) from the
   owner's workshop choices (supabase/seed/brand-center-library.json,
   28/09/2026): 21 sections, their groups, 428 items, every type and option
   with the owner's pick in `chosen`.

   Safe to run again: rows are matched by their keys and UPDATED, never
   duplicated, and nothing the owner added in the Hub (designs, files, new
   items, rules) is touched or deleted.

     npx tsx scripts/seed-brand-center.ts            # dry run: counts only
     npx tsx scripts/seed-brand-center.ts --write    # write to the database
   =========================================================================== */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(join(__dirname, "..", ".env.local"));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(), process.env.SUPABASE_SERVICE_ROLE_KEY!.trim());
const WRITE = process.argv.includes("--write");

type Option = { key: string; label: string; recommended: boolean; chosen: boolean };
type Type = { key: string; label: string; options: Option[] };
type Item = { key: string; name: string; use: string; importance: string; decision: string; note: string; ownerNote: string; types: Type[] };
type Section = { key: string; no: number; name: string; icon: string; groups: Array<{ name: string; items: Item[] }> };
const lib = JSON.parse(readFileSync(join(__dirname, "..", "supabase", "seed", "brand-center-library.json"), "utf8")) as { sections: Section[] };

/* A weak line drops single requests ("fetch failed"): every call is retried
   with a growing pause, and the writes are batched per group (~430 requests
   for the whole library instead of ~4,500). */
async function call<T>(what: string, run: () => PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  let wait = 1000;
  for (let i = 0; ; i++) {
    try {
      const { data, error } = await run();
      if (error) throw new Error(error.message);
      if (data === null) throw new Error("no row");
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (i < 6 && /fetch failed|ECONNRESET|timeout|network/i.test(msg)) { await new Promise((r) => setTimeout(r, wait)); wait *= 2; continue; }
      throw new Error(`${what}: ${msg}`);
    }
  }
}

async function main() {
  const acc = await call("owner account", () => sb.from("accounts").select("tenant_id").eq("username", "kamal").maybeSingle());
  const tenant = (acc as unknown as { tenant_id: string }).tenant_id;
  const count = { sections: 0, groups: 0, items: 0, types: 0, options: 0 };
  for (const s of lib.sections) {
    count.sections++;
    for (const g of s.groups) { count.groups++; for (const it of g.items) { count.items++; for (const t of it.types) { count.types++; count.options += t.options.length; } } }
  }
  console.log(`library: ${JSON.stringify(count)} · tenant ${tenant}`);
  if (!WRITE) { console.log("dry run — add --write to fill the database"); return; }

  const now = new Date().toISOString();
  for (const s of lib.sections) {
    const sec = await call(`section ${s.key}`, () => sb.from("brand_sections").upsert(
      { tenant_id: tenant, key: s.key, no: s.no, name: s.name, icon: s.icon, updated_at: now },
      { onConflict: "tenant_id,key" }).select("id").single()) as { id: string };
    let itemSort = 0;
    for (const [gi, g] of s.groups.entries()) {
      const grp = await call(`group ${g.name}`, () => sb.from("brand_groups").upsert(
        { tenant_id: tenant, section_id: sec.id, name: g.name, sort: gi, updated_at: now },
        { onConflict: "section_id,name" }).select("id").single()) as { id: string };
      const itemRows = g.items.map((it) => ({
        tenant_id: tenant, section_id: sec.id, group_id: grp.id, key: it.key, name: it.name, use_text: it.use,
        importance: it.importance, decision: it.decision, note: it.note || null, owner_note: it.ownerNote || null,
        sort: itemSort++, updated_at: now,
      }));
      const items = await call(`items of ${g.name}`, () => sb.from("brand_items").upsert(itemRows, { onConflict: "section_id,key" }).select("id, key")) as Array<{ id: string; key: string }>;
      const itemId = new Map(items.map((r) => [r.key, r.id]));
      const typeRows = g.items.flatMap((it) => it.types.map((t, ti) => ({ tenant_id: tenant, item_id: itemId.get(it.key)!, key: t.key, label: t.label, sort: ti })));
      const types = await call(`types of ${g.name}`, () => sb.from("brand_item_types").upsert(typeRows, { onConflict: "item_id,key" }).select("id, key, item_id")) as Array<{ id: string; key: string; item_id: string }>;
      const typeId = new Map(types.map((r) => [`${r.item_id}/${r.key}`, r.id]));
      const optionRows = g.items.flatMap((it) => it.types.flatMap((t) => t.options.map((o, oi) => ({
        tenant_id: tenant, item_id: itemId.get(it.key)!, type_id: typeId.get(`${itemId.get(it.key)}/${t.key}`)!,
        key: o.key, label: o.label, recommended: o.recommended, chosen: o.chosen, sort: oi,
      }))));
      await call(`options of ${g.name}`, async () => {
        const r = await sb.from("brand_item_options").upsert(optionRows, { onConflict: "type_id,key" });
        return { data: r.error ? null : true, error: r.error };
      });
    }
    console.log(`  ✓ ${String(s.no).padStart(2, "0")} ${s.name}`);
  }

  /* Read back and compare — a seed that "ran" is not a seed that landed. */
  const n = async (table: string) => (await sb.from(table).select("id", { count: "exact", head: true }).eq("tenant_id", tenant)).count ?? -1;
  const got = { sections: await n("brand_sections"), groups: await n("brand_groups"), items: await n("brand_items"), types: await n("brand_item_types"), options: await n("brand_item_options") };
  const notChosen = (await sb.from("brand_item_options").select("id", { count: "exact", head: true }).eq("tenant_id", tenant).eq("chosen", false)).count;
  console.log(`in the database: ${JSON.stringify(got)} · not chosen: ${notChosen}`);
  const ok = (Object.keys(count) as Array<keyof typeof count>).every((k) => got[k] >= count[k]);
  console.log(ok ? "seed-brand-center: OK" : "seed-brand-center: MISMATCH");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
