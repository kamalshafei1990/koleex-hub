/* CLOSED DIAGNOSTIC — skipped by default.
   This spec answered its question (see the investigation report) and is kept
   for reproducibility only. Its cleanup is the OLD inline path that leaked
   probe rows three times; tests/discuss/fixture.ts is now the single
   converging cleanup. Do not un-skip this without porting it to
   cleanupFixture() first, or it will pollute the 5,000-message fixture.
   Run deliberately with: KXPERF_RUN_CLOSED_DIAGNOSTICS=1 */
/* kxperf — DIAGNOSTIC phase. Measures WHERE the send→receive time goes, and
   catalogues every failing request. Adds no product behaviour; the only
   instrumentation is in the test process and in page-injected observers.

   ── Why the clock alignment is trustworthy here ─────────────────────────────
   The Next server, the sender browser and the receiver browser are all local
   processes on ONE machine, so Date.now() is a single monotonic-enough clock
   across all three. That is what makes a cross-process timeline possible at all
   without adding trace headers to production code. It is ALSO why these numbers
   are staging-shaped: the DB is in Tokyo, the app is on this laptop.

   ── What is measured vs what is inferred ────────────────────────────────────
   Measured directly:
     t1  sender submit            (test process, Enter keypress)
     t2  optimistic sender paint  (MutationObserver in the sender page)
     t3  send request start       (PerformanceResourceTiming, sender)
     t6  server ack / response    (PerformanceResourceTiming, sender)
     t4/t5 server receipt + db    (kx-server-timing stdout of the local server)
     t9  receiver's next network call after the send (ResourceTiming, receiver)
     t12 receiver paint           (MutationObserver in the receiver page)
   NOT directly observable without touching app code:
     t8  the realtime subscription callback firing. We infer its presence from
         WHICH network call the receiver makes and WHEN — a ping-triggered
         incremental fetch lands within ~ms of the ack; a poll-triggered one
         lands on a 5s boundary. The distinction is visible in the data; it is
         not assumed in advance. */

import { test, expect, type Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { signIn } from "./auth";
import { assertSafe } from "./guards";

const CHANNEL_NAME = "zz-kxperf-synthetic-5k";
const OUT = ".kxperf";

type Failing = {
  url: string; method: string; status: number; body: string;
  initiator: string; ms: number; when: string;
};

async function watchPaint(page: Page) {
  await page.addInitScript(() => {
    (window as any).__paint = {};
    const seen = (window as any).__paint;
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of Array.from(m.addedNodes)) {
          const t = (n.textContent ?? "");
          const hit = t.match(/kxperf-probe-[0-9]+-[0-9]+/);
          if (hit && !seen[hit[0]]) seen[hit[0]] = Date.now();
        }
      }
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  });
}

/** Every network call the page made after `since`, in wall-clock terms. */
async function callsSince(page: Page, since: number) {
  return page.evaluate((sinceMs) => {
    const origin = performance.timeOrigin;
    return (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .map((r) => ({
        url: r.name.replace(location.origin, ""),
        start: Math.round(origin + r.startTime),
        end: Math.round(origin + r.responseEnd),
        dur: Math.round(r.duration),
      }))
      .filter((r) => r.start >= sinceMs && (r.url.includes("/api/") || r.url.includes("supabase")));
  }, since);
}

test.describe("Discuss diagnostics", () => {
  /* 12 samples x (up to 20s wait + settle) + two rate-limit-aware logins does not
     fit the default budget. Raise the ceiling rather than cut the sample count:
     fewer samples would weaken the very percentiles this phase exists to produce. */
  test.setTimeout(900_000);
  test.beforeAll(() => assertSafe(process.env, process.env.KXPERF_BASE_URL ?? "http://localhost:3021"));

  test("A+B: send→receive timeline and every failing request", async ({ browser, baseURL }, info) => {
    const failing: Failing[] = [];
    const allCalls: Array<{ url: string; status: number; ms: number; who: string }> = [];

    const attach = (page: Page, who: string) => {
      page.on("response", async (res) => {
        const req = res.request();
        const url = res.url().replace(baseURL!, "");
        const t = res.request().timing();
        const ms = Math.round(t.responseEnd > 0 ? t.responseEnd : 0);
        allCalls.push({ url: url.slice(0, 90), status: res.status(), ms, who });
        if (res.status() >= 400) {
          let body = "";
          try { body = (await res.text()).slice(0, 200); } catch { body = "<unreadable>"; }
          failing.push({
            url, method: req.method(), status: res.status(), body,
            initiator: (req.frame()?.url() ?? "").includes("discuss") ? "discuss page" : "app shell",
            ms, when: who,
          });
        }
      });
    };

    const sender = await signIn(browser, "sender", { baseURL: baseURL! });
    const receiver = await signIn(browser, "receiver", { baseURL: baseURL! });
    await watchPaint(sender.page);
    await watchPaint(receiver.page);
    attach(sender.page, "sender");
    attach(receiver.page, "receiver");

    const open = async (p: Page) => {
      await p.goto("/discuss", { waitUntil: "load" });
      await p.getByText(CHANNEL_NAME, { exact: false }).first().click();
      await p.waitForSelector("text=/^(ok|got it|thanks)$/", { timeout: 60_000 });
    };
    await open(sender.page);
    await open(receiver.page);
    await receiver.page.waitForTimeout(4000);   // let realtime settle before timing anything

    const samples: any[] = [];
    for (let i = 0; i < 12; i++) {
      const token = `kxperf-probe-${Date.now()}-${i}`;
      const composer = sender.page.locator("textarea, [contenteditable='true']").last();
      await composer.click();
      await composer.fill(token);

      const t1 = Date.now();                       // 1. sender submit
      await composer.press("Enter");
      let t12 = -1;
      try {
        await receiver.page.waitForFunction((tk) => !!(window as any).__paint[tk], token, { timeout: 20_000 });
        t12 = await receiver.page.evaluate((tk) => (window as any).__paint[tk], token);   // 12. receiver paint
      } catch { /* recorded as a miss below */ }
      const t2 = await sender.page.evaluate((tk) => (window as any).__paint[tk] ?? -1, token); // 2. optimistic paint

      const sCalls = await callsSince(sender.page, t1);
      const rCalls = await callsSince(receiver.page, t1);
      const mutate = sCalls.find((c) => c.url.includes("/api/discuss/mutate"));
      // The receiver's first Discuss read AFTER the send is what actually delivers it.
      const rRead = rCalls.filter((c) => c.url.includes("/api/discuss/read")).sort((a, b) => a.start - b.start)[0];

      samples.push({
        i, token,
        t1_submit: t1,
        t2_optimistic_paint_ms: t2 > 0 ? t2 - t1 : null,
        t3_send_start_ms: mutate ? mutate.start - t1 : null,
        t6_server_ack_ms: mutate ? mutate.end - t1 : null,
        mutate_duration_ms: mutate?.dur ?? null,
        t9_receiver_fetch_start_ms: rRead ? rRead.start - t1 : null,
        t9_receiver_fetch_end_ms: rRead ? rRead.end - t1 : null,
        receiver_fetch_url: rRead?.url ?? null,
        gap_ack_to_receiver_fetch_ms: mutate && rRead ? rRead.start - mutate.end : null,
        t12_receiver_paint_ms: t12 > 0 ? t12 - t1 : null,
        paint_after_fetch_ms: rRead && t12 > 0 ? t12 - rRead.end : null,
        delivered: t12 > 0,
      });
      await sender.page.waitForTimeout(1500);
    }

    /* Cleanup: probe rows are ours; the fixture must stay at exactly 5000. */
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    await db.from("discuss_messages").delete().in("body", samples.map((s) => s.token));
    const { count } = await db.from("discuss_messages").select("id", { count: "exact", head: true })
      .eq("channel_id", "1581bdf2-c922-4ab2-bc3f-66a391732a3a");

    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/diagnose-${info.project.name}.json`, JSON.stringify({
      samples, failing,
      call_summary: Object.entries(allCalls.reduce((a: any, c) => {
        const k = `${c.status} ${c.url.split("?")[0]}`; a[k] = (a[k] ?? 0) + 1; return a;
      }, {})).sort((a: any, b: any) => b[1] - a[1]),
      fixture_messages_after: count,
    }, null, 2));

    await sender.context.close();
    await receiver.context.close();
    expect(count, "fixture restored").toBe(5000);
  });
});
