/* kxperf — 403/500 inventory. Read-only: opens Discuss and records every
   failing request in full. Sends nothing, so it cannot touch the fixture. */
import { test, expect, type Response } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { signIn } from "./auth";
import { assertSafe } from "./guards";
import { fixtureCount, EXACT_COUNT } from "./fixture";
import { classify, STAGING_CAVEAT } from "./staging-limits";

test.describe("403/500 inventory", () => {
  test.setTimeout(600_000);
  test.beforeAll(() => assertSafe(process.env, process.env.KXPERF_BASE_URL ?? "http://localhost:3021"));

  test("capture every failing request during a Discuss session", async ({ browser, baseURL }) => {
    expect(await fixtureCount()).toBe(EXACT_COUNT);
    const { context, page } = await signIn(browser, "sender", { baseURL: baseURL! });

    const fails: any[] = [];
    const all: Record<string, number> = {};
    page.on("response", async (res: Response) => {
      const req = res.request();
      const url = res.url().replace(baseURL!, "");
      const key = `${res.status()} ${req.method()} ${url.split("?")[0]}`;
      all[key] = (all[key] ?? 0) + 1;
      if (res.status() < 400) return;
      let body = ""; try { body = (await res.text()).slice(0, 300); } catch { body = "<unreadable>"; }
      const t = req.timing();
      /* Annotate, never suppress: the request still happened and is still
         recorded. Labelling stops a known environment artifact being
         rediscovered as a "finding"; it does not hide a real regression, which
         would land as `unclassified`. */
      const verdict = classify(url, res.status(), body);
      fails.push({
        url, method: req.method(), status: res.status(), body,
        classification: verdict.classification, why: verdict.why,
        resourceType: req.resourceType(),
        initiator: req.frame()?.url()?.replace(baseURL!, "") ?? "?",
        ms: Math.round(t.responseEnd > 0 ? t.responseEnd : -1),
        authenticated: !!(await context.cookies()).find((c) => c.name === "koleex_session"),
        at: Date.now(),
      });
    });

    const console_errors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") console_errors.push(m.text().slice(0, 200)); });

    // Cold load + channel open + idle (lets pollers/realtime run).
    await page.goto("/discuss", { waitUntil: "load" });
    await page.waitForSelector("text=zz-kxperf-synthetic-5k", { timeout: 60_000 });
    await page.getByText("zz-kxperf-synthetic-5k", { exact: false }).first().click();
    await page.waitForSelector("text=/^(ok|got it|thanks)$/", { timeout: 60_000 });
    await page.waitForTimeout(20_000);           // idle: catch repeating pollers
    await page.reload({ waitUntil: "load" });    // second load: is it once-per-load or once-ever?
    await page.waitForTimeout(10_000);

    mkdirSync(".kxperf", { recursive: true });
    const unclassified = fails.filter((f) => f.classification === "unclassified");
    writeFileSync(".kxperf/errors.json", JSON.stringify({
      STAGING_CAVEAT, fails, all, console_errors,
      summary: fails.reduce((a: any, f) => { a[f.classification] = (a[f.classification] ?? 0) + 1; return a; }, {}),
      unclassified_count: unclassified.length,
    }, null, 2));
    console.log("  " + STAGING_CAVEAT);
    console.log("  classifications:", JSON.stringify(fails.reduce((a: any, f) => { a[f.classification] = (a[f.classification] ?? 0) + 1; return a; }, {})));
    await context.close();
    expect(await fixtureCount(), "read-only spec must not touch the fixture").toBe(EXACT_COUNT);
    /* Known staging artifacts are expected and do NOT fail the run. Anything
       unclassified is a genuine unknown and must be looked at by a human. */
    expect(unclassified.map((u) => `${u.status} ${u.url} ${u.body.slice(0, 80)}`),
      "unclassified failing requests — these are NOT known staging artifacts").toEqual([]);
  });
});
