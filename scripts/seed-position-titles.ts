/* Fill koleex_positions.title_zh / title_ar from
   supabase/seed/position-titles-i18n.json (English title → [zh, ar]).
   Only empty cells are written — a translation someone already edited is
   never overwritten. Dry run by default; `--write` to apply.

     npx tsx scripts/seed-position-titles.ts [--write] */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const WRITE = process.argv.includes("--write");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
const db = createClient(url, key);

const map = JSON.parse(readFileSync(join(process.cwd(), "supabase/seed/position-titles-i18n.json"), "utf8")) as Record<string, [string, string]>;

async function main() {
  const { data, error } = await db.from("koleex_positions").select("id, title, title_zh, title_ar");
  if (error) throw new Error(error.message);
  let matched = 0, written = 0;
  const missing = new Set<string>();
  for (const p of data ?? []) {
    const t = map[String(p.title ?? "").trim()];
    if (!t) { missing.add(String(p.title)); continue; }
    matched++;
    const patch: Record<string, string> = {};
    if (!p.title_zh) patch.title_zh = t[0];
    if (!p.title_ar) patch.title_ar = t[1];
    if (!Object.keys(patch).length) continue;
    if (WRITE) {
      for (let attempt = 1; ; attempt++) {
        const { error: e } = await db.from("koleex_positions").update(patch).eq("id", p.id);
        if (!e) break;
        if (attempt >= 4) throw new Error(`${p.title}: ${e.message}`);
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
    written++;
  }
  console.log(`${data?.length ?? 0} positions · ${matched} matched · ${written} ${WRITE ? "written" : "would be written"} · ${missing.size} without a translation${missing.size ? `: ${[...missing].join(" | ")}` : ""}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
