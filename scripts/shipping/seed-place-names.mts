/* ---------------------------------------------------------------------------
   Shipping — load the proposed port names into shipping_place_names.

       npm run shipping:seed-names            dry run, prints what would change
       npm run shipping:seed-names -- --apply actually writes

   Reads scripts/shipping/data/place-names.json (build-place-names.mts made
   it from Wikidata) and never the network. Every row goes in as PROPOSED:
   nothing it writes reaches a screen until a person approves it in
   Shipping → Port names.

   ⚠️ A PERSON'S DECISION IS NEVER OVERWRITTEN. A row that was approved,
   rejected or typed by hand is left exactly as it is; re-running the seed
   only refreshes proposals nobody has decided yet. Idempotent, never deletes.

   Needs the table from supabase/migrations/20260926_shipping_place_names.sql.
   --------------------------------------------------------------------------- */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { checkPlaceName, placeSearchKey, type PlaceNameLang } from "../../src/lib/shipping/place-names";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const BATCH = 500;

type Named = { name: string; qid: string };
type Entry = { locode: string; ar?: Named; zh?: Named };

/* The same .env.local reader as seed-shipping-reference.mts. */
function loadEnv(): Record<string, string> {
  const file = path.resolve(HERE, "..", "..", ".env.local");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.includes("=") || line.trim().startsWith("#")) continue;
    const i = line.indexOf("=");
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}
const FILE_ENV = loadEnv();
function env(name: string): string {
  /* .trim(): a pasted key with a trailing newline fails auth without saying why. */
  const v = (process.env[name] ?? FILE_ENV[name] ?? "").trim();
  if (!v) throw new Error(`missing env ${name} (set it in .env.local)`);
  return v;
}

async function main() {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, "data", "place-names.json"), "utf8")) as {
    built_at: string; counts: Record<string, number>; names: Entry[];
  };
  const proposals: Array<{ locode: string; lang: PlaceNameLang; name: string; qid: string }> = [];
  for (const e of data.names) {
    for (const lang of ["ar", "zh"] as const) {
      const n = e[lang];
      const name = n ? checkPlaceName(lang, n.name) : null;
      if (n && name) proposals.push({ locode: e.locode, lang, name, qid: n.qid });
    }
  }
  console.log(`Port names seed  ${APPLY ? "" : "(dry run — pass --apply to write)"}`);
  console.log(`  proposals built ${data.built_at}: ${proposals.length} (${proposals.filter((p) => p.lang === "ar").length} Arabic, ${proposals.filter((p) => p.lang === "zh").length} Chinese)`);

  const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });

  /* System ports by code. */
  const idByCode = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await db.from("shipping_ports").select("id, locode")
      .is("tenant_id", null).not("locode", "is", null).range(from, from + 999);
    if (error) throw new Error(`ports: ${error.message}`);
    for (const r of rows ?? []) idByCode.set(r.locode as string, r.id as string);
    if (!rows || rows.length < 1000) break;
  }

  /* What is already there. A row a person decided (approved, rejected, or
     typed by hand) is never written again; an undecided Wikidata proposal
     is refreshed only when the new build says something different. */
  const existing = new Map<string, { status: string; source: string; name: string; source_ref: string | null }>();
  for (let from = 0; ; from += 1000) {
    const { data: rows, error } = await db.from("shipping_place_names").select("port_id, lang, status, source, name, source_ref")
      .not("port_id", "is", null).range(from, from + 999);
    if (error) throw new Error(`place names: ${error.message} — is 20260926_shipping_place_names.sql applied?`);
    for (const r of rows ?? []) existing.set(`${r.port_id}|${r.lang}`, r as never);
    if (!rows || rows.length < 1000) break;
  }
  const decided = [...existing.values()].filter((r) => r.status !== "proposed" || r.source === "manual").length;

  const now = new Date().toISOString();
  const fresh: Array<Record<string, unknown>> = [];
  const refresh: Array<{ port_id: string; lang: PlaceNameLang; name: string; qid: string }> = [];
  let unknown = 0;
  for (const p of proposals) {
    const port_id = idByCode.get(p.locode);
    if (!port_id) { unknown++; continue; }
    const had = existing.get(`${port_id}|${p.lang}`);
    if (!had) {
      fresh.push({ port_id, lang: p.lang, name: p.name, search_key: placeSearchKey(p.name),
        status: "proposed", source: "wikidata", source_ref: p.qid, updated_at: now });
    } else if (had.status === "proposed" && had.source === "wikidata" && (had.name !== p.name || had.source_ref !== p.qid)) {
      refresh.push({ port_id, lang: p.lang, name: p.name, qid: p.qid });
    }
  }
  console.log(`  ${idByCode.size} coded ports · ${existing.size} names already in, ${decided} of them decided by a person (kept)`);
  if (unknown) console.log(`  ! ${unknown} proposals name a code no system port has — skipped`);
  console.log(`  would add ${fresh.length} proposals and refresh ${refresh.length}`);
  if (!APPLY) { console.log(`\n  nothing written.`); return; }

  /* New rows: ON CONFLICT DO NOTHING — if a reviewer created the row a moment
     ago, theirs stands. */
  let n = 0;
  for (let i = 0; i < fresh.length; i += BATCH) {
    const slice = fresh.slice(i, i + BATCH);
    const { error } = await db.from("shipping_place_names").upsert(slice, { onConflict: "port_id,lang", ignoreDuplicates: true });
    if (error) throw new Error(`insert: ${error.message}`);
    n += slice.length;
    process.stdout.write(`\r  added ${n}/${fresh.length}`);
  }
  if (fresh.length) console.log();
  /* Refreshes are guarded in the statement itself: only a row that is STILL an
     undecided Wikidata proposal changes, even if someone decided it after the
     read above. */
  for (const r of refresh) {
    const { error } = await db.from("shipping_place_names")
      .update({ name: r.name, search_key: placeSearchKey(r.name), source_ref: r.qid, updated_at: now })
      .eq("port_id", r.port_id).eq("lang", r.lang).eq("status", "proposed").eq("source", "wikidata");
    if (error) throw new Error(`refresh: ${error.message}`);
  }
  console.log(`\n✓ seeded — nothing shows until it is approved in Shipping → Port names`);
}

await main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
