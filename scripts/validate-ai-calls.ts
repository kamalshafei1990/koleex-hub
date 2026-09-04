/* ---------------------------------------------------------------------------
   validate:ai-calls — past calls by their summaries (roadmap D2).
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { CALLS_MAX, collectCalls } from "../src/lib/server/ai/calls";
import { SUMMARY_HEADINGS } from "../src/lib/server/ai/voice/summary";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok = false;
  try { ok = typeof cond === "function" ? cond() : cond; } catch (e) { label += ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
  if (ok) { pass++; console.log(`  ✓ ${label}`); } else { failures.push(label); console.log(`  ✗ ${label}`); }
}

console.log("── 1. Rows to calls ──");
{
  const titles = new Map<string, string | null>([["c1", "Ningbo shipment"], ["c2", null]]);
  const rows = [
    { id: "m5", conversation_id: "c1", role: "assistant", source: "voice", content: `**${SUMMARY_HEADINGS.ar}**\n\n- سعر KX-200: 1,250 دولار`, created_at: "2026-09-03T18:00:00Z" },
    { id: "m4", conversation_id: "c1", role: "assistant", source: "voice", content: "Sure, the KX-200 is 1,250 USD FOB.", created_at: "2026-09-03T17:59:00Z" },
    { id: "m3", conversation_id: "c2", role: "assistant", source: "text", content: `**${SUMMARY_HEADINGS.en}**\n\n- typed, not a call`, created_at: "2026-09-03T17:00:00Z" },
    { id: "m2", conversation_id: "c2", role: "user", source: "voice", content: `**${SUMMARY_HEADINGS.en}**`, created_at: "2026-09-03T16:00:00Z" },
    { id: "m1", conversation_id: "c2", role: "assistant", source: "voice", content: `  **${SUMMARY_HEADINGS.zh}**\n- 会议`, created_at: "2026-09-02T09:00:00Z" },
  ];
  const calls = collectCalls(rows, titles);
  check("only spoken assistant rows that ARE summaries count, one call each, newest first, title attached (null when none), content trimmed",
    calls.length === 2 && calls[0].message_id === "m5" && calls[0].conversation_title === "Ningbo shipment" && calls[0].summary.startsWith(`**${SUMMARY_HEADINGS.ar}**`) &&
    calls[1].message_id === "m1" && calls[1].conversation_title === null && calls[1].summary.startsWith(`**${SUMMARY_HEADINGS.zh}**`));
  const many = Array.from({ length: 100 }, (_, i) => ({ id: `m${i}`, conversation_id: "c1", role: "assistant", source: "voice", content: `**${SUMMARY_HEADINGS.en}**\n- ${i}`, created_at: "t" }));
  check("the list is capped", collectCalls(many, titles).length === CALLS_MAX && collectCalls(many, titles, 4).length === 4);
}

console.log("\n── 2. The route and the client, read ──");
{
  const route = readFileSync("src/app/api/ai/calls/route.ts", "utf8");
  check("the route opens with the conversation doors and reads spoken assistant rows INSIDE the caller's own conversation ids, narrowed by the heading words",
    /requireAuth\(\)[\s\S]{0,200}?requireInternalUser\(auth\)/.test(route) &&
    /from\("ai_conversations"\)[\s\S]{0,200}?\.eq\("tenant_id", auth\.tenant_id\)\s*\.eq\("account_id", auth\.account_id\)/.test(route) &&
    /from\("ai_messages"\)[\s\S]{0,260}?\.in\("conversation_id", Array\.from\(titles\.keys\(\)\)\)\s*\.eq\("role", "assistant"\)\s*\.eq\("source", "voice"\)\s*\.or\(headingFilter\)/.test(route) &&
    /Object\.values\(SUMMARY_HEADINGS\)\.map\(\(h\) => `content\.ilike\.%\$\{h\}%`\)\.join\(","\)/.test(route) &&
    /if \(titles\.size === 0\) return NextResponse\.json\(\{ items: \[\] \}\);/.test(route) &&
    /console\.log\(`\[ai\.calls\] ok rows=/.test(route) && !/console\.\w+\([^)]*content/.test(route));
  const panel = readFileSync("src/components/ai/CallsPanel.tsx", "utf8");
  check("the panel fetches from the fixed path, aborts on unmount, renders the summary as markdown and opens the chat",
    /fetchFn\(CALLS_PATH, \{ credentials: "include", signal: ctl\.signal \}\)/.test(panel) && /return \(\) => ctl\.abort\(\);/.test(panel) &&
    /<MessageMarkdown content=\{it\.summary\} \/>/.test(panel) && /onOpenConversation\(it\.conversation_id\)/.test(panel) && !/dangerouslySetInnerHTML/.test(panel));
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("the app shows the calls in the main pane while open, the library and calls views exclude each other, and opening or starting a chat closes both",
    /\) : callsOpen \? \(\s*<CallsPanel copy=\{copy\} lang=\{lang\} onOpenConversation=\{\(id\) => void openConversation\(id\)\} \/>/.test(app) &&
    /setLibraryOpen\(true\); setCallsOpen\(false\);/.test(app) && /setCallsOpen\(true\); setLibraryOpen\(false\);/.test(app) &&
    /async \(id: string\) => \{\s*setLibraryOpen\(false\);\s*setCallsOpen\(false\);/.test(app) &&
    /const startNewChat = useCallback\(async \(\) => \{\s*setLibraryOpen\(false\);\s*setCallsOpen\(false\);/.test(app));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the database read and the list on a phone — opening Calls is the test.");
