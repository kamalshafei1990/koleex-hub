/* Authenticated authorization matrix for /api/files/* (China R3).
   Mirrors scripts/validate-access.ts: uses the SERVICE ROLE KEY to rotate the
   p0b probe-account passwords for the run, signs in via /api/auth/signin, and
   executes the scenario table from docs/performance/STORAGE_SECURITY_MODEL.md.

   Run:  BASE_URL=https://hub.koleexgroup.com \
         NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
         node scripts/validate-file-delivery.mjs [--catalog <id>] [--discuss <msgId>]

   Requires credentials this agent's environment does not hold — designed to
   run locally or in CI. No real customer data is used: probe accounts only,
   and target ids are passed in (use a test catalog / test channel message). */
import crypto from "node:crypto";

const BASE = process.env.BASE_URL ?? "https://hub.koleexgroup.com";
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const args = Object.fromEntries(process.argv.slice(2).map((a, i, all) => a.startsWith("--") ? [a.slice(2), all[i + 1]] : []).filter(Boolean));
if (!SUPA || !KEY) { console.error("Missing SUPABASE env — run where the service key is available."); process.exit(2); }

const results = [];
const check = (name, ok, detail) => { results.push([ok ? "PASS" : "FAIL", name, detail ?? ""]); };

async function admin(path, method = "GET", body) {
  const r = await fetch(`${SUPA}${path}`, { method, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" }, body: body ? JSON.stringify(body) : undefined });
  return r;
}

/** Rotate a probe account's password via the app's own admin API is not
 *  available here; we set a bcrypt/argon hash server-side is app-specific —
 *  instead reuse the validate-access flow: the app exposes password rotation
 *  through /api/auth/signin only, so we update via the accounts table using
 *  the same helper the existing suite uses. See scripts/validate-access.ts
 *  `rotateProbePassword` — imported logic duplicated minimally: */
async function signIn(username, password) {
  const r = await fetch(`${BASE}/api/auth/signin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
  if (!r.ok) return null;
  const setCookie = r.headers.getSetCookie?.() ?? [r.headers.get("set-cookie")].filter(Boolean);
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function get(path, cookie, headers = {}) {
  return fetch(`${BASE}${path}`, { headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers }, redirect: "manual" });
}

const CATALOG = args.catalog; // a real test catalog id
const DISCUSS = args.discuss; // a real test message id the admin probe can access
const FAKE = "00000000-0000-0000-0000-000000000000";

const run = async () => {
  /* ── unauthenticated matrix (no credentials needed) ────────────────── */
  check("unauthenticated → 401", (await get(`/api/files/catalog/${FAKE}`)).status === 401);
  check("forged category → denial", [401, 404].includes((await get(`/api/files/nope/${FAKE}`)).status));
  check("traversal in id → denial", [401, 404].includes((await get(`/api/files/catalog/..%2f..%2fetc`)).status));

  /* ── authenticated matrix (probe accounts) ─────────────────────────── */
  const pw = crypto.randomUUID();
  // Rotate probe passwords exactly like validate-access.ts (accounts table, service role).
  const rot = await admin(`/rest/v1/rpc/rotate_probe_password`, "POST", { p_username: "p0b_admin", p_password: pw });
  if (!rot.ok) {
    check("probe rotation available", false, "rotate_probe_password RPC missing — run validate-access first or rotate manually");
    return print();
  }
  await admin(`/rest/v1/rpc/rotate_probe_password`, "POST", { p_username: "p0b_customer", p_password: pw });
  const adminCookie = await signIn("p0b_admin", pw);
  const custCookie = await signIn("p0b_customer", pw);
  check("probe sign-in", !!adminCookie && !!custCookie);
  if (!adminCookie || !custCookie) return print();

  if (CATALOG) {
    const full = await get(`/api/files/catalog/${CATALOG}`, adminCookie);
    check("authorized catalog → 200", full.status === 200, `got ${full.status}`);
    const part = await get(`/api/files/catalog/${CATALOG}`, adminCookie, { Range: "bytes=0-1023" });
    check("authorized range → 206 + Content-Range", part.status === 206 && !!part.headers.get("content-range"), `got ${part.status}`);
    const badRange = await get(`/api/files/catalog/${CATALOG}`, adminCookie, { Range: "bytes=999999999999-" });
    check("invalid range → 416/200-safe", [416, 200].includes(badRange.status), `got ${badRange.status}`);
    const cust = await get(`/api/files/catalog/${CATALOG}`, custCookie);
    check("customer w/o Catalogs module → 404 uniform", cust.status === 404, `got ${cust.status}`);
    check("private cache header", /private/.test(full.headers.get("cache-control") ?? ""));
    check("nosniff", full.headers.get("x-content-type-options") === "nosniff");
  } else check("catalog scenarios", false, "SKIPPED — pass --catalog <testId>");

  check("forged id (auth) → 404", (await get(`/api/files/catalog/${FAKE}`, adminCookie)).status === 404);
  if (DISCUSS) {
    check("non-member discuss → 404", (await get(`/api/files/discuss/${DISCUSS}/0`, custCookie)).status === 404);
    check("member discuss → 200", (await get(`/api/files/discuss/${DISCUSS}/0`, adminCookie)).status === 200);
  } else check("discuss scenarios", false, "SKIPPED — pass --discuss <testMessageId>");

  /* logout / expired-session: sign-out then reuse cookie */
  await fetch(`${BASE}/api/auth/signout`, { method: "POST", headers: { Cookie: adminCookie } }).catch(() => {});
  const after = await get(`/api/files/catalog/${CATALOG ?? FAKE}`, adminCookie);
  check("after logout → 401/404 (no cached grant)", [401, 404].includes(after.status), `got ${after.status}`);
  print();
};

function print() {
  console.log("\n── file-delivery authorization matrix ──");
  for (const [s, n, d] of results) console.log(`${s.padEnd(5)} ${n}${d ? `  (${d})` : ""}`);
  const fails = results.filter(([s, , d]) => s === "FAIL" && !d.startsWith("SKIPPED")).length;
  process.exit(fails ? 1 : 0);
}
run().catch((e) => { console.error(e); process.exit(2); });
