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
import { buildTaskDraft, dayRangeISO, type Person, type DraftResult } from "../src/lib/server/ai-agent/tools/task-draft";
import { todoScopeClauses, applyTodoScope } from "../src/lib/server/todo-scope-rule";
import { briefText, hourIn, dayIn } from "../src/lib/server/ai/brief-text";
import { normalizeAiPersonalization, DEFAULT_AI_PERSONALIZATION } from "../src/lib/ai-personalization";

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
/* The draft is pure (task-draft.ts): what follows exercises it directly. */
const TEAM: Person[] = [
  { account_id: "a1", name: "Ahmed Hassan", username: "ahmed.h", department: "Sales" },
  { account_id: "a2", name: "Ahmed Nour", username: "ahmed.n", department: "Design" },
  { account_id: "a3", name: "Sara Adel", username: "sara", department: "Sales" },
  { account_id: "a4", name: "Mona Fathy", username: "mona", department: "Finance" },
  { account_id: "a5", name: "Li Wei", username: "liwei", department: "Logistics" },
];
const people = new Map(TEAM.map((p) => [p.account_id, p]));
const departments = new Set(TEAM.map((p) => p.department!.toLowerCase()));
const dubai = { tz: "Asia/Dubai", people, departments, isAdmin: false };
const draft = (args: Record<string, unknown>, o: Partial<typeof dubai> = {}) => buildTaskDraft(args, { ...dubai, ...o });
const okOf = (r: DraftResult) => (r.ok ? r : null);
check("the tool hands the draft to pure code with the caller's zone, the resolved people, their departments and the admin flag, and maps a permission refusal to denied",
  /const r = await resolvePeople\(ctx\.auth\.tenant_id, \[\], "createTodo"\);/.test(createSrc) &&
  /buildTaskDraft\(args, \{ tz, people, departments, isAdmin: ctx\.isSuperAdmin \|\| ut === "admin" \}\)/.test(createSrc) &&
  /permissionStatus: built\.permission \? "denied" : "allowed"/.test(createSrc));
check("a due date alone is the end of that working day in the zone; a reminder alone, the start of it",
  okOf(draft({ title: "x", due_date: "2026-09-18" }))?.draft.due_date === "2026-09-18T13:00:00.000Z" && okOf(draft({ title: "x", due_date: "2026-09-18" }))?.draft.remind_at === null &&
  okOf(draft({ title: "x", remind_at: "2026-09-18" }))?.draft.remind_at === "2026-09-18T05:00:00.000Z");
check("a reminder defaults to the due time only when the due date names a clock time; an explicit reminder wins",
  okOf(draft({ title: "x", due_date: "2026-09-18T15:00" }))?.draft.remind_at === "2026-09-18T11:00:00.000Z" &&
  okOf(draft({ title: "x", due_date: "2026-09-18T15:00", remind_at: "2026-09-18T09:00" }))?.draft.remind_at === "2026-09-18T05:00:00.000Z");
check("an unreadable date or reminder is a named refusal with the format asked for — never a guess, never a permission",
  (() => { const r = draft({ title: "x", due_date: "next Thursday" }); return !r.ok && r.refusal === "bad-due" && !r.permission && /ISO date/.test(r.message); })() &&
  (() => { const r = draft({ title: "x", remind_at: "14:30" }); return !r.ok && r.refusal === "bad-remind" && !r.permission; })() &&
  (() => { const r = draft({ title: "  " }); return !r.ok && r.refusal === "no-title"; })());
check("an id not on the assignable list — assignee, observer or mention — is a hard refusal that sends the model back to findTeamMember",
  ["assign_to_account_ids", "observer_account_ids", "mention_account_ids"].every((k) => { const r = draft({ title: "x", [k]: ["a9"] }); return !r.ok && r.refusal === "unknown-person" && /findTeamMember/.test(r.message); }) &&
  okOf(draft({ title: "x", assign_to_account_ids: ["a1", "a1"], observer_account_ids: ["a4"], mention_account_ids: ["a3"] }))?.who === "Ahmed Hassan");
check("a department must be one the colleagues have — matched without case, spelled as they spell it — else the known ones are listed",
  (() => { const r = okOf(draft({ title: "x", assign_to_department: "design" })); return r?.department === "Design" && r?.who === "the Design team"; })() &&
  (() => { const r = draft({ title: "x", assign_to_department: "Marketing" }); return !r.ok && r.refusal === "unknown-department" && /design, finance, logistics, sales/.test(r.message); })());
check("'everyone' is an admin's call — refused as a PERMISSION with the alternative offered; an admin gets it",
  (() => { const r = draft({ title: "x", assign_to_all: true }); return !r.ok && r.refusal === "everyone-denied" && r.permission && /admin account/.test(r.message); })() &&
  (() => { const r = okOf(draft({ title: "x", assign_to_all: true }, { isAdmin: true })); return r?.toAll === true && r?.who === "everyone"; })());
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

console.log("\n── 6. Thirty things a caller says, in three languages — the draft each one becomes (phase 3) ──");
/* Each case: what the caller said, the arguments a model following THE
   SECRETARY'S WAY sends for it (today is Sun 2026-09-13; the model writes
   local times in the caller's zone), and what the draft must be. The model's
   extraction is pinned by instruction (§3); the server's half is proved here. */
type Case = { say: string; args: Record<string, unknown>; o?: Partial<typeof dubai>; expect: (r: DraftResult) => boolean };
const remindAt = (iso: string) => (r: DraftResult) => r.ok && r.draft.remind_at === iso;
const CASES: Case[] = [
  { say: "Remind me at 3 to call Mr Li about the Ningbo shipment", args: { title: "Call Mr Li about the Ningbo shipment", remind_at: "2026-09-13T15:00" }, expect: (r) => remindAt("2026-09-13T11:00:00.000Z")(r) && r.ok && r.draft.due_date === null && r.who === "" },
  { say: "فكرني الساعة ٣ أكلم مستر لي عن شحنة نينجبو", args: { title: "أكلم مستر لي عن شحنة نينجبو", remind_at: "2026-09-13T15:00" }, expect: (r) => remindAt("2026-09-13T11:00:00.000Z")(r) && r.ok && r.who === "" },
  { say: "下午三点提醒我给李先生打电话，关于宁波的货", args: { title: "给李先生打电话，关于宁波的货", remind_at: "2026-09-13T15:00" }, o: { tz: "Asia/Shanghai" }, expect: remindAt("2026-09-13T07:00:00.000Z") },
  { say: "Ahmed should send the revised quotation to Delta before Thursday, high priority, and Sara should know", args: { title: "Send the revised quotation to Delta", assign_to_account_ids: ["a1"], due_date: "2026-09-17", priority: "high", mention_account_ids: ["a3"] }, expect: (r) => r.ok && r.who === "Ahmed Hassan" && r.draft.due_date === "2026-09-17T13:00:00.000Z" && r.draft.remind_at === null && r.draft.priority === "high" && r.mentions[0]?.name === "Sara Adel" && /Thu 17 Sept/.test(r.when.due) },
  { say: "أحمد يبعت عرض السعر المعدّل لدلتا قبل الخميس، مهم، وسارة تعرف", args: { title: "يبعت عرض السعر المعدّل لدلتا", assign_to_account_ids: ["a1"], due_date: "2026-09-17", priority: "high", mention_account_ids: ["a3"] }, expect: (r) => r.ok && r.who === "Ahmed Hassan" && r.mentions.length === 1 },
  { say: "让阿赫迈德周四前把修改后的报价发给 Delta，高优先级，告诉 Sara", args: { title: "把修改后的报价发给 Delta", assign_to_account_ids: ["a1"], due_date: "2026-09-17", priority: "high", mention_account_ids: ["a3"] }, o: { tz: "Asia/Shanghai" }, expect: (r) => r.ok && r.draft.due_date === "2026-09-17T09:00:00.000Z" },
  { say: "Put a task for the design team to update the catalogue", args: { title: "Update the catalogue", assign_to_department: "design" }, expect: (r) => r.ok && r.department === "Design" && r.who === "the Design team" && r.assignees.length === 0 },
  { say: "حط مهمة لفريق التصميم يحدّثوا الكتالوج", args: { title: "تحديث الكتالوج", assign_to_department: "Design" }, expect: (r) => r.ok && r.department === "Design" },
  { say: "给设计团队安排一个任务：更新产品目录", args: { title: "更新产品目录", assign_to_department: "DESIGN" }, expect: (r) => r.ok && r.department === "Design" },
  { say: "Every Monday send the weekly sales report, starting next Monday", args: { title: "Send the weekly sales report", recurrence: "weekly", due_date: "2026-09-21T17:00" }, expect: (r) => r.ok && r.draft.recurrence === "weekly" && r.draft.due_date === "2026-09-21T13:00:00.000Z" && /Mon 21 Sept/.test(r.when.due) },
  { say: "كل يوم اتنين ابعت تقرير المبيعات الأسبوعي", args: { title: "ابعت تقرير المبيعات الأسبوعي", recurrence: "weekly", due_date: "2026-09-14" }, expect: (r) => r.ok && r.draft.recurrence === "weekly" && r.draft.remind_at === null },
  { say: "每周一发送周销售报告", args: { title: "发送周销售报告", recurrence: "weekly", due_date: "2026-09-14T17:00" }, o: { tz: "Asia/Shanghai" }, expect: (r) => r.ok && r.draft.recurrence === "weekly" && r.draft.remind_at === "2026-09-14T09:00:00.000Z" },
  { say: "Private: prepare notes for my meeting with the bank, tomorrow morning", args: { title: "Prepare notes for the meeting with the bank", is_private: true, due_date: "2026-09-14T09:00" }, expect: (r) => r.ok && r.draft.is_private && r.draft.due_date === "2026-09-14T05:00:00.000Z" && r.draft.remind_at === "2026-09-14T05:00:00.000Z" },
  { say: "مهمة خاصة: جهّز ملاحظات اجتماع البنك بكرة الصبح", args: { title: "جهّز ملاحظات اجتماع البنك", is_private: true, due_date: "2026-09-14T09:00" }, expect: (r) => r.ok && r.draft.is_private && r.who === "" },
  { say: "私密任务：明天早上准备和银行开会的笔记", args: { title: "准备和银行开会的笔记", is_private: true, due_date: "2026-09-14T09:00" }, o: { tz: "Asia/Shanghai" }, expect: (r) => r.ok && r.draft.is_private && r.draft.due_date === "2026-09-14T01:00:00.000Z" },
  { say: "Assign it to everyone: fill the timesheet by Friday (a sales user)", args: { title: "Fill the timesheet", assign_to_all: true, due_date: "2026-09-18" }, expect: (r) => !r.ok && r.refusal === "everyone-denied" && r.permission },
  { say: "Assign it to everyone: fill the timesheet by Friday (an admin)", args: { title: "Fill the timesheet", assign_to_all: true, due_date: "2026-09-18" }, o: { isAdmin: true }, expect: (r) => r.ok && r.toAll && r.who === "everyone" },
  { say: "كلّف الكل: تعبية التايم شيت قبل الجمعة (أدمن)", args: { title: "تعبية التايم شيت", assign_to_all: true, due_date: "2026-09-18" }, o: { isAdmin: true }, expect: (r) => r.ok && r.toAll },
  { say: "Keep Mona in the loop on the Delta quotation task", args: { title: "Delta quotation", observer_account_ids: ["a4"] }, expect: (r) => r.ok && r.observers[0]?.name === "Mona Fathy" && r.who === "" },
  { say: "خلي منى متابعة على مهمة عرض دلتا", args: { title: "عرض دلتا", observer_account_ids: ["a4"] }, expect: (r) => r.ok && r.observers.length === 1 },
  { say: "让 Mona 关注 Delta 报价这个任务", args: { title: "Delta 报价", observer_account_ids: ["a4"] }, expect: (r) => r.ok && r.observers[0]?.account_id === "a4" },
  { say: "Tell Ahmed to… (two Ahmeds — a model that guessed instead of asking)", args: { title: "Call the customer", assign_to_account_ids: ["ahmed"] }, expect: (r) => !r.ok && r.refusal === "unknown-person" },
  { say: "Remind me next Tuesday to renew the license", args: { title: "Renew the license", remind_at: "2026-09-22" }, expect: (r) => r.ok && r.draft.remind_at === "2026-09-22T05:00:00.000Z" && r.draft.due_date === null && /Tue 22 Sept/.test(r.when.remind) },
  { say: "فكرني الثلاثاء الجاي أجدد الرخصة", args: { title: "أجدد الرخصة", remind_at: "2026-09-22" }, expect: (r) => r.ok && r.draft.remind_at === "2026-09-22T05:00:00.000Z" },
  { say: "下周二提醒我续签许可证", args: { title: "续签许可证", remind_at: "2026-09-22" }, o: { tz: "Asia/Shanghai" }, expect: (r) => r.ok && r.draft.remind_at === "2026-09-22T01:00:00.000Z" },
  { say: "Call the supplier at 9 tomorrow, urgent", args: { title: "Call the supplier", due_date: "2026-09-14T09:00", priority: "high" }, expect: (r) => r.ok && r.draft.priority === "high" && r.draft.due_date === "2026-09-14T05:00:00.000Z" && r.draft.remind_at === "2026-09-14T05:00:00.000Z" },
  { say: "Make a task: review the Delta contract", args: { title: "Review the Delta contract" }, expect: (r) => r.ok && r.who === "" && r.draft.due_date === null && r.draft.remind_at === null && r.draft.priority === "medium" && r.draft.label === null && r.when.due === "" },
  { say: "Remind me at half past two (a model that sent a bare clock)", args: { title: "x", remind_at: "14:30" }, expect: (r) => !r.ok && r.refusal === "bad-remind" },
  { say: "A task for the marketing team (a department this company has not got)", args: { title: "Plan the campaign", assign_to_department: "marketing" }, expect: (r) => !r.ok && r.refusal === "unknown-department" && /design, finance, logistics, sales/.test(r.message) },
  { say: "Sara: prepare the samples by Wednesday, label Sales, starting Monday", args: { title: "Prepare the samples", assign_to_account_ids: ["a3"], due_date: "2026-09-16", label: "Sales", start_date: "2026-09-14" }, expect: (r) => r.ok && r.who === "Sara Adel" && r.draft.due_date === "2026-09-16T13:00:00.000Z" && r.draft.start_date === "2026-09-14" && r.draft.label === "Sales" && r.when.start === "2026-09-14" },
];
check(`thirty utterances are listed`, CASES.length === 30);
for (const c of CASES) check(c.say, c.expect(draft(c.args, c.o)));

console.log("\n── 7. Phase 4: the day is the caller's; reminders ringing today; the brief on the text lane ──");
const dubaiDay = dayRangeISO("Asia/Dubai", new Date("2026-09-13T01:00:00.000Z"));
const shanghaiDay = dayRangeISO("Asia/Shanghai", new Date("2026-09-13T17:30:00.000Z"));
check("today's bounds are the caller's day: 05:00 Dubai is Sunday there (20:00Z Sat → 19:59Z Sun); 01:30 Monday Shanghai is already Monday",
  dubaiDay.startOfToday === "2026-09-12T20:00:00.000Z" && dubaiDay.endOfToday === "2026-09-13T19:59:59.999Z" && dubaiDay.endOfWeek === "2026-09-20T19:59:59.999Z" &&
  shanghaiDay.startOfToday === "2026-09-13T16:00:00.000Z" && shanghaiDay.endOfToday === "2026-09-14T15:59:59.999Z");
const listSrc = todos.slice(todos.indexOf("const listMyTodos"), todos.indexOf('name: "findTeamMember"'));
check("listMyTodos reads 'today' and 'week' in the caller's zone and offers 'reminders' — tasks whose reminder rings today, still open",
  /dayRangeISO\(ctx\.timezone \|\| "Asia\/Dubai"\)/.test(listSrc) && /enum: \["any", "overdue", "today", "week", "reminders"\]/.test(listSrc) &&
  /else if \(due === "reminders"\) q = q\.gte\("remind_at", startOfToday\)\.lte\("remind_at", endOfToday\)\.eq\("completed", false\);/.test(listSrc) && !/todayRangeISO/.test(todos));
check("the text lane has the brief: calendar, open tasks and today's reminders in one turn, then meetings → due/overdue → reminders → the one thing first → what to start with",
  /TODAY'S BRIEF \(text lane, tasks phase 4\)/.test(prompt) && /listMyCalendar AND listMyTodos\(filter:"open", due:"any"\) AND listMyTodos\(due:"reminders"\) in the SAME turn/.test(prompt) &&
  /reminders ringing today with their times; the one thing that needs them first; end by asking what they want to start with/.test(prompt));
const copySrc = readFileSync("src/components/ai/copy.ts", "utf8");
check("the first welcome tile asks for the day's brief, in all three languages",
  /prompts: \[\s*"Give me my brief for today: my meetings, tasks due, reminders, and what needs me first\.",/.test(copySrc) &&
  /prompts: \[\s*"给我今天的简报：会议、到期任务、提醒，以及我最该先做什么。",/.test(copySrc) &&
  /prompts: \[\s*"اعطيني بريف اليوم: اجتماعاتي، المهام اللي موعدها النهاردة، التذكيرات، وإيه اللي محتاجني الأول\.",/.test(copySrc));

console.log("\n── 8. Phases 5–6: one scope rule; the morning brief at the hour you chose; the drifted columns on record ──");
const me = { accountId: "me-1", tenantId: "t-1", department: "Sales", isSuperAdmin: false, canViewPrivate: false };
const clauses = todoScopeClauses(me, ["x1", "x2"]);
check("the scope rule, written once: created · assigned · everyone · my department · shared (assignee or observer) — and private hidden unless mine",
  clauses !== null && clauses.scope === "created_by_account_id.eq.me-1,assigned_by_account_id.eq.me-1,assign_to_all.eq.true,assigned_department.eq.Sales,id.in.(x1,x2)" &&
  clauses.privacy === "is_private.eq.false,created_by_account_id.eq.me-1");
check("  …no department and nothing shared drops those branches; break-glass drops the privacy clause; a super admin has no clauses at all",
  todoScopeClauses({ ...me, department: null }, [])?.scope === "created_by_account_id.eq.me-1,assigned_by_account_id.eq.me-1,assign_to_all.eq.true" &&
  todoScopeClauses({ ...me, canViewPrivate: true }, [])?.privacy === null && todoScopeClauses({ ...me, isSuperAdmin: true }, ["x1"]) === null);
const calls: string[] = [];
const fakeQ = { or(f: string) { calls.push(f); return fakeQ; } };
applyTodoScope(fakeQ, me, ["x1"]);
applyTodoScope(fakeQ, { ...me, isSuperAdmin: true }, ["x1"]);
check("  …applied as two AND-ed `or` filters on the query, none for a super admin", calls.length === 2 && calls[0].startsWith("created_by_account_id.eq.me-1") && calls[1].startsWith("is_private.eq.false"));
const routeSrc = readFileSync("src/app/api/todos/route.ts", "utf8");
check("the To-do route and the AI's listMyTodos both read the one rule from lib/server/todo-scope — the ported copy is gone",
  /import \{ applyTodoScope, sharedTodoIds, type TodoViewer \} from "@\/lib\/server\/todo-scope";/.test(routeSrc) && /query = applyTodoScope\(query, viewer, sharedIds\);/.test(routeSrc) &&
  /import \{ applyTodoScope, sharedTodoIds, type TodoViewer \} from "\.\.\/\.\.\/todo-scope";/.test(todos) && /q = applyTodoScope\(q, viewer, await sharedTodoIds\(viewer\)\);/.test(todos) &&
  !/Port of the route's non-SA visibility scope/.test(todos) && !/orParts/.test(todos) && !/orParts/.test(routeSrc));
const mig = readFileSync("supabase/migrations/todo_columns_reconcile_2026_09.sql", "utf8");
check("the columns production has without a migration file are on record — every one IF NOT EXISTS, with the reason, rollback and load stated",
  ["is_private", "tenant_id", "metadata", "reminded_at", "recurrence", "recurrence_parent_id", "recurrence_spawned_for", "recurrence_until", "approval_state", "approved_by_account_id", "approved_at"].every((c) => new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\s`).test(mig)) &&
  /CREATE INDEX IF NOT EXISTS idx_koleex_todos_tenant_open/.test(mig) && /Rollback:/.test(mig) && /Load:/.test(mig) && /RLS:/.test(mig) && !/^\s*(DROP|DELETE|TRUNCATE|UPDATE) /m.test(mig));

check("the brief's words: counts joined, the first meeting named, a quiet day said plainly — in three languages",
  briefText({ meetings: 3, dueToday: 2, overdue: 1, reminders: 1, first: "09:30 Delta call" }, "en").body === "3 meetings · 2 due today · 1 overdue · 1 reminder — first: 09:30 Delta call" &&
  briefText({ meetings: 1, dueToday: 0, overdue: 0, reminders: 0, first: "" }, "en").body === "1 meeting" &&
  briefText({ meetings: 0, dueToday: 0, overdue: 0, reminders: 0, first: "" }, "en").body === "Nothing on your plate today. A quiet one." &&
  briefText({ meetings: 2, dueToday: 1, overdue: 0, reminders: 2, first: "10:00 بنك" }, "ar").body === "2 اجتماعات · 1 مهمة موعدها النهاردة · 2 تذكيرات — الأول: 10:00 بنك" && briefText({ meetings: 0, dueToday: 0, overdue: 0, reminders: 0, first: "" }, "ar").title === "☀️ بريف اليوم" &&
  briefText({ meetings: 1, dueToday: 1, overdue: 1, reminders: 1, first: "" }, "zh").body === "1 个会议 · 1 个今天到期 · 1 个已逾期 · 1 个提醒" && briefText({ meetings: 0, dueToday: 0, overdue: 0, reminders: 0, first: "" }, "zh").body === "今天日程为空，轻松的一天。");
check("the hour and the day are read in the person's zone (03:30Z is 07 in Dubai and 11 in Shanghai; 20:30Z Sunday is Monday in Shanghai)",
  hourIn("Asia/Dubai", new Date("2026-09-13T03:30:00Z")) === 7 && hourIn("Asia/Shanghai", new Date("2026-09-13T03:30:00Z")) === 11 &&
  dayIn("Asia/Shanghai", new Date("2026-09-13T20:30:00Z")) === "2026-09-14" && dayIn("Asia/Dubai", new Date("2026-09-13T20:30:00Z")) === "2026-09-14" && dayIn("Europe/London", new Date("2026-09-13T20:30:00Z")) === "2026-09-13" &&
  hourIn("Mars/Olympus", new Date("2026-09-13T03:30:00Z")) === 7);
check("the setting is one integer hour or off — defaults off, refuses 24, 7.5, '8' and true",
  DEFAULT_AI_PERSONALIZATION.briefHour === null && normalizeAiPersonalization({ briefHour: 8 }).briefHour === 8 && normalizeAiPersonalization({ briefHour: 0 }).briefHour === 0 &&
  normalizeAiPersonalization({ briefHour: 24 }).briefHour === null && normalizeAiPersonalization({ briefHour: 7.5 }).briefHour === null && normalizeAiPersonalization({ briefHour: "8" }).briefHour === null &&
  normalizeAiPersonalization({ briefHour: true }).briefHour === null && normalizeAiPersonalization({}).briefHour === null);
const cron = readFileSync("src/app/api/cron/ai-brief/route.ts", "utf8");
check("the cron: the secret, opted-in active internal accounts only, the person's hour in their zone, one per person per day, the non-admin scope on purpose, an inbox row and one push that open the chat with ?ask=brief",
  /req\.headers\.get\("authorization"\) !== `Bearer \$\{secret\}`/.test(cron) && /\.eq\("user_type", "internal"\)\s*\.eq\("status", "active"\)\s*\.not\("preferences->ai->>briefHour", "is", null\)/.test(cron) &&
  /if \(hourIn\(tz, now\) !== hour\) continue;/.test(cron) && /\.eq\("metadata->>type", "ai_brief"\)\s*\.eq\("metadata->>day", day\)/.test(cron) && /isSuperAdmin: false,/.test(cron) &&
  /link: "\/ai\?ask=brief"/.test(cron) && /url: "\/ai\?ask=brief", tag: `ai-brief-\$\{day\}`/.test(cron) && !/\.from\("koleex_todos"\)\s*\.(insert|update|delete)/.test(cron));
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as { crons: Array<{ path: string; schedule: string }> };
check("vercel runs it hourly", vercel.crons.some((c) => c.path === "/api/cron/ai-brief" && c.schedule === "0 * * * *"));
const briefSrc = readFileSync("src/lib/server/ai/brief.ts", "utf8");
check("the brief reads the person's own calendar (one-off and recurring, today in their zone) and the tasks through the shared scope; it writes nothing",
  /\.from\("koleex_calendar_events"\)[\s\S]{0,200}?\.eq\("account_id", viewer\.accountId\)/.test(briefSrc) && /expandRecurrence\(e\.start_at/.test(briefSrc) &&
  /tq = applyTodoScope\(tq, viewer, await sharedTodoIds\(viewer\)\);/.test(briefSrc) && !/\.insert\(|\.update\(|\.delete\(/.test(briefSrc));
check("the settings tab offers the hour beside the suggestion tiles, in three languages; the chat opens the brief from the notification and drops the parameter",
  /BRIEF_HOURS = \[5, 6, 7, 8, 9, 10, 11, 12\]/.test(readFileSync("src/components/settings/tabs/AiTab.tsx", "utf8")) && /set\("briefHour", v === "off" \? null : Number\(v\)\)/.test(readFileSync("src/components/settings/tabs/AiTab.tsx", "utf8")) &&
  /"ai\.brief":\s*\{ en: "Morning brief", zh: "每日简报", ar: "بريف الصبح" \}/.test(readFileSync("src/lib/translations/settings.ts", "utf8")) &&
  /if \(params\.get\("ask"\) === "brief" && !c\) \{[\s\S]{0,400}?params\.delete\("ask"\);[\s\S]{0,400}?void startNewChat\(\)\.then\(\(\) => sendRef\.current\(copy\.prompts\[0\], false\)\);/.test(app));

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
