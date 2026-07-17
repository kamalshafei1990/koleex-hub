/* Proves the fixture cleanup converges automatically — no manual repair.
   Deliberately sends a burst WITHOUT settling (the exact pattern that leaked
   rows three times), then asserts cleanupFixture() restores exactly 5000. */
import { test, expect } from "@playwright/test";
import { signIn } from "./auth";
import { assertSafe } from "./guards";
import { cleanupFixture, fixtureCount, EXACT_COUNT } from "./fixture";

test.describe("fixture cleanup", () => {
  test.setTimeout(600_000);
  test.beforeAll(() => assertSafe(process.env, process.env.KXPERF_BASE_URL ?? "http://localhost:3021"));

  test("converges to exactly 5000 with no manual intervention", async ({ browser, baseURL }) => {
    expect(await fixtureCount(), "starts at 5000").toBe(EXACT_COUNT);
    const s = await signIn(browser, "sender", { baseURL: baseURL! });
    await s.page.goto("/discuss", { waitUntil: "load" });
    await s.page.getByText("zz-kxperf-synthetic-5k", { exact: false }).first().click();
    await s.page.waitForSelector("text=/^(ok|got it|thanks)$/", { timeout: 60_000 });

    // Rapid-fire, no settle — reproduce the leak conditions on purpose.
    for (let i = 0; i < 6; i++) {
      const c = s.page.locator("textarea, [contenteditable='true']").last();
      await c.click(); await c.fill(`kxperf-cleanupproof-${Date.now()}-${i}`); await c.press("Enter");
      await s.page.waitForTimeout(250);
    }
    const dirty = await fixtureCount();
    expect(dirty, "fixture is genuinely polluted — otherwise this proves nothing").toBeGreaterThan(EXACT_COUNT);

    const { deleted, count } = await cleanupFixture();
    console.log(`  polluted to ${dirty}, deleted ${deleted}, converged to ${count}`);
    await s.context.close();
    expect(count, "cleanup restored exactly 5000 automatically").toBe(EXACT_COUNT);
  });
});
