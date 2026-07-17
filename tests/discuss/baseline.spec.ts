/* kxperf — MEASURED client baseline for the EXISTING Discuss UI.
   ────────────────────────────────────────────────────────────────────────────
   This measures the app as it is today, against the 5,000-message staging
   fixture, on a production build. It changes nothing about the app. Its whole
   job is to replace "DiscussApp.tsx is 4,372 lines with no memo or
   virtualization, so it is probably slow" with numbers.

   What the numbers are allowed to mean:
   · These run on ONE laptop against a Tokyo database. Absolute milliseconds are
     a property of this machine and this link, not of the product.
   · The DOM/heap/long-task figures are the interesting ones: they are
     properties of the CLIENT and are largely independent of the network.
   · Every figure is written to .kxperf/baseline-*.json for the Phase-2 proposal
     to cite. No claim in that proposal may exceed what these files contain. */

import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { signIn, startTracing } from "./auth";
import { assertSafe, STAGING_REF } from "./guards";

const CHANNEL_ID = "1581bdf2-c922-4ab2-bc3f-66a391732a3a";
const CHANNEL_NAME = "zz-kxperf-synthetic-5k";
const OUT = ".kxperf";

type Metrics = Record<string, unknown>;
const results: Record<string, Metrics> = {};

function save(project: string) {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/baseline-${project}.json`, JSON.stringify(results, null, 2));
}

/* Install observers BEFORE any app code runs, so nothing is missed during the
   very window we care about (first paint + hydration). */
async function instrument(page: Page) {
  await page.addInitScript(() => {
    (window as any).__kx = { longTasks: [], lcp: 0, cls: 0, frames: [] };
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) (window as any).__kx.longTasks.push({ start: e.startTime, dur: e.duration });
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((l) => {
        const es = l.getEntries(); (window as any).__kx.lcp = es[es.length - 1]?.startTime ?? 0;
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!(e as any).hadRecentInput) (window as any).__kx.cls += (e as any).value;
      }).observe({ type: "layout-shift", buffered: true });
    } catch { /* observer unsupported — reported as absent, never faked */ }
  });
}

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const kx = (window as any).__kx ?? { longTasks: [], lcp: 0, cls: 0 };
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paint = performance.getEntriesByType("paint") as PerformanceEntry[];
    const res = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const js = res.filter((r) => r.name.endsWith(".js") || r.name.includes("/_next/static/chunks/"));
    const lt = kx.longTasks as Array<{ dur: number }>;
    return {
      ttfb_ms: nav ? Math.round(nav.responseStart) : null,
      dom_content_loaded_ms: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
      load_ms: nav ? Math.round(nav.loadEventEnd) : null,
      fcp_ms: Math.round(paint.find((p) => p.name === "first-contentful-paint")?.startTime ?? 0),
      lcp_ms: Math.round(kx.lcp),
      cls: Math.round((kx.cls ?? 0) * 1000) / 1000,
      js_requests: js.length,
      js_transferred_kb: Math.round(js.reduce((a, r) => a + (r.transferSize || 0), 0) / 1024),
      js_decoded_kb: Math.round(js.reduce((a, r) => a + (r.decodedBodySize || 0), 0) / 1024),
      long_tasks: lt.length,
      long_task_total_ms: Math.round(lt.reduce((a, t) => a + t.dur, 0)),
      long_task_max_ms: Math.round(Math.max(0, ...lt.map((t) => t.dur))),
      dom_nodes: document.getElementsByTagName("*").length,
      js_heap_mb: (performance as any).memory
        ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : null,
    };
  });
}

/** Find the message scroll container without touching app code: the tallest
   scrollable element on the page. Selecting by Tailwind class would break the
   moment the redesign this rig exists to inform touches a className. */
async function scrollerHandle(page: Page) {
  return page.evaluateHandle(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
    let best: HTMLElement | null = null;
    for (const el of all) {
      const s = getComputedStyle(el);
      if (!/auto|scroll/.test(s.overflowY)) continue;
      if (el.scrollHeight <= el.clientHeight + 50) continue;
      if (!best || el.scrollHeight > best.scrollHeight) best = el;
    }
    return best;
  });
}

test.describe("Discuss client baseline (5,000-message fixture)", () => {
  test.beforeAll(() => assertSafe(process.env, process.env.KXPERF_BASE_URL ?? `http://localhost:${process.env.KXPERF_PORT ?? 3021}`));

  test("cold load, channel open, scroll, and DOM cost", async ({ browser, baseURL }, info) => {
    const { context, page } = await signIn(browser, "sender", {
      baseURL: baseURL!,
      viewport: info.project.use.viewport as { width: number; height: number },
      isMobile: info.project.name === "mobile",
    });
    await startTracing(context, `${info.project.name}-baseline`);
    await instrument(page);

    const consoleErrors: string[] = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 160)); });

    // ── 1. cold load of /discuss ────────────────────────────────────────────
    const t0 = Date.now();
    await page.goto("/discuss", { waitUntil: "load" });
    await page.waitForSelector(`text=${CHANNEL_NAME}`, { timeout: 60_000 });
    const channelVisibleMs = Date.now() - t0;
    await page.waitForTimeout(1500);                        // let hydration/long-tasks settle
    results.cold_load = { ...(await snapshot(page)), channel_list_visible_ms: channelVisibleMs };

    // ── 2. open the 5,000-message channel ───────────────────────────────────
    const openStart = Date.now();
    await page.getByText(CHANNEL_NAME, { exact: false }).first().click();
    await page.waitForSelector("text=/^(ok|got it|thanks)$/", { timeout: 60_000 });
    const firstMessageMs = Date.now() - openStart;
    await page.waitForTimeout(2000);
    const afterOpen = await snapshot(page);
    results.channel_open = {
      ...afterOpen,
      first_message_painted_ms: firstMessageMs,
      dom_nodes_delta: (afterOpen.dom_nodes as number) - (results.cold_load.dom_nodes as number),
    };

    // ── 3. scroll cost over the message list ────────────────────────────────
    const scroller = await scrollerHandle(page);
    const hasScroller = await scroller.evaluate((el) => !!el);
    if (hasScroller) {
      const scrollStats = await page.evaluate(async (el: any) => {
        const kx = (window as any).__kx;
        const before = kx.longTasks.length;
        const t0 = performance.now();
        let frames = 0;
        const tick = () => { frames++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        // Drive a realistic upward scroll through history.
        for (let i = 0; i < 30; i++) {
          el.scrollTop = Math.max(0, el.scrollTop - el.clientHeight * 0.9);
          await new Promise((r) => setTimeout(r, 100));
        }
        const elapsed = performance.now() - t0;
        const added = kx.longTasks.slice(before) as Array<{ dur: number }>;
        return {
          duration_ms: Math.round(elapsed),
          frames,
          approx_fps: Math.round((frames / elapsed) * 1000),
          long_tasks_during_scroll: added.length,
          long_task_ms_during_scroll: Math.round(added.reduce((a, t) => a + t.dur, 0)),
          scroll_height_px: el.scrollHeight,
          client_height_px: el.clientHeight,
        };
      }, scroller);
      const afterScroll = await snapshot(page);
      results.scroll = { ...scrollStats, dom_nodes_after_scroll: afterScroll.dom_nodes, js_heap_mb_after_scroll: afterScroll.js_heap_mb };
    } else {
      results.scroll = { note: "no scrollable message container found — NOT measured, not assumed" };
    }

    results.console_errors = { count: consoleErrors.length, sample: consoleErrors.slice(0, 5) };

    await page.screenshot({ path: `${OUT}/artifacts/${info.project.name}-discuss.png`, fullPage: false });
    await context.tracing.stop({ path: `${OUT}/artifacts/${info.project.name}-trace.zip` });
    await context.close();
    save(info.project.name);

    // Guard rails: these assert the RIG worked, not that the app is fast.
    expect(results.channel_open.dom_nodes as number).toBeGreaterThan(0);
    expect(firstMessageMs).toBeGreaterThan(0);
  });

  test("send → receive latency with two simultaneous authenticated contexts", async ({ browser, baseURL }, info) => {
    const sender = await signIn(browser, "sender", { baseURL: baseURL!, isMobile: info.project.name === "mobile" });
    const receiver = await signIn(browser, "receiver", { baseURL: baseURL!, isMobile: info.project.name === "mobile" });

    const open = async (p: Page) => {
      await p.goto("/discuss", { waitUntil: "load" });
      await p.getByText(CHANNEL_NAME, { exact: false }).first().click();
      await p.waitForSelector("text=/^(ok|got it|thanks)$/", { timeout: 60_000 });
    };
    await open(sender.page);
    await open(receiver.page);
    await receiver.page.waitForTimeout(3000);          // let realtime subscribe

    const sent: string[] = [];
    const latencies: number[] = [];
    for (let i = 0; i < 5; i++) {
      const token = `kxperf-probe-${Date.now()}-${i}`;
      sent.push(token);
      const composer = sender.page.locator("textarea, [contenteditable='true']").last();
      await composer.click();
      await composer.fill(token);
      const t0 = Date.now();
      await composer.press("Enter");
      try {
        await receiver.page.waitForSelector(`text=${token}`, { timeout: 20_000 });
        latencies.push(Date.now() - t0);
      } catch {
        latencies.push(-1);                            // a miss is recorded, never silently dropped
      }
      await sender.page.waitForTimeout(1200);
    }

    const ok = latencies.filter((l) => l > 0).sort((a, b) => a - b);
    results.send_to_receive = {
      attempts: latencies.length,
      delivered: ok.length,
      missed: latencies.filter((l) => l < 0).length,
      min_ms: ok[0] ?? null,
      p50_ms: ok[Math.floor(ok.length / 2)] ?? null,
      max_ms: ok[ok.length - 1] ?? null,
      all_ms: latencies,
    };

    /* Clean up: the probe messages are ours and must not distort the 5,000-row
       fixture that later runs depend on. Delete by exact body, fixture channel
       only — never a blanket delete. */
    assertSafe(process.env, baseURL!);
    const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    if (!process.env.SUPABASE_URL!.includes(STAGING_REF)) throw new Error("refusing cleanup: not staging");
    const { error } = await db.from("discuss_messages").delete().eq("channel_id", CHANNEL_ID).in("body", sent);
    const { count } = await db.from("discuss_messages").select("id", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID);
    results.fixture_integrity = { cleanup_error: error?.message ?? null, messages_after_cleanup: count, expected: 5000 };

    await sender.context.close();
    await receiver.context.close();
    save(info.project.name);
    expect(count, "fixture must be restored to exactly 5000 messages").toBe(5000);
  });
});
