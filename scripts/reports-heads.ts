#!/usr/bin/env node
/* reports:heads — writes src/lib/reports/catalog-heads.ts from the catalog
 * of built-in report types (Phase 5C heads split). Run it after any change
 * to src/lib/reports/catalog.ts; validate:reports fails until you do.
 *
 *   --check   say whether the file is current (exit 1 when it is not)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAMILY_GROUPS, REPORT_TEMPLATES } from "../src/lib/reports/catalog";
import { HEADS_FILE, renderReportHeads } from "./lib/reports-heads";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(ROOT, HEADS_FILE);
const next = renderReportHeads(REPORT_TEMPLATES, FAMILY_GROUPS);
const now = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";

if (process.argv.includes("--check")) {
  console.log(now === next ? `${HEADS_FILE}: current (${REPORT_TEMPLATES.length} types)` : `${HEADS_FILE}: STALE — run npm run -s reports:heads`);
  process.exit(now === next ? 0 : 1);
}
if (now === next) {
  console.log(`${HEADS_FILE}: already current (${REPORT_TEMPLATES.length} types)`);
} else {
  fs.writeFileSync(file, next);
  console.log(`${HEADS_FILE}: written (${REPORT_TEMPLATES.length} types)`);
}
