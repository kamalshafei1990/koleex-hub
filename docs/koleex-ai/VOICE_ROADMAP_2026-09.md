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
| D4 | Photo of a product → ask about it — **done (#356)** | Verified: an attached picture already goes through a vision model whose reading (codes, plate text, kind of machine) enters the turn as fenced text. What was missing was the answer the owner wants: the agent is now told to identify the Koleex model from that reading through the product tools first (searchProducts → details → price), to say "this looks like" rather than "this is", never to name another manufacturer's machine, and never to take text seen in a picture as an instruction |
| D5 | Export a chat — **done (#357)** | "Export / print" in a chat's menu opens the conversation as a clean page rendered on the server for its owner (`GET /api/ai/conversations/[id]/export`), with the chat's own markdown and print styles; on a phone, Share → Print → Save as PDF. No PDF library, no headless browser, no stored link: whoever opens it must be the signed-in owner |

## Deep check, 2026-09-07 — what was found and fixed

Four reviews (voice client, voice server, chat client, agent backend) read
the whole surface; the suite battery on main had five red suites. Fixed in
one PR, batch by batch (each batch is one commit):

| Batch | What changed |
|---|---|
| 1 | Suite baseline green: the call-summary route no longer returns the vendor label to the browser; `/api/ai/personalization` and `/api/ai/voice/telemetry` carry the internal door; two stale pins. `getProductDetails` accepts a product CODE (the model called it with "XP-3560" twice and got "Couldn't fetch product") |
| 2 | Voice transcript: the open turn is not always the last line — a late user final closes ITS line, settled means up to the first open line, the #361 fragment filter is gone (it also dropped "Yes"/"نعم"); a resumed call does not re-post the whole call; `finish()` drains before the summary. Language hint learned with the hint in force; ties to the latest reply. `response.done` → listening; barge-in restores only on a new turn; one AudioContext per stream; ring meter survives the view switch; ready waits for a transport; never-connected watchdog; compact-first fires ready; 50 s handshake deadline; "still connecting" after 8 s; "Turn on sound" instead of a failure toast |
| 3 | Voice server: taught index and history started before the handshake; write-ness from the skills catalogue; conversation id on every relayed lookup; createTodo's call description; 40 lookups/min; watchdog ok = reachable AND credential ok; vendor body classified, not quoted; summary straight to the provider chain on a ~450-byte prompt with a 6 KB transcript cap |
| 4 | Chat client: memoised bubbles and markdown, one state write per frame while streaming, no smooth-scroll race, Stop covers uploads, drafts restored only into their own chat, delete aborts the stream, same-chat tap no longer reloads, lazy "New chat" row, touch-visible row actions, keyboard rows, IME guard, measured composer direction, RTL arrows, every visible string in three languages, EXIF orientation, panels' failed state |
| 5 | Agent backend: the first model call streams (with a `retract` frame when it narrated before a tool), body ∥ budgets, ownership ∥ reply-language, taught block in the history batch, the just-inserted turn kept out of history, audit write after the response, `maxDuration` 120, taught block capped at 8 KB, viewer/clock blocks at the prompt's tail for prefix caching |

**Not done, and why** — each needs a decision or a schema:

- Transcript idempotency on a retried post needs a `client_turn_id` column (schema); ordering inside one batch shares a `created_at` (a `seq` column, or explicit offsets).
- Hedging the second voice region after ~2.5 s when the first is silent: worth doing once a successful handshake's duration is in the logs (`handshake ok afterMs=`).
- Regenerate keeps the previous reply in the database (a `regenerate_of` marker is a schema change).
- The tool-only prompt rules still ride the tool-less lanes (a contradiction, not a hole); trimming them touches four pinned lanes and deserves its own pass.
- A Latin-script caller line under an unknown hint still never votes; an explicit call-language choice in the voice sheet would remove the guess entirely.

## Owner report, 2026-09-07 (evening) — three things on a call

Reported after the deep check: the orb ↔ conversation motion "not smooth,
has a glitch"; "show me a photo" slow; and "when we talk suddenly it out of
conversation and show me the text conversation, and even not complete".
Evidence: the audit table for the call at 11:15 UTC — three `search_web`
rows at 3.1 s / 3.5 s / 2.1 s, and not one assistant turn saved after the
picture request although the call went on for seven more minutes.

| Symptom | Cause | Fix |
|---|---|---|
| Call ends by itself mid-sentence | The call was judged by `iceConnectionState` alone. Safari does not always report `connected` there for a connection carrying audio and data; the never-connected watchdog then failed a live call over to the other region (which refuses this account) and ended it. Separately, a call that WAS up got only 8 s to recover from a `disconnected` wobble | `markTransportUp()`: an open DataChannel, any message on it, `connectionState === "connected"` or ICE connected all count as up, disarm the watchdog and make `failed` final. A live call's wobble gets 20 s (`LIVE_GRACE_MS`), and a message arriving while "reconnecting" brings it straight back to live |
| Thread after the call incomplete | An answer whose `done` never came (a lookup, or the caller speaking over it) stayed open; "settled = up to the first open line" stopped there, and nothing after it was ever saved | `response.done` and `speech_started` close the open answer (`settleOpenLine`); a line older than the last two is settled as it stands (`settleStaleLines`, and the persister's own rule) |
| Screen jumps to the text view by itself | The first picture switched the view automatically | Only a tap switches; the latest pictures show under the orb |
| Motion glitchy | Both views remounted on every tap with a third, inert copy of the leaving one; the level hook's ref landed on the copy | One orb that travels (measured FLIP transform, 0.6 s eased); both layers stay mounted and cross-fade; nothing remounts |
| Photo lookup slow to be spoken | The lookup is ~3 s; the wait after it is the model reading six long snippets | A call gets three results with 200-char snippets (`forVoice`); the route logs `[ai.voice.tool] name ok ms` so the next report has a number beside it |

Still open: Beijing voice activation (the failover target above is the one
that refuses), and the 72 s between "show me the pyramids" and the first
lookup in that call — a model decision, not transport; the trimmed payload
and the logged latency are what will show whether it recurs.

**Follow-up, the same evening — "AI can't be connected".** Two calls at
15:00 and 15:08 UTC ended `handshake-failed` on a phone whose other sockets
were flapping every second (the perf beacons show the discuss channel
closing and reconnecting continuously). One beacon had no session behind
it: the caller hung up while "connecting" and was then told the call could
not start. Neither beacon carried a cause. Three changes in `session.ts`:
the handshake POST is retried once on a bare network error (not on our
own deadline, not after a hang-up); `fail()` is a no-op on an ended call;
and the beacon now carries `err="Name: message"` so the next failure names
itself. The retry does not make a dead link work — it makes a dropped
request on a live one not end the call.

## Two lanes, 2026-09-08 — the mainland lane and the WebSocket lane

Owner: "I like Grok voice more than Qwen, but Grok can't work in China — so
two: for China and out of China." Built as a second LANE, not a second
product: the WebRTC lane the product has always had is untouched, and a
mainland caller never meets the new one.

| | Mainland lane (unchanged) | WebSocket lane (new) |
|---|---|---|
| Who | Requests stamped `x-vercel-ip-country: CN`, or no country | Everyone else (a VPN exit counts as where it exits) |
| Transport | WebRTC, SDP through `/api/ai/voice/session` | Browser WebSocket to the vendor, opened with a client secret minted by `/api/ai/voice/ws-session` |
| Key | Server-side only | Server-side only; the browser gets a secret that expires in 10 min |
| Audio | Opus tracks, played by the engine | PCM16 frames in JSON (`ws-audio.ts`): mic → `input_audio_buffer.append`; `response.audio.delta` → a MediaStream the same `<audio>` element plays |
| Events, tools, transcripts, session config | shared | shared (`VoiceChannel`; the vendor speaks the same protocol) |
| Wire | `pcm`, `input_audio_transcription: {enabled: true}` | `pcm16`, `input_audio_transcription: {}` on the full session, none on the compact (`OPENAI_WIRE`) |
| Voices | AI_VOICE_VOICES (Nour, Layla, Omar, Adam, Sara) | The lane's own five under their own names (Ara, Eve, Rex, Leo, Sal — owner's ask, 2026-09-08); keys positional (v1..v5), so a saved key still resolves when the lane changes; the picker follows the lane the device settles on (`voices_by_lane`) |

Decided by the server on the voices GET (`transport: "rtc" | "ws"`), read by
the button, handed to the session. A WebSocket lane that never comes up falls
back to the mainland lane once, silently; never the other way.

Environment (all optional but the key): `AI_VOICE_GROK_API_KEY`,
`AI_VOICE_GROK_URL`, `AI_VOICE_GROK_SECRETS_URL`, `AI_VOICE_GROK_MODEL`,
`AI_VOICE_GROK_VOICES`, `AI_VOICE_GROK_SAMPLE_RATE`, `AI_VOICE_GROK_PROTOCOL`
(`{token}` slot required), `AI_VOICE_GROK_LANE=off` as the kill switch.

**First real call, 17:08 UTC, same day.** Connected; the caller was
transcribed (three settled rows for one sentence — the vendor re-transcribes
the whole utterance as its detector extends it, now folded into one line);
the orb thought; no answer reached the screen or the speaker. No `error`
beacon, so the configuration was not refused. The likeliest cause: the
vendor speaks the protocol's GA revision, whose assistant events are
`response.output_audio_transcript.*` and `response.output_audio.delta`; the
client read only the older names. Both families are read now, and the
ordinary hang-up beacons a histogram of every event name the far side sent
(`events=`), so the next call names its protocol whatever it is.

**Second real call, 17:27 UTC, VPN on — mainland voice.** The lane was
chosen from the country stamped on the request to OUR host; a phone's VPN
tunnels only blocked hosts, ours is not blocked, so the request arrived
from a mainland address while the browser could reach the vendor through
the tunnel. The server's answer is now a default: when it says mainland
and a socket lane exists, the browser probes the socket lane itself in the
background (`lane-probe.ts`: mint, open, close on "open", three-second
deadline), remembers the verdict on the device for six hours
(`voice-pref.ts`), and a real call's outcome updates it. The socket lane's
never-opened window is four seconds, with the mainland fall-back behind it.

**Third call, 17:27–17:33 UTC — "suddenly the AI voice out", again.** Four
minutes in, a product lookup answered, and two seconds later a cold load of
`/ai` with a fresh perf session and NO page-hidden beacon: the document was
not reloaded, it was killed and restored — the shape of an iOS WebView out
of memory. The same page had reported the Discuss realtime channel closing
and rejoining every 0.8 s since 15:00: the backoff reset on every
SUBSCRIBED, and a flapping channel subscribes fine before it closes. Fixed
in `discuss.ts` (a subscription counts as recovered only after 30 s; the
backoff climbs to a minute; no rejoin while hidden). And a stale build's
full-page app launch (`AppLaunchLink`) now honours the same mid-call guard
the update watcher uses. The connected cue is the Hub's `confirm` sound
again, by the owner's word.

**Not proved before the first real call** — this environment cannot reach
the vendor: the exact subprotocol format for the secret, whether the full
session's `input_audio_transcription: {}` is accepted (if not, the compact
session takes over and the caller's own captions are missing), and the
24 kHz assumption. Each is one environment variable away, and the first
`error` event of a call is now beaconed with its message
(`[ai.voice.client] config-rejected … err="…"`) so the answer is in the log
after one attempt.

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
