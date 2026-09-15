/* ---------------------------------------------------------------------------
   Shipping — load the generated port / airport reference data into Supabase.

       npm run shipping:seed            dry run, prints what would change
       npm run shipping:seed -- --apply actually writes

   Idempotent. Re-running it refreshes the system rows in place; it never
   touches a tenant's own rows (tenant_id is not null) and never deletes.

   Reads scripts/shipping/data/*.json, which `build-reference-dataset.mts`
   produced from UN/LOCODE + the NGA World Port Index + OurAirports. Seeding
   does NOT hit the network — the generated files are the source of truth, so
   a seed run is reproducible and a source going offline cannot block a deploy.
   --------------------------------------------------------------------------- */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(HERE, "data");
const APPLY = process.argv.includes("--apply");
const BATCH = 500;

type Port = {
  locode: string | null; name: string; name_official: string | null;
  country_code: string; country_name: string; lat: number | null; lng: number | null;
  harbor_size: string | null; harbor_type: string | null; is_container: boolean | null;
  wpi_number: number | null; sea_region: string | null; subdivision: string | null;
  in_koleex_list: boolean; source: string;
};
type Alias = { locode_key: string; alias: string; raw: string; kind: string };
type Airport = {
  iata: string; icao: string | null; locode: string | null; name: string;
  country_code: string; municipality: string | null;
  lat: number | null; lng: number | null; size: "large" | "medium";
};

const read = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8")) as T;

/** Must match keyOf() in build-reference-dataset.mts exactly. */
const strip = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const normRaw = (s: string) => strip(s).replace(/[^a-z0-9]+/g, " ").trim();
const keyOf = (p: { locode: string | null; country_code: string; name: string }) =>
  p.locode ?? `X:${p.country_code}:${normRaw(p.name)}`;

/* Same .env.local reader as scripts/apply-migration.mts — the repo carries no
   dotenv dependency and does not need one for a handful of keys. */
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
  /* .trim() is load-bearing: a trailing newline on a pasted Supabase key
     fails auth with an error that names neither the key nor the newline. */
  const v = (process.env[name] ?? FILE_ENV[name] ?? "").trim();
  if (!v) throw new Error(`missing env ${name} (set it in .env.local)`);
  return v;
}

async function main() {
  const ports = read<Port[]>("ports.json");
  const aliases = read<Alias[]>("port-aliases.json");
  const airports = read<Airport[]>("airports.json");
  const meta = read<{ built_at: string; counts: Record<string, number> }>("meta.json");

  console.log(`Shipping reference seed  ${APPLY ? "" : "(dry run — pass --apply to write)"}`);
  console.log(`  dataset built ${meta.built_at}`);
  console.log(`  ports ${ports.length}  aliases ${aliases.length}  airports ${airports.length}\n`);

  if (!APPLY) {
    const withCode = ports.filter((p) => p.locode).length;
    console.log(`  would upsert ${ports.length} ports (${withCode} with UN/LOCODE)`);
    console.log(`  would upsert ${airports.length} airports`);
    console.log(`  would replace the system alias set (${aliases.length} rows)`);
    console.log(`\n  nothing written.`);
    return;
  }

  const db = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });

  /* ── ports ─────────────────────────────────────────────────────────────
     Split by whether the row has a code: the unique index that makes an
     upsert possible is the partial one on `locode`, so code-less ports
     cannot use onConflict and are reconciled by (country_code, name). */
  const coded = ports.filter((p) => p.locode);
  const uncoded = ports.filter((p) => !p.locode);

  let n = 0;
  for (let i = 0; i < coded.length; i += BATCH) {
    const slice = coded.slice(i, i + BATCH).map((p) => ({ ...p, tenant_id: null, updated_at: new Date().toISOString() }));
    const { error } = await db.from("shipping_ports").upsert(slice, { onConflict: "locode", ignoreDuplicates: false });
    if (error) throw new Error(`ports upsert: ${error.message}`);
    n += slice.length;
    process.stdout.write(`\r  ports ${n}/${coded.length}`);
  }
  console.log();

  for (const p of uncoded) {
    const { data: found } = await db.from("shipping_ports").select("id")
      .is("tenant_id", null).is("locode", null)
      .eq("country_code", p.country_code).eq("name", p.name).maybeSingle();
    if (found) {
      const { error } = await db.from("shipping_ports").update({ ...p, updated_at: new Date().toISOString() }).eq("id", found.id);
      if (error) throw new Error(`port update ${p.name}: ${error.message}`);
    } else {
      const { error } = await db.from("shipping_ports").insert({ ...p, tenant_id: null });
      if (error) throw new Error(`port insert ${p.name}: ${error.message}`);
    }
  }
  console.log(`  ports ${coded.length} by code + ${uncoded.length} by name`);

  /* ── id map, built with the same key function the dataset used ───────── */
  const idByKey = new Map<string, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("shipping_ports")
      .select("id, locode, country_code, name").is("tenant_id", null)
      .range(from, from + 999);
    if (error) throw new Error(`ports read-back: ${error.message}`);
    if (!data?.length) break;
    for (const r of data) idByKey.set(keyOf(r as never), r.id);
    if (data.length < 1000) break;
  }
  console.log(`  resolved ${idByKey.size} port ids`);

  /* ── aliases ───────────────────────────────────────────────────────────
     Replaced wholesale rather than upserted: an alias that was REMOVED from
     the dataset (a bad match corrected upstream) has to disappear, and an
     upsert cannot express a deletion. Scoped to system ports only. */
  const rows = aliases
    .map((a) => ({ port_id: idByKey.get(a.locode_key), alias: a.alias, raw: a.raw, kind: a.kind }))
    .filter((r): r is { port_id: string; alias: string; raw: string; kind: string } => Boolean(r.port_id));
  const orphans = aliases.length - rows.length;
  if (orphans) console.warn(`  ! ${orphans} aliases had no port — skipped`);

  /* Chunked: 3,800 uuids in one .in() builds a URL the platform drops with a
     bare "fetch failed" rather than a 414, which is a confusing way to learn
     you exceeded a request-line limit. */
  const allIds = [...idByKey.values()];
  for (let i = 0; i < allIds.length; i += 200) {
    const { error } = await db.from("shipping_port_aliases").delete().in("port_id", allIds.slice(i, i + 200));
    if (error) throw new Error(`alias clear: ${error.message}`);
    process.stdout.write(`\r  clearing aliases ${Math.min(i + 200, allIds.length)}/${allIds.length}`);
  }
  console.log();

  n = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const { error } = await db.from("shipping_port_aliases").upsert(slice, { onConflict: "alias,kind,port_id" });
    if (error) throw new Error(`alias upsert: ${error.message}`);
    n += slice.length;
    process.stdout.write(`\r  aliases ${n}/${rows.length}`);
  }
  console.log();

  /* ── airports ──────────────────────────────────────────────────────────── */
  n = 0;
  for (let i = 0; i < airports.length; i += BATCH) {
    const slice = airports.slice(i, i + BATCH).map((a) => ({ ...a, tenant_id: null, updated_at: new Date().toISOString() }));
    const { error } = await db.from("shipping_airports").upsert(slice, { onConflict: "iata", ignoreDuplicates: false });
    if (error) throw new Error(`airports upsert: ${error.message}`);
    n += slice.length;
    process.stdout.write(`\r  airports ${n}/${airports.length}`);
  }
  console.log(`\n\n✓ seeded`);
}

await main().catch((e) => { console.error(`\n✗ ${e instanceof Error ? e.message : String(e)}`); process.exit(1); });
