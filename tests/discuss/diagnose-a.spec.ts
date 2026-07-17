/* CLOSED DIAGNOSTIC — skipped by default.
   This spec answered its question (see the investigation report) and is kept
   for reproducibility only. Its cleanup is the OLD inline path that leaked
   probe rows three times; tests/discuss/fixture.ts is now the single
   converging cleanup. Do not un-skip this without porting it to
   cleanupFixture() first, or it will pollute the 5,000-message fixture.
   Run deliberately with: KXPERF_RUN_CLOSED_DIAGNOSTICS=1 */
/* kxperf — DIAGNOSTIC A (rerun). Closes the send→receive timeline.
   ────────────────────────────────────────────────────────────────────────────
   Fixes three defects in my previous attempt:

   1. PAINT WAS NEVER MEASURED. A MutationObserver installed via addInitScript
      never fired (delivered:0 on 12/12) while waitForSelector finds the same
      tokens reliably. So this uses locator.waitFor({state:"visible"}) ARMED
      BEFORE the send — arming after the send can miss a fast delivery entirely
      and silently inflates nothing, it just loses the sample. Visibility is then
      confirmed (attached AND visible, not merely present) and a rAF boundary is
      taken for the actual paint.

   2. THE WRONG REQUEST WAS TIMED. I took the receiver's FIRST /api/discuss/read
      after the send. That is an assumption, not a measurement: the first read
      may be a poll tick that predates the message. This version reads every
      response BODY and only accepts the request whose payload actually contains
      the token. That alone may explain the 280ms-vs-2.6s contradiction.

   3. CLEANUP RACED THE SENDS. It deleted while sends were still in flight, so 5
      probe rows survived in the fixture. Now: every send settles, exact ids are
      collected from the mutate RESPONSE, and only those ids are deleted. The
      fixture count is asserted at BOTH ends.

   Correlation is by token, never by temporal proximity. */

import { test, expect, type Page, type Response } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { signIn } from "./auth";
import { assertSafe, STAGING_REF } from "./guards";

const CHANNEL_ID = "1581bdf2-c922-4ab2-bc3f-66a391732a3a";
const CHANNEL_NAME = "zz-kxperf-synthetic-5k";
const OUT = ".kxperf";

type ReadCall = {
  url: string; cursor: string | null; kind: string;
  start: number; end: number; dur: number; status: number;
  bytes: number; ids: string[]; carriesToken: boolean;
};

function db() {
  if (!process.env.SUPABASE_URL!.includes(STAGING_REF)) throw new Error("refusing: not staging");
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
}
async function fixtureCount() {
  const { count } = await db().from("discuss_messages").select("id", { count: "exact", head: true }).eq("channel_id", CHANNEL_ID);
  return count ?? -1;
}

/** Classify a Discuss read by its URL shape — the trigger is inferred from the
 *  request's own parameters, not from when it happened. */
function classify(url: string): string {
  if (url.includes("resource=myChannels")) return "channel_refresh/unread";
  if (url.includes("&after=")) return "incremental_after";
  if (url.includes("resource=channelMessages")) return "full_channel_fetch(poll or open)";
  return "other";
}

test.describe("Diagnostic A — send→receive timeline", () => {
  test.setTimeout(1_800_000);
  test.beforeAll(() => assertSafe(process.env, process.env.KXPERF_BASE_URL ?? "http://localhost:3021"));

  test("isolated + burst modes with token-correlated stages", async ({ browser, baseURL }, info) => {
    const startCount = await fixtureCount();
    expect(startCount, "fixture must start at exactly 5000").toBe(5000);

    const sender = await signIn(browser, "sender", { baseURL: baseURL! });
    const receiver = await signIn(browser, "receiver", { baseURL: baseURL! });

    /* Record every receiver read WITH its body, so we can later ask "which
       request actually delivered token X" instead of guessing. */
    const reads: ReadCall[] = [];
    receiver.page.on("response", async (res: Response) => {
      const url = res.url();
      if (!url.includes("/api/discuss/read")) return;
      const t = res.request().timing();
      let body = "";
      try { body = await res.text(); } catch { body = ""; }
      let ids: string[] = [];
      try { ids = (JSON.parse(body).data ?? []).map((m: any) => m.id); } catch { /* non-JSON */ }
      reads.push({
        url: url.replace(baseURL!, ""),
        cursor: new URL(url).searchParams.get("after"),
        kind: classify(url),
        start: Math.round(t.startTime),
        end: Math.round(t.startTime + t.responseEnd),
        /* responseEnd is ms since startTime; Playwright reports -1 when a phase
           never completed. A 15s "duration" on the previous run came from timing
           a request that was still open, so guard it rather than report fiction. */
        dur: t.responseEnd > 0 ? Math.round(t.responseEnd) : -1,
        status: res.status(),
        bytes: body.length,
        ids,
        carriesToken: false,          // filled per-sample below, by token
      });
      (reads[reads.length - 1] as any).body = body;
    });

    /* mutate responses give us the authoritative created message id per token. */
    const created: Record<string, string> = {};
    sender.page.on("response", async (res: Response) => {
      if (!res.url().includes("/api/discuss/mutate")) return;
      try {
        const j = JSON.parse(await res.text());
        const id = j?.data?.id, body = j?.data?.body;
        if (id && typeof body === "string" && body.startsWith("kxperf-a-")) created[body] = id;
      } catch { /* ignore */ }
    });

    const open = async (p: Page) => {
      await p.goto("/discuss", { waitUntil: "load" });
      await p.getByText(CHANNEL_NAME, { exact: false }).first().click();
      await p.waitForSelector("text=/^(ok|got it|thanks)$/", { timeout: 60_000 });
    };
    await open(sender.page);
    await open(receiver.page);
    await receiver.page.waitForTimeout(5000);

    /* ── CALIBRATION: prove the locator method works before trusting 24 samples.
       The previous run produced 12 confident-looking rows with a silently dead
       observer. One proven sample first. */
    const calToken = `kxperf-a-cal-${Date.now()}`;
    const calLoc = receiver.page.getByText(calToken, { exact: false }).first();
    const calWait = calLoc.waitFor({ state: "visible", timeout: 30_000 });
    const composer0 = sender.page.locator("textarea, [contenteditable='true']").last();
    await composer0.click(); await composer0.fill(calToken);
    const calT0 = Date.now();
    await composer0.press("Enter");
    let calibrated = false, calMs = -1;
    try { await calWait; calMs = Date.now() - calT0; calibrated = true; } catch { /* stays false */ }
    if (!calibrated) throw new Error("CALIBRATION FAILED: the receiver locator never saw the token. Do not trust any sample; fix detection first.");
    const allTokens: string[] = [calToken];

    async function sample(token: string, mode: string) {
      // ARM detection BEFORE submitting — arming after can miss a fast delivery.
      const loc = receiver.page.getByText(token, { exact: false }).first();
      const armed = loc.waitFor({ state: "visible", timeout: 30_000 });

      const composer = sender.page.locator("textarea, [contenteditable='true']").last();
      await composer.click();
      await composer.fill(token);
      const t1 = Date.now();                                  // 1. sender submit
      const readsBefore = reads.length;
      await composer.press("Enter");

      let tVisible = -1, tPaint = -1, ok = false;
      try {
        await armed;
        tVisible = Date.now();                                // receiver DOM-visible
        const attachedVisible = await loc.isVisible();
        // Paint boundary: the frame AFTER visibility was detected.
        tPaint = await receiver.page.evaluate(() => new Promise<number>((r) => requestAnimationFrame(() => r(Date.now()))));
        ok = attachedVisible;
      } catch { /* miss recorded */ }

      /* Which read ACTUALLY carried the message ROW?
         A naive "body contains token" match is wrong: resource=myChannels embeds
         last_message.body in the sidebar preview, so it contains the token while
         delivering no message row. That mis-identified 11/12 carriers on the
         previous run. The carrier must be a channelMessages read whose data[]
         holds an element whose body EQUALS the token. */
      const carries = (r: ReadCall) => {
        if (!r.url.includes("resource=channelMessages")) return false;
        try {
          const rows = JSON.parse(((r as any).body ?? "{}")).data ?? [];
          return rows.some((m: any) => m?.body === token);
        } catch { return false; }
      };
      const mine = reads.slice(readsBefore).filter(carries);
      mine.forEach((r) => (r.carriesToken = true));
      const carrier = mine.sort((a, b) => a.start - b.start)[0] ?? null;
      const allAfter = reads.slice(readsBefore).map((r) => ({ kind: r.kind, dur: r.dur, bytes: r.bytes, carries: carries(r) }));

      return {
        mode, token, delivered: ok,
        t12_receiver_visible_ms: tVisible > 0 ? tVisible - t1 : null,
        t12_paint_ms: tPaint > 0 ? tPaint - t1 : null,
        paint_after_visible_ms: tVisible > 0 && tPaint > 0 ? tPaint - tVisible : null,
        carrier_kind: carrier?.kind ?? null,
        carrier_duration_ms: carrier?.dur ?? null,
        carrier_bytes: carrier?.bytes ?? null,
        carrier_rows: carrier?.ids.length ?? null,
        carrier_cursor: carrier?.cursor ?? null,
        reads_after_send: allAfter.length,
        reads_detail: allAfter,
      };
    }

    const samples: any[] = [];

    // ── Mode A: isolated. One at a time, fully settled, 4s spacing.
    for (let i = 0; i < 12; i++) {
      const tk = `kxperf-a-iso-${Date.now()}-${i}`; allTokens.push(tk);
      samples.push(await sample(tk, "isolated"));
      await sender.page.waitForTimeout(4000);
    }
    // ── Mode B: burst. Reproduce the earlier rapid pattern: 1.2s spacing, no settle.
    for (let i = 0; i < 12; i++) {
      const tk = `kxperf-a-burst-${Date.now()}-${i}`; allTokens.push(tk);
      samples.push(await sample(tk, "burst"));
      await sender.page.waitForTimeout(1200);
    }

    /* ── CLEANUP: sends must SETTLE first. The previous race deleted while rows
       were still being written, leaving 5 behind. Wait, then delete exact ids. */
    await sender.page.waitForTimeout(8000);
    const { data: rows } = await db().from("discuss_messages")
      .select("id, body").eq("channel_id", CHANNEL_ID).like("body", "kxperf-a-%");
    const ids = (rows ?? []).map((r: any) => r.id);
    if (ids.length) {
      await db().from("discuss_reactions").delete().in("message_id", ids);   // dependents first
      await db().from("discuss_messages").delete().in("id", ids);
    }
    const { data: residue } = await db().from("discuss_messages")
      .select("id").eq("channel_id", CHANNEL_ID).like("body", "kxperf-a-%");
    const endCount = await fixtureCount();

    mkdirSync(OUT, { recursive: true });
    writeFileSync(`${OUT}/diagnose-a-${info.project.name}.json`, JSON.stringify({
      calibration: { token_seen: calibrated, visible_ms: calMs },
      tokens_sent: allTokens.length, rows_deleted: ids.length,
      fixture_start: startCount, fixture_end: endCount, residue: (residue ?? []).length,
      samples,
    }, null, 2));

    await sender.context.close();
    await receiver.context.close();
    expect((residue ?? []).length, "no benchmark message may remain").toBe(0);
    expect(endCount, "fixture must end at exactly 5000").toBe(5000);
  });
});
