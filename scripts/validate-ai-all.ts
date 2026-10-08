#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   validate:ai — every Koleex AI and voice validator, one command.

   Forty-two suites guarded this code and not one of them ran anywhere but a
   developer's shell (audit, 2026-09-11). This runs each `validate:ai-*` and
   `validate:voice-*` script from package.json in turn, prints one line per
   suite, keeps the full output of the ones that fail, and exits non-zero if
   any did. The CI workflow (.github/workflows/validate-ai.yml) calls it on
   every pull request that touches the AI or voice code.

   Discovery is by name, so a new suite is covered the day it is added to
   package.json — nothing to register here.
   --------------------------------------------------------------------------- */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
const suites = Object.keys(pkg.scripts).filter((k) => /^validate:(ai|voice)-/.test(k)).sort();

const failed: Array<{ name: string; output: string }> = [];
const t0 = Date.now();
for (const name of suites) {
  const started = Date.now();
  const r = spawnSync("npm", ["run", "-s", name], { encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024 });
  const output = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  const summary = output.split("\n").reverse().find((l) => /passed|failed|OK|checks/.test(l))?.trim() ?? "";
  const ok = r.status === 0;
  console.log(`${ok ? "✓" : "✗"} ${name.padEnd(34)} ${String(Date.now() - started).padStart(6)} ms  ${summary}`);
  if (!ok) failed.push({ name, output });
}

console.log(`\nvalidate:ai — ${suites.length - failed.length}/${suites.length} suites passed in ${Math.round((Date.now() - t0) / 1000)} s`);
for (const f of failed) {
  console.log(`\n──── ${f.name} ────\n${f.output.trim()}\n`);
}
process.exit(failed.length > 0 ? 1 : 0);
