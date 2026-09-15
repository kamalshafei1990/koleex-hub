#!/usr/bin/env tsx
/* ---------------------------------------------------------------------------
   seed-contracts-module — give every role that could already reach a contract
   the same reach under the new "Contracts" module.

   WHY THIS EXISTS. Contracts used to ride the Invoices permission, because a
   contract was only reachable from the invoice it was raised on. Shipping the
   Contracts app made it a module of its own — and the permission system is
   DENY BY DEFAULT, so the moment the API stopped asking about Invoices, all
   24 roles holding Invoices would have lost contracts with nothing on screen
   to explain why. A new app that silently revokes access is not a new app,
   it is an outage.

   So the module is seeded to EXACTLY what Invoices grants today: same view,
   create, edit, delete, same data_scope. Nothing is widened. From here the
   owner can turn Contracts down in Roles & Permissions independently — which
   is the whole reason it became its own module.

   IDEMPOTENT. A role that already has a Contracts row is left alone, so a
   second run cannot overwrite a decision made in the Roles UI after the
   first. DRY RUN BY DEFAULT.

       npx tsx scripts/seed-contracts-module.mts
       npx tsx scripts/seed-contracts-module.mts --apply
   --------------------------------------------------------------------------- */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");

const env = readFileSync(".env.local", "utf8");
const envGet = (k: string) =>
  env.split("\n").find((l) => l.startsWith(k + "="))?.slice(k.length + 1).trim().replace(/^["']|["']$/g, "") ?? "";
const sb = createClient(envGet("NEXT_PUBLIC_SUPABASE_URL"), envGet("SUPABASE_SERVICE_ROLE_KEY"));

type Perm = {
  role_id: string;
  module_name: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  data_scope: string | null;
};

const { data: roles, error: rolesErr } = await sb.from("koleex_roles").select("id, name");
if (rolesErr) throw new Error(rolesErr.message);
const roleName = new Map((roles ?? []).map((r) => [r.id as string, r.name as string]));

const { data: perms, error: permErr } = await sb
  .from("koleex_permissions")
  .select("role_id, module_name, can_view, can_create, can_edit, can_delete, data_scope")
  .in("module_name", ["Invoices", "Contracts"]);
if (permErr) throw new Error(permErr.message);

const invoices = (perms ?? []).filter((p) => (p as Perm).module_name === "Invoices") as Perm[];
const already = new Set((perms ?? []).filter((p) => (p as Perm).module_name === "Contracts").map((p) => (p as Perm).role_id));

const toInsert = invoices
  .filter((p) => !already.has(p.role_id))
  .map((p) => ({
    role_id: p.role_id,
    module_name: "Contracts",
    can_view: p.can_view,
    can_create: p.can_create,
    can_edit: p.can_edit,
    can_delete: p.can_delete,
    data_scope: p.data_scope ?? "all",
  }));

console.log(`Invoices rows: ${invoices.length}`);
console.log(`Contracts rows already present: ${already.size}`);
console.log(`Would insert: ${toInsert.length}\n`);
for (const r of toInsert) {
  const flags = [r.can_view && "view", r.can_create && "create", r.can_edit && "edit", r.can_delete && "delete"]
    .filter(Boolean)
    .join("/") || "none";
  console.log(`  ${(roleName.get(r.role_id) ?? r.role_id).padEnd(22)} ${flags}  (${r.data_scope})`);
}

if (!APPLY) {
  console.log("\nDRY RUN — pass --apply to write.");
  process.exit(0);
}

if (toInsert.length) {
  const { error } = await sb.from("koleex_permissions").insert(toInsert);
  if (error) throw new Error(error.message);
}

/* Verify by re-reading rather than trusting the insert's own report: the
   thing that must be true afterwards is that no role which could see a
   contract yesterday is missing one today. */
const { data: after } = await sb
  .from("koleex_permissions")
  .select("role_id, can_view")
  .eq("module_name", "Contracts");
const grantedNow = new Set((after ?? []).filter((r) => r.can_view).map((r) => r.role_id as string));
const lost = invoices.filter((p) => p.can_view && !grantedNow.has(p.role_id));

console.log(`\nApplied. Contracts rows now: ${after?.length ?? 0}`);
if (lost.length) {
  console.log(`FAIL — ${lost.length} role(s) lost access: ${lost.map((p) => roleName.get(p.role_id)).join(", ")}`);
  process.exit(1);
}
console.log("OK — every role that could see a contract before still can.");
