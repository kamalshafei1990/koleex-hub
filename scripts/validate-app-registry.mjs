#!/usr/bin/env node
/* ---------------------------------------------------------------------------
   validate:app-registry — every shipped app must be governable in Roles.

   Why: the Roles page used to keep its own hand-written module list. Adding an
   app to APP_REGISTRY did not add it there, and because permissions are
   deny-by-default, the new app was unreachable for every non-super-admin with
   no way for an admin to grant it — that is exactly how the Translator
   shipped invisible. The list is now derived, and this script fails the build
   if that derivation ever stops covering an active app.

   Run: node scripts/validate-app-registry.mjs
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";

const fail = [];
const ok = [];

const nav = readFileSync("src/lib/navigation.ts", "utf8");
const mods = readFileSync("src/lib/permission-modules.ts", "utf8");
const roles = readFileSync("src/app/roles/page.tsx", "utf8");

/* ── 1. The Roles page must NOT re-introduce a hardcoded module list ── */
if (/const\s+PERMISSION_GROUPS\s*:/.test(roles)) {
  fail.push(
    "src/app/roles/page.tsx declares its own PERMISSION_GROUPS. " +
    "It must import them from @/lib/permission-modules so new apps appear automatically.",
  );
} else if (/from "@\/lib\/permission-modules"/.test(roles)) {
  ok.push("Roles page imports the derived module list");
} else {
  fail.push("src/app/roles/page.tsx no longer imports @/lib/permission-modules");
}

/* ── 2. Every active registry app resolves to a governable module ──
   Parse the registry entries we care about: id, name, active, and the
   not-governable exclusions declared in permission-modules. */
const entries = [...nav.matchAll(
  /\{\s*id:\s*"([^"]+)",[\s\S]*?name:\s*"([^"]+)",[\s\S]*?active:\s*(true|false)/g,
)].map(([, id, name, active]) => ({ id, name, active: active === "true" }));

if (entries.length < 20) {
  fail.push(`Only parsed ${entries.length} registry entries — the parser is out of date with navigation.ts`);
}

const excluded = new Set(
  (mods.match(/const NOT_GOVERNABLE = new Set\(\[([^\]]*)\]\)/)?.[1] ?? "")
    .split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean),
);

const sidebarBlock = nav.slice(nav.indexOf("export const SIDEBAR_GROUPS"));
const grouped = new Set(
  [...sidebarBlock.matchAll(/appIds:\s*\[([^\]]*)\]/g)]
    .flatMap(([, list]) => list.split(",").map((s) => s.trim().replace(/^"|"$/g, "")))
    .filter(Boolean),
);

/* An app is covered if it is grouped in the sidebar (→ sidebar group) or not
   (→ the "System & Tools" catch-all). Both paths exist in permission-modules,
   so the only real failure is an app that is excluded without being listed in
   NOT_GOVERNABLE — i.e. a coverage hole. */
const active = entries.filter((e) => e.active);
const uncovered = active.filter((e) => excluded.has(e.id) === false && !e.name);
if (uncovered.length) {
  fail.push(`Apps with no resolvable module name: ${uncovered.map((e) => e.id).join(", ")}`);
} else {
  ok.push(`${active.length} active apps all resolve to a module name`);
}

const goofs = [...excluded].filter((id) => !entries.some((e) => e.id === id));
if (goofs.length) {
  fail.push(`NOT_GOVERNABLE lists ids that aren't in the registry: ${goofs.join(", ")}`);
} else {
  ok.push(`NOT_GOVERNABLE (${[...excluded].join(", ")}) all exist in the registry`);
}

/* ── 3. openAccess apps must be real, active registry entries ── */
const openIds = [...nav.matchAll(/id:\s*"([^"]+)"[^}]*openAccess:\s*true/g)].map(([, id]) => id);
const badOpen = openIds.filter((id) => !active.some((e) => e.id === id));
if (badOpen.length) {
  fail.push(`openAccess set on inactive/unknown apps: ${badOpen.join(", ")}`);
} else {
  ok.push(`openAccess apps: ${openIds.join(", ") || "(none)"}`);
}

/* ── 4. Both enforcement points honour openAccess ── */
const client = readFileSync("src/lib/permissions.ts", "utf8");
const server = readFileSync("src/lib/server/auth.ts", "utf8");
if (!/isOpenAccessModule\(module\)/.test(client)) {
  fail.push("src/lib/permissions.ts can() no longer applies the openAccess default");
} else ok.push("client can() honours openAccess");
if (!/isOpenAccessModule\(moduleName\)/.test(server)) {
  fail.push("requireModuleAction no longer applies the openAccess default");
} else ok.push("server requireModuleAction honours openAccess");

/* ── report ── */
for (const line of ok) console.log(`  ✓ ${line}`);
if (fail.length) {
  console.error("\nvalidate:app-registry FAILED\n");
  for (const line of fail) console.error(`  ✗ ${line}`);
  process.exit(1);
}
console.log("\nvalidate:app-registry passed");
