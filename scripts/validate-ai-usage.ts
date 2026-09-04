/* ---------------------------------------------------------------------------
   validate:ai-usage — how much Koleex AI is used, for the owner (roadmap D3).
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { USAGE_DAYS_DEFAULT, USAGE_DAYS_MAX, USAGE_TOP_TOOLS, aggregateUsage, dayKeys, dayOf, parseDays } from "../src/lib/server/ai/usage";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok = false;
  try { ok = typeof cond === "function" ? cond() : cond; } catch (e) { label += ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
  if (ok) { pass++; console.log(`  ✓ ${label}`); } else { failures.push(label); console.log(`  ✗ ${label}`); }
}

console.log("── 1. The window ──");
check("days: default 14, capped at 60, junk and zero fall back",
  parseDays(null) === USAGE_DAYS_DEFAULT && parseDays("7") === 7 && parseDays("999") === USAGE_DAYS_MAX && parseDays("0") === USAGE_DAYS_DEFAULT && parseDays("x") === USAGE_DAYS_DEFAULT);
check("day keys: N UTC days ending today, oldest first, every day present",
  (() => { const k = dayKeys(3, new Date("2026-09-04T02:00:00Z")); return k.join(",") === "2026-09-02,2026-09-03,2026-09-04"; })() &&
  dayOf("2026-09-03T23:59:59Z") === "2026-09-03" && dayOf("junk") === null);

console.log("\n── 2. The report ──");
{
  const now = new Date("2026-09-04T12:00:00Z");
  const r = aggregateUsage({
    days: 3, now,
    messages: [
      { created_at: "2026-09-04T01:00:00Z", role: "user", source: "text" },
      { created_at: "2026-09-04T01:01:00Z", role: "assistant", source: "text" },
      { created_at: "2026-09-03T10:00:00Z", role: "user", source: "voice" },
      { created_at: "2026-09-03T10:00:30Z", role: "assistant", source: "voice" },
      { created_at: "2026-08-01T10:00:00Z", role: "user", source: "text" },
      { created_at: "2026-09-03T10:00:00Z", role: "system", source: "text" },
    ],
    conversations: [
      { created_at: "2026-09-04T00:30:00Z", account_id: "a1" },
      { created_at: "2026-09-02T09:00:00Z", account_id: "a2" },
      { created_at: "2026-09-02T09:30:00Z", account_id: null },
    ],
    toolCalls: [
      { created_at: "2026-09-04T01:00:10Z", tool_name: "searchProducts", ok: true, account_id: "a1" },
      { created_at: "2026-09-03T10:00:20Z", tool_name: "searchProducts", ok: false, account_id: "a3" },
      { created_at: "2026-09-03T10:00:25Z", tool_name: "getProductPrice", ok: true, account_id: "a3" },
    ],
    calls: [{ created_at: "2026-09-03T10:05:00Z" }],
  });
  check("turns are split typed / spoken / replies by day; rows outside the window and roles that are neither are ignored",
    r.days.length === 3 && r.days[2].typed === 1 && r.days[2].replies === 1 && r.days[1].spoken === 1 && r.days[1].replies === 1 && r.days[0].typed === 0 &&
    r.totals.typed === 1 && r.totals.spoken === 1 && r.totals.replies === 2);
  check("chats, calls and lookups land on their days; people are distinct accounts across chats and lookups",
    r.days[2].chats === 1 && r.days[0].chats === 2 && r.days[1].calls === 1 && r.days[1].tools === 2 && r.days[2].tools === 1 && r.people === 3);
  check("tools are ranked by count with a success rate, capped",
    r.tools[0].name === "searchProducts" && r.tools[0].count === 2 && r.tools[0].okRate === 50 && r.tools[1].name === "getProductPrice" && r.tools[1].okRate === 100 &&
    aggregateUsage({ days: 1, now, messages: [], conversations: [], calls: [], toolCalls: Array.from({ length: 30 }, (_, i) => ({ created_at: "2026-09-04T01:00:00Z", tool_name: `t${i}`, ok: true, account_id: "a" })) }).tools.length === USAGE_TOP_TOOLS);
  check("the report carries no text: only numbers, day strings and tool names",
    !JSON.stringify(r).includes("content") && Object.keys(r).sort().join() === "days,people,since,tools,totals");
}

console.log("\n── 3. The route and the tab, read ──");
{
  const route = readFileSync("src/app/api/ai/usage/route.ts", "utf8");
  check("the route is super-admin only, decided from the server's auth context, after the ordinary doors",
    /requireAuth\(\)[\s\S]{0,200}?requireInternalUser\(auth\)[\s\S]{0,200}?if \(!auth\.is_super_admin\) \{\s*return NextResponse\.json\(\{ error: [^}]*\}, \{ status: 403 \}\);/.test(route));
  check("every read is tenant-scoped and windowed, no message text is selected except to recognise a summary heading, and nothing of it is returned",
    (route.match(/\.eq\("tenant_id", auth\.tenant_id\)/g) ?? []).length === 4 && (route.match(/\.gte\("created_at", since\)/g) ?? []).length === 4 &&
    /select\("created_at, role, source"\)/.test(route) && /select\("created_at, content"\)[\s\S]{0,900}?isSummaryMessage\(r\.content\)\)\s*\.map\(\(r\) => \(\{ created_at: r\.created_at \}\)\)/.test(route) &&
    !/console\.\w+\([^)]*content/.test(route));
  const tab = readFileSync("src/components/settings/tabs/AiTab.tsx", "utf8");
  check("the tab shows the section to a super admin only and fetches the fixed path once",
    /\{account\.is_super_admin && <UsageSection t=\{t\} \/>\}/.test(tab) && /fetch\("\/api\/ai\/usage\?days=14", \{ credentials: "include", signal: ctl\.signal \}\)/.test(tab) && /return \(\) => ctl\.abort\(\);/.test(tab));
  const tr = readFileSync("src/lib/translations/settings.ts", "utf8");
  check("the copy says plainly that cost is not shown and why",
    /"ai\.usage\.desc":[^\n]*Cost is not shown: token usage is logged per turn but not stored/.test(tr) && /"ai\.usage\.title":[^\n]*ar: "/.test(tr));
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the database reads and the table on a phone — opening Settings → Koleex AI as the owner is the test.");
