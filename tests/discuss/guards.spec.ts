/* NEGATIVE TESTS for the kxperf safety guards.
   Every test here asserts the rig REFUSES. A guard that has never been attacked
   is an assumption, not a control — each case below is a way someone could
   plausibly point this rig at Production by accident. */

import { test, expect } from "@playwright/test";
import { checkSafety, baseUrlViolations, STAGING_REF, PRODUCTION_REF } from "./guards";

const SAFE = {
  SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
  SUPABASE_SERVICE_ROLE_KEY: "not-a-real-key",
  KXPERF_SEED_APPROVED: "true",
};
const LOCAL = "http://localhost:3021";

test.describe("kxperf guards — must refuse", () => {
  test("baseline: a correctly configured staging run is ALLOWED", () => {
    expect(checkSafety(SAFE, LOCAL)).toEqual([]);
  });

  test("refuses the production project ref in SUPABASE_URL", () => {
    const v = checkSafety({ ...SAFE, SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` }, LOCAL);
    expect(v.join(" ")).toMatch(/not the staging project|PRODUCTION project ref/);
  });

  test("refuses a production key hiding in an UNRELATED env var", () => {
    // The dangerous case: SUPABASE_URL is staging, so a single check passes,
    // but a production credential is loaded and one typo away from being used.
    const v = checkSafety({ ...SAFE, SOME_OTHER_URL: `https://${PRODUCTION_REF}.supabase.co` }, LOCAL);
    expect(v.some((x) => x.includes("SOME_OTHER_URL"))).toBe(true);
  });

  test("refuses a production HOST anywhere in the env", () => {
    const v = checkSafety({ ...SAFE, WEBHOOK: "https://hub.koleexgroup.com/x" }, LOCAL);
    expect(v.some((x) => x.includes("PRODUCTION host"))).toBe(true);
  });

  test("refuses when KXPERF_SEED_APPROVED is missing", () => {
    const { KXPERF_SEED_APPROVED, ...rest } = SAFE;
    expect(checkSafety(rest, LOCAL).some((x) => x.includes("KXPERF_SEED_APPROVED"))).toBe(true);
  });

  test('refuses KXPERF_SEED_APPROVED="TRUE" / "1" / "yes" — must be exactly "true"', () => {
    for (const bad of ["TRUE", "1", "yes", " true"]) {
      expect(checkSafety({ ...SAFE, KXPERF_SEED_APPROVED: bad }, LOCAL)
        .some((x) => x.includes("KXPERF_SEED_APPROVED"))).toBe(true);
    }
  });

  test("refuses a wrong fixture tag", () => {
    expect(checkSafety({ ...SAFE, KXPERF_FIXTURE_TAG: "kxperf-discuss-baseline-v2" }, LOCAL)
      .some((x) => x.includes("fixture tag"))).toBe(true);
  });

  test("refuses a missing SUPABASE_URL rather than guessing", () => {
    const { SUPABASE_URL, ...rest } = SAFE;
    expect(checkSafety(rest, LOCAL).some((x) => x.includes("missing"))).toBe(true);
  });

  test("refuses an unknown third project (allowlist, not just denylist)", () => {
    const v = checkSafety({ ...SAFE, SUPABASE_URL: "https://abcdefghijklmnopqrst.supabase.co" }, LOCAL);
    expect(v.some((x) => x.includes("not the staging project"))).toBe(true);
  });

  test("refuses a Production base URL", () => {
    for (const u of ["https://hub.koleexgroup.com", "https://hub.koleexgroup.com/discuss", "https://www.koleexgroup.com"]) {
      expect(baseUrlViolations(u, SAFE).some((x) => x.includes("PRODUCTION")), u).toBe(true);
    }
  });

  test("refuses an arbitrary remote base URL unless explicitly approved", () => {
    const u = "https://koleex-somepreview-kamal-shafeis-projects.vercel.app";
    expect(baseUrlViolations(u, SAFE).length).toBeGreaterThan(0);
    // ...and ALLOWS it once the operator names that exact origin.
    expect(baseUrlViolations(u, { ...SAFE, KXPERF_APPROVED_PREVIEW: u })).toEqual([]);
  });

  test("an approved-preview prefix cannot be used to smuggle in Production", () => {
    const v = baseUrlViolations("https://hub.koleexgroup.com", {
      ...SAFE, KXPERF_APPROVED_PREVIEW: "https://hub.koleexgroup.com",
    });
    expect(v.some((x) => x.includes("PRODUCTION"))).toBe(true);   // denylist beats approval
  });

  test("refuses a missing or malformed base URL", () => {
    expect(baseUrlViolations(undefined, SAFE).length).toBeGreaterThan(0);
    expect(baseUrlViolations("not-a-url", SAFE).length).toBeGreaterThan(0);
  });
});
