/* ---------------------------------------------------------------------------
   assert-staging-environment — the single gate every Discuss Run-B fixture
   script MUST pass through before it touches a database.
   (Discuss-scoped staging environment for Unit 2 Run B)

   WHY THIS EXISTS
   Fixture scripts create and destroy accounts, channels and messages. Pointed
   at the wrong project they would create synthetic identities in — or delete
   real rows from — PRODUCTION. Nothing about a connection string makes that
   mistake loud; it would simply succeed. So the safety property cannot be "the
   operator was careful", it has to be a check the machine performs.

   DESIGN: FIVE INDEPENDENT CONDITIONS, ALL REQUIRED
   Any single condition could be satisfied by accident (a stale env var, a
   copied .env, a shell that still has production exported). Requiring all five
   means an accident has to happen five times simultaneously in the same
   direction. In particular the production ref is hardcoded as a DENYLIST value:
   even if every other check were somehow subverted, naming production is fatal.

   This is deliberately fail-closed: unknown / missing / unparseable => abort.
   --------------------------------------------------------------------------- */

/** The ONLY database these scripts may ever write to. */
export const STAGING_REF = "gmtjbshjsuexqayqumix";

/** Hardcoded denylist. Never a target — only ever something to refuse.
 *  This constant exists so that "am I about to hit production?" is answerable
 *  without trusting any environment variable. */
export const PRODUCTION_REF = "yxyizbnfjrwrnmwhkvme";

/** Production hostnames that must never appear in a fixture run's config. */
const PRODUCTION_DOMAINS = ["hub.koleexgroup.com", "koleexgroup.com"];

/** The operator must opt in explicitly, per-run. Being on staging is not by
 *  itself permission to mutate it. */
const FIXTURE_FLAG = "KX_ALLOW_DISCUSS_FIXTURES";

export interface StagingEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  ref: string;
}

function fail(reason: string): never {
  // No values are printed — only which condition failed. A guard that leaks the
  // secret it is guarding is not a guard.
  console.error(`\n  ABORT: ${reason}`);
  console.error("  No database connection was opened. Nothing was modified.\n");
  process.exit(1);
}

function refFromUrl(raw: string): string {
  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    fail("SUPABASE_URL is not a valid URL.");
  }
  const m = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
  if (!m) fail("SUPABASE_URL does not look like a Supabase project host.");
  return m[1];
}

/**
 * Assert we are pointed at the Discuss-scoped staging project, or abort.
 * Returns the validated connection details on success.
 */
export function assertStagingEnvironment(): StagingEnv {
  // 1 — the environment must declare itself staging.
  if (process.env.KX_ENVIRONMENT !== "staging") {
    fail(`KX_ENVIRONMENT must be exactly "staging" (got: ${process.env.KX_ENVIRONMENT ?? "<unset>"}).`);
  }

  // 2 — explicit per-run opt-in.
  if (process.env[FIXTURE_FLAG] !== "1") {
    fail(`${FIXTURE_FLAG}=1 is required to run fixture mutations.`);
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!supabaseUrl) fail("SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL is not set.");
  if (!serviceRoleKey) fail("SUPABASE_SERVICE_ROLE_KEY is not set.");

  const ref = refFromUrl(supabaseUrl);

  // 3 — denylist first. Production is never a target, whatever else is true.
  if (ref === PRODUCTION_REF) {
    fail("Target is the PRODUCTION Supabase project. Fixture scripts must never run against production.");
  }

  // 4 — allowlist. Not-production is not the same as is-staging.
  if (ref !== STAGING_REF) {
    fail(`Target project ref is not the Discuss staging project (expected ${STAGING_REF}).`);
  }

  // 5 — no production domain anywhere in the resolved config.
  const haystack = [supabaseUrl, process.env.NEXT_PUBLIC_SITE_URL ?? "", process.env.VERCEL_URL ?? ""].join(" ");
  for (const d of PRODUCTION_DOMAINS) {
    if (haystack.includes(d)) fail(`A production domain (${d}) is present in the environment.`);
  }

  console.log(`  staging guard: OK (ref ${ref}, KX_ENVIRONMENT=staging, fixtures enabled)`);
  return { supabaseUrl, serviceRoleKey, ref };
}

/* Allow `node scripts/assert-staging-environment.mts` as a standalone preflight. */
if (process.argv[1] && process.argv[1].endsWith("assert-staging-environment.mts")) {
  assertStagingEnvironment();
  console.log("  preflight passed.\n");
}
