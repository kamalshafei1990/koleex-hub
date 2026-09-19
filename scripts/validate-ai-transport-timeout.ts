/* ---------------------------------------------------------------------------
   validate:ai-transport-timeout — a hung provider must not hang a user.

   WHY THIS SUITE IS BEHAVIOURAL AND NOT STATIC. Most guards in this repo read
   source, because most of what they hold is structural. This one cannot: the
   property is "what happens when a socket goes quiet", and no amount of
   reading proves that. So it stands up real HTTP servers that reproduce each
   pathology and calls the real transport against them.

   THE BUG IT CLOSES. Neither postChat nor postChatStreaming passed a signal to
   fetch, which has no default timeout. A provider that ACCEPTED the connection
   and then never answered held a real user turn open until the platform killed
   the function — and the AI routes set no maxDuration, so that ceiling is the
   platform default rather than a number anyone chose. Failover could not help,
   because failover needs a status and a hang produces none.

   SECTION C IS THE ONE THAT MATTERS MOST, and it is the regression test, not
   the feature test. The obvious implementation — one overall timeout — would
   cut off a long answer that is streaming perfectly well, turning a rare
   failure into a frequent self-inflicted one. Section C runs a stream whose
   TOTAL duration is far past the stall budget while every GAP stays under it,
   and asserts it completes untouched. A naive fix fails here.
   --------------------------------------------------------------------------- */

import http from "node:http";
import { postChatStreaming, postChat } from "../src/lib/server/ai/core/transport";

let pass = 0;
const fails: string[] = [];
const check = (label: string, cond: boolean) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fails.push(label); console.log(`  ✗ ${label}`); }
};

/* A SUITE THAT ASSERTS "DOES NOT HANG" MUST NOT ITSELF HANG. Removing the
   signal from the transport — the exact bug this file exists for — made an
   earlier version of this suite run forever instead of failing, which in CI is
   indistinguishable from a stuck machine and gives nobody the diagnosis. Every
   transport call is raced against a watchdog; losing that race IS the failure. */
const HUNG = Symbol("transport did not return");
async function within<T>(ms: number, work: Promise<T>): Promise<T | typeof HUNG> {
  return Promise.race([
    work,
    new Promise<typeof HUNG>((r) => setTimeout(() => r(HUNG), ms)),
  ]);
}

/* 14 chunks × 600ms ≈ 8.4s of healthy streaming against a 5s budget. */
const ALIVE_CHUNKS = 14;
const ALIVE_GAP_MS = 600;

const sse = (s: string) => `data: ${JSON.stringify({ choices: [{ delta: { content: s } }] })}\n\n`;

type Mode = "silent-headers" | "stall-mid" | "slow-but-alive";

/** silent-headers — accepts the connection, sends nothing, ever.
 *  stall-mid      — sends headers and two tokens, then goes quiet.
 *  slow-but-alive — keeps emitting, with every gap comfortably under the
 *                   stall budget, for a total well past it. */
function serve(mode: Mode) {
  return http.createServer(async (_req, res) => {
    if (mode === "silent-headers") return;
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write(sse("Hel"));
    res.write(sse("lo"));
    if (mode === "stall-mid") return;
    /* THE COUNT AND THE GAP ARE BOTH LOAD-BEARING. The total must exceed the
       OVERALL budget (or a naive one-timeout implementation would pass this
       section by never firing) while every individual gap stays well under
       the stall budget (or the correct implementation would fail it). An
       earlier version ran 2.4s against a 5s budget and proved neither. */
    for (let i = 0; i < ALIVE_CHUNKS; i++) {
      await new Promise((r) => setTimeout(r, ALIVE_GAP_MS));
      res.write(sse(` ${i}`));
    }
    res.write("data: [DONE]\n\n");
    res.end();
  });
}

async function listen(s: http.Server): Promise<string> {
  await new Promise((r) => s.listen(0, () => r(null)));
  return `http://127.0.0.1:${(s.address() as { port: number }).port}/`;
}

async function main() {
  /* The floor the transport clamps to. Set here so the suite runs in seconds
     rather than in the two minutes a production default would take — and
     setting it also proves the env override is read at all. */
  process.env.AI_HTTP_TIMEOUT_MS = "5000";
  process.env.AI_HTTP_STALL_MS = "5000";
  const BUDGET = 5000;

  console.log("\nSection A — a provider that accepts the connection and never answers");
  {
    const s = serve("silent-headers");
    const url = await listen(s);
    const r = await within(BUDGET * 2, postChatStreaming(url, "k", {}, () => {}));
    check("returns instead of hanging", r !== HUNG);
    const out = r === HUNG ? null : r;
    check("reports 504, which is already in the failover table", out?.status === 504);
    check("is not ok, so the caller's failed-status path takes over", out?.ok === false);
    check("carries no key or fragment of one", out !== null && !out.bodyText.includes("k"));
    s.close();
  }

  console.log("\nSection B — a stream that opens, delivers, then goes silent");
  {
    const s = serve("stall-mid");
    const url = await listen(s);
    const seen: string[] = [];
    const r = await within(BUDGET * 2, postChatStreaming(url, "k", {}, (t) => seen.push(t)));
    check("returns instead of hanging", r !== HUNG);
    const out = r === HUNG ? null : r;
    check("reports 504", out?.status === 504);
    /* The tokens are kept deliberately. They are already on the user's
       screen; a status carrying no content would let the caller's rescue path
       replace a partial answer with an error, and a truncated answer is the
       better of those two. */
    check("KEEPS the tokens that did arrive", out?.content === "Hello");
    check("and those tokens had already reached the caller", seen.join("") === "Hello");
    s.close();
  }

  console.log("\nSection C — a LONG but healthy stream is never cut off (the regression test)");
  {
    const s = serve("slow-but-alive");
    const url = await listen(s);
    const t0 = Date.now();
    const r = await within(ALIVE_CHUNKS * ALIVE_GAP_MS + BUDGET * 2, postChatStreaming(url, "k", {}, () => {}));
    const ms = Date.now() - t0;
    check("returned at all", r !== HUNG);
    const out = r === HUNG ? null : r;
    /* THE assertion of this file. The run outlasts the OVERALL budget, so a
       naive single-timeout implementation aborts here — while every gap stays
       under the stall budget, so the correct one does not. */
    check("ran for longer than an overall timeout would have allowed", ms > BUDGET);
    check("completed normally rather than being aborted", out?.ok === true && out?.status === 200);
    const expected = "Hello" + Array.from({ length: ALIVE_CHUNKS }, (_, i) => ` ${i}`).join("");
    check("delivered the whole answer, not a prefix", out?.content === expected);
    s.close();
  }

  console.log("\nSection D — the non-streaming call");
  {
    const s = serve("silent-headers");
    const url = await listen(s);
    const t0 = Date.now();
    const r = await within(BUDGET * 2, postChat(url, "k", {}));
    const ms = Date.now() - t0;
    check("returns instead of hanging", r !== HUNG);
    check("reports 504", r !== HUNG && r.status === 504);
    /* A timeout is deliberately NOT retried. Three more attempts would spend
       three more budgets to learn the same thing while the user waits; the
       504 sends the turn to the next provider instead. */
    check("is not retried, which would have cost four budgets", ms < BUDGET * 2);
    void ms;
    s.close();
  }

  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    console.log("\nFAILED:");
    for (const f of fails) console.log(`  · ${f}`);
    process.exit(1);
  }
  console.log("Section C is the regression test: a naive overall timeout passes A, B and D and fails C.");
}

main();
