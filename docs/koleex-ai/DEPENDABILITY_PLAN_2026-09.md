# Koleex AI — the dependability plan (September 2026)

Owner, 2026-09-11 evening: "I want to totally depend on Koleex AI in daily
life and in Koleex work, the way a user depends on ChatGPT, Grok or Claude.
Make a plan to fix any issue and how to improve it."

This document is that plan. It is written from what the product does today,
what broke this week (with the evidence), and what "dependable" has to mean
before anyone can lean on it. It complements `KOLEEX_AI_EVOLUTION_PLAN.md`
(the architecture roadmap) and `VOICE_ROADMAP_2026-09.md` (the voice
backlog); where those already carry an item, this plan points at it rather
than restating it.

Rules that hold for every item, as always: no provider hard-coded; mainland
China works without a VPN; writes stay confirmed by a person; permissions
are decided by the server; uploaded or spoken content is never an
instruction; nothing is called done until it is reachable and tested at
runtime.

## 1. What "dependable" means here

Eight properties, each with a way to check it. A product that has all eight
can be leaned on; one that is missing any of them will be caught out on the
day it matters.

| # | Property | How it is checked |
|---|---|---|
| D1 | **Knows what day it is, and what has changed since it learned things.** Every answer about "today", "latest", "newest", "current" is anchored to the real date and to a fresh lookup. | A date question on every lane answers correctly; a "latest X" question searches with a freshness window and states the date of its source |
| D2 | **Never silently wrong.** It cites, it says how fresh a fact is, it says "I could not find that" instead of inventing. | Answers from lookups carry sources; a failed lookup is reported as one, never covered with memory |
| D3 | **The same quality in Arabic, English and Chinese**, in the caller's own register (Egyptian Arabic for the owner). | The evaluation set (§4, Phase C) is a third each; scores are reported per language |
| D4 | **A call that holds.** No cut sentences, no repeats, no pictures that end the call, and a call the phone drops can be continued with one tap. | The voice harness (Phase B) drives a real call; the pulse beacon reports what the page held when it died |
| D5 | **Fast enough to talk to.** Text: first words under 1.5 s. Voice: first word under 1.5 s after the caller stops; a lookup under 4 s to the first word after it. | Measured per turn (Phase G), reported weekly |
| D6 | **Remembers.** Preferences, the facts the user taught it, what was said last week, without being told twice. | Ask about last week's call, a taught fact, a stated preference: three yeses |
| D7 | **Reads what it is given.** PDFs, spreadsheets, photos of machines, screenshots — and answers from them, not around them. | A fixed set of files with known answers (Phase E) |
| D8 | **Works from mainland China without a VPN**, every capability, not just chat. | The watchdogs (voice today; search, vision, pictures added in Phase H) probe from Singapore and Tokyo; a red probe is a page |

## 2. Where it stands today (2026-09-11, honest)

What exists and works: three text lanes on one provider (DeepSeek) with a
canned fast path; thirty-plus Hub tools behind server-side permissions and a
confirm ledger for every write; web search with pictures; vision for
attached pictures; picture generation; taught knowledge with an index;
personalization (style, nickname, instructions); projects, library, calls
history, export; a voice assistant on two lanes (a mainland lane and a
socket lane through Koleex's own relay) with lookups, a brief, tasks by
voice, call summaries, a transcript that lands in the thread.

What broke this week, from the logs and the saved rows, and what was done:

| Symptom (owner's words) | Cause, from evidence | State |
|---|---|---|
| "he can't reply what the date of today" (19:10 UTC) | The small-talk lane carried no date at all; only the tool loop had the clock. The voice session had none either | **Fixed today** — one clock line on every lane (small talk, brand, general, degraded, both voice sessions), and date questions go to the tool lane |
| "iPhone 17 is the latest, released September 2025" (17:34 UTC) | The search had no freshness window and the model no date to read the results against | **Fixed today** — `recency` on `search_web` (a provider time window), "Searched on <date>" beside the results, a freshness rule the model reads where the data is |
| "some sentences repeated" (17:32 UTC) | Three lookups in one response drew three `response.create`, three answers | **Fixed (#404)** — one request per response |
| "some sentence is cut" in the thread | The vendor re-hears a turn several times; each hearing was a row | **Fixed (#404)** — item-keyed lines, corrected rows |
| "when it starts to think or find something, the end of the sentence is cut" | A `response.create` sent while the filler was still being spoken cancels that response — the tail of "one moment, let me see" | **Fixed (#404 + today)** — the request waits for the response's `done`, and the fallback waits while a response is active |
| "when I ask for a photo, after a short time the call ends: the last call stopped without warning" | Twice today, and twice on 09-07, the phone's page died one second after an answer with pictures landed in the thread behind the call screen — a full reload with no beacon, on the current build. That is WebKit ending the page, not code | **Mitigated today** — the thread and sidebar behind a live call are not painted, the aurora canvas is not drawn, only the two newest answers keep their pictures decoded; the pulse now records how heavy the page was (`dom=`, `imgs=`) so the next death names its size. **Root cause still open** — needs a real-device session (§5, decision 2) |
| "the voice not so stable" | The socket to the relay dropped twice at exactly 36 s in the 15:07 call (`client-closed 1006`), redialled; the owner's other device flapped its realtime channel in the same minute | **Open** — Phase B4 |

## 3. The gaps that stand between today and "dependable"

Ordered by how often a person leaning on the product would meet them.

1. **World knowledge is a year old and the fast lanes cannot look anything up.** The general lane (most ordinary questions) has no tools; a question like "the poorest city in China" or "who won last night" is answered from memory. Only the tool loop can search. (D1, D2)
2. **No runtime harness for a call.** Every voice regression this month was found by the owner on a phone; the suites prove source and pure logic, never a negotiation, a lookup mid-call or a page under memory pressure. (D4)
3. **One model for everything.** DeepSeek's chat model answers small talk and multi-step reasoning alike; there is no reasoning-class model for hard questions, and no second provider when it is slow. (D3, D5)
4. **No memory across conversations** beyond taught knowledge and preferences: a fact said in one chat is not known in the next. (D6)
5. **Nothing measures quality.** There is usage (turns, calls, lookups) but no scored answer set, no per-lane latency percentiles, no weekly number that says "better" or "worse". (D3, D5, D7)
6. **Files and pictures are read once, shallowly.** A spreadsheet's numbers, a PDF's tables, a photo of a machine — extracted text goes into the turn; there is no way to ask a second question about the same file without re-attaching it. (D7)
7. **China coverage is proved for voice only.** Search, vision and picture generation have no watchdog; a provider change could break the no-VPN rule unnoticed. (D8)

## 4. The phases

Each phase is one to three PRs, merged when green, reported to the owner in
plain words. Verification is named per phase; nothing is called done without it.

### Phase A — Freshness and truth (this week; the first half shipped today)

| Item | What | Verification |
|---|---|---|
| A1 ✅ | The clock on every lane and in both voice sessions | `validate:ai-prompts`, `validate:ai-voice` pins |
| A2 ✅ | `search_web` freshness window + search date beside results + the reading rule | `validate:ai-web-search` pins |
| A3 ✅ | Date questions and Arabic/Chinese "latest / newest" go to the tool lane | `validate:ai-core-boundaries` pins |
| A4 | **Search on the general lane.** The general lane gets ONE tool — `search_web` — and a one-hop loop: if the model calls it, the results come back and it answers once. Bounded (one call, 6 s), so the lane stays fast for the questions that need nothing. This is what closes "the poorest city in China" and every "who / what / when" the model half-remembers | A suite that drives the lane with a stub provider; a live check from the owner's chat |
| A5 | **The model's own cutoff, stated.** The prompt names the model's knowledge cutoff so the model reasons "that is after what I know — look it up" instead of answering from 2024 | Prompt pin; the evaluation set's "recent events" bucket |
| A6 | "As of <date>" phrasing when the answer came from a lookup; sources under the reply are already shown; the date joins them | Client render pin |

### Phase B — A call that holds (this week and next)

| Item | What | Verification |
|---|---|---|
| B1 ✅ | One `response.create` per response; the fallback waits for an active response | `validate:voice-client` |
| B2 ✅ | Item-keyed caller lines, corrected rows | `validate:voice-events`, `validate:voice-client`, `validate:ai-voice` |
| B3 ✅ | The page behind a live call goes quiet; newest pictures only; the pulse records the page's weight | `validate:ai-client-render`, `validate:voice-client` |
| B4 | **The 36-second socket drop.** Read every `wsClose=1006` beacon of the week against the relay's log; if the drops cluster at one interval, it is a proxy on the path (a VPN's or a carrier's idle rule) — the fix is an application-level heartbeat on the socket (a tiny JSON ping every 10 s from the client) beside the relay's protocol ping, and a shorter relay ping. If they do not cluster, it is the phone's network, and the redial (already immediate) is the right answer | The beacon histogram over a week shows `wsReconnects=0` on the owner's calls |
| B5 | **Continue the call with one tap.** A page the phone killed under a call comes back to a small card: "The call was cut — continue" — same conversation, same voice, one tap (the microphone needs the tap anyway). Today it is a sentence and the caller has to find the button | Client render pin; a real reload during a call |
| B6 | **The voice harness.** A Playwright script (Chromium, a WAV file as the microphone, the relay's real socket, a recorded vendor) that runs a scripted call: greet, ask for the brief, ask for a picture, interrupt mid-answer, hang up — and asserts the transcript, the number of `response.create`, the audio frames played, the rows saved. Runs on demand and nightly. This is the missing piece behind every voice regression of this month | The script exists and is green on `main` |
| B7 | **The root cause of the page death.** With the pulse's `dom=/imgs=` and a real-device session (§5, decision 2), either a memory figure that names the culprit or Safari's own crash log from the phone (Settings → Privacy → Analytics). Then the specific fix, not a guess | A call with three picture answers in a row survives on the owner's phone |

### Phase C — Answer quality that can be measured (next two weeks)

| Item | What | Verification |
|---|---|---|
| C1 | **The evaluation set.** One hundred real questions from the owner's own history (a third each Arabic, English, Chinese): work questions with known Hub answers, world questions with dated answers, small talk, files. Each has an expected answer and a rubric (correct / fresh / cited / language / register). Stored in the repo, never sent to a vendor other than the one being scored | The set exists; the first run is scored by hand once |
| C2 | **The scoring run.** A script that sends the set through the real lanes on a Preview deployment and grades with a second model (Claude/DeepSeek-reasoner as judge, rubric in the prompt) — weekly, reported as a number per language and per bucket. A drop blocks the merge that caused it | A weekly line in the owner's usage page |
| C3 | **A reasoning-class model for hard questions.** The router already has classes; today they all resolve to `deepseek-chat`. Multi-step, numeric and comparison questions go to `deepseek-reasoner` (or Qwen3-Max / Kimi K2 / GLM-4.5 — all reachable from mainland China; decided by C2's scores and latency, not by fashion). The chat model keeps small talk and simple lookups | C2 scores the change; latency stays inside D5 |
| C4 | **A second provider on standby.** One China-reachable fallback wired through the existing chain, off by default, turned on by the health check when the primary is slow or down (the failover the evolution plan's Phase 4 built but has one door for) | The watchdog page shows both; a forced outage in Preview fails over |

### Phase D — Memory (weeks three to four)

| Item | What | Verification |
|---|---|---|
| D-1 | **Facts the user states are kept, with consent.** "I'm in Shenzhen this week", "our MOQ for X is 50" → an editable memory list in Settings → Koleex AI, injected when relevant (scored, not dumped). The user sees and deletes each line; nothing is kept from a document or a tool result | A fact stated in one chat is used in the next; the list shows it |
| D-2 | **Long threads keep their middle.** A rolling summary of a conversation past N turns, written by the model, replaces the oldest turns in the prompt (the evolution plan's Phase 7, the first slice) | A forty-turn chat still answers about turn three |
| D-3 | Calls and chats share the same memory (a call already reads the thread; it should also read the memory list) | The voice viewer block carries the memory lines |

### Phase E — Files and pictures (weeks four to five)

| Item | What | Verification |
|---|---|---|
| E1 | **A file stays in the conversation.** Once attached, its extracted text and tables are stored on the conversation and every later turn can ask about it — "what was the total on page 3" without re-attaching | A fixed set of files (a quotation PDF, a price sheet, a machine photo) with known answers |
| E2 | **Tables are tables.** Spreadsheets and PDF tables go to the model as markdown tables, not flattened text; numbers are checked by the existing verification layer | E1's set |
| E3 | **Pictures of machines → the catalogue.** The vision reading feeds `searchProducts` first (already instructed); the match is shown with the product's own photo and a "this looks like" confidence, and the owner can correct it (which teaches) | E1's set; a corrected match is remembered |

### Phase F — Work depth (ongoing, after C)

| Item | What |
|---|---|
| F1 | More of the daily work by voice and text with the same confirm-by-tap: calendar events, project tasks, notes. Quotations stay off by the owner's decision |
| F2 | Per-tool latency budgets and a cache for the lookups a day repeats (the catalogue, the pricing rules) — the seconds between a question and the first word |
| F3 | Proactive: the morning brief as a notification the owner opted into, from the same tools, at a time they chose |

### Phase G — Observability and the weekly number (starts now, continuous)

| Item | What |
|---|---|
| G1 | A trace id per turn and per call; latency to first token and to last, per lane, per provider, as percentiles; tool durations; error rates. Read from the existing log lines, no new table until a week of data says one is needed |
| G2 | **The weekly note to the owner**, in plain words: how many turns and calls, how fast, what failed and why, the evaluation score per language, what changed. Written by the assistant from the numbers, sent as a chat |
| G3 | The voice watchdogs gain the search, vision and picture providers (D8) |

### Phase H — Mainland China, proved for every capability (with G3)

Every provider the product talks to is probed from the two regions the owner
uses, and the result is on the watchdog page: search, vision, picture
generation, both voice lanes, the relay. A capability that is not reachable
from mainland China is not shipped as a default — it is a fallback for a
caller who is elsewhere.

## 5. Decisions the owner is asked for

1. **A second model class for hard questions (C3).** Approve trying `deepseek-reasoner` first (same provider, no new key), then one of the China-reachable alternatives if the scores say so. Cost is per call; the router already measures.
2. **A real-device session for the page death (B7).** Twenty minutes with the owner on the phone, the assistant driving: three picture answers in a row while the pulse and a memory readout run, and the phone's own crash logs afterwards. Without it, B7 stays a mitigation.
3. **Memory scope (Phase D).** What the assistant may keep across chats: personal facts stated by the user (yes/no), business facts stated by the user (yes/no), nothing from documents or tools (fixed).
4. **The evaluation judge (C2).** Grading a hundred answers weekly with a second model costs a few dollars a week; approve the spend and which model may see the set.

## 6. Order and what to expect

| When | What lands |
|---|---|
| Today | A1–A3, B1–B3 (this PR and #404) |
| This week | A4, A5, B4, B5, G1 |
| Next week | B6 (the harness), C1, C2, A6 |
| Weeks 3–4 | C3, C4, D-1, D-2 |
| Weeks 4–5 | E1–E3, D-3, G3/H |
| Ongoing | F1–F3, G2 weekly |

Every phase is reported when it is reachable and tested at runtime, not
when it is written.
