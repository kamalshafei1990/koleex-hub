/* validate:roles — assertion suite for the Roles & Permissions app.
   This app IS the access-control surface, so a silent regression here is a
   privilege-escalation, not a bug. Greps the source so a refactor cannot
   quietly drop an SA check, revive the anon-key write fallback, or ship a
   clone that skips the roles-mirror / audit trail. Plain node, matching
   every other validate:* script. */

import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
function check(name, ok, detail = "") {
  if (ok) pass++;
  else { fail++; console.error(`  ✗ ${name}${detail ? " — " + detail : ""}`); }
}

/* ── API routes: every write is Super-Admin-gated ── */
const rolesApi = readFileSync("src/app/api/roles/route.ts", "utf8");
const roleIdApi = readFileSync("src/app/api/roles/[id]/route.ts", "utf8");
const cloneApi = readFileSync("src/app/api/roles/[id]/clone/route.ts", "utf8");
const permsApi = readFileSync("src/app/api/permissions/route.ts", "utf8");

check("POST /api/roles requires SA", rolesApi.includes("auth.is_super_admin"));
check("PATCH+DELETE /api/roles/[id] require SA", (roleIdApi.match(/auth\.is_super_admin/g) ?? []).length >= 2);
check("clone requires SA", cloneApi.includes("auth.is_super_admin"));
check("PUT /api/permissions requires SA", permsApi.includes("auth.is_super_admin"));
check("GET /api/permissions is admin-gated (not any-authenticated)",
  permsApi.includes('requireModuleAccess(auth, "Management")') && permsApi.includes('requireModuleAccess(auth, "Accounts")'));

/* ── Delete safety ── */
check("DELETE refuses while accounts still use the role", roleIdApi.includes("still use this role") && roleIdApi.includes("409"));
check("DELETE cleans permissions + both role tables",
  roleIdApi.includes('from("koleex_permissions").delete()') && roleIdApi.includes('from("roles").delete()'));

/* ── Mirror discipline: koleex_roles ↔ roles must never diverge ── */
check("POST mirrors into roles", rolesApi.includes('.from("roles")') && rolesApi.includes("upsert(mirrorRow"));
check("PATCH mirrors into roles", roleIdApi.includes("MIRROR_KEYS"));
check("clone mirrors into roles (FK accounts.role_id)", cloneApi.includes('from("roles").upsert('));
check("clone does NOT copy break-glass flags",
  cloneApi.includes("is_super_admin: false") && cloneApi.includes("can_view_private: false")
  && cloneApi.includes("Deliberately NOT copied"));

/* ── Audit trail on every mutation ── */
check("create is audited", rolesApi.includes("logAudit"));
check("patch + delete are audited", (roleIdApi.match(/logAudit/g) ?? []).length >= 2);
check("clone is audited", cloneApi.includes("logAudit") && cloneApi.includes("cloned_from"));

/* ── Client lib: no anon-key writes to role/permission tables ── */
const admin = readFileSync("src/lib/management-admin.ts", "utf8");
{
  /* Scan only the roles/permissions section (createRole → end of
     upsertPermissions) for supabaseAdmin WRITE verbs. */
  const start = admin.indexOf("export async function createRole");
  const end = admin.indexOf("POSITION HISTORY");
  const section = admin.slice(start, end);
  const writes = section.match(/supabaseAdmin\s*\n?\s*\.from\("(koleex_roles|koleex_permissions|roles)"\)\s*\n?\s*\.(insert|update|upsert|delete)/g) ?? [];
  check("no anon-key write fallback for roles/permissions", writes.length === 0, `found ${writes.length}`);
  check("write fallbacks return an error instead", section.includes("Network error — role not created.") && section.includes("Network error — permissions not saved."));
}

/* ── Page gate: /roles is SA-only, loading ≠ denied ── */
const page = readFileSync("src/app/roles/page.tsx", "utf8");
check("/roles page gates on isSuperAdmin", page.includes("useMeBootstrap") && page.includes("boot && !isSA"));
check("loading bootstrap shows spinner, not denial", page.includes("bootLoading && !boot"));
check("non-SA does not even fetch roles", page.includes("if (boot && !isSA) return; // locked screen"));
check("delete disabled while role is in use", page.includes("disabled={(role.accounts_count ?? 0) > 0}"));
check("dangerous flags surfaced on the row", page.includes("badge.superAdmin") && page.includes("badge.breakGlass"));

/* ── Registry discipline (standing rule) ── */
const pm = readFileSync("src/lib/permission-modules.ts", "utf8");
check("module list derives from APP_REGISTRY", pm.includes("APP_REGISTRY") && pm.includes("SIDEBAR_GROUPS"));
check("Roles itself is never governable", pm.includes('NOT_GOVERNABLE') && pm.includes('"roles"'));

console.log(`\nvalidate:roles — ${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("validate:roles passed");
