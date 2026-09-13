# Koleex AI as a working secretary — tasks, reminders, delegation

Plan, 2026-09-13. Owner's ask, in their words: "ask Koleex AI: remind me at
that time to do that, or set a task to that employee… the AI can ask if I
didn't tell him the title, description, assignees, priority, project, start,
end, reminder, label, mentions, documents, observers… but be very smart:
extract the answers from the conversation, ask only what it must, and ask
it in a smart way, not as a form. Not every field is needed to create a
task. Saved tasks should show in the today brief. Chat and voice."

Roles taken for this plan: secretary (how a good assistant behaves),
programmer (what exists, what changes), time manager (dates, reminders,
the brief), AI trainer (the instructions and how we prove them).

Status of every claim below was checked in the code on 2026-09-13; paths
are given so the next reader can check again.

---

## 0. Where we stand — most of the machinery already ships

What exists and is live in production:

| Piece | Where | State |
|---|---|---|
| Task table with priority, label, due, start, `remind_at`, status, recurrence, private, `metadata{observers, mentions, attachments, checklist, products}` | `supabase/migrations/create_todo_tables.sql`, `todo_phase2_fields.sql`; later columns applied out-of-band (see §8) | live |
| Assignees table, notes, labels (14 department labels seeded, user-creatable) | same | live |
| Visibility scope (creator, assigner, assignee, department, all, observer; private gated by `can_view_private`; super admin sees the tenant) | `src/app/api/todos/route.ts:96-118`, ported to `src/lib/server/ai-agent/tools/todos.ts:128-160` | live, duplicated |
| Reminder engine: cron every 5 min, re-arms when `remind_at` moves, inbox message + web push, supersedes unread copies, never loops | `src/app/api/cron/todo-reminders/route.ts`, `vercel.json` | live |
| Recurrence (daily/weekly/monthly) and overdue escalation to the manager | `src/lib/server/todo-recurrence.ts`, `todo-escalation.ts` | live |
| AI tools: `listMyTodos`, `findTeamMember`, `createTodo`, `completeTodo`, `updateTodo`, `reassignTodo`, `deleteTodo` — every write two-phase | `src/lib/server/ai-agent/tools/todos.ts` | live |
| The confirm ledger: a write runs only when a matching pending action exists for this account, tenant, conversation, tool and normalised args; atomic consume; 15-min expiry | `src/lib/server/ai/security/pending-actions.ts`, `tool-registry.ts:283-319` | live, enforced |
| Permission gating of tool exposure = dispatch (one function, one suite) | `tool-registry.ts:124-166`, `scripts/validate-ai-tool-exposure.ts` | live |
| Voice: `createTodo` is the one write on a call; the card on the call screen; the tap saves; the model never confirms itself | `src/lib/server/ai/voice/tools.ts:139-152`, `src/app/api/ai/voice/tool/route.ts:161-175`, `src/components/ai/VoiceCallScreen.tsx:947-975` | live (#353) |
| Today's brief on a call: calendar + tasks due/overdue, in silence, then ~20 s spoken | `src/lib/server/ai/voice/session-config.ts:265-269` (#352) | live, voice only |
| Employee resolution for any "who": active internal accounts, names from `people` | `src/lib/server/assignable-employees.ts` | live |
| Project tasks: a second model with attachments, checklist, comments, time; AI tools `createProjectTask` etc. | `src/lib/server/ai-agent/tools/projects.ts` | live |

What is missing (the whole of this plan lives in these gaps):

1. The AI cannot set `remind_at`, `start_date`, `is_private`, recurrence,
   observers, mentions or attachments — `createTodo`'s schema stops at
   title, description, priority, due, label, assignees
   (`todos.ts:284-299`). The table, the cron and the push are all waiting.
2. No confirm card in chat. Text-lane writes are confirmed by typing
   "yes"; only the call screen has the card with the Save button.
3. No brief on the text lane and no proactive brief (dependability plan
   F3).
4. No "secretary" instruction: how to extract, what to infer, when and how
   to ask.
5. Hygiene: the visibility scope is written twice; five columns have no
   migration file.

Conclusion for the owner: this is not a new module. It is one schema
widening of an existing tool, one shared card, one set of instructions,
and one brief — in that order, each shippable alone.

---

## 1. Principles (the ones this feature adds to the standing rules)

- **Extract first, infer second, ask last.** The whole conversation is the
  form. A question is asked only when the action cannot be right without
  the answer.
- **Title is the only required field.** Everything else has a default or
  is left empty. A task with a title alone is a valid task.
- **The server decides who may do what.** The model proposes; the tool
  layer checks module rights, the assignable list, view-as, the tenant.
  The card shows what will happen; the ledger makes it happen only on the
  caller's tap or explicit yes.
- **One task draft, two lanes.** Chat and voice produce the same draft
  object and the same card. The difference is only how it is confirmed
  (tap on the call screen; tap or "yes" in chat).
- **Inferred values are visible.** What the AI assumed (a date, a person,
  a priority) is shown on the card marked as assumed, so a wrong guess
  costs one tap, not a wrong task.
- **Never a form.** At most one sentence of questions, at most two things
  in it, always with a default offered ("I'll set it for tomorrow morning
  unless you want another time").
- **Reminders are tasks.** "Remind me at 3 to call Mr Li" is a task for
  the caller with `remind_at` 15:00 today. One model, one screen, one cron.
- **Speed and mainland.** No new external service. Extraction happens in
  the same model turn as the answer; the card renders from the tool's
  preview payload; nothing waits on a second call.

---

## 2. The task draft — what the AI fills

| Field | Source, in order | Default when absent | Ask? |
|---|---|---|---|
| title | the verb phrase of the request; the subject of a forwarded message; the name of an attached document | — | yes, only if no phrase can be made |
| description | the rest of what was said; quoted message text; document summary (one line) | empty | never |
| assignees | names in the sentence → `findTeamMember`; "me/myself" or no name → the caller | the caller | only when a name matches two people, or a named person is not assignable for this caller |
| assign to department / all | "the sales team", "everyone" | none | never; shown on the card |
| priority | "urgent", "when you can", deadline nearness (due today → high) | medium | never |
| start_date | "from Monday", "starting next week" | none | never |
| due_date | "by Thursday", "before the meeting", "end of month"; a bare time ("at 3") → today, or tomorrow if past | none | for a task given to another person with no date, one soft ask bundled with anything else needed |
| remind_at | "remind me at 3", "ping me an hour before"; default for a due task with a time: at the due time; for a due day with no time: 09:00 that day in the caller's timezone | none unless due has a time | never |
| label | department words, project words, existing label names | none | never |
| project | a project named in the conversation or the one currently open | none | only when the same name matches two projects |
| mentions | "let X know", "cc X" | none | never |
| attachments | files uploaded in this conversation, or the document being discussed | none | never; the card lists them |
| observers | "keep X in the loop", "X should see this" | none | never |
| private | "just for me", "private" | false | never |
| recurrence | "every Monday", "daily", "monthly" | none | never |

Times resolve in the caller's timezone from `UserContext.timezone`
(`prefs.calendar.timezone`, default Asia/Dubai). Dates are echoed on the
card in the caller's language with the weekday, so "Thursday" is checked by
eye, not trusted.

---

## 3. How the AI asks — the secretary's manners

The instruction (text lane and voice, same words, added to the existing
"TASKS BY VOICE" block and to the text-lane system prompt):

> When the caller wants something done, remembered or given to someone,
> build the task from everything already said — this turn, earlier turns,
> people named, files shared, the project being discussed. Fill what you
> can; assume sensible defaults; leave the rest empty. Ask ONLY when the
> task would be wrong without the answer: a name that fits two people, a
> person you cannot assign to, a task for someone else with no date at
> all. Ask in one natural sentence, at most two things, and offer your
> default in the same breath. Never list fields. Never ask for a
> description, a label, a priority, an observer or a document — take them
> if given, otherwise leave them. Then call createTodo without confirm
> and describe the card in one line. On a call, say the one line and stop:
> the caller taps Save.

Worked examples (what the caller says → what the AI does):

- "Remind me at 3 to call Mr Li about the Ningbo shipment." → task for
  the caller, title "Call Mr Li about the Ningbo shipment", due today
  15:00, remind 15:00, no question. Card. One line: "Ready — a reminder at
  3 today to call Mr Li. Save?"
- "Ahmed should send the revised quotation to Delta before Thursday, high
  priority, and Sara should know." → assignee Ahmed (resolved), due
  Thursday 17:00 local, remind Thursday 09:00, priority high, mention
  Sara, label from Ahmed's department if one fits. No question.
- "Put a task for the design team to update the catalogue." → department
  Design, no date. One soft ask, bundled: "Set it for the design team.
  Any deadline, or shall I leave it open?"
- Two Ahmeds: "Which Ahmed — Ahmed Hassan in sales or Ahmed Nour in
  design?" (the only kind of direct question that is always right).
- Caller is a sales user asking to assign to the finance manager: the
  tool answers `permissionStatus: denied` with the reason; the AI says
  "I can save this for you, but I can't assign it to Mona from your
  account — shall I put it on your list and mention her?"

What the AI never does: fill a field it was not told and cannot infer from
the conversation (no invented descriptions), name a person outside the
assignable list, mention a vendor, or say the task is saved before the
ledger confirms it.

---

## 4. How it shows in the conversation

### Chat

1. The caller types the request.
2. The AI answers with one line and a **Task card** under it (the draft):
   title; a row of chips — person(s) or "You", due with weekday, remind
   time, priority, label, project, recurrence; a small line for mentions,
   observers, attachments when present. Values the AI assumed carry a
   faint "assumed" mark. Buttons: **Save**, **Change…**, **Cancel**.
3. **Save** posts the pending action with `confirm:true, via:"tap"` to a
   new small route (`POST /api/ai/chat/confirm`) that calls `dispatchTool`
   — the same ledger match the voice tap uses today. The card turns into
   its saved state: a tick, "Saved for Ahmed, due Thu 18 Sep", and an
   "Open in To-do" link (`/todo?task=<id>`).
4. **Change…** does not open a form. It focuses the composer with a
   prompt hint ("say what to change"); the caller types "make it medium
   and move it to Friday" and the AI re-proposes the card (a fresh pending
   action; the old one is left to expire). Typing "yes"/"save" still
   works: the model re-sends `confirm:true` and the ledger matches, as
   today.
5. A card that was saved or cancelled stays in the transcript frozen, as
   the question card does (`Bubble.tsx:346-352`). Labels on the card are
   in the language of the request, not of the UI (same rule).

### Voice

Already shipped for the basic case (#353): the model calls `createTodo`
in silence, the card appears on the call screen, the caller taps Save.
This plan changes three things on the call: the card gains the new fields
(reminder, people, project, recurrence), the model's one line names what
matters ("a reminder at 3", "for Ahmed by Thursday") and nothing else,
and a **"Save" by voice** option — see decision 2 in §7. Voice keeps
`createTodo` as its only write until the chat card has proven the flow;
`updateTodo` on a call comes after, through the same card.

### The brief

- Voice: exists. It already reads tasks due today and overdue, so a task
  saved by the AI appears the next morning without any change.
- Text lane: a "Today" chip on the welcome screen and the same instruction
  for the chat model → one message: meetings in order, tasks due today
  and overdue, reminders set for today, the one thing to start with.
- Proactive (F3, later): an opt-in time in Settings; a cron at that time
  builds the same brief server-side and sends a push that opens the chat
  with it. Same tools, no new data.

---

## 5. Permissions, account types, roles — who may do what

All decided by the server, from `UserContext` (`permissions.ts`), never by
the client or the model.

| Action | Rule |
|---|---|
| Create a task for oneself | To-do module `create` |
| Assign to another person | To-do `create` AND the person is in `listAssignableEmployees(tenant)`; department heads to their department, admins and super admins to anyone in the tenant (matches today's web form; a tighter matrix is a `koleex_permissions` decision, not a code one) |
| Assign to a department / to all | To-do `create`; "all" for admin and super admin only |
| Observers, mentions | anyone assignable; observers see the task (existing scope) |
| Private | creator only; hidden from others unless `can_view_private` |
| Link to a project / create a project task | Projects module `view`; `createProjectTask` needs its own `create` |
| Attach a document | only files the caller uploaded in this conversation (already server-held), or documents the caller can view; the AI never fetches a file by name it has not seen |
| Reminders | for oneself always; for another person only with the assignment |
| Edit, complete, reassign, delete | the existing owner/assignee rules in `todos.ts`; delete stays owner-only and destructive-class |
| View-as | mutations are refused by `requireAuth` (`auth.ts:42`); the card shows "read-only while viewing as" instead of Save |

External (customer) accounts: the To-do module is internal; the tools are
not exposed to them (the exposure suite already pins this).

---

## 6. Implementation phases — small, each shippable, each with suites

**P1 — the tool speaks the whole table (no schema change).** Widen
`createTodo` and `updateTodo` with `remind_at`, `start_date`,
`is_private`, `recurrence`, `recurrence_until`, `observer_account_ids`,
`mention_account_ids`, `attachment_ids` (from this conversation's
uploads), `project_id` (link only), `assign_to_department`,
`assign_to_all`. Server-side: resolve relative times in the caller's
timezone (a small pure helper, tested), validate every account id against
the assignable list, write observers/mentions/attachments into `metadata`
exactly as the web form does (`route.ts:70-71`), keep the preview payload
complete for the card. Voice description override updated. Suites:
`validate-ai-voice`, `validate-ai-tool-exposure` (47 tools unchanged),
`validate-ai-confirm-ledger`, a new `validate-ai-tasks` for the time
helper and the argument validation. Deliverable: "remind me at 3" works by
voice today, saved by tap.

**P2 — one Task card, chat and call.** Lift the card out of
`VoiceCallScreen.tsx:947-975` into `src/components/ai/TaskCard.tsx`;
render it in `Bubble.tsx` for a `tool-result` step whose payload carries
`pendingAction` for a todo tool; the saved and cancelled states; the
"Change…" composer hint; `POST /api/ai/chat/confirm` (auth, module check,
rate limit, `via:"tap"`, `dispatchTool`) — the same order as the voice
tool route. Suite: `validate-ai-client-render` (the card in all three
languages, frozen after save, no Save under view-as).

**P3 — the secretary's instructions and how we prove them.** The
extraction and asking rules (§3) in the text-lane system prompt and the
voice session config; the worked examples as an offline eval: 30
utterances in Arabic, Chinese and English with the expected draft (which
fields filled, which question if any), run against the time helper and a
recorded model transcript, pinned in `validate-ai-tasks`. This is the
"AI trainer" phase; it is where "smart" is measured, not asserted.

**P4 — the brief on the text lane; reminders in it.** The "Today" chip
and instruction; `listMyTodos` gains `due: "reminders-today"`; the voice
brief lists reminders set for today in the tasks part.

**P5 — the proactive brief (F3).** Opt-in time and channel in Settings; a
cron; the brief assembled server-side from the same tools; push that
opens the chat with it. Owner decides the default hour.

**P6 — hygiene [SCHEMA GATE].** Migration files for the columns that
exist in production without one (`tenant_id`, `is_private`, `metadata`,
`recurrence*`, `reminded_at`); the visibility scope moved into one shared
function used by the route, the AI tool and `/api/me/work`. No new table:
observers stay in `metadata` (they work, they are indexed by the scope
query, and a table would add nothing the product needs yet). This phase
follows the standing rule: reason, schema, index, RLS posture (service
role only, stated), migration, rollback, expected load — and the owner's
sign-off before it runs.

Order of value: P1 delivers the owner's first sentence ("remind me at 3")
in a day; P2 makes chat feel like voice; P3 is what makes it smart; P4–P5
close the loop with the morning; P6 keeps it honest.

---

## 7. Decisions for the owner (short)

1. **Reminders are tasks** — a reminder is a task for yourself with a
   reminder time, on the same To-do list. Recommended. (The other way, a
   separate reminders list, means a new table and a second screen.)
2. **Saving by voice without a tap** — for a task that is ONLY for
   yourself, with no other person involved, the AI could save on your
   spoken "yes". This is an autonomous write and is OFF unless you say
   so; if on, it still goes through the ledger, and only for self-tasks.
3. **A task inside a project** — when a project is named, create a
   *project task* (it has time tracking, comments, attachments) rather
   than a To-do with a link. Recommended.
4. **Who may assign to whom** — today's web rule: department heads to
   their department, admins to anyone. Keep, or tighten in permissions.
5. **The proactive brief** — hour and channel (push, or also the inbox).

---

## 8. Risks and guardrails

- **Autonomous writes**: none. Every write is a pending action; the ledger
  is the only path; the model's `confirm:true` alone is refused
  (`tool-registry.ts:283-319`, pinned).
- **Documents as instructions**: an attached file's text is data for the
  description, never an instruction; the existing untrusted-content rules
  apply (`validate:ai-untrusted`).
- **Wrong person**: names resolve only through `findTeamMember` in the
  same conversation; two matches → a direct question; none → no
  assignment and a plain sentence.
- **Wrong time**: the card shows date with weekday and time in the
  caller's timezone; a timezone the profile does not set defaults to
  Asia/Dubai, and the owner in China should set theirs once (Settings).
- **Duplicate scope logic**: P6 removes it; until then P1 touches both
  copies together, with the suite pinning both.
- **Speed**: no extra model call; the card is the tool's preview; the
  brief is two reads the model already does.
- **Mainland**: everything is our own routes and Supabase through the
  server; no new host.
- **Vendor names**: none in any card, prompt or message.

## 9. After first live test (2026-09-13)

- **Owner's first try** — "Remind me of tomorrow to keep working on
  products data" (iPhone PWA, 12:12) — never reached the tool loop. The
  route's work-data detector (`isWorkDataQuery`, `decide-turn.ts`) knew
  only "remind me **to**" and a work noun; the sentence had neither, so it
  fell to the tool-less general lane, whose prompt honestly says it cannot
  set reminders. The six phases were right; the door in front of them was
  too narrow.
- **Fix**: any "remind me/us/him/her/them …" continuation, "don't let me
  forget", "set/add/need a reminder / alarm / follow-up", plus the Arabic
  (ذكّرني، فكّرني، نبهني، متنساني) and Chinese (别忘, 闹钟) spellings, now
  route to the tool loop. Pinned in `validate:ai-core-boundaries` with the
  owner's exact sentence, seven more English shapes, six Arabic/Chinese
  ones, and three negatives ("that reminds me of a story" stays general).
- **Cost of a false positive**: one slower turn through the tool loop; the
  loop handles small talk anyway. A false negative is the screenshot above.
