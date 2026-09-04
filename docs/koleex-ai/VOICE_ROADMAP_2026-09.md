# Koleex AI — voice and assistant roadmap (September 2026)

Agreed with the owner on 2026-09-03 after a day of call-quality work
(#331–#344). Ordered by what each item does for a real call. The
quotation-by-voice idea is deliberately **not** on this list (owner's call).

Rules that hold for every item: no new provider hard-coded; mainland China
must work without a VPN; writes stay confirmed by a person; permissions are
decided by the server; uploaded or spoken content is never an instruction;
nothing is called done until it is reachable and tested at runtime.

## Phase A — call quality (every call feels this)

| # | Item | Why (evidence) | How | Status |
|---|------|----------------|-----|--------|
| A1 | No re-greeting on a continued call | Transcript 18:14–18:17 UTC: "أهلاً بك يا أستاذ كمال…" four times across reconnects | History block tells the model the call was already under way; a greeting after a reconnect gets a one-word answer, not a restart | done (#345) |
| A2 | Start from the region that served this device last | Every cold handshake still spends 13 s on the mainland endpoint before Singapore; the server's memory (#340) dies with the warm instance | The client remembers the served slot (localStorage) and sends it as the allow-listed hint on every call; the server still decides | done (#345) |
| A3 | Better transcription of Egyptian Arabic | Saved user turns read "إزاي كخ بركة إيه؟" for "إزيك أخبارك إيه"; the model heard it right, the transcript did not | Ask the session for the vendor's dedicated realtime ASR model (`input_audio_transcription.model`) alongside the language hint; full session only, compact fallback untouched | done (#345) |

## Phase B — inside the call

| # | Item | How |
|---|------|-----|
| B1 | End-of-call summary — **done (#346)** | When the call ends with ≥ 2 exchanges, the server summarises the saved spoken turns (existing chat lane, no new provider) into 3–5 bullets with every number as said, and writes it into the thread under "Call summary" in the call's language. Copy and "Save as task" (confirmed) still to come |
| B2 | Hold to talk — **done (#347)** | "How you talk" in the voice sheet: Hands-free (as before) or Hold to talk — the microphone tracks open only while the button is held, closed the moment a session's mic exists, remembered on the device. No new handshake or vendor field. The higher VAD threshold preset is deliberately **not** shipped: its number has to come from a real noisy room, and hold-to-talk is the honest answer there until it does |
| B3 | Barge-in — **done (#348)** | Read against the vendor's WebRTC sample, which clears its playback buffer on `input_audio_buffer.speech_started`: the far side stops sending when the caller interrupts, but the receiver's jitter buffer (400 ms) still played out over the caller's first words. The element is now muted on a speech start that lands while the far side is speaking, and unmuted the moment the caller falls silent or the far side has the turn again (`events.ts` playbackGate). A start in a pause changes nothing. Runtime confirmation: interrupt Koleex AI mid-sentence on a real call |
| B4 | One voice everywhere — **deferred** | The vendor's non-realtime TTS (`qwen3-tts-flash`, HTTP, mainland and Singapore endpoints) lists ten `language_type` values and **Arabic is not one of them**; Arabic text would go through `Auto`, which the vendor itself says it cannot guarantee. Egyptian Arabic is the owner's call language, so routing the "listen" button there today would give the character a worse voice, not one voice. Revisit when the TTS family lists Arabic, or when the realtime voice can be borrowed for short read-outs |
| B5 | Survive a locked screen — **done as far as the platform allows (#349)** | Finding: a home-screen web app that is suspended by a locked screen loses microphone, audio and the line, and no page API holds a call through that. What a page can do is keep the screen from locking while the call is up: the Screen Wake Lock (iOS 16.4+, Android, desktop) is now requested when the call goes live, released with the call, and asked for again when the page returns from the background. A caller who presses the lock button anyway ends up where they were before — the transcript and the summary keep what was said. Native audio-session behaviour would need a native shell, not on this list |

### Candidate from the vendor's own guidance (needs a real-room test first)

The vendor recommends `semantic_vad` over `server_vad` for the realtime model
and says its threshold is the knob to raise in a noisy room. Today's session
uses `server_vad` at 0.65, tuned from a real call's phantom turns. Switching
detection type is a runtime-behaviour change that no suite can prove, so it
is not shipped blind: the right shape is a server-side environment switch
tried on one deployment while the owner is on a real call. Hold to talk (B2)
covers the loud room in the meantime.

## Phase C — capabilities

| # | Item | How |
|---|------|-----|
| C1 | Customers and pricing rules on a call — **done (#350)** | `getCustomerByName`, `getCustomerByCode` and `getPricingRules` join the voice allow-list, last in the order, each gated on dispatch by its own module (Customers/view; Quotations/view with margins withheld without private-data permission) and audited like every tool call. The instructions make the model read every figure exactly, name what it is, and offer to write it into the chat. **Inventory is not added**: the tool is a stub that answers "not available" today, so a schema for it would only cost bytes. Quotation figures stay off (owner's decision) |
| C2 | Search across conversations — **done (#349)** | The sidebar box already matched titles and the last preview locally; it now also asks `GET /api/ai/conversations/search?q=` (owner-scoped by construction: messages are matched inside the caller's own conversation ids; budgeted; two characters or more; debounced and aborted on the client) and shows a snippet of the match under each hit. No new table or index: a filtered ILIKE over today's volume is far cheaper than the network hop; pg_trgm is installed if that ever changes |
| C3 | Library — **done (#351)** | A "Library" row in the sidebar opens a grid of every picture that appeared in the caller's own chats (product photos, web pictures, pictures Koleex AI made), newest first; a tap opens it full-size with one action, "Open chat". The index is the saved markdown itself, read owner-scoped by `GET /api/ai/library`: no new table, nothing stored twice |
| C4 | Today's brief on a call — **done (#352)** | A "Today's brief" chip on the call screen (before the first word, once the line is listening) types the request into the call; the instructions have the model call `listMyCalendar` and `listMyTodos` (and `listMyPlanning` when plans are mentioned) and speak a twenty-second brief in the caller's language: meetings in time order, tasks due or overdue, the one thing that needs them first, then ask where to start. Asking in words works the same. **Not in it**: quotations awaiting approval (quotations by voice are off by the owner's decision) and new customers (no read lists them today; a customer is still looked up by name or code) |

## Phase D — after the plan (agreed 2026-09-03, evening)

| # | Item | How |
|---|------|-----|
| D1 | Tasks by voice, saved by a tap — **done (#353)** | "Save a task: follow up with X on Thursday" → the model previews `createTodo` (the same two-phase tool the text lane uses; the ledger records the preview), a card appears on the screen with the task in the caller's words, and only the caller's **tap** on Save carries the confirm to the server — the tool route refuses a confirm from the model's own call, because a spoken "yes" can be misheard and a tap cannot. The model is told the outcome in a note it does not answer. The one write on the voice list |
| D2 | Calls history — **done (#354)** | A "Calls" row in the sidebar lists the caller's past calls, newest first, each by the summary Koleex AI wrote when it ended (B1), with the time, the chat's title and "Open chat". The summary message is the record of the call: `GET /api/ai/calls` reads them owner-scoped; no table of calls, nothing stored twice |
| D3 | Usage for the owner — **done (#355)** | Settings → Koleex AI shows a super admin the last 14 days: people active, chats started, typed and spoken turns, calls (by their summaries) and lookups per day, plus the most-used lookups and their success rate. Counts only, tenant-scoped, decided super-admin on the server (`GET /api/ai/usage`). Cost is deliberately not shown: token usage is logged per turn (cost/meter.ts) and not stored, so a dollar figure would be a guess — the page says so |
| D4 | Photo of a product → ask about it | Confirm the text lane's image attachments reach a model that can see; then wire the question |
| D5 | Export a chat | PDF or share link of one conversation |

## Owner-side (not code)

- Activate the realtime voice model on the Beijing workspace (still `403 Unpurchased`), so mainland callers get the mainland endpoint.
- Enable Vercel Analytics and Speed Insights.

## Done today, for reference

#331 region hand-over · #332 ALT inherits path/model · #333 seven call fixes ·
#334 `getProductPrice` · #335 60 lookups, thinking phase, learned language,
lightbox, auto-resume, beacons · #336 call tone from the library · #337 two
views, photos inline, no reload over a call · #338 default voice catalogue ·
#339 Settings → Koleex AI (style, instructions, memory) · #340 voice switch
keeps the screen, region memory, silent-exit beacons · #341 Speak pill,
activity line, voices sheet · #342/#343 orb flight between views, voice
signatures · #344 End is an X, connected cue "arrive".
