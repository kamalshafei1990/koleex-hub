/* CLOSED DIAGNOSTIC — skipped by default.
   This spec answered its question (see the investigation report) and is kept
   for reproducibility only. Its cleanup is the OLD inline path that leaked
   probe rows three times; tests/discuss/fixture.ts is now the single
   converging cleanup. Do not un-skip this without porting it to
   cleanupFixture() first, or it will pollute the 5,000-message fixture.
   Run deliberately with: KXPERF_RUN_CLOSED_DIAGNOSTICS=1 */
/* kxperf — DIAGNOSTIC A2. Why does incremental_after take ~800–900ms?
   ────────────────────────────────────────────────────────────────────────────
   Scope: ONE endpoint. No rendering, no virtualization, no redesign.

   Client-side stages come from PerformanceResourceTiming on the carrier request
   (the one whose response body actually contains the token). Server-side stages
   come from the route's own stageTimer line, matched by CURSOR TAG — the cursor
   the client sent is unique per request, so the join is by identity. Matching
   server lines to client requests by timestamp is exactly how the previous two
   carrier mis-identifications happened. */

import { test, expect, type Page, type Response } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { signIn } from "./auth";
import { assertSafe, STAGING_REF } from "./guards";

const CHANNEL_ID = "1581bdf2-c922-4ab2-bc3f-66a391732a3a";
const CHANNEL_NAME = "zz-kxperf-synthetic-5k";

function db() {
  if (!process.env.SUPABASE_URL!.includes(STAGING_REF)) throw new Error("refusing: not staging");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
const count = async () => (await db().from("discuss_messages").select("id", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID)).count ?? -1;

test.describe("A2 — incremental_after stage breakdown", () => {
  test.setTimeout(1_800_000);
  test.beforeAll(() => assertSafe(process.env, process.env.KXPERF_BASE_URL ?? "http://localhost:3021"));

  test("stage-by-stage for the carrier request", async ({ browser, baseURL }, info) => {
    expect(await count(), "fixture starts at 5000").toBe(5000);
    const sender = await signIn(browser, "sender", { baseURL: baseURL! });
    const receiver = await signIn(browser, "receiver", { baseURL: baseURL! });

    /* Every read + its body, so the carrier is identified by content. */
    const reads: Array<{ url: string; body: string; cursorTag: string | null }> = [];
    receiver.page.on("response", async (res: Response) => {
      if (!res.url().includes("/api/discuss/read")) return;
      let body = ""; try { body = await res.text(); } catch { /* */ }
      const after = new URL(res.url()).searchParams.get("after");
      reads.push({ url: res.url(), body, cursorTag: after ? after.slice(11, 23) : null });
    });

    const open = async (p: Page) => {
      await p.goto("/discuss", { waitUntil: "load" });
      await p.getByText(CHANNEL_NAME, { exact: false }).first().click();
      await p.waitForSelector("text=/^(ok|got it|thanks)$/", { timeout: 60_000 });
    };
    await open(sender.page); await open(receiver.page);
    await receiver.page.waitForTimeout(5000);

    const samples: any[] = [];
    const tokens: string[] = [];
    for (let i = 0; i < 14; i++) {
      const token = `kxperf-inc-${Date.now()}-${i}`; tokens.push(token);
      const armed = receiver.page.getByText(token, { exact: false }).first().waitFor({ state: "visible", timeout: 30_000 });
      const c = sender.page.locator("textarea, [contenteditable='true']").last();
      await c.click(); await c.fill(token);
      const before = reads.length;
      await c.press("Enter");
      try { await armed; } catch { /* miss */ }

      // Carrier = a channelMessages read whose data[] holds body === token.
      const carrier = reads.slice(before).find((r) => {
        if (!r.url.includes("resource=channelMessages")) return false;
        try { return (JSON.parse(r.body).data ?? []).some((m: any) => m?.body === token); } catch { return false; }
      });

      if (carrier) {
        // Client-side network stages for THAT exact URL.
        const net = await receiver.page.evaluate((u) => {
          const e = (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((r) => r.name === u).pop();
          if (!e) return null;
          return {
            total_ms: Math.round(e.duration),
            stalled_ms: Math.round(e.requestStart - e.startTime),        // queue/connect/blocked
            ttfb_ms: Math.round(e.responseStart - e.requestStart),        // server think + network out+back
            download_ms: Math.round(e.responseEnd - e.responseStart),     // network transfer
            transfer_bytes: e.transferSize,
            decoded_bytes: e.decodedBodySize,
            protocol: e.nextHopProtocol,
          };
        }, carrier.url);
        samples.push({ i, token, cursor_tag: carrier.cursorTag, ...(net ?? {}), rows: (() => { try { return JSON.parse(carrier.body).data.length; } catch { return null; } })() });
      } else {
        samples.push({ i, token, cursor_tag: null, note: "no carrier captured" });
      }
      await sender.page.waitForTimeout(4000);   // isolated: no contention
    }

    /* Cleanup: settle, then delete exact ids only. */
    await sender.page.waitForTimeout(8000);
    const { data: rows } = await db().from("discuss_messages").select("id").eq("channel_id", CHANNEL_ID).like("body", "kxperf-inc-%");
    const ids = (rows ?? []).map((r: any) => r.id);
    if (ids.length) {
      await db().from("discuss_reactions").delete().in("message_id", ids);
      await db().from("discuss_messages").delete().in("id", ids);
    }
    const { data: residue } = await db().from("discuss_messages").select("id").eq("channel_id", CHANNEL_ID).like("body", "kxperf-inc-%");
    const end = await count();

    mkdirSync(".kxperf", { recursive: true });
    writeFileSync(`.kxperf/incremental-${info.project.name}.json`, JSON.stringify({ samples, deleted: ids.length, residue: (residue ?? []).length, fixture_end: end }, null, 2));
    await sender.context.close(); await receiver.context.close();
    expect((residue ?? []).length).toBe(0);
    expect(end, "fixture ends at 5000").toBe(5000);
  });
});
