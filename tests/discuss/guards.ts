/* kxperf browser rig — SAFETY GUARDS.
   ────────────────────────────────────────────────────────────────────────────
   This rig rotates a fixture account's password and drives a real login. Both
   are harmless against the synthetic staging fixture and unacceptable against
   Production. Every guard below exists to make "pointed at Production" a
   startup crash rather than a discovery.

   Design rules, learned the hard way on this workstream:

   · ALLOWLIST the staging ref, DENYLIST the production ref. Two independent
     checks, not one — a denylist alone passes for a third, unknown project, and
     an allowlist alone would pass if someone renamed a var.
   · These are PURE FUNCTIONS returning violations, not `process.exit()` calls.
     A guard that exits cannot be unit-tested, and an untested guard is a
     decoration. `assertSafe()` is the only thing that throws; the negative
     tests call `checkSafety()` directly and assert it REFUSES.
   · Fail CLOSED on anything unreadable, missing, or unexpected. Absence of a
     production marker is not evidence of staging. */

export const STAGING_REF = "gmtjbshjsuexqayqumix";       // ALLOWLIST — the only permitted target
export const PRODUCTION_REF = "yxyizbnfjrwrnmwhkvme";    // DENYLIST — never, under any flag
export const FIXTURE_TAG = "kxperf-discuss-baseline";    // exact tag; fixture rows only
export const PRODUCTION_HOSTS = ["hub.koleexgroup.com", "koleexgroup.com"];

export type Env = Record<string, string | undefined>;

/** A base URL is acceptable only if it is loopback, or an EXPLICITLY approved
 *  staging Preview passed via KXPERF_APPROVED_PREVIEW. "Looks like a preview"
 *  is not approval — the operator names the exact origin or it is refused. */
export function baseUrlViolations(baseUrl: string | undefined, env: Env): string[] {
  const v: string[] = [];
  if (!baseUrl) return ["baseUrl is missing — refusing to guess"];
  let u: URL;
  try { u = new URL(baseUrl); } catch { return [`baseUrl is not a URL: ${baseUrl}`]; }

  const host = u.hostname.toLowerCase();
  if (PRODUCTION_HOSTS.some((h) => host === h || host.endsWith(`.${h}`)))
    v.push(`baseUrl points at PRODUCTION (${host}) — denied`);

  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0";
  const approved = (env.KXPERF_APPROVED_PREVIEW ?? "").trim();
  const isApprovedPreview = approved.length > 0 && baseUrl.startsWith(approved);
  if (!isLocal && !isApprovedPreview)
    v.push(`baseUrl ${host} is neither local nor an explicitly approved preview (set KXPERF_APPROVED_PREVIEW)`);
  return v;
}

/** Every guard, evaluated together so the operator sees ALL of them at once
 *  rather than fixing one, re-running, and hitting the next. */
export function checkSafety(env: Env, baseUrl?: string): string[] {
  const v: string[] = [];

  const url = env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url) v.push("SUPABASE_URL is missing — refusing to run against an unknown project");
  if (url && !url.includes(STAGING_REF)) v.push(`target is not the staging project (${STAGING_REF}) — refusing`);
  if (url && url.includes(PRODUCTION_REF)) v.push("PRODUCTION project ref present — denied");

  // The production ref must not appear in ANY var: a stray prod key in the env
  // is a loaded gun even if SUPABASE_URL happens to point at staging.
  for (const [k, val] of Object.entries(env)) {
    if (typeof val === "string" && val.includes(PRODUCTION_REF) )
      v.push(`env ${k} contains the PRODUCTION project ref — denied`);
    if (typeof val === "string" && PRODUCTION_HOSTS.some((h) => val.includes(h)) && !k.startsWith("npm_"))
      v.push(`env ${k} references a PRODUCTION host — denied`);
  }

  if (env.KXPERF_SEED_APPROVED !== "true") v.push('KXPERF_SEED_APPROVED must be exactly "true"');
  if ((env.KXPERF_FIXTURE_TAG ?? FIXTURE_TAG) !== FIXTURE_TAG) v.push(`fixture tag must be exactly ${FIXTURE_TAG}`);

  v.push(...baseUrlViolations(baseUrl ?? env.KXPERF_BASE_URL, env));
  return v;
}

/** The only throwing entry point. Call once, before anything touches the DB. */
export function assertSafe(env: Env, baseUrl?: string): void {
  const v = checkSafety(env, baseUrl);
  if (v.length) {
    throw new Error(
      `kxperf guards REFUSED (${v.length}):\n` + v.map((x) => `  · ${x}`).join("\n") +
      "\nNothing was read or written.",
    );
  }
}
