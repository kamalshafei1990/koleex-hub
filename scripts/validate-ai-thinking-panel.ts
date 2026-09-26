/* ---------------------------------------------------------------------------
   validate:ai-thinking-panel — the Thinking panel (owner, 2026-09-26).

   "The words come quickly and remove quickly … this can be in the place of
   thinking, same as any famous AI." What a model says before a lookup moves
   into a panel above the answer instead of vanishing; the lookups show in
   plain words; the panel folds to "Thought for Ns" once the answer begins.

   Checked here: the server's note (made safe before it is kept), the retract
   frame that carries it, the panel's rows (order, words, no tool names), and
   the client wiring that keeps the note and times the thinking.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { thinkingNote, THINKING_NOTE_MAX } from "../src/lib/server/ai/core/thinking-note";
import { thinkingRows, hasThinking, lookupDetail, siteOf, thoughtSeconds } from "../src/components/ai/thinking-panel-model";
import { COPY } from "../src/components/ai/copy";
import type { AgentStep, ThinkingRecord } from "../src/components/ai/types";
import { buildThinkingRecord, parseThinkingRecord, THINKING_MAX_NOTES, THINKING_MAX_LOOKUPS } from "../src/lib/ai/thinking-record";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}`);
  }
}

console.log("\n── 1. The note: what of the narration is safe to keep ──");
{
  check("plain narration is kept as said", thinkingNote("The user wants a ranked list. I'll look up the latest ranking.") === "The user wants a ranked list. I'll look up the latest ranking.");
  check("leaked tool markup is cut", !/<tool_call>|<function/.test(thinkingNote("Let me check.<tool_call>{\"name\":\"search_web\"}</tool_call>")));
  check("a note that states a price is dropped whole (no evidence exists yet to check it against)",
    thinkingNote("The FOB price is USD 1,250 per unit, so I'll confirm it.") === "");
  check("empty or debug-looking text gives no note", thinkingNote("") === "" && thinkingNote("   ") === "" && thinkingNote("(cached)") === "");
  const long = "word ".repeat(400);
  const capped = thinkingNote(long);
  check(`a long monologue is capped at ${THINKING_NOTE_MAX} characters and marked as cut`, capped.length <= THINKING_NOTE_MAX + 1 && capped.endsWith("…"));
}

console.log("\n── 2. The retract frame carries the note ──");
{
  const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
  check("the frame is built by retractFrame, which keeps only thinkingNote's output",
    /function retractFrame\(said: string\): \{ type: "retract"; note\?: string \} \{\s*const note = thinkingNote\(said\);\s*return note \? \{ type: "retract", note \} : \{ type: "retract" \};/.test(route));
  check("every retract the route sends goes through it (no bare retract frame is left)",
    !/send\(\{ type: "retract" \}\)/.test(route) && (route.match(/emit\(send\(retractFrame\(/g) ?? []).length === 3);
  check("the tool loop's retract carries what streamed since the last one, then starts over",
    /liveText \+= text;/.test(route) && /emit\(send\(retractFrame\(liveText\)\)\);\s*liveText = "";/.test(route));
}

console.log("\n── 3. The panel's rows ──");
{
  const steps: AgentStep[] = [
    { kind: "tool-call", tool: "search_web", payload: { query: "top 100 global brands 2026" } },
    { kind: "tool-result", tool: "search_web", text: "ok" },
    { kind: "tool-call", tool: "read_page", payload: { url: "https://www.interbrand.com/best-brands/" } },
  ];
  const thinking: ThinkingRecord = {
    startedAt: 0,
    notes: [
      { text: "I'll look up the latest ranking.", at: 0 },
      { text: "The snippets stop at 10; I'll open the page.", at: 1 },
      { text: "The page lists 25; the rest are from general knowledge.", at: 2 },
    ],
  };
  const live = thinkingRows(steps, thinking, false);
  check("rows interleave in the order they happened: note, search, note, read, note",
    live.map((r) => r.kind).join(",") === "note,lookup,note,lookup,note");
  const search = live[1];
  const read = live[3];
  check("a search shows its query and is done once its result arrived",
    search.kind === "lookup" && search.detail === "top 100 global brands 2026" && search.done);
  check("a read shows its site without www., and is still running while live",
    read.kind === "lookup" && read.detail === "interbrand.com" && !read.done);
  check("once the answer has begun every lookup reads as done", thinkingRows(steps, thinking, true).every((r) => r.kind !== "lookup" || r.done));
  check("any other tool shows no arguments at all (Hub data stays off the panel)",
    lookupDetail({ kind: "tool-call", tool: "getCustomer", payload: { name: "ACME Trading", id: "c-1" } }) === null);
  check("a bad URL gives no site rather than throwing", siteOf("not a url") === null && siteOf(42) === null);
  check("a turn with no lookup and nothing said before one has no panel",
    !hasThinking([{ kind: "answer", text: "Hi" }], { startedAt: 0, notes: [] }) && !hasThinking(undefined, undefined));
  check("  …and one with either has a panel",
    hasThinking(steps, undefined) && hasThinking([], { startedAt: 0, notes: [{ text: "x", at: 0 }] }));
  check("thinking time is whole seconds and never 0", thoughtSeconds(200) === 1 && thoughtSeconds(23_400) === 23);
}

console.log("\n── 4. The words, in three languages, with no tool names ──");
{
  const keys = ["thinkingTitle", "thoughtFor", "thinkSearching", "thinkSearched", "thinkReading", "thinkRead", "thinkingShow", "thinkingHide"] as const;
  check("every panel string exists in English, Chinese and Arabic",
    (["en", "zh", "ar"] as const).every((l) => keys.every((k) => typeof COPY[l][k] === "string" && COPY[l][k].length > 0)));
  check("\"Thought for {s}\" carries its number slot in all three",
    (["en", "zh", "ar"] as const).every((l) => COPY[l].thoughtFor.includes("{s}")));
  check("the title matches the activity line's word for thinking (Thinking / 思考中 / بفكّر)",
    COPY.en.thinkingTitle === "Thinking" && COPY.zh.thinkingTitle === "思考中" && COPY.ar.thinkingTitle === "بفكّر");
  const panel = readFileSync("src/components/ai/ThinkingPanel.tsx", "utf8");
  check("the panel never renders a step's raw text or tool name — only the words above and the row's detail",
    !/\{row\.tool\}/.test(panel) && !/step\.text|\.text\}\s*<\/span>/.test(panel));
}

console.log("\n── 5. The client keeps the note and times the thinking ──");
{
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("a retract's note moves into the panel, placed before the next lookup",
    /if \(typeof json\.note === "string" && json\.note\) thinkNotes\.push\(\{ text: json\.note, at: lookupsSeen \}\);/.test(app));
  check("only a NEW lookup reopens the panel; a frame that adds results does not",
    /if \(lookups > lookupsSeen\) \{\s*lookupsSeen = lookups;\s*thinkMs = undefined;/.test(app));
  check("the thinking time is fixed when the answer begins",
    /if \(thinkMs === undefined && \(lookupsSeen > 0 \|\| thinkNotes\.length > 0\)\) \{\s*thinkMs = Date\.now\(\) - thinkStartedAt;/.test(app));
  check("the final message keeps the panel's record", /servedModel,\s*thinking: thinkingRecord\(\),/.test(app));
  const bubble = readFileSync("src/components/ai/Bubble.tsx", "utf8");
  check("the bubble shows the panel when there is thinking, and the separate activity line steps aside",
    /\{showThinking && \(\s*<ThinkingPanel/.test(bubble) && /!isUser && !showThinking && msg\.content && orbState === "typing"/.test(bubble) &&
    /showThinking \? null : orbState === "loading"/.test(bubble));
}

console.log("\n── 6. The record saved with the reply (ai_messages.thinking) ──");
{
  const steps: AgentStep[] = [
    { kind: "tool-call", tool: "search_web", payload: { query: "top 100 global brands 2026" } },
    { kind: "tool-result", tool: "search_web", text: "ok" },
    { kind: "tool-call", tool: "read_page", payload: { url: "https://www.interbrand.com/best-brands/" } },
    { kind: "tool-call", tool: "getCustomer", payload: { name: "ACME Trading", phone: "+86 138 0000 0000" } },
    { kind: "answer", text: "…" },
  ];
  const rec = buildThinkingRecord({ notes: [{ text: "I'll look it up.", at: 0 }], steps, ms: 23_400 });
  check("a turn with lookups saves a v1 record: its notes, its lookups, how long it thought",
    !!rec && rec.v === 1 && rec.notes.length === 1 && rec.lookups.length === 3 && rec.ms === 23_400);
  check("a lookup keeps only a search's query or a read's site — another tool's arguments are never stored",
    !!rec && rec.lookups[0].detail === "top 100 global brands 2026" && rec.lookups[1].detail === "interbrand.com" &&
    rec.lookups[2].detail === null && !JSON.stringify(rec).includes("ACME") && !JSON.stringify(rec).includes("138"));
  check("a turn with no lookup and nothing said saves nothing (the column stays NULL)",
    buildThinkingRecord({ notes: [], steps: [{ kind: "answer", text: "Hi" }], ms: 900 }) === null);
  const many = buildThinkingRecord({
    notes: Array.from({ length: 30 }, (_, i) => ({ text: `note ${i} ` + "x".repeat(900), at: i })),
    steps: Array.from({ length: 40 }, () => ({ kind: "tool-call", tool: "search_web", payload: { query: "q" } })),
    ms: 1,
  });
  check(`the record is bounded: ≤ ${THINKING_MAX_NOTES} notes of ≤ 600 characters, ≤ ${THINKING_MAX_LOOKUPS} lookups, well under the column's 16 KB check`,
    !!many && many.notes.length === THINKING_MAX_NOTES && many.notes.every((n) => n.text.length <= 600) &&
    many.lookups.length === THINKING_MAX_LOOKUPS && JSON.stringify(many).length < 16384);
  check("a saved record reads back as itself", JSON.stringify(parseThinkingRecord(JSON.parse(JSON.stringify(rec)))) === JSON.stringify(rec));
  check("a value that is not the saved shape reads as no panel, never a broken one",
    parseThinkingRecord(null) === null && parseThinkingRecord("x") === null && parseThinkingRecord({ v: 2, notes: [], lookups: [{ tool: "search_web", detail: "q" }], ms: 1 }) === null &&
    parseThinkingRecord({ v: 1, notes: "no", lookups: [], ms: 1 }) === null && parseThinkingRecord({ v: 1, notes: [], lookups: [], ms: 1 }) === null);
  const rows = thinkingRows(undefined, { notes: rec!.notes, lookups: rec!.lookups, ms: rec!.ms }, false);
  check("a reloaded thread draws the saved record: the note, then each lookup, all done, same details",
    rows.map((r) => r.kind).join(",") === "note,lookup,lookup,lookup" &&
    rows.every((r) => r.kind !== "lookup" || r.done) &&
    rows[1].kind === "lookup" && rows[1].detail === "top 100 global brands 2026" && rows[2].kind === "lookup" && rows[2].detail === "interbrand.com" &&
    rows[3].kind === "lookup" && rows[3].detail === null);
  check("  …and a saved record alone is enough for the panel to show", hasThinking(undefined, { notes: [], lookups: rec!.lookups, ms: 1 }));

  const route = readFileSync("src/app/api/ai/agent/route.ts", "utf8");
  check("the route reads the record off the frames it sends (every frame passes through the tracker)",
    /const send = \(obj: unknown\) => \{\s*trackThinking\(obj\);/.test(route));
  check("  …a retract's note is kept with the lookup count at that moment; a new lookup or retract restarts the answer clock",
    /if \(typeof f\.note === "string" && f\.note\) thinkNotes\.push\(\{ text: f\.note, at: thinkLookups \}\);\s*thinkAnswerAt = null;/.test(route) &&
    /if \(n > thinkLookups\) \{\s*thinkLookups = n;\s*thinkAnswerAt = null;/.test(route));
  check("the reply's insert names the column only when there is a record",
    /const thinking = buildThinkingRecord\(\{\s*notes: thinkNotes,\s*steps: agent\.steps,/.test(route) && /\.\.\.\(thinking \? \{ thinking \} : \{\}\),/.test(route));
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("an opened thread checks each saved record on the way in",
    /const thinking = parseThinkingRecord\(\(r as \{ thinking\?: unknown \}\)\.thinking\);/.test(app));
  const mig = readFileSync("supabase/migrations/ai_messages_thinking.sql", "utf8");
  check("the migration adds one nullable jsonb column with no default (no rewrite), bounded by a CHECK",
    /add column if not exists thinking jsonb;/.test(mig) && !/thinking jsonb[^;]*(not null|default)/i.test(mig) &&
    /jsonb_typeof\(thinking\) = 'object' and octet_length\(thinking::text\) <= 16384/.test(mig));
  check("  …and states its reason, index, RLS, load and rollback", ["WHY.", "SHAPE.", "INDEX.", "RLS.", "LOAD.", "ROLLBACK."].every((h) => mig.includes(h)));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
