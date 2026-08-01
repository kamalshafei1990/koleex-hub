/* KDS census v2 — style divergence per app, with DATA-COLOR classification.
   Run: npx tsx scripts/kds-census.ts
   v2 lesson (Products pilot): hex on data lines (color-name maps, swatch
   lists: `name:`, `hex:`, colou?r keys) is PRODUCT DATA, not UI chrome. */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
const PX = /text-\[(\d+(?:\.\d+)?)px\]/g;
const TOKEN = /var\(--[a-z-]+\)/g;
const DATA_LINE = /(name\s*:|hex\s*:|colou?r\s*:|swatch|"#[0-9a-fA-F]{6}",?\s*$)/i;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

const APPS = readdirSync("src/app").filter((d) => {
  try { return statSync(join("src/app", d)).isDirectory(); } catch { return false; }
});

type Row = { app: string; uiHex: number; dataHex: number; px: number; tokens: number; kloc: number; div: number };
const rows: Row[] = [];
for (const app of APPS) {
  const files = [...walk(join("src/app", app)), ...walk(join("src/components", app))];
  if (!files.length) continue;
  const ui = new Set<string>(), data = new Set<string>(), px = new Set<string>();
  let tokens = 0, loc = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    loc += src.split("\n").length;
    tokens += (src.match(TOKEN) ?? []).length;
    for (const line of src.split("\n")) {
      const hexes = line.match(HEX) ?? [];
      if (!hexes.length) continue;
      const bucket = DATA_LINE.test(line) ? data : ui;
      hexes.forEach((h) => bucket.add(h.toLowerCase()));
    }
    (readFileSync(f, "utf8").match(PX) ?? []).forEach((m) => px.add(m));
  }
  const kloc = Math.max(loc / 1000, 1);
  rows.push({ app, uiHex: ui.size, dataHex: data.size, px: px.size, tokens, kloc: loc / 1000, div: Math.round(((ui.size * 2 + px.size) / kloc) * 10) / 10 });
}
rows.sort((a, b) => b.div - a.div);
console.log("app".padEnd(18) + "kLOC".padStart(7) + "uiHex".padStart(7) + "dataHex".padStart(9) + "pxSizes".padStart(9) + "tokens".padStart(8) + "divergence".padStart(12));
for (const r of rows) {
  console.log(r.app.padEnd(18) + r.kloc.toFixed(1).padStart(7) + String(r.uiHex).padStart(7) + String(r.dataHex).padStart(9) + String(r.px).padStart(9) + String(r.tokens).padStart(8) + String(r.div).padStart(12));
}
