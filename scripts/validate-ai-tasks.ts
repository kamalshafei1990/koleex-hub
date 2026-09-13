#!/usr/bin/env tsx

/* ===========================================================================
   validate:ai-tasks — Koleex AI as a secretary: tasks, reminders, delegation.

   Phase 1 of docs/koleex-ai/TASKS_BY_AI_PLAN_2026-09.md: the to-do tool
   speaks the whole table (reminder, start, recurrence, private, people,
   department) and reads times in the CALLER's zone. What is proved here:
   the pure time helpers with real zones; the tool's schema, defaults,
   writes and notifications, by pin; the voice card and the two lanes'
   instructions, by pin. The handlers themselves need Supabase and are
   proved by the confirm-ledger and exposure suites' contracts.
   ========================================================================== */

import { readFileSync } from "node:fs";
import {
  resolveTaskTime, resolveTaskDay, describeWhen, hasClockTime, parseRecurrence, zonedToUtcMs, DEFAULT_TASK_HOUR,
} from "../src/lib/server/ai-agent/tools/task-time";
import { isChatConfirmTool, CHAT_CONFIRM_TOOLS } from "../src/lib/server/ai/chat-confirm";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name}${detail ? `\n      ↳ ${detail}` : ""}`); }
}

console.log("\n── 1. Times are read where the caller is ──");
check("a date alone is a working morning in the caller's zone (Dubai, UTC+4): 09:00 → 05:00Z",
  resolveTaskTime("2026-09-18", "Asia/Dubai") === "2026-09-18T05:00:00.000Z" && DEFAULT_TASK_HOUR === 9);
check("  …and the default hour can be the end of the working day for a due date (17:00 Dubai → 13:00Z)",
  resolveTaskTime("2026-09-18", "Asia/Dubai", 17) === "2026-09-18T13:00:00.000Z");
check("a local datetime without offset is read in the zone: 15:00 Shanghai → 07:00Z",
  resolveTaskTime("2026-09-18T15:00", "Asia/Shanghai") === "2026-09-18T07:00:00.000Z" &&
  resolveTaskTime("2026-09-18 15:00", "Asia/Shanghai") === "2026-09-18T07:00:00.000Z" &&
  resolveTaskTime("2026-09-18T15:00:30", "Asia/Shanghai") === "2026-09-18T07:00:00.000Z");
check("a value with its own offset is taken as written",
  resolveTaskTime("2026-09-18T15:00:00+08:00", "Asia/Dubai") === "2026-09-18T07:00:00.000Z" &&
  resolveTaskTime("2026-09-18T15:00Z", "Asia/Dubai") === "2026-09-18T15:00:00.000Z");
check("daylight saving is honoured: 09:00 New York is 13:00Z in July and 14:00Z in January",
  resolveTaskTime("2026-07-04T09:00", "America/New_York") === "2026-07-04T13:00:00.000Z" &&
  resolveTaskTime("2026-01-04T09:00", "America/New_York") === "2026-01-04T14:00:00.000Z");
check("words, 'none', an empty string, a non-string and an implausible year are not times",
  resolveTaskTime("tomorrow at 3", "Asia/Dubai") === null && resolveTaskTime("none", "Asia/Dubai") === null &&
  resolveTaskTime("", "Asia/Dubai") === null && resolveTaskTime(42, "Asia/Dubai") === null &&
  resolveTaskTime("1990-01-01", "Asia/Dubai") === null && resolveTaskTime("2200-01-01T09:00", "Asia/Dubai") === null);
check("an unknown zone falls back to Dubai rather than throwing",
  resolveTaskTime("2026-09-18T09:00", "Mars/Olympus") === "2026-09-18T05:00:00.000Z");
check("zonedToUtcMs is the inverse of the zone's wall clock",
  new Date(zonedToUtcMs(2026, 9, 18, 15, 0, "Asia/Shanghai")).toISOString() === "2026-09-18T07:00:00.000Z");
check("a start day keeps a date and takes the zone's day of a datetime (23:30Z is the next day in Shanghai)",
  resolveTaskDay("2026-09-18", "Asia/Shanghai") === "2026-09-18" && resolveTaskDay("2026-09-18T23:30:00Z", "Asia/Shanghai") === "2026-09-19" &&
  resolveTaskDay("none", "Asia/Shanghai") === null && resolveTaskDay("soon", "Asia/Shanghai") === null);
const worded = describeWhen("2026-09-18T07:00:00.000Z", "Asia/Shanghai");
check("the preview words a time in the zone with its weekday: Fri 18 Sept, 15:00 (2026-09-18 is a Friday)",
  /Fri/.test(worded) && /18 Sept?/.test(worded) && /15:00/.test(worded) && describeWhen(null, "Asia/Shanghai") === "" && describeWhen("junk", "Asia/Shanghai") === "");
check("only a value with hours and minutes names a clock time (decides the default reminder)",
  hasClockTime("2026-09-18T15:00") && hasClockTime("2026-09-18 15:00+04:00") && !hasClockTime("2026-09-18") && !hasClockTime(null));
check("recurrence is one of three words or nothing",
  parseRecurrence("weekly") === "weekly" && parseRecurrence(" Daily ") === "daily" && parseRecurrence("monthly") === "monthly" &&
  parseRecurrence("yearly") === null && parseRecurrence(undefined) === null);

console.log("\n── 2. The tool speaks the whole table ──");
const todos = readFileSync("src/lib/server/ai-agent/tools/todos.ts", "utf8");
const createSrc = todos.slice(todos.indexOf('name: "createTodo"'), todos.indexOf("/* ── Complete / reopen"));
for (const field of ["remind_at", "start_date", "recurrence", "recurrence_until", "is_private", "assign_to_department", "assign_to_all", "observer_account_ids", "mention_account_ids"]) {
  check(`createTodo's schema offers ${field}`, new RegExp(`\\n\\s+${field}: \\{ type: "`).test(createSrc));
}
check("only the title is required, and the description says so",
  /required: \["title"\]/.test(createSrc) && /Only the title is required — never ask for the rest/.test(createSrc));
check("times resolve in the caller's zone (UserContext.timezone), the due date at the end of the working day, the reminder at the start",
  /const tz = ctx\.timezone \|\| "Asia\/Dubai";/.test(createSrc) && /resolveTaskTime\(args\.due_date, tz, 17\)/.test(createSrc) && /resolveTaskTime\(args\.remind_at, tz\)/.test(createSrc));
check("a reminder defaults to the due time only when the due date names a clock time",
  /resolveTaskTime\(args\.remind_at, tz\) \?\? \(dueIso && hasClockTime\(args\.due_date\) \? dueIso : null\)/.test(createSrc));
check("an unreadable date or reminder is a plain failure with the format asked for, never a guess",
  /if \(args\.due_date && !dueIso\) \{\s*return \{ ok: false, permissionStatus: "allowed"/.test(createSrc) && /if \(args\.remind_at && !remindIso\) \{\s*return \{ ok: false, permissionStatus: "allowed"/.test(createSrc));
check("assignees, observers and mentions resolve against the assignable list in ONE lookup; an unknown id is a hard error",
  /const everyone = \[\.\.\.assigneeIds, \.\.\.observerIds, \.\.\.mentionIds\];/.test(createSrc) && /await resolvePeople\(ctx\.auth\.tenant_id, everyone, "createTodo"\)/.test(createSrc) &&
  /const unknown = ids\.filter\(\(id\) => !people\.has\(id\)\);\s*if \(unknown\.length > 0\) \{\s*return \{\s*ok: false,/.test(todos));
check("a department must be one the colleagues have, spelled as they spell it, else the known ones are listed",
  /if \(!r\.departments\.has\(department\.toLowerCase\(\)\)\)/.test(createSrc) && /I don't know a department called/.test(createSrc));
check("'everyone' is an admin's call — refused as a PERMISSION, with the alternative offered",
  /if \(!ctx\.isSuperAdmin && ut !== "admin"\) \{\s*return \{\s*ok: false,\s*permissionStatus: "denied",/.test(createSrc) && /You don't have permission to assign a task to everyone/.test(createSrc));
check("the preview carries names, the times in words, the zone — and the pending action carries ids and ISO times only",
  /preview: \{\s*\.\.\.normalized,\s*assignees: assignees\.map/.test(createSrc) && /when,\s*timezone: tz,/.test(createSrc) &&
  /pendingAction: \{\s*tool: "createTodo",\s*args: \{\s*\.\.\.normalized,\s*\.\.\.\(assigneeIds\.length > 0 \? \{ assign_to_account_ids: assigneeIds \} : \{\}\),\s*\.\.\.\(observerIds\.length > 0 \? \{ observer_account_ids: observerIds \} : \{\}\),\s*\.\.\.\(mentionIds\.length > 0 \? \{ mention_account_ids: mentionIds \} : \{\}\),/.test(createSrc));
check("the insert writes every field the To-do app writes, people into metadata as the app does",
  /remind_at: normalized\.remind_at,\s*recurrence: normalized\.recurrence,\s*recurrence_until: normalized\.recurrence_until,/.test(createSrc) &&
  /start_date: normalized\.start_date,/.test(createSrc) && /is_private: normalized\.is_private,/.test(createSrc) && /assigned_department: departmentName,\s*assign_to_all: toAll,/.test(createSrc) &&
  /observers: observers\.map\(personRef\)/.test(createSrc) && /mentions: mentions\.map\(personRef\)/.test(createSrc) && /created_via: "koleex-ai"/.test(createSrc));
check("assignee rows expand a department through koleex_employees and 'everyone' through active internal accounts, then INTERNAL ONLY — as the route does",
  /\.from\("koleex_employees"\)\s*\.select\("account_id"\)\s*\.eq\("department", departmentName\)/.test(createSrc) &&
  /\.eq\("user_type", "internal"\)\s*\.eq\("status", "active"\)/.test(createSrc) && /\.in\("id", assigneeAccountIds\)\s*\.eq\("user_type", "internal"\)/.test(createSrc));
check("notifications: assignees, then mentions, then observers — never the creator, never twice",
  /const notified = new Set<string>\(\[ctx\.auth\.account_id\]\);/.test(createSrc) && /const fresh = recipients\.filter\(\(id\) => !notified\.has\(id\)\);/.test(createSrc) &&
  /"todo_assignment"/.test(createSrc) && /"todo_mention"/.test(createSrc) && /"todo_observer"/.test(createSrc) &&
  createSrc.indexOf('"todo_assignment"') < createSrc.indexOf('"todo_mention"') && createSrc.indexOf('"todo_mention"') < createSrc.indexOf('"todo_observer"'));
check("the confirmation names the reminder", /I'll remind \$\{who \? "them" : "you"\} \$\{when\.remind\}/.test(createSrc));

const updateSrc = todos.slice(todos.indexOf('name: "updateTodo"'), todos.indexOf("/* ── Reassign (with confirm)"));
for (const field of ["remind_at", "start_date", "recurrence", "is_private", "add_observer_account_ids", "remove_observer_account_ids"]) {
  check(`updateTodo's schema offers ${field}`, new RegExp(`\\n\\s+${field}: \\{ type: "`).test(updateSrc));
}
check("updateTodo reads times in the zone, clears with 'none', and refuses an unreadable time plainly",
  /const tz = ctx\.timezone \|\| "Asia\/Dubai";/.test(updateSrc) && /isNone\(args\.due_date\) \? null : resolveTaskTime\(args\.due_date, tz, 17\)/.test(updateSrc) &&
  /isNone\(args\.remind_at\) \? null : resolveTaskTime\(args\.remind_at, tz\)/.test(updateSrc) && /I couldn't read that reminder time/.test(updateSrc));
check("observers change as a whole list previewed by name; the metadata is merged, not replaced; the newly added hear about it",
  /patch\.metadata = \{ \.\.\.\(t\.metadata \?\? \{\}\), observers: nextObservers \}/.test(updateSrc) && /observers → \$\{observerNames\}/.test(updateSrc) &&
  /const fresh = nextObservers\.map\(\(o\) => o\.account_id\)\.filter\(\(id\) => !before\.has\(id\) && id !== ctx\.auth\.account_id\);/.test(updateSrc));
check("stopping a recurrence also clears its end date", /if \(changes\.recurrence === null\) changes\.recurrence_until = null;/.test(updateSrc));

console.log("\n── 3. The two lanes are told the secretary's way ──");
const prompt = readFileSync("src/lib/server/ai/prompts/index.ts", "utf8");
check("the text lane: build from everything said, only the title required, never ask for what was not mentioned, ask only when the task would be wrong, one sentence with a default",
  /THE SECRETARY'S WAY \(tasks and reminders\)/.test(prompt) && /Only the title is required\. NEVER ask for a description, priority, label, observer, document or date the user did not mention/.test(prompt) &&
  /Ask ONLY when the task would be wrong without the answer/.test(prompt) && /ONE natural sentence with your default in it/.test(prompt) && /"remind me at 3" → today 15:00 in their timezone/.test(prompt));
const voiceCfg = readFileSync("src/lib/server/ai/voice/session-config.ts", "utf8");
check("the call: the same, with everything they said, the only question the two-matches one, and the one line names the reminder or the person",
  /call createTodo WITHOUT confirm, with" \+\s*" the title in their words and EVERYTHING they said/.test(voiceCfg) && /two matches → ask which one, the only question you ask/.test(voiceCfg) &&
  /the reminder time or the person and the day — and that a tap saves it/.test(voiceCfg) && /NEVER call" \+\s*" createTodo with confirm yourself/.test(voiceCfg));
const voiceTools = readFileSync("src/lib/server/ai/voice/tools.ts", "utf8");
check("the call's createTodo description names remind_at and the timezone, and still reserves confirm for the tap",
  /remind_at for \\"remind me at 3\\" \(today" \+\s*" 15:00 in their timezone\)/.test(voiceTools) && /Never call with confirm yourself\./.test(voiceTools));

console.log("\n── 4. The card on the call shows what will be saved, in words ──");
const route = readFileSync("src/app/api/ai/voice/tool/route.ts", "utf8");
check("the tool route forwards the tool's preview beside the pending arguments — for the screen, never back with the tap",
  /preview: \(result\.data as \{ preview\?: unknown \} \| null\)\?\.preview \?\? undefined,/.test(route));
const sess = readFileSync("src/lib/voice/session.ts", "utf8");
check("the session reads the preview strictly (an object, not an array) and hands it on with the message",
  /const preview = p\.preview && typeof p\.preview === "object" && !Array\.isArray\(p\.preview\) \? \(p\.preview as Record<string, unknown>\) : undefined;/.test(sess) &&
  /this\.events\.onPendingWrite\?\.\(call\.name, \{ tool: p\.tool, args: p\.args as Record<string, unknown> \}, typeof msg === "string" \? msg : "", preview\);/.test(sess));
const btn = readFileSync("src/components/ai/VoiceCallButton.tsx", "utf8");
check("the button keeps the preview with the pending write", /setPendingWrite\(\{ tool: pending\.tool, args: pending\.args, message, preview \}\);/.test(btn));
const screen = readFileSync("src/components/ai/VoiceCallScreen.tsx", "utf8");
check("the card words the due and reminder times from the preview (raw arguments as fallback) and names the people, with the tap unchanged",
  /const pv = pendingWrite\.preview \?\? \{\};/.test(screen) && /remind \? `\$\{copy\.remind\} \$\{remind\}` : ""/.test(screen) && /people\.length \? `\$\{copy\.forPeople\} \$\{people\.join\(", "\)\}` : ""/.test(screen) &&
  /data-task-details/.test(screen) && /onClick=\{onConfirmWrite\}/.test(screen));
check("the card's new words exist in all three languages",
  /remind: "Reminder",/.test(screen) && /remind: "提醒",/.test(screen) && /remind: "تذكير",/.test(screen) && /forPeople: "For",/.test(screen) && /forPeople: "给",/.test(screen) && /forPeople: "لـ",/.test(screen));

console.log("\n── 5. Phase 2: the Task card in the chat, saved by a tap through the ledger ──");
const orch = readFileSync("src/lib/server/ai-agent/orchestrator.ts", "utf8");
check("the orchestrator hands the preview's confirm arguments to the screen on the step — only while awaiting approval — and leaves the model's envelope alone",
  /\.\.\.\(result\.pendingAction && result\.permissionStatus === "approval_required"\s*\? \{ pending: \{ tool: result\.pendingAction\.tool, args: result\.pendingAction\.args \} \}\s*: \{\}\),/.test(orch));
const serverTypes = readFileSync("src/lib/server/ai-agent/types.ts", "utf8");
const clientTypes = readFileSync("src/components/ai/types.ts", "utf8");
check("AgentStep.pending exists on both sides of the wire, the client's a mirror",
  /pending\?: \{ tool: string; args: Record<string, unknown> \};/.test(serverTypes) && /pending\?: \{ tool: string; args: Record<string, unknown> \};/.test(clientTypes));
check("the chat may confirm the five to-do writes and nothing else — not a read, not a tool off the list, not an invention",
  [...CHAT_CONFIRM_TOOLS].sort().join() === "completeTodo,createTodo,deleteTodo,reassignTodo,updateTodo" &&
  isChatConfirmTool("createTodo") && isChatConfirmTool("updateTodo") && !isChatConfirmTool("listMyTodos") && !isChatConfirmTool("createCalendarEvent") && !isChatConfirmTool("search_web") && !isChatConfirmTool("") && !isChatConfirmTool("CREATETODO"));
const confirmRoute = readFileSync("src/app/api/ai/agent/confirm/route.ts", "utf8");
const at = (re: RegExp) => { const m = re.exec(confirmRoute); return m ? m.index : -1; };
const order = [
  at(/const auth = await requireAuth\(req\);/), at(/requireInternalUser\(auth\)/), at(/await buildUserContext\(auth\)/), at(/await req\.json\(\)/),
  at(/CHAT_CONFIRM_MAX_ARGS_BYTES\) return NextResponse\.json\(\{ error: "Too large\." \}, \{ status: 413 \}\)/), at(/if \(!isChatConfirmTool\(name\)\) return NextResponse\.json\(\{ error: "Not allowed\." \}, \{ status: 403 \}\)/),
  at(/bucket: "chat_confirm", windowSec: 60, max: CHAT_CONFIRM_PER_MIN/), at(/parseConversationParam\(/), at(/\.from\("ai_conversations"\)[\s\S]{0,200}?\.eq\("account_id", auth\.account_id\)/),
  at(/dispatchTool\(ctx, name, \{ \.\.\.args, confirm: true \}, \{ conversationId \}\)/),
];
check("the confirm route re-decides everything in the voice tool route's order: the door, the account type, the context, the body, the size, the list, the budget, the caller's own conversation, then dispatch WITH the conversation id",
  order.every((i) => i >= 0) && order.every((i, k) => k === 0 || i > order[k - 1]));
check("a fabricated tap is the ledger's to refuse: the route passes confirm:true and lets dispatchTool match the recorded preview; it never writes a table itself before dispatch",
  confirmRoute.indexOf('.from("ai_messages")') > at(/dispatchTool\(ctx, name/) && !/\.from\("koleex_todos"\)/.test(confirmRoute));
check("on success the tool's own line joins the thread as an assistant message and the conversation counter moves — never on a refusal",
  /if \(result\.ok && result\.permissionStatus === "allowed" && typeof result\.message === "string"/.test(confirmRoute) && /role: "assistant", content: result\.message, provider: "tool-confirm"/.test(confirmRoute) &&
  /message_count: \(conv\.message_count \?\? 0\) \+ 1/.test(confirmRoute) && /withPublicProvider\(ins\.data/.test(confirmRoute) && /export const dynamic = "force-dynamic";/.test(confirmRoute));
const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
check("the page posts the preview's own arguments with the conversation id and via:'tap', shows saved/failed, and appends the route's message once",
  /fetch\("\/api\/ai\/agent\/confirm", \{[\s\S]{0,300}?body: JSON\.stringify\(\{ conversation_id: conversationId, name: pending\.tool, arguments: pending\.args, via: "tap" \}\)/.test(app) &&
  /\[msgId\]: \{ state: "saved", text: body\.output\?\.message \?\? undefined, todoId \}/.test(app) && /prev\.some\(\(m\) => m\.id === row\.id\) \? prev : \[\.\.\.prev, row\]/.test(app) &&
  /onConfirmTask=\{onConfirmTask\}\s*onCancelTask=\{onCancelTask\}\s*taskStatus=\{taskCards\[m\.id\]\}/.test(app));
const bubble = readFileSync("src/components/ai/Bubble.tsx", "utf8");
check("the bubble shows the card only for a to-do write awaiting approval with its confirm arguments, tappable only on the last unanswered message",
  /\(s\.tool === "createTodo" \|\| s\.tool === "updateTodo"\) &&\s*s\.permissionStatus === "approval_required" &&\s*!!s\.pending/.test(bubble) && /live=\{!!isLast && !!onConfirmTask && !answeredWith\}/.test(bubble));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
