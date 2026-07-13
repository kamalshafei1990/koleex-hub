/* ==========================================================================
   validate:access — per-persona probe suite for the access architecture.

   Signs in over HTTP as real (probe) accounts and asserts what each persona
   can and cannot reach — the executable form of the access vision:

     · Customer login: no Employees API, no Contacts directory, no cost
       history, no cost fields on product models, no people edits.
     · Internal login without can_view_private: salary/bank columns and
       account secrets stripped from employee detail; cost fields absent.
     · NOBODY ever receives password_hash in any API response.
     · Self-edit lockdown: people PATCH is 403 without Employees/Accounts
       edit rights (even for your own record).

   Requirements:
     · Dev server running (BASE_URL, default http://localhost:3001)
     · SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or .env.local) — used only
       to look up probe accounts and rotate their passwords for the run.
   Probe accounts (created by the P0-B cutover): p0b_admin, p0b_customer.
   Missing ones are skipped with a warning, never silently passed.
   ========================================================================== */

import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { hash as argon2Hash } from "@node-rs/argon2";

/* ── env (.env.local fallback so `npm run validate:access` just works) ── */
function loadEnvLocal() {
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch { /* no .env.local — rely on process.env */ }
}
loadEnvLocal();

const SUPA_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE_URL = process.env.KX_BASE_URL ?? "http://localhost:3001";
if (!SUPA_URL || !SERVICE_KEY) {
  console.warn("[access] SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required; skipping.");
  process.exit(0);
}
const db = createClient(SUPA_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ── tiny assertion harness (same style as the other validators) ── */
let pass = 0, fail = 0, skip = 0;
function ok(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function skipped(name: string, why: string) {
  skip++; console.log(`  ⏭️  ${name} — ${why}`);
}

/* ── HTTP helpers ── */
async function signIn(username: string, password: string): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/api/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) return null;
  // Node fetch: multiple Set-Cookie headers are accessible via getSetCookie().
  const cookies =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get("set-cookie") ?? ""];
  const jar = cookies.filter(Boolean).map((c) => c.split(";")[0]).join("; ");
  return jar || null;
}

async function api(cookie: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { Cookie: cookie, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, text, json: json as Record<string, unknown> | null };
}

/* ── probe account prep: rotate password so the run can sign in ── */
async function prepProbe(username: string): Promise<{ username: string; password: string; account: Record<string, unknown> } | null> {
  const { data: acc } = await db
    .from("accounts")
    .select("id, username, user_type, role_id, person_id, status, is_super_admin")
    .ilike("username", username)
    .maybeSingle();
  if (!acc) return null;
  const password = `Probe-${randomBytes(9).toString("base64url")}`;
  const password_hash = await argon2Hash(password, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const { error } = await db
    .from("accounts")
    .update({
      password_hash,
      password_algo: "argon2id",
      password_rehash_required: false,
      force_password_change: false,
      status: "active",
    })
    .eq("id", (acc as { id: string }).id);
  if (error) { console.warn(`[access] couldn't rotate ${username}: ${error.message}`); return null; }
  return { username: (acc as { username: string }).username, password, account: acc as Record<string, unknown> };
}

async function main() {
  console.log(`\n=== validate:access — probing ${BASE_URL} ===\n`);

  /* Reference records used as probe targets. */
  const [{ data: anyEmployee }, { data: anyProductModelProduct }, { data: anyPerson }] = await Promise.all([
    db.from("koleex_employees").select("id").limit(1).maybeSingle(),
    db.from("product_models").select("product_id").limit(1).maybeSingle(),
    db.from("people").select("id").limit(1).maybeSingle(),
  ]);
  const employeeId = (anyEmployee as { id?: string } | null)?.id;
  const productId = (anyProductModelProduct as { product_id?: string } | null)?.product_id;
  const personId = (anyPerson as { id?: string } | null)?.id;

  /* ── Persona: CUSTOMER (p0b_customer) ── */
  console.log("— customer persona (p0b_customer) —");
  const customer = await prepProbe("p0b_customer");
  if (!customer) {
    skipped("customer persona", "probe account p0b_customer not found");
  } else {
    const jar = await signIn(customer.username, customer.password);
    if (!jar) { ok("customer can sign in", false, "signin failed"); }
    else {
      ok("customer can sign in", true);
      if (employeeId) {
        const r = await api(jar, `/api/employees/${employeeId}`);
        ok("employee detail is 403 for customers", r.status === 403, `got ${r.status}`);
        ok("employee response never contains password_hash", !r.text.includes("password_hash"));
      } else skipped("employee detail 403", "no employees in DB");

      const contacts = await api(jar, "/api/contacts?type=customer");
      ok("contacts directory is 403 for customers", contacts.status === 403, `got ${contacts.status}`);

      if (productId) {
        const hist = await api(jar, `/api/products/cost-history?product_id=${productId}`);
        ok("cost history is 403 for customers", hist.status === 403, `got ${hist.status}`);

        const models = await api(jar, `/api/product-models?product_id=${productId}`);
        ok("product models load for customers", models.status === 200, `got ${models.status}`);
        ok(
          "model rows carry no cost_price / supplier / moq",
          models.status !== 200 ||
            (!models.text.includes("cost_price") && !models.text.includes('"supplier"') && !models.text.includes('"moq"')),
        );
      } else skipped("product cost checks", "no product models in DB");

      if (personId) {
        const patch = await api(jar, `/api/people/${personId}`, {
          method: "PATCH", body: JSON.stringify({ notes: "probe-should-fail" }),
        });
        ok("people PATCH is 403 for customers (self-edit lockdown)", patch.status === 403, `got ${patch.status}`);
      } else skipped("people PATCH 403", "no people rows");
    }
  }

  /* ── Persona: INTERNAL (p0b_admin) — assertions adapt to its role flags ── */
  console.log("\n— internal persona (p0b_admin) —");
  const admin = await prepProbe("p0b_admin");
  if (!admin) {
    skipped("internal persona", "probe account p0b_admin not found");
  } else {
    // Look up role flags so the assertions match what this role SHOULD see.
    // Account-level Super Admin bypasses every gate (by design) — model it.
    const isSA = (admin.account as { is_super_admin?: boolean }).is_super_admin === true;
    const roleId = (admin.account as { role_id?: string | null }).role_id ?? null;
    let canViewPrivate = isSA;
    let canViewEmployees = isSA;
    let canEditPeople = isSA;
    if (roleId) {
      const [{ data: role }, { data: perms }] = await Promise.all([
        db.from("roles").select("can_view_private").eq("id", roleId).maybeSingle(),
        db.from("koleex_permissions").select("module_name, can_view, can_edit").eq("role_id", roleId),
      ]);
      canViewPrivate ||= (role as { can_view_private?: boolean } | null)?.can_view_private === true;
      for (const p of (perms ?? []) as Array<{ module_name: string; can_view: boolean; can_edit: boolean }>) {
        const mod = p.module_name.toLowerCase();
        if (mod === "employees") { canViewEmployees ||= p.can_view; canEditPeople ||= p.can_edit; }
        if (mod === "accounts") canEditPeople ||= p.can_edit;
      }
    }
    console.log(`  (flags: super_admin=${isSA}, can_view_private=${canViewPrivate}, employees.view=${canViewEmployees}, people.edit=${canEditPeople})`);

    const jar = await signIn(admin.username, admin.password);
    if (!jar) { ok("internal probe can sign in", false, "signin failed"); }
    else {
      ok("internal probe can sign in", true);
      if (employeeId) {
        const r = await api(jar, `/api/employees/${employeeId}`);
        if (!canViewEmployees) {
          ok("employee detail is 403 without Employees module", r.status === 403, `got ${r.status}`);
        } else {
          ok("employee detail loads with Employees module", r.status === 200, `got ${r.status}`);
          if (r.status === 200 && !canViewPrivate) {
            ok("salary/bank columns stripped without can_view_private",
              !r.text.includes("initial_salary") && !r.text.includes("bank_account_number"));
          }
        }
        ok("employee response never contains password_hash", !r.text.includes("password_hash"));
      } else skipped("employee detail checks", "no employees in DB");

      {
        /* Use a random UUID so the probe NEVER mutates a real person row:
           gate passes → 404 (row not found), gate blocks → 403. */
        const ghost = "00000000-0000-4000-a000-0000000000aa";
        const patch = await api(jar, `/api/people/${ghost}`, {
          method: "PATCH", body: JSON.stringify({ notes: "probe" }),
        });
        if (canEditPeople) ok("people PATCH passes the gate with edit rights (404 on ghost row)", patch.status === 404, `got ${patch.status}`);
        else ok("people PATCH is 403 without edit rights (self-edit lockdown)", patch.status === 403, `got ${patch.status}`);
      }

      const canEdit = await api(jar, "/api/me/can-edit-profile");
      ok("can-edit-profile mirrors the PATCH rule",
        canEdit.status === 200 && (canEdit.json?.allowed === canEditPeople),
        `allowed=${String(canEdit.json?.allowed)} expected=${String(canEditPeople)}`);
    }
  }

  console.log(`\n=== validate:access — ${pass} passed, ${fail} failed, ${skip} skipped ===\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error("[access] fatal:", e); process.exit(1); });
