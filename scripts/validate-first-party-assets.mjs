/* Repo guard (China R3): fail if new browser-facing code references Supabase
   Storage directly. Server-side code (src/app/api, src/lib/server) is exempt
   — it's supposed to talk to storage. Allowlisted legacy sites are listed
   with reasons; shrink this list, never grow it silently.
   Run: node scripts/validate-first-party-assets.mjs   (CI-friendly, exit 1 on findings) */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ALLOW = new Set([
  // intentionally retained (reason: URL construction for uploads / data fields, not browser fetches)
  "src/lib/storage-client.ts",
  "src/lib/cdn.ts",              // the interception point itself
  // SVG icon builders: optimizer-incompatible (SVG deliberately blocked from
  // the image pipeline); all have local fallbacks (glyph/Simple Icons) so CN
  // degradation is graceful. Candidates for a public-icon /api/files category.
  "src/components/todo/ProductPicker.tsx",
  "src/components/knowledge/product-coding/taxonomy-logo.ts",
  "src/components/icons/brands/BrandGlyph.tsx",
  // Large installer downloads — module-gated future /api/files "software" category.
  "src/lib/software-center.ts",
]);
const BAD = [/storage\/v1\/object\/public\//, /storage\/v1\/render\/image\//];
const findings = [];
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (p.includes("src/app/api") || p.includes("src/lib/server")) continue; // server-side exempt
      walk(p);
    } else if (/\.(tsx?|css)$/.test(f)) {
      const rel = relative(ROOT, p);
      if (ALLOW.has(rel)) continue;
      const src = readFileSync(p, "utf8");
      for (const re of BAD) {
        const m = src.match(re);
        if (m) findings.push(`${rel}: ${m[0]}`);
      }
    }
  }
}
walk(join(ROOT, "src"));
if (findings.length) {
  console.error("Browser-direct Supabase Storage references found (route via cdnImage/fpAvatar or /api/files):");
  for (const f of findings) console.error("  " + f);
  process.exit(1);
}
console.log("validate:first-party OK — no browser-direct storage references outside the allowlist.");
