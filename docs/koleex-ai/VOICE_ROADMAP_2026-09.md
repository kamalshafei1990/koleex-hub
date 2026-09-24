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

## Fourth and fifth findings, 2026-09-07 (night) — the page killed under the call, and a chopped voice

**The page was killed, twice, right after pictures** (17:33 and 18:03 UTC):
a call answered a lookup that showed photos, and seconds later `/ai` cold
loaded with a fresh perf session and no `page-hidden` beacon — the document
was not reloaded, it was killed and restored. Catalogue photos already went
through our optimizer at slot size; a WEB photo (search results, a markdown
image the model wrote) went into `<img>` at its original URL — camera-sized
files decoded for 88 px tiles, several per answer, in the page that also
holds the audio graph, and the always-mounted words layer kept every one of
them alive. Fixed:

- `GET /api/ai/image?u=…&w=384|768|1200` — an authenticated, budgeted proxy
  that fetches the picture server-side under the SSRF rules (the Translator's
  address check, lifted into `lib/server/safe-url.ts`: https only, every
  redirect hop re-checked, private ranges refused), with byte / time / pixel
  ceilings, and returns a freshly encoded WebP at the slot's width. The
  browser only ever talks to our host — which is also the mainland rule.
- `lib/ai/image-url.ts` `aiImage(url, width)`: storage → optimizer, web →
  proxy, blob/data → itself. Used by every AI picture: transcript tile 384,
  orb strip 384, chat bubble 768, lightbox 1200, library 384.
- A tile in a layer that is not showing draws an empty frame of the same
  size and holds no picture (`PhotoTile visible`, `VoiceTranscript
  photosVisible`).
- The web search drops a picture that declares more than 4 MB before the
  model sees it.

**"The voice of Grok not so stable"** (18:10). Frames come down the socket
across a VPN in bursts; the player butted each frame 50 ms behind now, so
every wire gap longer than that was a gap in the voice. Now a run of frames
starts 200 ms behind and the lead grows 100 ms on every underrun up to
600 ms (`nextFrameStart`, pure). And the microphone is read by an
AudioWorklet on the audio thread (module from a blob URL, ScriptProcessor
fallback), so a busy main thread no longer drops the caller's frames.

Not proved here: the worklet path on iOS Safari (the fallback is what
shipped before), and whether 200 ms is the right lead for the owner's link
— the `hung-up` beacon's event histogram will show how many answers played.

## Hear a voice before choosing it, and a cut answer stays cut (2026-09-07, late)

**"When I press a voice it should say some sample words so I can listen
before I select it."** `GET /api/ai/voice/preview?voice=<key>&lane&lang`
synthesises one product sentence ("Hi, I'm Koleex AI…", in the UI
language) in the SAME vendor voice id the call would use — the socket
lane's vendor answers a POST with the bytes; the mainland lane's answers
with an envelope naming a URL, fetched after the address check. Endpoints
and the speech model are configuration with defaults
(`AI_VOICE_GROK_TTS_URL`, `AI_VOICE_TTS_URL`, `AI_VOICE_TTS_MODEL`);
budget `voice_preview` 20/min; the browser caches a sample a week. On the
sheet a tap on an orb plays the sample and marks it; "Use this voice"
confirms (off until a different voice was heard). The player is primed
inside the tap so the phone lets the bytes play when they land a second
later; while a sample plays the microphone is closed and the far side
silenced, both restored after.

**"When I speak I hear strange voices from Koleex AI, it seems to glitch."**
A barge-in flushed the queue, but frames of the cut answer still in flight
were played the instant they landed: half-syllables over the caller's
words. Now every voice frame is dropped after a barge-in until the far
side's next `response.created`; frames naming the cut response are dropped
even after that.

Not proved here: that either vendor's speech endpoint knows every voice id
the realtime catalogue offers (a refusal is a 502 and the sheet says
"couldn't play a sample"), and the exact request shape — both are
transcribed from the vendors' published guides, and one real tap answers
each. The refusal's status is in the log (`[ai.voice.preview] synthesis
refused status=…`).

## Third pass on the socket lane's sound, 2026-09-07 (night)

Owner: still "a strange voice when I speak or the AI listens", and choosing
a voice "takes time until it talks". The hung-up beacon of that call shows
two clean turns (2 speech_started, 2 responses, no cancels), so the sound
was not late frames of a cut answer — it was how each answer STARTED: the
vendor sends a small first frame fast and then streams, and the player
started that blip 50 ms later, then sat in silence until the next frame.
`JitterQueue` now gathers 300 ms of an answer (or 350 ms of waiting) before
the first frame plays, then plays back to back; an underrun (a run drained
under a second ago) grows the gathering 100 ms up to 800 ms; a gap over a
second is simply the next answer.

The switch: the rebuilt call waited to be spoken to. Now the switch arms a
greeting and the rebuilt call's `session.updated` sends one
`response.create` with instructions (`VOICE_SWITCH_GREETING`): one short
sentence in the conversation's language, so the new voice is heard at once.
The `voice-switched` beacon now carries the lane. The sheet: the current
voice wears a check and the caption "Current"; the confirm button names the
candidate ("Use Eve").

Samples worked on the first tap (two `GET /api/ai/voice/preview 200` at
18:56, the socket lane's vendor). The mainland lane's synthesiser is still
unproven.

## The sheet, once more (2026-09-07, night)

Owner: "this page still has glitches… use Koleex Hub colors… change the
connected sound to ping". Fixed: the panel is the hub's own surface
(`#111111`, `--bg-secondary`) and its bottom padding clears the home
indicator (the panel stopped at 2rem and the indicator's strip showed as a
black band under it); the chosen/candidate tile wears ONE Hub Blue border
with a soft glow instead of a border plus an offset ring that read as a
doubled circle; the tile row has room above for the badge and glow (an
overflow-x container clips vertically); a sampling tile shows the same
animated dots the activity line uses. The connected cue is `ping`; a stored
`arrive` or `confirm` nobody chose follows it.

## One voice, and "[noise]" (2026-09-07, late night)

Owner: "a lot of bugs in the Grok voice conversation; when I switch to a
different voice the voice doesn't change — it seems to have only one voice;
when I talk it has a noise".

**One voice.** The socket lane's catalogue carried the vendor ids
lowercase, copied from the speech console (`eve`). The realtime session
accepted `voice: "eve"` without an error and spoke its default voice every
time; the vendor's own realtime clients default to `"Ara"`, capitalised.
The catalogue is capitalised now (`Ara:Ara,…`); the sample endpoint, which
wants lowercase, gets the id lowered. The socket route logs `session
voice=<key> vendor=<id>`.

**"[noise]".** The 19:47 call's transcript held a caller turn of `[noise]
...` — right after two voice samples. The sample player opened its own
AudioContext beside the call's; on a phone a second context started
mid-call re-negotiates the audio hardware, and the first context's
microphone reader went on at a rate that was no longer the hardware's. Now
a sample plays through the call's own context — the socket lane's audio
(`WsAudio.playSample`, through the far side's stream) or the tones'
context on the WebRTC lane — and a caller line that is only transcriber
markers (`[noise]`, `[inaudible]`, `…`) is dropped, not shown, not saved.

## "Again and again it closes by itself" — the line that drops, and the exits that left no trace (2026-09-08)

The 02:36 call's own metrics carry the answer: `net.offline` at 02:40:14
and `net.reconnect_ms 5051` — the phone's network was gone for five
seconds mid-call. The socket lane had no redial: a dropped socket sat in
"reconnecting" until the twenty-second deadline ended the call. The beacon
that would have said so was sent while the network was down and died with
it, so the log had nothing — for the fourth time that evening.

Fixed, as one mechanism rather than four patches:

- **Redial in place.** `VoiceSession.dialWs` is one dial; a socket that
  drops on a call that WAS up is redialled at once, then at 1.5 s, 3 s, 6 s
  (`WS_RECONNECT_DELAYS_MS`) for as long as the deadline allows — a new
  secret and socket, the same microphone, audio context and screen; the
  session is configured afresh and the server's history comes with it.
  Only a deadline with no socket open ends the call.
- **The microphone survives a lost line.** `fail("connection-lost")` on a
  call that was up keeps the stream (`takeMicrophone`); the button hands it
  to the resumed call, so the phone is asked for nothing outside a tap.
- **The pulse** (`lib/voice/call-memory.ts`): a live call writes its
  diagnostics to the device every 5 s; a hang-up clears it. The next load
  finds a pulse younger than 45 s nobody cleared, beacons `page-killed`
  with those diagnostics, and tells the caller to tap to continue.
- **Beacons wait for the network**: sent while `navigator.onLine` is false
  they queue on the device (10 at most) and go on `online` or next load,
  stamped with when they were made.
- **No socket storm under a call**: Discuss's realtime channel does not
  rejoin while `[data-kx-call-active]` is up; the call's end nudges it.
- The beacon carries `ws_reconnects` and the last socket close code.

## "Still a strange voice and noise while I am talking" (2026-09-08, later)

After the sample player moved into the call's context, the noise stayed.
The other contexts were the orb's meters: `useStreamLevel` opened its own
AudioContext over the microphone stream and another over the far stream,
beside the call's own — on the socket lane, two contexts on one live
microphone, and the phone garbles the second one's reader exactly while
the caller speaks. Now the socket lane's audio meters both sides inside
its own context (`WsAudio.levels`, two analysers), the session hands them
through (`VoiceSession.levels`), `useSessionLevels` polls them once a
frame, and the button gives the stream meters no stream on that lane. The
meter's arithmetic is one pure function (`rmsLevel`) shared by both. On
the WebRTC lane nothing changes: the browser carries that call's audio
itself and the stream meters are harmless there.

Contexts under a socket-lane call now: the call's own, the tones', and the
notification engine's. None reads the microphone but the call's.

## "Still connecting", and the caption's place (2026-09-08 03:40)

The route answered the socket-lane handshake in seconds (`POST
/api/ai/voice/ws-session 200` at 03:39:46); the answer never reached the
phone, and the handshake's ceiling was the mainland lane's fifty seconds —
the screen said "Still connecting" for as long as the owner waited. The
socket lane now waits fifteen (`WS_HANDSHAKE_TIMEOUT_MS`): its route mints
a secret and reads two tables, nothing that takes longer. After that the
existing fall-back to the mainland lane runs. A **Try again** control
appears with the slow-handshake caption: one tap beacons `retried`,
releases the call, moves a socket lane that never came up to the mainland
lane, and rebuilds with the words kept. The caption is a centred block that
wraps, with the dots inline after the last word (the flex row had left it
ragged with the dots stranded at the far right). Beacons now go by fetch,
whose failure is seen and queued; the beacon API is used only on a page on
its way out.

## "Still connecting again, Grok does not work, the voice cut after two minutes" (2026-09-08 05:52)

Four socket-lane handshakes from the owner's phone between 05:52 and 05:56,
and **not one reached our route**: the log has no `POST
/api/ai/voice/ws-session` after 03:43, while the SDP handshake, the
transcript writes and the beacons — seconds apart, on the same origin —
all arrived. The beacons said `service-unreachable … err="AbortError:
Fetch is aborted"` after fifteen seconds, then the fall-back to the
mainland lane's other region, which is the "still Qwen voice" the owner
heard with his VPN on. The one difference on the wire: this POST carried
nothing — no body, no content type — and so did the lane probe's.
Whatever sits between that phone and us (a tunnel's local proxy, a
middlebox) held or dropped the empty POSTs and passed the rest.

- The handshake and the probe now POST a JSON body (`voice`,
  `conversation`, `stt`; `{probe:true}`), and the route reads the fields
  from the body, else the query, after the gate and the budget, bounded,
  allow-listed downstream as before. `[ai.voice.ws] session … via=body|query
  probe=…` says which arrived.
- A **canary** beside a slow handshake: when the socket lane's POST has
  had no answer in four seconds, one small GET to `/api/version` runs
  beside it and its outcome rides in the failure beacon as `canary=`
  (status/time, `timeout`, `error`). "Our origin was unreachable" and
  "this one request went nowhere" are different faults; the beacons of
  05:52 could not tell them apart.
- The call that connected (mainland lane, other region, 88 s, hung up):
  four answers, three finished their audio, the fourth ended with
  `response.done` and nothing after it — the "voice cut". The histogram
  could not say whether the far side failed it, cut it short or cancelled
  it. `response.done` with a status other than `completed` is now one more
  histogram key (`response.done.failed`, `.incomplete`, `.cancelled`) and
  the far side's reason travels in the beacon as `respErr=`.
- The lane the voices GET names, when its answer arrives after the tap
  that started a call (the tap came three seconds after the page opened),
  no longer relabels the running call: it waits for the hang-up and sets
  the lane of the next call. At 05:53:02 a mainland call was beaconed as
  `lane=ws` for this reason, and Try again moved it "back" to the lane it
  was already on.

## "Still always like this", after #379 (2026-09-08 06:19–06:27)

With #379 live, the socket-lane handshakes **arrive** (`POST
/api/ai/voice/ws-session 200` at 06:21:40, 06:22:55, 06:23:08, 06:24:48).
What happened next, from the beacons:

- `retried elapsedMs=96793 ice=ws1 dc=open lastEvent=none lane=ws
  canary=timeout5002ms`: the socket to the vendor **opened** (readyState 1)
  and for ninety-six seconds not one event came down it, while the screen
  said "Still connecting" and the caller waited; the canary to our own
  origin timed out in the same seconds. A stalled tunnel keeps a
  connection "open" and moves nothing on it. The lane counted an open
  socket as the transport up (`markTransportUp` on `onopen`), so nothing
  ended the wait.
- The mainland lane's handshakes took 24–34 s on that network (`retried
  elapsedMs=34118 ice=new dc=connecting lane=rtc`) — "too long to connect".
- The call that worked (mainland lane, other region, 203 s) ended with
  `lastEvent=response.function_call_arguments.delta … toolCalls=0`: the
  far side began a tool call and never finished its arguments (33 s of
  silence after the caller's last turn). Vendor-side; the histogram now
  says so.

The change: **on the socket lane the transport is up when the far side has
spoken** — its first event — not when the socket says open
(`WS_FIRST_EVENT_MS` = 7 s). A first dial whose socket has said nothing by
then, or whose socket closes before a word, fails as `service-unreachable`,
and the button's existing fall-back to the mainland lane runs; the caller
is on a working call in seconds instead of staring at "Still connecting".
A redial's open socket is likewise the call back only on its first event.
The canary and `respErr` stay as they were.

## The vendor, opened from our own function (2026-09-08 06:47)

After #380 the same shape came from the owner's Mac, through the VPN
("Connected" in the menu bar): the handshake arrived (`POST ws-session
200` at 06:47:39 and 06:47:52), the socket opened, nothing came down it.
Two devices, one tunnel, one silence — and nothing of ours had ever
opened that socket from anywhere but a browser, so "the vendor is silent
for everyone" and "that path is a stalled tunnel" were the same log.

The watchdog now opens the socket lane from our own function every
fifteen minutes (`grok-probe.ts`, from Tokyo and Singapore): a secret is
minted with the real key, the socket is dialled exactly as a browser dials
it, and the line says whether the far side SPOKE — `[ai.voice.watch]
socket ok|fail verdict=spoke|silent|refused|no-secret afterMs= openMs=
first=<event type> close=<code>`. No audio is sent, no model answers; the
socket is closed on the first event. `spoke` from our function beside
`silent` from the owner's devices puts the fault on the path between those
devices and the vendor — which no client change can fix, and which the
fall-back now handles in seconds. `silent` from our function too would be
the vendor's, and the next thing to raise with them.

## The relay: the socket lane carried through our own domain (2026-09-08 07:10)

Owner: "go ahead with the Railway relay. but if we do this so qwen will
not be used at all??" — No: the relay changes the **path** of the socket
lane, not which lane a caller gets. The mainland lane stays the default
for mainland callers and the fall-back for everyone; both lanes' voices
stay in the picker.

`services/voice-relay/` is a small Node service (Railway, Singapore,
project `koleex-voice-relay`, domain
`voice-relay-production-2195.up.railway.app`). The browser opens ONE
socket to it; it opens the vendor's and carries text frames both ways.
What it refuses is the point:

- **No key.** The browser presents the short-lived client secret the
  route minted, in the subprotocol, exactly as it would to the vendor; the
  relay forwards that subprotocol upstream and the vendor authenticates it.
- **A ticket, or nothing.** `/api/ai/voice/ws-session` signs
  `exp.HMAC-SHA256(relaySecret, token.exp)` over the client secret
  (`signRelayTicket`, mirrored by the relay's `verifyTicket`,
  constant-time). Someone with their own vendor secret cannot use our
  relay; a ticket cannot be lent to another connection; it lives as long
  as the secret (ten minutes).
- **The upstream host is the relay's configuration**, never the client's;
  the client may name a model (allow-listed characters). Origins are
  suffix-matched to Koleex domains and Vercel previews. Text frames only,
  bounded; sessions capped at an hour; per-address and total connection
  caps; pings keep a border path alive; logs carry counts, durations and
  close codes, never a secret, a ticket or a frame.

Vercel side: `AI_VOICE_RELAY_URL` (wss) makes the route hand browsers the
relay's url with a ticket (`browserSocketUrl`; the log says
`socket=relay|direct`); `AI_VOICE_RELAY_SECRET` must equal the relay's
`VOICE_RELAY_SECRET`. Unset, browsers dial the vendor directly as before.
The watchdog probes the relay path beside the vendor's own (`[ai.voice.watch]
relay …`). The device's lane probe now waits for the far side's first event
(five seconds), not the socket's open.

## "Thinking, and no answer at all" (2026-09-08 07:06)

The call at 07:04 (mainland lane, other region, 290 s): the caller asked
the distance between two cities at 07:06:24; the far side's response
carried "one moment" and a tool call whose arguments finished at
07:07:05 — **forty-two seconds** of "thinking" — then our tool route
answered in a second and the answer was spoken at 07:07:13. The 06:26
call was the same shape and the caller hung up at thirty-three seconds.
The wait is on the far side, between the response's creation and the tool
call's arguments; nothing of ours runs in that window. Diagnostics now
carry `tool_wait_ms` (the longest such wait in a call) and the beacon logs
`toolWaitMs=`, so the next report is a number. An `error` event mid-call
(07:07:07, as the tool result and a barge-in crossed) is beaconed as
`config-rejected` — a misnomer to fix.

## The socket that opened and said nothing was OURS (2026-09-09 02:24)

The relay's first real session from the owner's phone, mainland China,
**no VPN**: the lane probe went phone → relay → vendor and heard the
vendor's first event in 815 ms (`session=5 upstream open openMs=417
down=3`, closed by the probe on its first frame). Four seconds later the
call: `session=6 upstream open openMs=409 … down=3 up=0`, closed by the
phone after 8.9 s. The vendor spoke three frames; the phone sent
**nothing** — not even the session configuration that goes out on `open`.

That is not a network. `createBrowserWsAudio` did `out.connect(farMeter)`
on a MediaStreamAudioDestinationNode, which has no outputs: IndexSizeError
in every browser, since the meters change of 2026-09-08 03:25 (#377). The
factory threw out of `dialWs` after the socket was created and before its
handlers were attached — the socket opened, the far side spoke, nothing
was heard, nothing was sent, the call sat in "connecting". Every "open
and silent" socket since (06:21 phone, 06:47 Mac, 07:03, 07:09, 02:24) was
this line. The Node fakes had a `connect` on the destination, so no suite
caught it; the suite's fake now refuses `connect` as a browser does.

- The far side plays through a GainNode bus; the bus feeds the destination
  and the meter. Nothing is connected from the destination.
- The audio factory is built inside a catch: a throw on the call's own dial
  is `handshake-failed` with the cause in the beacon, and the button's
  fall-back to the mainland lane runs; a redial's throw closes the socket.

What stays true: the socket-lane POSTs that never reached the route
(05:52–05:56) were the network, and the relay is still the right path from
the mainland — the probe proved phone → relay → vendor works without a
VPN. Beijing's 403 stays the key.

## The first real conversation through the relay — and two calls that sent nothing (2026-09-09 03:06–03:09)

After #386 the owner tested from the phone in mainland China. The relay's
log, by session:

| time (UTC) | what | relay line |
|---|---|---|
| 03:00:37 | page opened (lane probe) | `up=0 down=3 ms=903` |
| 03:06:19 | call, **through the VPN** | `up=158 down=37 ms=14549` — speech in, transcript, answer, voice out; the beacon shows `speech_started … response.output_audio.delta:10 … response.done` |
| 03:07:39 | page opened again (lane probe) | `up=0 down=3` |
| 03:08:59 | call, **no VPN** | `up=1 down=5 ms=13929` — the session configuration went up, then NOTHING; beacon `events=session.created,conversation.created,ping:2,session.updated` |
| 03:09:11 | call, **no VPN** | `up=1 down=4 ms=8632` — the same |

So the socket lane works end to end from the mainland (the 03:06 call is a
real conversation on it), and the two failing calls are NOT the network:
the socket opened through the relay in ~410 ms, the vendor accepted the
session, and the phone never sent one frame of microphone audio. The
beacon could not say why — reader never started, context suspended, track
muted or silent — and nothing about the network explains a microphone.

**What this change does (diagnosis, no behaviour change):**

- `ws-audio.ts` `stats()`: which reader took the microphone (`worklet` /
  `processor` / `none` / `failed`), how many frames it handed out, the
  loudest sample it saw (0..1), the context's state and sample rate. A
  script-processor start that throws is now `failed` in stats rather than
  an unhandled rejection.
- `session.ts` diagnostics: `up_frames` (frames actually sent on the
  socket), `capture` (`worklet:running:48000`), `mic_peak`, `mic`
  (`live:open:on` — the track's readyState, muted or open, enabled or off).
- The telemetry route prints ` upFrames= capture= micPeak= mic=` when a
  capture was reported.
- The two server lines that name the lane and the socket (`[ai.voice] lane=`
  and `[ai.voice.ws] session … socket=relay|direct`) were `console.log`, which
  the Vercel log tool never shows; they are `console.warn` now.

**Next read:** the owner's next no-VPN call. `capture=none` → the reader was
never started (onopen path); `…:suspended:…` → an AudioContext iOS would not
run (created too long after the tap); `mic=live:muted:on` → iOS muted the
track (another audio session took the microphone); `micPeak=0` with frames
counted → a silent track; `upFrames>0` with no `speech_started` → the
vendor's VAD never fired on what it received.

**"Not Grok voice" (the 03:06 call):** on the socket lane the vendor is
Grok by construction (`lane=ws`), and its audio came down
(`response.output_audio.delta:10`). The ws-session line — visible from now
on — will show which `voice=` key the call asked for and the vendor id it
resolved to; the picker offers the socket lane's own names (Ara, Eve, Rex,
Leo, Sal) once the device settles on that lane.

## The beacon answered: the reader starts, the context runs, the track is live — and nothing is read (2026-09-10 17:22)

The owner's calls after #387, from the phone in mainland China:

| time (UTC) | VPN | upFrames | capture | micPeak | mic | outcome |
|---|---|---|---|---|---|---|
| 17:21:57 | on | 1512 | worklet:running:48000 | 1.0 | live:open:on | 136 s, six turns, two lookups |
| 17:22:32 | off | 0 | worklet:running:48000 | 0 | live:open:on | 13 s, configured, nothing sent |
| 17:22:46 | off | 0 | worklet:running:48000 | 0 | live:open:on | 10 s, the same (fresh page) |

So without the VPN the worklet reader is started, the AudioContext reports
`running` (at hang-up), the microphone track is `live`, not muted and
enabled — and the worklet posts NOTHING. The relay confirms (`up=1`: the
session configuration only). The network is not in this path: the socket is
open and pinging, and the reader is local.

Two readings remain, and this change separates them and acts on both:

- **The context was suspended for the whole call and only the hang-up tap
  resumed it** (`ctx` is sampled at hang-up). `stats().start` now records
  the state right after the reader started and `resume()` came back; the
  beacon carries it as `:s<state>`.
- **The engine delivers nothing to this worklet on this context.** After
  `CAPTURE_STALL_MS` (2.5 s) with zero frames, the reader resumes the context
  once more and hands the microphone to the script processor — a different
  engine path on the same context and track. A processor that is silent
  too is `:stalled` in the beacon, and nothing local can fix that.

Beacon format: `capture=worklet:running:48000:f1512:srunning` (reader,
state at hang-up, rate, frames read, state at start), with
`processor-after-stall` as the reader when the switch happened and
`:stalled` when both were silent.

**Next read:** `processor-after-stall` with `f>0` means the worklet is the
broken piece on that phone without a VPN and the switch is the fix;
`:ssuspended` means the context never ran — the fix is then to keep the
context created inside the tap (before the handshake), not after it;
`:stalled` with the track live means the OS delivers silence to the page
and the microphone must be re-acquired.

## The mainland endpoint answers Singapore, not Tokyo — the handshake moves (2026-09-11 08:20–08:47)

With the China account's key and workspace in place, the first no-VPN call
from the phone (08:20:50):

| step | where | result |
|---|---|---|
| handshake attempt 1, slot=primary (Beijing) | hnd1 | `UND_ERR_CONNECT_TIMEOUT` after 10.3 s |
| handshake attempt 2, slot=primary | hnd1 | `TimeoutError` after 3.0 s |
| hand-over to slot=alt (international) | hnd1 | call up; 101 s, four turns |
| watchdog, slot=primary | sin1 08:22:33 | no fail line — reached (the ok line was still info-level) |
| watchdog, slot=primary | hnd1 08:30:35 | `UND_ERR_CONNECT_TIMEOUT` after 10.5 s |

The new workspace host resolves to the same two A records as the old one
(47.94.20.201, 101.201.58.201), so this is not DNS; the old host answered
Tokyo with a 403 in ~420 ms fifteen minutes earlier. From Tokyo the socket
to the new host does not open; from Singapore it does. The caller paid the
thirteen seconds of "Still connecting" on the primary that never answered,
then talked to the alternate region — which works, but carries the media
out of the country.

**Change:** `vercel.json` pins `src/app/api/ai/voice/session/route.ts` to
`sin1`. Only the SDP handshake moves; the media path is phone → vendor and
never touches our function. The project default stays `hnd1`, and both
watchdogs keep measuring both regions, so a reversal is read from the same
log as this move. The suite's region assertions are inverted again, with
the numbers above beside the earlier Hong Kong numbers — the file's own
rule: read the numbers first.

**Owner's directive:** "go ahead and move it to Singapore."

**Still open:** the socket lane's silent worklet on the phone without a
VPN (#388's stall watchdog is live; no beacon from a no-VPN socket-lane
call since, because the mainland lane now serves those calls).

## Both lanes' voices in one picker, and a verdict that is not a lock (2026-09-11 09:05)

After the Singapore pin the mainland lane served the phone directly:
`handshake ok attempt=1/2 slot=primary from=sin1 afterMs=408 / 482 / 427`
(09:01–09:02, three calls, one with a lookup). Then the owner: "with VPN
and without VPN is only [the mainland] voice, there is no [socket-lane]
voice at all." Two causes, both in the client:

1. **A fresh verdict was a lock.** `decideLane` returned `probe: false` for
   any device verdict younger than six hours. The 08:20 probe had failed
   (the relay saw no session — the phone did not reach it at that moment),
   "mainland" was saved, and for six hours no probe ran — a VPN switched
   on inside the window changed nothing. Now the verdict is only where the
   next tap goes, with no wait; the probe runs on every open and moves the
   lane when the network has moved.
2. **The sheet had no way to ask for the other line.** The first cut of
   this change merged both lanes' voices into one picker, tagged by lane —
   and the Mac showed ONE row (09:35): the voice names are the PRODUCT'S on
   both lines (`v1…v5`, Nour/Layla/Omar/Adam/Sara), a different vendor id
   behind each per line (`[ai.voice.ws] session voice=v1 vendor=Ara`), so
   the keys collided and a voice could never name a line. The line is its
   own control now: two pills in the voice sheet under "Line" — "Mainland
   line" / "International line", never a vendor — drawn only when both
   lines have voices, the current one pressed. Choosing a line moves the
   next call there, saves the choice as the device's verdict, re-arms the
   one fall-back, offers that line's voices (the same names; the current
   one kept), and rebuilds a running call with the words kept. When the
   international line does not answer, the call falls back to the mainland
   line as before, the sheet's pill follows, and the screen says so once:
   "The international line can't be reached from your network right now —
   continuing on the mainland line."

Suite section 37; mutation: restoring the six-hour lock fails 2, dropping
the lane save in selectLane fails 1.

**The Mac, VPN on, 09:34 — what the note was for:** the international line
was chosen (server: `lane=ws country=US`), the ws-session answered, and the
socket never opened: `service-unreachable … err="AbortError: Fetch is
aborted" canary=timeout5001ms` — our own host did not answer the Mac's
canary in five seconds either; the VPN's path to our servers was the
problem, not the vendor's. The call fell back, the mainland line answered
from Singapore in 120–430 ms, the note showed, and a later international
call at 09:36 went through the relay.

**Billing, the same hour:** the vendor's SMS — the China account's balance
is −0.04 yuan. The mainland lane bills THAT account (the international
region bills the other one). The owner recharges the China account; until
then a refused mainland handshake falls over to the alternate region as
designed, and the watchdog's `slot=primary` line will say `credential=refused`
the moment the vendor enforces the arrears.

## Owner-side (not code)

- 2026-09-08 19:30 UTC: the owner added `AI_VOICE_RELAY_URL` and
  `AI_VOICE_RELAY_SECRET` to Vercel Production. A production deployment
  made after that moment carries them; the watchdog's `relay` line is the
  proof (`[ai.voice.watch] relay ok verdict=spoke …`).
- The mainland lane's `403 AccessDenied.Unpurchased` on Beijing: the model
  (`qwen3.5-omni-plus-realtime`) shows a full free quota in the owner's
  Model Studio account, so the refusal is the KEY, not the model — the
  vendor's error code means the Bailian service is not activated for the
  account the key belongs to, and realtime calls must come from the
  default workspace. Fix: a new API key from the default workspace of the
  China-site account, into `AI_VOICE_API_KEY`, then a production redeploy.
- 2026-09-11 08:12 UTC: the 403 was a WORKSPACE MISMATCH, not a quota. The
  China-site account's default workspace is `ws-ajesekz9dt6z6sal` (its
  API-Key page shows the workspace-specific domain), and it had NO API key;
  `AI_VOICE_BASE_URL` pointed at `ws-pl9r1rv87m0hqnl5`, another account's
  workspace, with a key issued elsewhere. The owner created a key in the
  default workspace and set `AI_VOICE_API_KEY` and
  `AI_VOICE_BASE_URL=https://ws-ajesekz9dt6z6sal.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime`
  in Vercel Production. This commit exists to make the production
  deployment that carries them; the watchdog's `slot=primary` line is the
  proof (`ok` instead of `403`).
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

## Deep check, 2026-09-11 evening — one call, three faults

Owner, 17:40 UTC: "suddenly the voice conversation stop and the voice not
so stable, some sentence is cut and some sentences repeated." Read from the
saved rows of conversation `49fe6010…` (17:32–17:35 UTC), the relay's log
(session 514: 202 s, `client-closed code=1006`, 2375 frames up / 541 down),
the `page-killed` beacon the next page sent, and the Vercel request log.

| What the owner heard | What the evidence says | Fixed |
|---|---|---|
| **Repeated sentences** — the brief, then "and nothing in the schedule either", then "nothing planned either"; the owner asked why it repeats and it apologised | `response.created:15` for 8 caller turns. "Today's brief" makes the model call THREE lookups in one response; each result went back followed by its own `response.create`, so the far side was asked to speak three times. | Yes — the session reads every function call off `response.done` and sends ONE `response.create` when the last output of that response is in (`responseFunctionCalls`, `noteToolOutputSent`); an output whose `response.done` never comes still gets one request after 1.2 s |
| **Cut sentences in the thread** — "قوللي الـ...", "حاجة أنا بجر...", "أنا عايزك ت..." as rows, each followed by the fuller hearing | `input_audio_transcription.completed:70` and `.updated:54` for `speech_started:8`: the socket lane's vendor transcribes a turn several times over, settled each time, under ONE `item_id`. The prefix rule merged only the adjacent case; a re-hearing that changed an early word, or landed after the far side's filler, became its own row — and the first hearing was already saved | Yes — a caller's line is keyed on its item: any later hearing replaces it where it stands (`appendTranscript`, `ITEM_LOOKBACK`); `.updated` is read as the live caption it is; a line already written is **corrected** in its row (`PATCH /api/ai/voice/transcript`, same gate, budget and ownership; only a `source='voice'` row of that conversation) and the bubble updates in place |
| **The call stopped** | 17:35:33 the answer with two web pictures was saved; 17:35:35 a full document load of `/ai` on the SAME build (no 404s, no stale-bundle heal — the page had loaded fresh at 17:31:48); no `page-hidden` beacon (a reload fires `pagehide`); the pulse reported `page-killed` with `lastEvent=response.output_audio.delta`. That is the shape of the phone's WebKit process dying under the page and Safari reloading it, not of anything this code did. The same shape as 2026-09-07 17:33 and 18:03, both also right after pictures | Not fixable from a page. Pictures already come resized through `/api/ai/image` (2026-09-07); the audio graph is one context. What remains is memory the page cannot see. Kept: the next load names it and tells the caller |
| **"Not so stable"** | The Discuss realtime channel on the owner's other device flapped `CLOSED/reconnect` seven times between 17:35:02 and 17:35:53 — the local link was unsteady in the same minute. The socket lane's jitter buffer adapts up to 0.8 s | Nothing to change blind; the buffer is the right tool for a link like that |
| **"Still a glitch"** (19:06 UTC, after #404) | The model spoke the pictures' markdown: "! (exhibitorsearch.messefrankfurt.com)" twice, read aloud — the call's search envelope carried the text lane's picture URLs and markdown rule. The same call died at 19:06:45, right after that pictures answer (the third such death; #405's quiet-page mitigation was not yet live) | Yes — `forVoice` hands the model the pictures' count and each result's site name, never a URL, with a note written for speech; the beacon histogram leads with the notable keys |
| **"Still too many problems and still the voice has a glitch"** (2026-09-12 04:14 UTC, 163 s, socket lane through the relay, hung up cleanly, no reconnect) | Two things, both in the evidence. (1) The owner asked for a picture of the most expensive watch; the model said "the pictures on your screen…", the owner: "ما فيش صور على الشاشة". Since #406 the call screen read its pictures out of the SPOKEN envelope — which #406 had just stripped of `images` so a voice never reads a URL — so every web picture on a call showed nothing while the model, told `pictures_on_screen: 4`, described them. (2) The relay the socket lane runs through was in **Amsterdam** (`ams` in the service's region config; the README said Singapore): every audio frame from China crossed to Europe and back before the vendor — the jitter the owner hears as a glitch on this lane | Yes — the tool route sends the screen its own `pictures` list beside the model's envelope (client reads it first); `railway.json` pins the relay to Singapore (`asia-southeast1-eqsg3a`) so the region cannot drift; the canary's separator no longer vanishes in the beacon (`200:1397ms`, was read as `2001397ms`) |
| **"The voice is not clean — pulses while Koleex AI talks, on both lines"** (2026-09-12 09:46 UTC call, both lanes tried; and the 05:35 call) | Two mechanisms, one per lane, both in our own playback path. Socket lane: every frame of the far side's voice became its own 24 kHz `AudioBuffer` inside a 48 kHz `AudioContext`, and the engine resampled each buffer on its own — a discontinuity at every frame boundary, ~20 a second. Mainland lane: the orb's far-side meter ran the remote WebRTC track through a second `AudioContext` while the `<audio>` element played it, a known source of clicks and garbling on Safari. Also in the 05:35 call: the client side of the relay socket vanished (1006) at ~30 s intervals — 12.9 / 28.7 / 27.9 s — on a Japan-exit path, while the 04:14 call on a US exit had none in 153 s: a network-path cut, not the relay | Yes — the socket lane's context is created at the wire's rate (`new AudioContext({ sampleRate })`, default as fallback), so frames play as one continuous signal; the mainland far meter reads `RTCRtpReceiver.getSynchronizationSources().audioLevel` (`session.farLevel`, `useReceiverLevel`) and nothing but the element touches the voice; the lane is labelled "China (Mainland) line". Open: the ~30 s cuts are the owner's network path (isolating test asked for); the duplicated saved line at a redial |

## Deep check, 2026-09-12 — three reviews, one batch

Owner: "I think now it works fine but again use your skills to make a deep
check to find any problem, any issue or any bug to fix it, and check deeply
for anything in UI/UX to improve." Three independent reviews (security, UI/UX,
bug hunt) over the voice client, the relay, the agent route and the chat
client; what each found and what changed, in one PR.

| Found | Where | Fixed |
|---|---|---|
| **The 05:36 duplicate** (a saved line twice at a redial) | The writer of the dying call was overwritten with its last turn still queued; the resumed call's writer counted the FINAL lines on screen, one fewer than where the old writer had stopped when an unfinished answer sat behind the conversation — so the turn after it was written again | Yes — the cut answer is closed and written by the dying call's writer, which finishes first; the next writer is seeded from where it stopped (`TranscriptPersister.settled`, `resumeSettledRef`); pinned with the exact line shape |
| The answer in flight at a drop stayed open across the redial | The redialled call's first answer was glued onto the cut one | Yes — `reconnecting` closes the open assistant line and writes it |
| A late `done` of a cut answer made a second row of it | The mainland lane's channel can come back after the line was settled | Yes — an assistant final that begins with the settled answer replaces it (`appendTranscript`) |
| A busy server (429) counted as a strike; three ended the call's persistence | `TranscriptPersister` | Yes — a 429 waits for the next turn or the drain; a real failure still strikes |
| A write with no deadline hung the hang-up drain | `TranscriptPersister` | Yes — 12 s deadline; and a repeat of a batch that landed is echoed by the route, not written again (whole batch against the newest rows, same tenant, 2 min) |
| Corrections keyed by slot PATCHed another turn's words after a withdrawn line shifted the list | `TranscriptPersister` | Yes — corrections follow the line's item id; a line without one is only compared with the same speaker in the same slot |
| A redial refused with 429 was redialled again on the backoff, spending the budget it had just run out of | `VoiceSession.dialWs` | Yes — 401/403 end the call; 429 honours a short `Retry-After` as the next redial's delay, else ends the call with the reason on screen |
| A fast lane that returned nothing sent an empty reply | `/api/ai/agent` | Yes — `null`, so the turn falls through to the orchestrator |
| Relay: the client address was the first `X-Forwarded-For` hop (spoofable); no cap per ticket; the pending queue unbounded | `services/voice-relay` | Yes — last hop, `MAX_PER_TICKET` 3, `MAX_PENDING_BYTES` 2 MiB; origins env set on Railway (applies on the next deploy) |
| History reads were not scoped to the tenant; the general lane's web search had no budget | agent route, `search_web` | Yes — tenant predicate on both selects; per-account and per-tenant-day search budgets |
| UI: Arabic letter-spacing, a #666666 placeholder, physical `left/right` in the lightbox, no focus ring on the call screen, the settings button without a name, spinners under reduced motion, Escape ending the call from the chat view, no mark on a reply the caller stopped, a silent gap before the call summary | chat + call screens | Yes — all applied; "Stopped" mark on a cut-short reply; "Writing the call summary…" row (en/zh/ar) between hang-up and the summary |

## The sound system (2026-09-12)

Owner: "make a sound system for the Koleex AI app — connected, cancel,
error, thinking". Thirty moments were listed and offered as a synthesised
family first; the owner then chose the public-domain **glass** cue set
(UI SFX, CC0 audio) and picked a cue per moment on a listening page.

- `src/lib/sounds/catalog.ts` — the 30 moments, each naming its recording
  (`/sounds/ai/<moment>.mp3`, served from this origin so it works from
  mainland China) and keeping synthesised notes as the fallback. Defaults:
  everything on except message-sent, reply-received, copied (the owner's
  "no sound") and thinking.
- `src/lib/sounds/player.ts` — `playSound(key)` through the Hub's one
  engine (`lib/notificationSound`): master switch, the Koleex AI switch,
  and per-moment switches (`prefs.ai`), never do-not-disturb; one cue at a
  time per moment; the notes only when there is no engine.
- Settings → Sounds gains a "Koleex AI" card and one card per group: tap a
  name to hear it, the switch keeps or silences the moment.
- Provenance: `public/sounds/ai/NOTICE.txt` (CC0 1.0, original cue names).
- Round two (the seven the owner marked "change"): hold-to-talk start → hover,
  thinking → streaming, pictures shown → expand, summary written → checkout,
  back online → redo, dictation sent → check, approval needed →
  double-click. All thirty are the owner's picks now.

## "Not clean, glitches and cuts, on both lines" (2026-09-12 16:53–17:00 UTC)

Three calls after the sound system shipped, read from the beacons, the relay
log and the saved turns.

| Call | What the evidence says | Change |
|---|---|---|
| 16:53 `4fa72f0ae1`, **China (Mainland) line**, 131 s, hung up cleanly, `ice=connected`, no drop | The handshake to the mainland region timed out twice (`UND_ERR_CONNECT_TIMEOUT` 10.5 s, then 3 s) and the call was served from the alternate region after 13.5 s. No connection drop in the call itself, so what was heard is packet loss on the path, not a cut line — and the beacon could not yet say how much | The offer now asks for **Opus in-band FEC** (`withOpusFec`), so a lost packet is rebuilt from the next; the hang-up beacon carries **inbound stats** (`rtc=recv= lost= jitter= conc=`, sampled every 5 s) so the next call says how lossy the path was |
| 16:56 `82f2124765`, international line, **US exit**, 40 s | Zero cuts; relay session 14 ended cleanly at 37 s | Nothing — this path works, as on 2026-09-12 04:14 (153 s, zero cuts) |
| 16:58 `84ace574a1`, international line, **Japan exit**, 140 s, `wsReconnects=5`, `wsClose=1006` | Relay sessions 15–19: `client-closed 1006` at 3.0 / 28.9 / 29.2 / 28.3 / 32.9 s — the ~30 s cut of the 05:35 call again, on the same exit; the US exit has never shown it. Each redial opened a **new** far-side session: configured again, context gone, the answer in flight lost — that is the "cuts" heard | The relay **parks** the far side for 12 s when a client vanishes abnormally and the first redial **resumes** it with the same secret (`resume=1`, hello `koleex.relay resumed:true`): no second configuration, the held frames delivered, the conversation continues. The path still cuts every 30 s; the call no longer restarts with it |
| The sounds | "Too many" | Defaults cut to the five a caller must not miss: ready, line back, ended, failed, error. The rest stay in Settings → Sounds, off |

Still the owner's to check: the ~30 s cut does not happen on the US exit; the
network path is the difference, and a resume hides it rather than removes it.

## "Crackling while it talks; it swallows the last letter and says it when the result comes" (2026-09-12, after #416)

The owner is on the international (socket) line with and without a VPN, so
the socket lane's own playback path is the suspect — and it had three faults
that fit the words exactly:

| Heard | Cause in `ws-audio.ts` | Change |
|---|---|---|
| Crackling, ~20 clicks a second while the voice plays | Each frame's start time was `previous + duration` in floating point; over a few hundred frames the starts drifted a fraction of a sample from the true boundary — a gap or an overlap at every joint | Starts are counted in **whole samples** from the run's origin (`JitterDeps.rate`); every boundary lands on a sample |
| Cuts mid-sentence | A frame arriving even 1 ms after the run drained stopped the sentence and gathered a whole new lead (a third of a second of silence), then resumed | A frame less than **120 ms** late continues the run from now (`LATE_GRACE_S`); the lead still grows for the next run. The lead itself starts at **450 ms** (was 300), grows by 150 and caps at 1.2 s |
| The last letter missing, said when the next answer comes | The tail of an answer that arrived after a drain was gathered and waited for the 350 ms timer; if the model's tool call and the next answer came first, the tail played glued to it | `response.output_audio.done` / `response.audio.done` / `response.done` release the buffer at once (`WsAudio.endOfResponse`) |

## "Nothing fixed, everything is the same" (2026-09-12 17:37–17:39 UTC, after #417)

The beacon of the 17:37 call (`7015f6547e`, 84 s, socket lane, production
deployment of #417) read `capture=…:u0:b450`: **zero** buffer underruns at
a 450 ms lead, and the relay session ran 81 s with no cut. So the jitter
buffer was never the crackle. What remained on the playback path, and is
now gone:

| | Before | Now |
|---|---|---|
| Output | The far side rendered into a `MediaStreamAudioDestinationNode`, its stream played by the call button's `<audio>` element: a second clock domain and a second buffer, a known source of clicks on Apple's engine | The far bus connects to the context's destination; the element gets a stream that carries nothing (the button's wiring stands); the barge-in gate is a gain on the bus (`WsAudio.mute`, `session.setFarMuted`) |
| Context rate | The wire's 24 kHz (since #412), against 48 kHz hardware — the engine resampled the whole output | The engine's own rate; the 24 kHz wire is bridged by **one continuous resampler per direction** (`StreamResampler`: carries its position and last sample from frame to frame, so joints are seamless; the morning's per-buffer resampling forgot the previous frame at every joint) |
| Frame starts | Counted in whole samples from `duration` | Counted from the exact resampled length (`JitterFrame.samples`) |

If the crackle survives this too, the next suspect is outside the page: the
device's output route (Bluetooth/receiver) or the far side's own stream.

## "Nothing fixed, everything is the same" — the fourth time (2026-09-12 18:08–18:10 UTC, after #418)

Two calls, both on production with #418 live (Vercel READY 17:51, merge
commit `0e4c2f8`):

| Call | Lane | What the beacon read |
|---|---|---|
| `b412f0fed8`, 18:08:35 → voice switched at 34 s | mainland (rtc) | `rtc=recv219 lost5 jitter10 conc47394` — of ~220 packets, 5 lost, 10 ms jitter, and **47 394 concealed samples** (≈1 s of audio the decoder had to invent, with `jitterBufferTarget` already at 400 ms) |
| `3aae46dc11`, 18:09:17 → 18:10:27 (78 s) | international (ws) | `capture=worklet:running:48000:f859:srunning:u2:b750` — the engine's rate is **48000**, so the #418 build was running; 2 underruns, the lead grew to 750 ms; relay session 12: 74 s, `up=865 down=193`, no cut |

So #418 was live and the crackle survived it. Looking at what every attempt
since #412 shared: each frame of the far side became its own
`AudioBufferSourceNode`, started at a computed time — at the wire's rate, at
the engine's rate, through a stream, straight to the destination. A start
time is honoured by the engine's scheduler; on some engines to the render
quantum, not the sample. Two hundred starts a minute are two hundred seams.

**Now (this PR): the far side is one continuous stream.** Its samples go
into a ring on the audio thread (`PLAYOUT_WORKLET_SOURCE`, an
`AudioWorkletProcessor`; the script processor with the same `PcmRing` where
there is no worklet) and the engine pulls from the ring every quantum —
there is nothing to seam. The ring reports the moment it runs dry and holds.
`PlayoutGate` on the main thread decides when it may play: gather 450 ms of
an answer (or 350 ms of waiting, or the answer's end), then open; a dry
ring inside an answer is an underrun — the lead grows a step and the ring
gathers again, waiting for the *grown* lead this time (the old queue's
350 ms wait let frames out before the lead was rebuilt, so its growth
bought nothing); a dry ring after the answer's end is the answer over. The
beacon's capture string gains `:o<worklet|processor|pending|failed>`.

**And the relay now measures the vendor's own pacing** (`createPacing`,
end line `deltas= audioMs= gaps= maxGap= minAhead=`): whether the far
side's stream stalls is read where no tunnel and no phone is in the way. If
`minAhead` reads hundreds of ms negative, the cuts are the vendor's stream
and the only client answer is a longer lead; if it reads near zero while
the beacon still counts underruns, the cuts are on the path from Singapore
to the phone.

What this cannot fix: the mainland lane's concealment is the decoder's own
(the browser's WebRTC stack, packets from the vendor's media server);
FEC is on and the receiver holds 400 ms. The next question for the owner,
if the crackle survives this too, is the device's output route — phone
speaker, wired, or Bluetooth (a Bluetooth headset with the microphone open
falls to the low-rate hands-free profile on every phone; that sounds
"not clean" on both lanes and no page can change it).

## The relay's first pacing readings, and three owner asks (2026-09-13 05:08–05:19 UTC)

Three socket-lane calls on production with #419 live (`:oworklet` in every
beacon — the ring is what played):

| Relay session | Length | deltas | audio | gaps > 250 ms | longest gap | minAhead | Client beacon |
|---|---|---|---|---|---|---|---|
| 18 | 32 s | 36 | 25.9 s | 10 | 1 183 ms | **−525 ms** | `u1:b600` |
| 21 | 19 s | 19 | 10.3 s | 5 | 959 ms | −148 ms | (page killed) |
| 23 | 58 s | 36 | 32.5 s | 13 | 1 354 ms | −129 ms | `u4:b1050` |

**The far side's own stream stalls.** Its frames are 700–900 ms of audio
each, and the silences between two frames of one answer reach 1.35 s: the
audio runs up to half a second behind real time even before it leaves
Singapore. That is the cut the caller hears — and a lead of 450 ms cannot
cover a 1.35 s silence. Session 23's four underruns against a relay-side
deficit of only 129 ms say the Singapore → phone path adds jitter of its own.

**The crackle is not the seams.** The ring was live and the caller heard the
same, so the last client-side candidate is gone. The relay now reads the
sound itself: `clicks=` (jumps between neighbouring samples no voice makes),
`edges=` (such jumps at the joint of two frames of one answer), `peak=`,
`clip=`. If the vendor's PCM carries clicks at its own frame joints, the
next readings say so; if it reads clean, the crackle is made on the device
(the output route — a Bluetooth headset with the microphone open falls to
the hands-free profile on every phone).

**"Connecting is too slow."** Calls `3b3f58a895` (05:08) and `9667fc037f`
(05:15): our route answered the handshake POST in ~2 s (server log 200), the
answer never reached the phone, the canary GET to our own origin timed out —
the tunnel was dead for those seconds — and the caller watched "connecting"
for 17 and 20 s until the fifteen-second deadline let the fall-back lane run.

### This PR

- **A lead the device learns.** The socket lane starts at the lead the last
  call settled on (`koleex-voice-lead-ms`); a call that never ran dry hands
  back one step. The first call on a path pays the cuts once.
- **A dead origin ends the wait.** The canary is armed at 2.5 s with a 3.5 s
  deadline, and its timeout or error ABORTS the handshake as a timeout: the
  call fails as service-unreachable and the fall-back runs within ~6 s of
  the tap instead of 15–20.
- **The relay reads the sound** (`clicks= edges= peak= clip=`).
- **The app opens on a new chat** (owner: "the ChatGPT way"). The remembered
  last chat is gone; the sidebar holds the history; `?c=` and the
  interrupted-call chip still open the chat they name.
- **One look from loader to app**: the root fades in over 220 ms, the aurora
  canvas over 600 ms, opacity only, nothing under reduced motion.

What this cannot fix: the vendor's pacing itself. A lead that covers a
1.35 s silence is a lead of 1.35 s — the device learns it where the path
needs it, and gives it back where it does not.

## "I listen from the phone speaker, no external device" — one audio context per call (2026-09-13)

With Bluetooth ruled out, the count of AudioContexts alive under the live
microphone was taken. On the socket lane there were THREE: the call's tones
(`CallTones`, opened in the tap), the Hub's sound engine
(`notificationSound`, opened for the cues that shipped 2026-09-12 — the day
the "not clean, glitches" reports began), and the voice itself
(`createBrowserWsAudio`). Two on the mainland lane. The codebase already
recorded what a second context does on a phone (ws-audio.ts playSample,
2026-09-07: it re-negotiates the audio hardware under the live microphone;
the far side transcribed "[noise]"). The crackle survived four playback
redesigns because none of them touched this.

Now:
- The tones open no context on the socket lane (the voice has one); on the
  mainland lane the tones' context is the call's one.
- The call's cues go through the call's own context by a SINK
  (`sounds/player.ts setCueSink`): the voice's `WsAudio.playCue` first, the
  tones' context second; before the call has a context (the tap's dialling
  cue) the Hub engine still plays.
- The Hub engine is HELD from live to release (`holdSoundEngine`): its
  context is suspended and nothing creates or resumes it; Hub chimes during
  a call are dropped, as a phone drops them during a phone call.

So during a live call exactly one AudioContext runs. If the crackle
survives this, the relay's `clicks=`/`edges=`/`clip=` readings decide
between the vendor's audio and the device.

## "The iPad is much better; the Chinese line on the iPad is totally fine" (2026-09-13 06:12–06:20 UTC)

Three facts from this window, in order of weight:

1. **The far side's audio is clean.** The relay's new meter on two socket-lane
   calls (sessions 5 and 8): `clicks=0 edges=0 clip=0 peak=61`, `peak=59`.
   No click, no clipped sample, no seam at any frame joint. Whatever the
   iPhone hears was made after Singapore.
2. **The iPhone runs dry where the relay does not.** Session 8 (82 s):
   `gaps=13 maxGap=1598 minAhead=-25` at the relay — the far side stalls up
   to 1.6 s between frames but, counted from an answer's first frame, is
   only 25 ms behind real time. The same call's beacon: `u13:b1200` —
   thirteen underruns with the lead at its 1.2 s ceiling. An iPad on the
   same account does not cut. Either the path Singapore → phone adds more
   than a second of jitter the tablet's path does not, or the phone's main
   thread stalls and cannot feed the ring. The beacon now tells them apart:
   `:g<ms>` (the longest gap between frames of one answer AS THEY REACH THE
   PAGE — against the relay's maxGap) and `:m<ms>` (the main thread's worst
   stall, a 250 ms timer's lateness); the mainland string gains `sconc=`
   (concealment that was silence) and `jbd=` (the receiver's hold) and
   `stall=`.
3. **"Connecting" was the server, seven times over.** Every mainland
   handshake from sin1 between 06:12 and 06:18 spent 10 s on a connect
   timeout to the cn-north endpoint, 3 s on a retry of the same endpoint,
   and then got the alt region in under 200 ms — `first=primary` each time,
   because the browser's saved hint ("primary served me at 06:12:09")
   outranked the server's memory of it failing since. Meanwhile the socket
   lane's origin was unreachable from the phone (canary timeout at 3.5 s —
   the new abort worked: 6.7–9.6 s instead of 17–20), and the fall-backs and
   "Try again" taps ran the account's six-starts-a-minute budget out:
   `ratelimit account count=10 max=6`, "Too many calls started".

### This PR

- **A failed region goes last for ten minutes** (`lastFailed`,
  `orderRegionSlots(..., failed)`), whatever the hint says.
- **A dead path is not sampled twice**: a connect timeout, a refused
  connection or an unresolved name leaves the region for the other one at
  once (`continue regions`), and the first attempt is 7 s, not 13.
  Worst case on a dead primary: ~7 s once, then ~1 s.
- **Twelve starts a minute**, not six: a fall-back and a "Try again" are
  starts too.
- **The aurora rests while a call is up** (`kx-call-live` → the canvas loop
  stops; `kx-call-ended` → it resumes): the heaviest thing on the page gives
  the phone its headroom back.
- **The AI app is warmed on Home** (prefetch tier A, gated on Save-Data, a
  slow link, a hidden tab, offline): the loading screen the owner sees is
  its chunk downloading on the tap.
- **The meters above**, so the next iPhone call says path or page.

## Three owner asks, same evening (2026-09-13)

- **"Remove the sound of listening."** The `call-ready` cue ("ready to hear
  you") is off by default; it stays in Settings → Sounds. Four cues remain on:
  line back, ended, failed, error.
- **"When it is thinking or getting something from the internet, its talking
  cuts at the last letter, then continues the rest of the sentence when the
  result shows."** The spoken filler the instructions asked for before a
  lookup WAS the cut: the far side stops its own voice the instant it emits a
  tool call, mid-word, and finishes the sentence after the result. The rule
  is now the opposite: no words in the turn that calls a tool; the tool goes
  first, in silence, and the whole answer follows in one breath. The orb
  shows "thinking" meanwhile (and the `thinking` cue is there for anyone who
  turns it on).
- **"The Chinese voice is louder; the international one is low."** The
  mainland lane plays through a media element, the socket lane through the
  audio graph, which a phone in a call session plays quieter. The socket
  lane's far bus now carries a 1.6× lift (`FAR_GAIN`; the relay measured the
  far side's peaks at ~60 % of full scale) into a compressor set as a
  limiter (−6 dB threshold, 12:1), so the rare peak is caught rather than
  clipped. Cues divide the lift out and keep their own volume.

## "Check the difference of the photos — this is what happens while it loads" (2026-09-13)

Two screenshots of the same second. In the first: no emoji button, no Speak
pill, the globe further left, the orb higher. In the second: both controls
in place, the globe moved right, the orb lower. Two causes:

- The lazy controls' placeholders were not their shapes: a 36 px square for
  a ~90 px pill, a 32 px square for a 40 px button. When the code landed, the
  composer's row re-laid itself. Now the placeholders ARE the shapes — the
  pill's height, padding, icon and colour with a blank where the word goes;
  the emoji button's 40 px. The row does not move when the code does.
- The orb's one-shot hello (a transform hop) fired at 350 ms, while the
  root was still fading in and the controls still arriving — it read as
  part of a glitch. It waits 900 ms now, past all of that.

## "Try again" — the thirty-second cut, left before it comes (2026-09-13 07:42 UTC)

The owner's word after #424 was "Try again". No new symptom; the same
international-line cut. The evidence of the hour, read together:

- Relay session 14 (06:45:26–06:50:02 UTC, the owner's international call,
  273 s): `parked` at 28.9 / 59.7 / 90.6 / 121.5 / 152.4 / 183.2 / 214.1 /
  245.0 s — eight cuts, **thirty seconds apart to the second**, on a
  Singapore exit (the GET said SG) as on the Japan exit of 09-12. Each
  `resumed gapMs=` 397–834, `held=` 0–3. End line `resumes=8 clicks=4`.
- The client's beacon for the same call: `wsReconnects=8 wsClose=1006
  capture=…:u10:b1200:oworklet:g14880:m635`. Ten underruns with the lead at
  its ceiling: one per cut, near enough. The relay's own pacing was fine
  (`minAhead=-770` at worst, inside one answer). The path cuts the socket;
  the resume mends the conversation but not the half-second of silence.
- Two dials (06:42:45, 07:01:45) never reached the relay at all and the
  canary ended them at 7.8 s — both within seconds of a hang-up on the
  same exit. The fall-back to the mainland lane ran, so the call came up
  on the other voice. Not this PR's; noted.

So the cut is the path's, periodic, and known in advance. This PR leaves
the socket before the path cuts it:

- `services/voice-relay/server.mjs`: a resume (`resume=1`, same secret,
  same verified ticket) that finds the session LIVE rather than parked is a
  **handover**: the new socket becomes the client on the spot, receives the
  hello `resumed:true`, and the old socket is closed by the relay with
  `HANDOVER_CODE` 4002 after the frames already written to it. The vendor's
  side never changes. `live` map beside `parked`; `handover ms=` in the log;
  `handovers=` in the end line. `server.handover.test.mjs` proves it on
  real sockets against a fake vendor (12/12).
- `src/lib/voice/session.ts`: the socket's lifetime on this path is LEARNT
  — the first abnormal close (1006) of a socket that was up 15 s–120 s sets
  it, for the call and in storage (`koleex-voice-ws-life`, 6 h) for the
  device's next calls. With a lifetime known, a replacement socket dials
  `resume=1` six seconds before it (`rotateAfter`); the relay's hello — or
  the relay's 4002 on the old socket, whichever this page reads first —
  makes the replacement the call: microphone frames go out on it, its
  frames come in, the keepalive moves, the old socket is read to its end.
  Nothing is configured, nothing restarts, the state never leaves "live".
  A replacement not answered in 5 s is dropped and the call stays where it
  was; the resume of #416 still mends a cut that comes anyway. Only on the
  relay's socket; never on a vendor dialled directly; never on a device
  that has seen no cut. `ws_rotations` in the diagnostics → `wsRotations=`
  in the beacon line and the pulse.
- Suites: voice-client 754 (pure helpers; the whole handover both orders;
  the timeout; learning and storage; the two never-rotate cases); relay 12.

Expected on the owner's next international call: `handovers=N` on the
relay with `resumes=0`, `wsRotations=N wsReconnects=0` in the beacon, and
`:u` near zero. If the path's cut is not periodic after all, the learnt
lifetime is wrong by construction and the resume path still holds.

## "Fix the international voice opening on the Chinese line" (2026-09-13 08:2x UTC)

Two calls of the morning (06:42:45, 07:01:45) placed the caller's
international voice on the mainland line. The evidence, read together:

- Both times our route ANSWERED the socket lane's handshake — `POST
  /api/ai/voice/ws-session 200 … socket=relay` in the server log — and the
  answer never reached the phone. The canary beside it stalled too, the
  call failed as `service-unreachable` at 7.8 s (`canary=timeout:3501ms`),
  and the fall-back placed the call on the mainland lane. One second later
  the mainland lane's own POST from the same page went straight through.
  Not a dead origin: a request stuck on a connection the phone's exit had
  just changed under (US → SG at that minute).
- After that one fall-back, EVERY call on the page stayed on the mainland
  line: the fall-back flag was cleared only by the caller's own Line
  choice, and the mount-time probe runs once.

Two changes:

- `src/lib/voice/session.ts`: the canary's verdict no longer ends the
  call. It aborts the stuck request and sends the same handshake again, at
  once, on a fresh controller with `WS_HANDSHAKE_RETRY_MS` (4 s) of its
  own; only that second request failing is the service not answering. The
  beacon reads `canary=timeout:…+retry`.
- `src/components/ai/VoiceCallButton.tsx`: when a call that fell back
  ends (hang-up or terminal failure), the socket lane is probed in the
  background (lane-probe.ts); if it answers, the next call is back on the
  international line with the caller's voice (the same key on both lines),
  the device remembers `ws/probe`, and the note goes. Never under a call
  already placed.
- voice-client 756: the retry in both outcomes (second ask answered → the
  socket opens, no failure; not answered → service-unreachable on the
  retry's own deadline), the pins for the re-probe.

## Tasks by AI, phase 1 — the tool speaks the whole table (2026-09-13)

Owner: "start to do the plan without reading, I trust you, anything for
this task you can decide for me." Decisions taken (TASKS_BY_AI_PLAN §7):
reminders are self-tasks with a reminder time; saving by voice stays a
tap; a named project makes a project task (instruction-level, later); the
web assignment rule stands; the proactive brief comes in phase 5.

- `ai-agent/tools/task-time.ts` (new, pure): times resolve in the CALLER's
  zone (`UserContext.timezone`, default Asia/Dubai) — a date alone is 09:00
  there (17:00 for a due date), a local datetime is read there, a value
  with an offset is kept; DST honoured through Intl; wording for the
  preview ("Fri 18 Sept, 15:00").
- `createTodo`: `remind_at`, `start_date`, `recurrence(_until)`,
  `is_private`, `assign_to_department`, `assign_to_all` (admins; refused
  as a permission otherwise), `observer_account_ids`,
  `mention_account_ids`. A reminder defaults to the due time when the due
  date names a clock time. People resolve once against the assignable
  list; a department must be one they have. The insert and the
  notifications (assignees → mentions → observers, never twice, never the
  creator) mirror `/api/todos` POST, people into `metadata` as the app
  writes them. The preview carries names, times in words and the zone;
  the pending action carries ids and ISO times only.
- `updateTodo`: the same fields, `none` clears, observers add/remove as a
  previewed list, the newly added notified.
- Voice: the tool route forwards the tool's preview beside the pending
  args (never back with the tap); the call card words the due and
  reminder times and names the people, in three languages. The call's
  createTodo description and the TASKS BY VOICE instruction ask for
  everything said and forbid asking for what was not.
- Text lane: THE SECRETARY'S WAY paragraph — extract first, only the title
  required, ask only when the task would be wrong without the answer, one
  sentence with a default.
- Suites: new `validate:ai-tasks` (50: real-zone time cases incl. DST, the
  schema and write pins, both lanes' instructions, the card);
  `validate:voice-tools` 208, `validate:ai-tool-exposure` 33 (47 tools
  unchanged), `validate:ai-voice` payload budget still under 40 KB,
  voice-client 756.

Not in this phase (by design): attachments from the chat (the AI's uploads
live in a transient bucket; copying them into `todo-attachments` is phase
2 work with the chat card), a project link on a to-do (a named project
should become a project task — instruction in phase 3), the chat confirm
card (phase 2), the brief on the text lane (phase 4).

## Tasks by AI, phase 2 — the Task card in the chat, saved by a tap (2026-09-13)

The text lane confirmed a task by typing "yes" — the model re-sent the
arguments with confirm:true and the ledger matched. Now the chat has the
call screen's card:

- `AgentStep.pending` (server and client): a write tool's first phase
  hands its confirm arguments to the screen on the tool-result step, only
  while `approval_required`; the model's envelope is unchanged
  (orchestrator).
- `POST /api/ai/agent/confirm` (new): the page posts the preview's own
  arguments with confirm:true and the conversation id. The route re-decides
  everything in the voice tool route's order — the door, the account type,
  the context, the body and its size, the chat-confirm list
  (`lib/server/ai/chat-confirm.ts`: the five to-do writes, catalogue
  fail-safe), a 40/min budget, the caller's own conversation — then
  `dispatchTool` with the conversation id, where the ledger refuses a tap
  that matches no recorded preview. On success the tool's own line joins
  the thread as an assistant message (`provider: tool-confirm`), so a
  reload shows the task saved and the model's next turn knows it exists.
- `components/ai/TaskCard.tsx` (new): title, the times in words, the
  people by name, observers, mentions, recurrence, private — from the
  tool's preview; Save (Hub Blue) and Cancel while live (the last message,
  no reply yet); saving / saved (with "Open in To-do") / failed / not saved
  as a record afterwards. An update preview is a "Task change" card listing
  the changes. Copy in en/zh/ar (`copy.ts`).
- `Bubble.tsx` renders it above the answer like the quotation draft;
  `KoleexAiApp.tsx` owns the tap, the outcome per message, and appends the
  route's message once. Cancel closes the card; the recorded preview
  expires on its own (15 min).
- Suites: `validate:ai-client-render` 258 (the card live, older, answered,
  saving, saved with the link, failed, cancelled, the update card, the two
  refusals, ar/zh); `validate:ai-tasks` 58 (the step, the types, the list,
  the route's order and its post-dispatch write, the page's post, the
  bubble's live rule).

Voice unchanged: the call keeps its card and its tap route.

## Tasks by AI, phases 3 and 4 — the draft is proved, and the brief reaches the chat (2026-09-13)

**Phase 3 — the secretary's extraction, measured.** The model extracts;
the server decides. `ai-agent/tools/task-draft.ts` (new, pure) now holds
what createTodo will write: times in the caller's zone, the reminder
defaulted, people by name, the department as its colleagues spell it, or
one NAMED refusal (`no-title`, `bad-due`, `bad-remind`, `unknown-person`,
`unknown-department`, `everyone-denied` — the last a permission). createTodo
resolves the people once and calls it. `validate:ai-tasks` runs THIRTY
utterances — Arabic, Chinese, English — each with the arguments a model
following THE SECRETARY'S WAY sends and the draft it must become: "remind
me at 3" is 15:00 in Dubai and in Shanghai; "before Thursday" is Thursday
17:00 with no reminder; "tomorrow morning" carries its reminder; "the
design team" resolves to Design; "everyone" is refused for a sales user
and granted to an admin; two Ahmeds guessed at is a refusal that sends the
model back to findTeamMember; a bare "14:30" is refused, never guessed.
Honest boundary: the model's half — that it sends those arguments for
those words — is pinned by instruction and read in production logs, not
simulated here.

**Phase 4 — the brief on the text lane.**
- `listMyTodos`: "today" and "week" are the CALLER's day
  (`dayRangeISO(ctx.timezone)`), not the server's UTC day — for a caller in
  Dubai or Shanghai the old bound started at 04:00 or 08:00 their time and
  hid the morning's tasks; new `due: "reminders"` — tasks whose reminder
  rings today, still open.
- Text-lane prompt: TODAY'S BRIEF — calendar, open tasks and today's
  reminders in ONE turn, then meetings in time order → due/overdue →
  reminders with their times → the one thing first → what to start with;
  a few short lines, no headers.
- The first welcome tile now asks for the day's brief (en/zh/ar).
- Suites: `validate:ai-tasks` 94 (the draft's behaviour, the thirty
  utterances, the day bounds in two zones, the reminders filter, the
  prompt, the tiles).

Voice unchanged (its brief already reads tasks due and overdue; the
`reminders` filter is available to it through the same tool).

## Tasks by AI, phases 5 and 6 — the brief comes to you; the rule is written once (2026-09-13)

**Phase 5 — the proactive brief (dependability plan F3).**
- Settings → Koleex AI → **Morning brief**: one hour (05:00–12:00) in the
  user's calendar timezone, or off (default). Stored as
  `preferences.ai.briefHour` through the existing personalization route;
  normalised to an integer hour or null.
- `GET /api/cron/ai-brief`, hourly (`vercel.json`): for each opted-in active
  internal account whose local hour is now, and who has no brief today
  (the inbox row `metadata.type=ai_brief, day` is the record): today's
  meetings (one-off and recurring, `expandRecurrence`), tasks due today,
  overdue, reminders ringing today — through `lib/server/todo-scope` with
  the NON-admin scope on purpose (a super admin's brief is their own day,
  not the tenant's) — then one inbox row (`system`) and one push (`tag
  ai-brief-<day>`), both opening `/ai?ask=brief`. Wording in the reply
  language (`lib/server/ai/brief-text.ts`): "3 meetings · 2 due today ·
  1 overdue · 1 reminder — first: 09:30 Delta call"; a quiet day is said
  plainly. Nothing is written to tasks or calendar.
- The chat, opened with `?ask=brief`, starts a new conversation, asks for
  the brief in the user's language (the first welcome tile's words) and
  drops the parameter.

**Phase 6 — hygiene.**
- `lib/server/todo-scope.ts` (+ the pure `todo-scope-rule.ts`): the To-do
  visibility rule written ONCE — created · assigned · everyone · my
  department · shared (assignee or observer) · private only if mine or
  break-glass · super admin sees the tenant. `/api/todos` GET, the AI's
  `listMyTodos` and the brief read it; the ported copy in the tool is gone.
- `supabase/migrations/todo_columns_reconcile_2026_09.sql`: the eleven
  columns production has without a migration file, every one
  `IF NOT EXISTS` (a no-op on production, verified against
  information_schema on 2026-09-13), with the reason, RLS posture,
  rollback and load stated as the schema rule requires; one small index
  on (tenant_id, completed).
- Suites: `validate:ai-tasks` 106 (the scope rule and its application, the
  two callers, the migration's shape, the brief's words in three
  languages, the zone hour and day, the setting's normalisation, the
  cron's order and its no-writes, the vercel entry, the settings control,
  the deep link).

Not done, by choice: attachments from the chat onto a task (the AI's
uploads live in a transient bucket; copying them into `todo-attachments`
is its own small piece), and a "project task when a project is named"
instruction — both listed for the owner as next.

## The sidebar against ChatGPT's; Arabic and Chinese at their own size (2026-09-13)

Owner, with a screenshot of the ChatGPT sidebar: "our Koleex AI sidebar
needs to adjust specially when a conversation starts with Arabic … adjust
the text size in this app specifically the Arabic and Chinese".

- **What was wrong.** The row title had `dir="auto"` (right for shaping)
  and nothing else, so `text-align: start` resolved to the title's own
  side: Arabic chats sat against the pin, English ones against the icon —
  two columns in one list. And the whole app is drawn at Latin sizes;
  Arabic (no ascender line) and Chinese (a dense square per word) both
  read a step smaller than Latin at the same px, and Chinese was not even
  detected — the bubble sized by direction alone, so a Chinese reply got
  the Latin 14.
- **The rule, written once.** `lib/text-direction` gains `textScript` /
  `textLang` beside `textDirection`: the whole string is weighed, the
  non-Latin script wins a near-tie, Kana is not Chinese. Content carries
  its script as a `lang` attribute (sidebar and project titles, the search
  hint, both bar titles, the bubble, the composer, the welcome tiles, the
  task title, the call's lines and caption); the AI root carries the
  screen's language. The stylesheet does the rest in one block of
  `globals.css`: titles pinned to the screen's side; ar/zh content one step
  up per surface (13→15 titles and tiles, 14→16 bubbles, 16→17 composer,
  15→17 task title, 18→20 call lines); a CJK font stack for `lang="zh"`;
  and an Arabic or Chinese SCREEN lifts the 11/12/13 px chrome one step,
  with the content surfaces excluded so an English title inside an Arabic
  screen is not grown twice.
- **Suites.** `validate:ai-client-render` 272 (+14): the script detector on
  mixed lines, the rendered `lang` and class on rows, bubbles, tiles and
  the task card, the root's `lang`, and the stylesheet's rules by name.

### The chat's title, one rule for both lanes (same evening)

The sidebar's second Arabic problem was the label itself. The typed lane
titled a new chat with its first four words — a Chinese sentence has no
spaces, so it came through whole, sixty ideographs in a 248 px row — and
the voice lane with its first N characters, cutting Arabic mid-word.
`lib/server/ai/conversation-title` is now the one rule both routes call:
markdown and links stripped; a greeting clause dropped ("Hello, can you…",
"يا كولكس، عايز…", "你好，请帮我…"); the first sentence or clause; at most
five words that do not end on a filler (to / of / في / و / 的…), or at most
twelve ideographs cut on a word boundary through `Intl.Segmenter`. No model
call — this runs on every first turn. Pinned in
`validate:ai-core-boundaries` §6b (90).

Note for the record: the merge of #433 did not get a production deployment
from Vercel — its GitHub webhook for the `main` push was missed (the branch
push of the same commit deployed as a preview) — so this change also carries
#433 to production.

## "A problem in the Arabic words at the beginning of the answer" (2026-09-15)

Owner's screenshot: an Arabic opening paragraph, then a long English task
prompt in a code fence. The opening read jumbled — laid out as an English
paragraph, its Arabic runs in left-to-right order.

- **Cause.** The bubble's direction is measured over the whole message
  (right for a heading like "ما يغطيه Koleex Hub", which only resolves
  from the reply around it). The fence's several hundred Latin letters
  outweighed the ~150 Arabic ones, so the bubble went `ltr`.
- **Fix, three parts.** `textDirection` / `textScript` measure the PROSE:
  fenced code, inline code and URLs are ignored (`proseOf`). The markdown
  renderer takes the bubble's direction and marks any paragraph, heading,
  list item or quote that clearly runs the other way with its own `dir`
  (`blockDirection`: Arabic present → the 3:1 rule; else twelve Latin
  letters is a phrase, fewer is a name and inherits) — an English
  paragraph inside an Arabic answer, or an Arabic one inside English,
  reads correctly on both sides. Code blocks are always left-to-right
  (`dir="ltr"` plus the stylesheet), inline code is its own bidi island
  (`dir="auto"`). Also: the hast `node` react-markdown hands each
  component no longer leaks into the DOM as an attribute.
- **Suites.** `validate:ai-client-render` 279 (+7): the owner's shape, a
  URL, inline code, the block thresholds, the rendered `dir` per block in
  both bubble directions, the code block, the calls panel unchanged.

## "All sounds are good — keep them all and wire them" (2026-09-16)

The glass family shipped in #415 with a catalogue of thirty moments, a
player, recordings, a settings sheet and a preview page. Having heard the
recorded set end to end the owner approved all of it and asked for it to be
connected. Three things were in the way.

- **Twenty-six of the thirty were silent by default.** The first decision
  (2026-09-12 evening, on the synthesised family: "too many — keep the
  sounds for basic things") left only four on: the line came back, the call
  ended, the call failed, an error. Every other cue existed, had a call
  site, and never played unless someone went to Settings → Sounds and woke
  it. Every moment now starts on; the switch is how one goes quiet. The
  catalogue records both decisions and which one stands.
- **`action-denied` was never played by anything.** It was in the
  catalogue, in the settings sheet and on the preview page from the first
  day; both lanes answered a refusal with the generic error cue. A tap the
  server will not carry out — 403, or `status: "denied"` after
  `dispatchTool` re-checks the caller's permission — now says so, on the
  call screen and in the thread. A real fault still says error.
- **The thread's task card was mute, or spoke the wrong cue.** The card
  shipped with the tasks work (#428–#431), after the sounds; the call
  screen has announced the same three moments since #415. Saving played
  `reply-received` — the cue for an answer arriving — and now plays
  `action-done` ("a task saved"). Cancelling played nothing and now plays
  `action-cancelled`. A turn that ends with a card waiting plays
  `approval-needed` INSTEAD of the reply cue, never both, and rides the end
  of the turn rather than a message's arrival — so opening a thread that
  already holds a card stays quiet.

Also: the thread warms its own cues on mount, as the call warms its
seventeen inside the tap that starts it. Nothing plays; the files are
fetched and decoded once so the first cue of a session is not late.

**Suites.** `validate:voice-client` 761 (+5), and the catalogue's pins now
assert the rule rather than a list — every moment on, every cue in the
catalogue played by something in the app. Mutation-tested: unwiring
`action-denied` fails four checks, returning one cue to silent fails two.

## "It always like that and not connected fast" (2026-09-16)

Screenshot: "STILL CONNECTING — the voice service is slow right now … 12s".
The caption appears at eight seconds (CONNECTING_SLOW_MS); the counter read
twelve.

**What the logs say.** The call is in production at 17:34 UTC:

| t | line |
|---|---|
| 17:34:03 | `GET /api/ai/voice/session` — `lane=ws country=US`; `auth.resolve total_ms=817` (db 518) |
| 17:34:06 | `POST /api/ai/voice/session` — `handshake ok attempt=1/2 slot=primary from=sin1 afterMs=611 budgetMs=7000` |

So the server was not slow: our handshake to the voice region answered in
**611 ms**, from Singapore, first attempt. The session route is already
pinned to `sin1` in `vercel.json`, which matters — the watchdog shows the
primary region is unreachable from Tokyo (`from=hnd1 … afterMs=10491
UND_ERR_CONNECT_TIMEOUT`, every run) and healthy from Singapore
(`from=sin1 … afterMs=494`). Nothing to fix there; worth knowing.

The three seconds between the two lines are the client's, and they are the
part we own.

**The cause.** `waitForIceGathering` waited for
`iceGatheringState === "complete"` with a six-second ceiling. "Complete"
means every transport has heard from every STUN server it was handed —
including the ones that never answer from a tunnelled mainland exit. The
offer does not need that. It needs one route back through the NAT.

**The fix.** The wait now ends on the first server-reflexive (or relayed)
candidate plus a 250 ms settle window, keeping the six seconds as the
ceiling for a network that produces none. A **host** candidate never ends
it — behind carrier NAT that is the offer that "negotiates, and then
connects to nothing", which is what the old comment was protecting against
and still is. This is not cutting gathering off early: it ends once
gathering has produced the thing the far side needs.

`candidateKind` / `candidateIsReachable` read `typ <kind>` from the
candidate line itself rather than trusting an optional property, and are
pure. The wait now returns how long it took, and that rides the beacon as
`gather=` beside `rtc=` — so the next slow call is read, not guessed.

**What this does not fix.** After the offer is posted the ICE *connection*
still has to form, and on this path that is the network. The socket lane
exists for exactly that; a mainland-lane call that stalls in ICE has no
automatic escape to it, only "Try again". That is the next thing to look
at if the owner still sees long connects with `gather=` reading small.

**Suites.** `validate:voice-client` 768 (+6). Mutation-tested: letting a
host candidate end the wait fails two checks, restoring the wait-for-
complete behaviour fails one.

## "Still slow — check the gather number" (2026-09-17)

No `gather=` number existed yet: the beacon is flushed on the NEXT call, and
the only one that had arrived was queued from 2026-09-16 07:50, before the
change. What it said, though, was the more important finding:

    [ai.voice.client] retried elapsedMs=25703 ice=new dc=connecting
    lastEvent=none lane=rtc slot=primary iceEverConnected=false

`ice=new` — the connection state never left "new" in 25.7 seconds. It moves
to "checking" the moment the answer is applied, so on that call the answer
was never applied. And `lane=rtc`.

**The lane was the wrong one, and it was a race.** The owner's two calls at
04:32 and 04:33 UTC are each preceded by `[ai.voice] lane=ws country=US` —
the deployment told the device to take the socket lane — and each POSTs to
the WebRTC handshake anyway. `decideLane` returns `ws` unconditionally when
the server says so, so the only way to land on `rtc` is to tap before that
answer is applied. The button held the lane in a ref that **started at
"rtc"** and was corrected only when the config read returned: 470–840 ms of
`auth.resolve` (db 360–560 ms) in production, and a quick tap fits inside
it. On this caller's network the mainland lane does not connect at all.

**The fix.** `startingLane` (pure, in voice-pref) gives the tap the lane
this device already proved — every probe, live call and deliberate choice
is already written down, it simply was not read at the start. A device with
nothing written down still starts on `rtc`, the lane that needs no relay.
And the deployment's own answer is now written down too (`source: "server"`),
so a first-ever load seeds correctly on the second, and never over a choice
the caller made themselves or a fresher verdict from the network.

**What the earlier change did do.** Tap-to-POST fell from ~3 s (2026-09-16
17:34) to ~2 s (04:32); the server's own handshake answered in 443 ms and
684 ms. That part is no longer the cost.

**Suites.** `validate:voice-client` 772 (+4). Mutation-tested: restoring the
hard-coded `"rtc"` fails one check, making `startingLane` ignore the saved
verdict fails another.

## "Still same" — the beacon finally says why (2026-09-17, 04:57)

The gather number arrived, and with it the answer. It was never the
gathering.

    [ai.voice.client] service-unreachable elapsedMs=11698 ice=none dc=none
    lane=ws fellBack=true iceEverConnected=false
    err="AbortError: Fetch is aborted" canary=timeout:3502ms+retry

Beside it, our own logs for the same twelve seconds:

| t | line |
|---|---|
| 04:57:29 | `POST /api/ai/voice/ws-session` **200** (auth 153 ms) `socket=relay` |
| 04:57:35 | `POST /api/ai/voice/ws-session` **200** — the retry |
| 04:57:39 | the beacon above |
| 04:57:40 | `POST /api/ai/voice/session` `handshake ok afterMs=436` — the fall-back, which connected |

**Our route answered 200 twice and neither answer reached the browser.**
The canary — a plain GET to `/api/version` on our own origin — timed out at
3.5 s. This network cannot reliably complete a response from
hub.koleexgroup.com on the socket lane. Nothing in the voice path is slow:
the handshake that did connect took 436 ms.

**Why it happened on every call.** The call fell back, connected, and wrote
`rtc` down — correctly. `decideLane` then threw that away: its first line
was `if (server === "ws") return { lane: "ws", probe: false }`, and `server`
is a guess from the country stamp on the request. So the next load tried the
socket lane again, failed again, and spent the same twelve seconds. Every
call. That is what "always slow" was.

**The fix.** A fresh verdict from a real call or a probe is evidence from
this network and now outranks the country stamp; the caller's own choice
still outranks both. The probe keeps running behind the verdict, so a
network that recovers moves the lane back on its own — the lock the
2026-09-11 note warns about is exactly what `probe: true` prevents. And the
country stamp is written down only when the device knows nothing at all, so
it can never land on top of a verdict (it could, until now — added the day
before, and it was making this worse).

**Suites.** `validate:voice-client` 776 (+7). Mutation-tested three ways:
putting the country stamp first again fails two checks, letting the stamp
clobber a verdict fails two, dropping the probe behind a verdict fails two.

**Still true and not ours:** the owner's network drops responses from our
origin. The fall-back now happens once rather than on every call, but the
first call after a network change still spends that time discovering it.

---

## 2026-09-17 — "still slow", a fourth time: a five-second probe was erasing what an eleven-second call proved

#439 shipped and did not help. The reason is in production, one loop, read
straight off the logs:

| t | line |
|---|---|
| 05:29:51 | `POST /api/ai/voice/ws-session` — the call's first attempt |
| 05:29:57 | `POST /api/ai/voice/ws-session` — its retry |
| 05:30:01 | beacon `service-unreachable elapsedMs=10802 lane=ws fellBack=true` → writes `rtc`, source `call` |
| 05:30:01 | `POST /api/ai/voice/session` — primary region timed out at 7002 ms, alt answered in 261 ms |
| 05:30:07 | `POST /api/ai/voice/ws-session probe=true` → writes `ws`, source `probe` — **over it** |
| 05:30:56 | `POST /api/ai/voice/ws-session` — the next call, on `ws` again |
| 05:31:06 | beacon `service-unreachable elapsedMs=11682 …` — the same eleven seconds |

`decideLane` was already reading the device's verdict ahead of the country
stamp. It could not help, because the verdict was gone six seconds after it
was written. **The reading was ranked; the store was not.**

And the probe is not wrong about what it measured. It opens one short
socket, then closes it. A call opens a session and keeps it. On a network
that completes a handshake but drops a held response, the probe passes and
the call fails — so the two are not equal evidence, and they were being
stored as if they were.

**The fix.** `mergeLane` — pure — decides which verdict may replace which,
and `saveLane` enforces it, so the rule is a property of the store rather
than of the seven places that write to it:

- the caller's own hand always writes, and a machine that disagrees never
  writes over a fresh one (true of `decideLane`'s reading before this, and
  not of the store — a probe could quietly erase a chosen lane);
- a real call's verdict holds against a probe or the country stamp for
  **30 minutes** (`CALL_VERDICT_HOLD_MS`) — long enough that the loop above
  cannot re-form, short enough that a network which really changed is
  re-opened by the next probe rather than by the six-hour expiry;
- an **agreeing** write refreshes the stamp and keeps the stronger source.
  Without this the loop simply takes one more step to close: fall-back
  stores `rtc/call`, the agreeing probe stores `rtc/probe`, and the probe
  after that — the one saying `ws` — faces a verdict it is allowed to
  overwrite.

Also confirmed live from the same logs: the ICE-gathering fix (#437) works —
a connected call reported `gather111`, 111 ms, where the old path waited for
every STUN server to give up. Gathering was never the cost.

**Suites.** `validate:voice-client` 786 (+10), including the owner's exact
sequence replayed through the real store. Mutation-tested four ways: writing
without the ranking fails 1, letting a probe outrank a call fails 3, letting
an agreeing probe erase the call's provenance fails 1, letting a probe erase
the caller's own choice fails 1.

**Still true and not ours:** this network drops held responses from our
origin on the socket lane. What changed is that the caller pays for that
discovery once, not on every call.

---

## 2026-09-17 — the socket lane's give-up budget: nobody was adding the three numbers up

Checked the production logs before changing anything, and the first finding
was that **the owner has not placed a call since 05:31** — neither #439 (live
~05:40) nor #440 (live 05:51) has been exercised by him. His app was open and
read the config at 05:51:51 on the new build:

```
[ai.voice] lane=ws country=US ws=true rtc=true
```

— note `country=US`, a VPN exit, which is why the server keeps offering the
socket lane — and then no `POST /api/ai/voice/ws-session` and no
`POST /api/ai/voice/session` before the app went quiet at 05:55. So the
report is the 05:30 experience repeated, not a verdict on the fix. Said so
to the owner rather than shipping over it.

**What is still genuinely wrong**, and is this change: the first call on any
fresh browser still pays the full give-up on the socket lane, and that
give-up is ~11 s while the fall-back behind it connects in 436 ms. Where the
eleven went:

| window | cost | why |
|---|---|---|
| 0.0 – 2.5 s | `WS_CANARY_AFTER_MS` | waiting, canary not yet armed |
| 2.5 – 6.0 s | `WS_CANARY_TIMEOUT_MS` | the canary's own deadline → the verdict |
| 6.0 – 10.0 s | `WS_HANDSHAKE_RETRY_MS` | the one retry |
| ~10.2 s | | give up → rtc, 0.44 s |

**None of those three was measured.** They were room left for a round trip,
added by three different incidents, and no one ever added them together. The
measurements say the room is far too generous — our own watch cron, hitting
the same route from the same regions:

```
[ai.voice.watch] ok slot=primary from=hnd1 status=400 afterMs=646
[ai.voice.watch] ok slot=alt     from=sin1 status=400 afterMs=98
[ai.voice.watch] socket ok from=hnd1 afterMs=643 openMs=384
[ai.voice.watch] relay  ok from=sin1 afterMs=969
```

and `/api/version`, which is what the canary asks for, answers in under
200 ms.

**New budget:** arm at 1.5 s (still past a healthy handshake's 1.3 s),
canary 2.5 s (twelve times its healthy answer), retry 2.5 s — the
2026-09-13 incident's own retry went through *one second* later. Worst case
**~6.5 s instead of ~11**, and every incident behaviour is unchanged: the
canary still only reports and aborts, the retry still gets its turn, and the
fall-back still runs only after it.

The three are now pinned **as a sum**, so the next change to any one of them
has to face the total a caller actually sits through.

**Suites.** `validate:voice-client` 788 (+2). Mutation-tested four ways:
arming late again fails 2, the four-second retry fails 2, arming so early it
would cut a healthy handshake short fails 3, a canary deadline under five
times its healthy answer fails 3.

---

## 2026-09-18 — the owner's two calls, measured: seven seconds is the mainland region's dead-burst budget

The owner tested #440 and #441 and reported: **"first one 7 seconds, second one
still slow."** That is the first real measurement in this whole thread, and it
moves the fault off the lane entirely — by the second call the client has
learnt the lane and skips the socket, and the caller still waits.

### What the watch cron had been recording, unread

It samples both vendor paths from both of our regions every fifteen minutes.
Nobody had read it as a distribution. One hour, 2026-09-17 18:00–19:00 UTC,
every sample:

| t | from | primary (`cn-north`) | alt |
|---|---|---|---|
| 18:15 | hnd1 | **FAIL 10487 ms** `UND_ERR_CONNECT_TIMEOUT` | ok 482 ms |
| 18:22 | sin1 | ok 521 ms | ok 342 ms |
| 18:30 | hnd1 | ok 652 ms | ok 638 ms |
| 18:37 | sin1 | ok 531 ms | ok 242 ms |
| 18:45 | hnd1 | ok 823 ms | ok 457 ms |
| 18:52 | sin1 | ok 426 ms | ok 146 ms |

**This killed a change that was one edit from being made.** The 05:52 failure
that day was from `sin1`, and it looked like the vendor's mainland host had
moved to answering Tokyo — which would have meant flipping the `sin1` pin
`vercel.json` has carried since #391. The hour above shows the primary failing
from **hnd1** too. The path is not worse from one of our regions than the
other; it is **intermittent**, exactly as the note above
`HANDSHAKE_ATTEMPT_BUDGETS_MS` already said. The pin is not the fault and must
not be flipped on one sample pair.

### What the fault is

A primary handshake that is going to work answers in **426–838 ms**, every
observation we have, from either region. A dead one is a connect timeout at
**~10.5 s**. Nothing has ever been measured between 0.9 s and 10 s.

`TWO_REGION_ATTEMPT_BUDGETS_MS[0]` was **7 000 ms** — seven seconds spent
entirely inside a gap where no successful handshake has ever landed. On every
call that meets a bad burst, the caller pays all seven before the other region
is asked, and the other region answers in 146–638 ms. That is the owner's
seven-second call, both of them.

Now **2 500 ms** — three times the slowest healthy answer on record. It changes
nothing for a caller whose mainland path is up, and it hands a caller in a bad
burst to the other region in 2.5 s instead of 7.

**Deliberately not a hedge.** Racing both regions and taking the first answer
would quietly move mainland callers onto the international endpoint, because
the answer carries the ICE candidates the browser connects its **media** to.
Mainland must work without a VPN. The order stands; only the waiting is cut.

**Suites.** `validate:ai-voice` 378 (+2), including a pin that the candidates
are still walked as one ordered loop with exactly one handshake in flight.
Mutation-tested three ways: seven seconds again fails 1, a budget tighter than
a healthy handshake needs fails 1, replacing the ordered loop fails 2.

**Still open, and worth watching:** the primary path fails in bursts from both
of our regions. The cost is now bounded, not removed. The watch cron's samples
are the record to read if it gets worse.

---

## 2026-09-18 — full debug pass on the Koleex AI app: four real faults, all found by measuring

Owner: *"clean and make full debugging for Koleex AI app and make it fast and
fix any issue."* Method was the one that has been paying off all week — read
the production numbers first, then fix what they name.

### 1. Koleex AI was listed as warmed and was never warmed

`TIER_A_IDLE_PRELOAD` has carried `"ai"` first since 2026-09-13, with the
owner's *"extremely fast, almost no loading"* written beside it. There was no
`ai` key in `CHUNK_PRELOADERS`. The decision was written down and never
reached the browser:

- Home's idle warm (`if (chunksWarmed < 2 && hasChunkPreloader(id))`) skipped
  AI entirely; the hover-intent warm was a no-op too. Only the 16.6 KB `.rsc`
  shell was ever prefetched.
- The ~573 KB `KoleexAiApp` chunk group therefore downloaded **on the tap**,
  every first launch of every session.
- And `wasChunkWarmed("ai")` returned **true** — because an app with no
  preloader "has nothing to warm" — so the launch was reported **warm**. The
  owner's telemetry read `nav.warm_ms 14923` for a fully cold download, while
  going *back* from `/ai` in the same session took **427 ms**. The number that
  should have caught this was the number it fooled.

Pinned as the invariant — every app listed for idle preload must have a
preloader — with the one other offender (`products`) named, so a *new* one
fails the build. `products` is outside this app and, with the idle budget at
two chunks, is never reached; reported rather than changed from here.

### 2. The agent route's error handler could not run

```
const history = …   ← declared INSIDE the try
} catch (e) {
  … `hist=${history.length}` …   ← not in scope
```

It compiled only because `tsconfig`'s `"lib"` includes `"dom"`, whose global
`history: History` carries a `.length`. On the server that global does not
exist, so the catch threw `ReferenceError: history is not defined` **before**
enqueuing the `{type:"error"}` frame. On every failed turn the browser got a
stream that simply ended — the screen said *"No reply was received"* instead
of the sentence written for it — and the `[ai] … ok=false` line that plan G1
added, the whole error-rate signal, was never written. **Pressing Stop
mid-answer takes this path too.** The count is now hoisted; pinned as a rule
(nothing the catch reads may be declared inside the try), not as a spelling.

### 3. A chat that failed to start locked the composer for the session

`createConversation()` returned `null` for a refusal and **threw** for a
dropped link. `send()` awaits it before its own `try/finally` begins, so a
rejection skipped the `finally` that clears `sendingRef`: the composer stayed
on "Stop" for the rest of the session, every later `send()` returned at the
guard, silently, and Stop could not clear it either. Only a reload freed it.
The caller's `if (!created)` handling was already correct — it just never ran.
Every failure now leaves by the `null` door.

### 4. The in-call lookup had no deadline

The POST to `/api/ai/voice/tool` was the one request this module made with no
signal, and it is the one where a stall is *heard*: nothing answers the far
side until it settles, so the model waits for a `function_call_output` that
never comes and says nothing — a live, silent call with no error and no way
out but hanging up. Every sibling already had its deadline
(`PERSIST_TIMEOUT_MS`: *"a request with no deadline hung the hang-up drain"*).
Now 12 s — the number the screen already uses for its "searching" floor, and
under the route's own `maxDuration` of 30.

### Also

- The realtime channel's nudge was undoing its own flap rule — see the entry
  below.
- `isMissingTable` in `discuss.ts` was dead (its twin in `inbox.ts` is the
  live one); removed.
- **The voice-client suite is flaky under load**: four resume/handover checks
  failed once while a build and two audits ran, and passed on a clean re-run.
  The cause is `await sleep(160)` against an 80 ms grace timer — 2× headroom
  is not enough on a loaded machine. Not fixed here; recorded so CI red can
  be recognised for what it is.

**Suites.** `validate:ai-client-render` 283 (+2), `validate:ai-streaming` 37
(+2), `validate:voice-client` 793 (+3+2). Mutation-tested five ways, each
caught. `validate:ai` 44/44, tsc and eslint clean, `next build` clean.

### Left for the owner to decide

`/ai` mounts `AdminAuth` **twice** — once from the shell (`RootShell →
AuthGate`) and again in `src/app/ai/page.tsx`. The inner one renders
`BrandLoading` until its own effect reads storage, which delays the *start* of
the chunk download and shows a third loading surface. Eleven sibling routes
carry the same wrapper, and removing it changes behaviour when
`NEXT_PUBLIC_USE_SUPABASE_AUTH` is on. That is a permissions question, not a
performance one, so it is the owner's call rather than mine.

---

## 2026-09-18 — the realtime nudge was undoing its own flap rule

The rejoin backoff is right and was being defeated one line below it. `kick`
set `retry = 0`, and `kick` fires on `online`, on `kx-call-ended`, and on
every return to the tab. On a phone changing networks and switching apps —
the whole of this owner's usage — the ramp never got to climb. His
reconnects on `discuss:account`, one session:

```
+0.8s +1.8s +4.4s +7.1s +15.9s   → back to +0.8s
+1.1s +1.7s +4.2s +7.0s +13.3s +27.5s → and again
```

That is a socket storm on the same flaky link his voice call fights for —
which is exactly what the call guard in `scheduleRejoin` already exists to
prevent. A nudge now means *"do not sit out the wait"*, not *"forget what this
link has been doing"*: it still rejoins at once, and what the next failure
waits is owned by the one rule with evidence behind it — a subscription that
held for `REJOIN_STABLE_MS`. A burst of nudges is also one rejoin now
(`KICK_FLOOR_MS`), since `online` and `visibilitychange` arrive in bursts and
each nudge is a teardown plus a fresh socket.


---

## 2026-09-18 — the second gate on /ai is gone (owner: "remove it")

Offered as the owner's call rather than mine, because removing a gate is a
permissions change and the standing rule is *do not weaken permissions*. He
said remove it. **Checked before touching it**, and the check is what makes it
safe rather than the instruction:

- `RootShell` wraps every route in `<AuthGate>` except two lists —
  `BYPASS_PREFIXES = ["/auth"]` and `BYPASS_SUFFIXES = ["/print"]`. `/ai` is in
  neither, so it cannot render until that gate has passed.
- `AuthGate` gates on **both** branches: `AdminAuth` when
  `NEXT_PUBLIC_USE_SUPABASE_AUTH` is off, `SupabaseGate` when it is on. There
  is no configuration in which removing the page's copy leaves the route open.
- Forty-five other routes never double-wrapped; `/ai` is now consistent with
  them rather than weaker than the norm.

**What it cost while it was there.** The inner copy started its own `authed`
state at `null` and painted a full-height `BrandLoading` until its effect had
read storage — and `<KoleexAiApp/>` is `next/dynamic`, so its chunk could not
*begin* downloading until that effect ran. It also put three loading surfaces
in a row (route skeleton → BrandLoading → skeleton again), which is precisely
what the comment above that component promises not to do: *"One look from
click to content."*

**Pinned, not argued.** `validate:ai-client-render` now asserts all four
facts: `/ai` is not bypassable, the shell gates what it does not bypass,
AuthGate gates on both branches, and the page holds no gate of its own.
Mutation-tested three ways — making `/ai` bypassable fails 1, drifting the
page shape fails 1, and removing the gate from either AuthGate branch fails 1.
It cannot quietly become "no gate".

`validate:ai-client-render` 286 (+3). `validate:ai` 44/44, tsc and eslint
clean, `next build` clean.


---

## 2026-09-18 — "the dock app / home screen is not updated": four things were fine, one was not

Owner asked why the installed app does not pick up new builds. Checked the
whole chain with evidence before changing anything, and **the first
hypothesis was wrong** — worth recording, because it was the one I was most
sure of.

### Verified working (not guesses)

| link | result |
|---|---|
| does the page carry the real build id? | ✅ live HTML `<meta name="kx-build" content="5890c1d…">` |
| does `/api/version` agree? | ✅ same sha |
| can the service worker serve stale JS? | ✅ **no** — tested, see below |
| is `UpdateWatcher` actually mounted? | ✅ `RootShell.tsx:393` |

**The killed hypothesis.** The service worker is cache-first on
`/_next/static/`, justified by "every file there has a hash in its name, so
it can NEVER go stale". Turbopack's names *look* like short slugs, not
content hashes, and several (`02o~ssm5_k3~4.js`, `0jp0h8059qlzg.css`) were
identical across builds days apart — so it looked like the installed app was
being served old JavaScript under a stable URL, which would have explained
the whole week.

It was tested rather than believed: build, snapshot all 571 chunk hashes,
change a **shipped string** (`copy.ts` → `newChat`), rebuild, compare.

```
same filename, different content : 0
brand-new filenames              : 6
```

(Two earlier probes — a comment, then an unused export — produced
byte-identical output, because both are stripped. That is why the third probe
used a string that actually ships.) The names are content-addressed; the
cache-first rule is safe exactly as its comment claims. **No change was made
on the strength of a plausible mechanism.**

### What was actually broken

`healInstalledApp` recorded the **attempt**, not the outcome, and recorded it
**before** the navigation:

```
mark "done" for build X  →  window.location.reload()
```

A reload that never completes — a dropped link mid-navigation, the ordinary
failure on this owner's network — leaves the mark written. The app comes back
on the old bundle, sees the new id, calls the function, reads its own mark,
and returns. **It never tries again**, and the installed app is frozen on
that build for the rest of the session.

The record now counts attempts and is keyed **FROM→TO**:

- a lost navigation is retried, up to `HEAL_ATTEMPTS_MAX` (3);
- a heal that *worked* cannot be retried — the next boot's `from` is the new
  build, so the record is not about that move (and `check()` will not call it
  once the ids agree);
- a genuinely stuck build costs three loads instead of an infinite loop, so
  the original guard's job is still done, on a bounded budget instead of a
  budget of one;
- junk, and the old bare-id format, count as **no attempt** rather than as a
  completed heal.

Still refuses to interrupt a live call or unsaved work, and still only runs
while the app is on screen.

**Suites.** `validate:ai-client-render` 291 (+5). Mutation-tested four ways:
the one-shot guard back fails 1, dropping the FROM→TO key fails 1, an
unbounded budget fails 1, and interrupting a live call fails 1.
`validate:ai` 44/44, tsc and eslint clean, `next build` clean.

---

## 2026-09-18 — PR #447: a 34-second hold is not a healthy link

The owner said "still slow" for the sixth time. Nothing was shipped on a
hypothesis this round; the deployment's own logs were read first
(`dpl_ChjMPwTcFXQu4q2PU5CcHqn37L38`, 17:24–17:32 UTC), and most of what they
say is that the complaint cannot be attributed yet:

- **No voice call reached the server at all** in that window — no
  `POST /api/ai/voice/session`, no `/api/ai/voice/ws-session`. Whatever was
  slow, it was not a call we saw.
- **No `nav.cold.*` / `nav.warm_ms`** either: no cold app open in the window.
- The vendor path measured healthy from `hnd1` at 17:30:35 — primary
  `afterMs=683`, socket `spoke afterMs=713`. (The `sin1` sample at 17:22:33
  was `afterMs=1920`, well outside the 426–838 ms band the 2500 ms first
  attempt budget in #442 was derived from. Worth watching; one sample.)
- What the window DOES show, continuously, is the `discuss:account` realtime
  channel failing to hold on his link.

### The one thing the numbers proved

The flap rule from #443 is working — the ramp climbs cleanly — and it was
being thrown away by its own recovery clause. From his session:

```
+0.27s +2.1s +4.6s +6.7s +6.3s +12.2s +36.3s   ← ramp, correct
  (one subscription then held 34.1s → retry = 0)
+0.89s +0.93s +2.1s +4.2s +8.3s +13.9s          ← and again from zero
```

`REJOIN_STABLE_MS` is 30 s, the hold was 34.1 s, so the whole session's
history was erased by 4.1 s. Fourteen socket opens in ten minutes on a link
that never once held a channel for a full minute — on the mainland path the
product exists for.

`retryAfterRecovery` replaces `retry = 0`: a recovery **halves** the step.
A channel that genuinely recovers is still rewarded and is back to a short
retry within two recoveries; a channel that flaps at 34 s forever settles
near the 60 s cap instead of sprinting back to 0.9 s.

### And the part that is still not explained

Several CLOSED → reconnect pairs in his data are ~250 ms apart. A scheduled
rejoin cannot do that — `rejoinDelayMs(0)` floors at 800 ms — so either a
nudge opened them (and `KICK_FLOOR_MS` says no more than one per 3 s) or the
page is not running the build we think it is. Rather than pick one and ship
it, `rt.reconnect` now carries `via` (`init` / `timer` / `kick`) and the
backoff step `r`, and `rt.status` carries `held` in seconds. The next round
of this is a reading, not an argument.

`rt.channels` also stopped firing once per status change — the set cannot
have changed there — and is recorded where it actually changes. That was
half of every perf beacon on the one link that cannot spare it.

---

## 2026-09-23 — The orb has a second style, and the user picks it

Owner: *"the user can choose the orb shape … from Koleex Hub Setting or Koleex
AI setting … and if he choose one so every thing in Koleex Hub related to the
AI orb will change."* The second style is the dotted thought-orb from
[thinking-orbs](https://github.com/JakubAntalik/thinking-orbs) (MIT, v0.3.1,
pinned exactly).

**Where you choose.** Settings → Koleex AI → Orb. The Koleex AI app's own
settings link already lands on that tab, so it is one picker for both. Each
option is shown as its own live orb, and the choice applies the moment it is
tapped, to every orb on screen.

**Where it applies.** Everything goes through one component, `ChosenOrb`:
KoleexGlowOrb (Home, chat bubbles, welcome card, the app header, Discuss, the
launcher icon) and the call screen. `validate:ai-orb` fails the build if any
surface draws `<AIOrb>` or `<DottedOrb>` directly, so a new screen cannot
quietly ignore the choice.

**Where it is kept.** On the account (`preferences.orb`, `"aura" | "dots"`), so
phone, iPad and Mac agree. It is also mirrored in localStorage, so the right orb
is there on the first frame. No schema change: it is one more key in the
existing jsonb, written through the atomic `account_prefs_merge`, and
`withDefaults` passes it through so the fifteen wholesale saves don't wipe it.

**Why not the library's own component.** It draws at 64 px and 20 px only, and
any other size has no tuning. The Hub draws the orb at 26–200 px. So we use the
library's engine (pure geometry, 6 KB gzipped, no network, no WebGL) and draw it
ourselves. `dottedPreset()` picks the 20 px tuning below 40 px and the 64 px
tuning from 40 px up. The suite checks that every motion stays inside its box at
every size the Hub uses. Drawing it ourselves also gives the dotted orb what the
library lacks: our state model, the voice level on a call, and the Hub's own
theme and reduce-motion settings.

**What each state looks like** (`dotted-orb-map.ts`):

| Aura orb | Dotted orb |
|---|---|
| idle | composing, at half pace (owner's choice, see below) |
| listening | listening |
| speaking | composing |
| thinking | working |
| searching | searching (scan) |
| analysing / reasoning | solving |
| translating / connecting | connecting |
| generating / creating a record | composing |
| any other action | weaving |
| success | shaping |
| error / warning | breathing, slowed and dimmed |

Results stay restrained, no colour, just as on the aura orb.

**Known limit.** Home is rendered on the server. A user who chose dots sees the
aura orb for one frame there while the page hydrates. Everywhere else (the AI
app, Discuss, Settings) mounts on the client and reads the choice on the first
render.

**Suites.** `validate:ai-orb` 142 (+35); `validate:voice-client` pin moved to
`ChosenOrb`. Mutation-tested five ways, each caught:
- the call screen drawing `AIOrb` directly
- `withDefaults` dropping the key
- speaking drawn like listening
- the size threshold moved
- the picker no longer saving

### Follow-up: "thinking" at small size

The owner looked at the live preview and said: *"fix the thinking one"*.

Below 40 px the orbits motion (`working`) falls back to the 20 px tuning. At
that tuning it is just a few dots scattered on tilted orbits, most of them faint
on the far side, and it stops looking like an orb. The chat bubble is 38 px and
shows "thinking" more than anything else.

I rendered five motions side by side at 38 and 30 px, on dark and on light:
working, solving, searching, listening and weaving. `solving` was the clearest:
a full dotted sphere whose bands keep settling. It also already means "working
something out".

So `dottedLook(…, size)` now draws `solving` wherever it would draw `working`
below 40 px. Nothing else changes by size.

`validate:ai-orb` has 145 checks (+3), each confirmed by breaking the code on
purpose:
- removing the rule fails 1 check;
- DottedOrb no longer passing its size fails 1 check;
- widening the rule to every motion fails 1 check.

---

## 2026-09-23 — The update is offered, and the owner presses it

Owner: *"I want to show the update message and I press update to know that
there is update happened."* The installed app used to update itself without
asking: it reloaded as soon as it saw a new version, and it reloaded again
whenever the tab went hidden. So the Mac dock app changed under him and he never
saw an update arrive. Both paths are removed. The "New version available ·
Update" capsule now waits until it is pressed, in the browser and in the
installed app alike.

- **Not over a live call.** The capsule is hidden while the call screen is up
  (`body:has([data-kx-call-active='1']) .kx-update-offer`), because its button
  reloads the page and a reload ends the call. It comes back when the call
  ends.
- **One silent path stays: `AppLaunchLink`.** A stale tab's chunks are already
  gone from the new deployment, so opening another app with a soft navigation
  would fail. That one launch becomes a full navigation, and the "Updated to
  the latest version" confirmation says so when it lands.

### And the dots stopped costing everyone

**The regression.** `validate:budgets` failed on 19 routes after #448.
`ChosenOrb` imported `DottedOrb` statically, which put the dots engine
(~16 KB) into the chunk that every route with an orb shares.

**The fix.** It now loads through React `lazy` (not `next/dynamic`), so only
users who chose dots download it.

**What remained.** Six routes still sat 1–2 KB over. They had about 1 KB of
headroom to begin with. I built CRM before the orb (9772d9c) and after: the
difference is +1,345 bytes, all in the shared shell.
- `ChosenOrb`: 794 B
- `orb-style` store: 766 B
- lazy stub: 102 B
- The removed update-reload code offsets part of this.

Those six budgets were raised by 2 KB, with that measurement recorded next to
them.

**Suites.**
- `validate:ai-client-render` 294 (new update-offer checks). Mutation-tested
  three ways, each caught: the installed-app self-reload put back, the reload
  on hide put back, and the offer shown over a call.
- `validate:ai-orb` 146. A new check fails if anything imports the dots or the
  engine statically.
- `validate:voice-client` 799, `validate:budgets` 107/107.


### Follow-up: the resting motion is the owner's choice

The owner compared all nine motions side by side, at 104, 72, 38 and 30 px on
dark and light, and chose **composing**. It replaces the breathing ring, which
is not a sphere.

**Why not solving?** The owner also asked about solving. It was ruled out
because it is what a small orb *thinks* with (see the #449 follow-up). Beside a
chat message, a resting orb and a thinking one would have looked identical.

**Why composing at half pace?** Composing is also the speaking motion. But
speaking only appears on the call screen, where it runs at full pace and grows
and shrinks with the voice. At rest it runs at half pace and holds its size.

The slowed, dimmed ring is kept for warning, error, sleep and waiting on the
user.

`validate:ai-orb` has 148 checks (+2). Each was confirmed by breaking the code
on purpose:
- idle drawn as solving fails 3;
- idle at full pace fails 2.

### Follow-up: the shape changes, it does not cut

The owner reported: *"there is no transition in the new orb between shape and
other — should have a very smart and creative transition"*. I built six live
samples next to the existing cut: crossfade, morph, gather & burst, vortex,
dust and scan wipe. He chose **morph**.

**The morph.** `dotted-orb-morph.ts` is pure.
- A change of motion flies the same dots from the old shape into the new one
  over 800 ms, eased in and out.
- Both frames are ordered by angle around the centre. The shorter list is
  stretched over the longer one, so every dot of both shapes takes part.
- Each dot's flight is short and stays on its own side of the sphere.
- Position, radius, ink and alpha are all interpolated.

**Fix: speed changes no longer snap.** The old loop was rebuilt on every change
and restarted time at the new speed, so even a speed change snapped. Now:
- the loop reads the current look from a ref, so it is not rebuilt;
- its clock advances by the current speed;
- resting → speaking (both the sash) speeds up smoothly and does not morph.

**Other behaviour:**
- If the user asked for reduced motion, there is no morph. The one still frame
  is redrawn when the state changes.
- Offscreen or in a hidden tab, the clock is capped at 100 ms per frame, so the
  orb does not jump when it comes back.

**Verified in a browser.** The real `DottedOrb`, bundled into a test page and
rendered in headless Chromium at 200, 72 and 38 px, shows the resting sash, the
dots in flight at 400 ms, and the thinking shape after.

**Tests.** `validate:ai-orb` has 155 checks (+7):
- every dot takes part;
- the morph starts on the old shape and lands on the new one;
- an empty side fades;
- real transitions stay inside the box at 30–200 px;
- the wiring.

Each new check was confirmed by breaking the code on purpose; all of these were
caught:
- a cut put back;
- the loop restarting on motion;
- pairing that drops dots;
- a morph that never lands.

### Follow-up: on Home, the orb is bigger and wanders

The owner, on the Home greeting: *"I want the orb more bigger and changed
randomly with the orb motion shapes."*

**Bigger.**
- From `md` up the orb is 112 px, next to a greeting card of about that height.
- On a phone it stays 72 px, so the greeting keeps its width.
- It is one canvas drawn at 112 and scaled into a 72 px box below `md`, so
  nothing swaps or jumps after load.

**It wanders.** The new `wander` prop passes from `KoleexGlowOrb` through
`ChosenOrb` to the dots only; the aura orb has a single shape and never
receives it.
- At rest, the dotted orb morphs to a random shape every 6 s. It picks any of
  the other eight, never the one it is already in, so every change is visible.
- The moment the assistant is doing something (typing the greeting, for
  example), the state's own look takes over, with a morph like any other
  change.
- It never wanders in stillness, and it pauses while the tab is hidden.
- It is Home only. Everywhere else the orb keeps its states.

**Verified in a browser.** I rendered the real `DottedOrb` in headless
Chromium. At rest it moved through sash → ring → dotted sphere → sash at
6-second steps. A "thinking" orb beside it kept its shape the whole time.

**Tests.** `validate:ai-orb` has 159 checks (+4). Each was confirmed by
breaking the code on purpose; all three breaks were caught:
- wandering that may repeat the current shape;
- wandering while the orb is thinking;
- Home not wandering.

## Dotted orb colour — Aurora flow under Aurora, the basic orb under Core (2026-09-23)

The owner was shown six colourings, then four drawn over the real Aurora
ground, and chose **Aurora flow**: the dots wear the wave field's own blues,
and the colours ripple through the sphere with the field's own noise. His
condition: *"this only for Aurora style — if I change the system style to
Core, the orb becomes the basic one."*

**The style decides, nothing else.** `dottedPalette()` reads `data-kx-skin`
on `<html>`. Aurora gives `"aurora"`. Core, a missing value or an unknown one
gives `"mono"`, which is the original grey ink byte for byte. The orb watches
the attribute, so switching the style in Settings recolours every orb on the
page at once, with no reload. The aura orb is not touched.

**One Aurora in the tree.** The field's palettes and its simplex noise moved
unchanged from `WavyBackground` to `src/lib/aurora-field.ts`. The field
imports them from there, and so does the orb (`dotted-orb-ink.ts`), so the
two cannot drift apart. Goldens taken from the pre-move source lock the field
to the last bit: same five blues per theme, same grounds, same noise.

**How it looks.**
- Every ramp stop is one of the field's colours. On a dark ground it runs from
  ice blue at the top down to steel; on a light ground the field's mid blues
  run down to its deepest one.
- Colour belongs to the place on the orb, not to the dot. Dots travel through
  it as they turn, so a morph needs nothing extra.
- Near dots stay brighter than far ones, so the sphere keeps its depth.

**Calm and cheap, as promised.**
- The ripple runs at 0.15 noise units a second; the approved sample ran 0.25.
- It ripples only on the full-size tuning. A chat-bubble orb (under 40 px)
  shows the same colours held still.
- Stillness (the OS setting or the Hub's own) and a machine marked low-power
  also hold the colours still.
- The cost is one noise lookup per dot per frame, from a single noise shared
  by every orb on the page.

**Verified in a browser.** I rendered the real `DottedOrb` in headless
Chromium under Aurora and Core, in dark and light: blue under Aurora, the
original grey under Core. Flipping the style on a mounted orb recoloured it
both ways, with no reload.

**Tests.** `validate:ai-orb` has 171 checks (+12). Each was confirmed by
breaking the code on purpose, and all 17 breaks were caught.

## Chat: a second backup provider (Grok), set by configuration (2026-09-23)

The owner asked to "put Grok as a second backup for the chat". The chat now tries three providers in order: DeepSeek, then `AI_FALLBACK_*`, then `AI_FALLBACK2_*`.

**How it is built.** The second backup is the same OpenAI-compatible adapter as the first, created by `createOpenAiCompatibleAdapter(slot)`, so it follows the same rules: HTTPS only, the key read at call time, protected body keys, and its own entry in the circuit breaker. No vendor is named in code; Grok is only configuration.

**Borrowing the key by name.** A slot can reuse a key the deployment already has: `AI_FALLBACK2_API_KEY_FROM=AI_VOICE_GROK_API_KEY`. The secret is never copied or pasted. Only a name shaped `AI_…_API_KEY` is accepted, so this can never reach the database service key or a session secret.

**Configuration.** Set these four in Vercel (none of them is a secret), then redeploy:

| Variable | Value |
|---|---|
| `AI_FALLBACK2_BASE_URL` | `https://api.x.ai/v1` |
| `AI_FALLBACK2_MODEL` | `grok-4.7` |
| `AI_FALLBACK2_LABEL` | `grok` |
| `AI_FALLBACK2_API_KEY_FROM` | `AI_VOICE_GROK_API_KEY` |

The session could not set them itself: the Vercel connector returns 403 on project environment variables.

**How to check it.** `/api/ai/providers?probe=1` (super-admin) lists all three providers and sends each one a tiny turn. If the second backup is not configured, the route explains why using its own variable names (`fallback2_not_configured_because`).

**Tests.** `validate:ai-provider` has 183 checks (+27). Each was confirmed by breaking the code on purpose: the order, an unsafe borrow, the own key taking precedence over a borrowed one, the slot's variable names, the slot reading the first slot's settings, and the route probing only two providers.

## Koleex AI models, part 1: the server (2026-09-23)

The owner asked to turn the three providers into Koleex AI models the user can pick from, like the model pickers in the big chat apps. The names are Koleex's own. No vendor is named anywhere the user can see.

| Model | Good at | Voice | Slot behind it |
|---|---|---|---|
| **Auto** (default) | Koleex picks per question | yes | no preference: the normal order |
| **Koleex Blink** | fast answers, translation, Chinese | yes | `AI_FALLBACK_*` |
| **Koleex Mind** | everyday work: products, prices, quotations | no | the primary adapter |
| **Koleex Deep** | deep thinking, analysis, long files | yes | `AI_FALLBACK2_*` |

**Where it lives.** `src/lib/ai/koleex-models.ts` is the catalog: ids, names and one-line descriptions in English, Chinese and Arabic. It is shared with the browser and names no vendor, and a test enforces that. `src/lib/server/ai/provider/koleex-model-slots.ts` is the only file that knows which slot stands behind each name, and it is server-only.

**The client asks and the server decides.** The agent route accepts an optional `model` in the body. `resolveRequestedModel` turns any value it doesn't recognise into Auto, and so does a model an operator has switched off. A client can never pick something that doesn't exist or has been switched off.

**A choice is a preference, not a cage.** The chosen model is tried first (`preferFirst` in the registry, applied after the unconfigured providers are filtered out). The others stay behind it as failover exactly as before, so a choice can never leave a user without an answer. The failover kill-switch still applies.

**The reply says which model answered.** Every agent response now carries `model`: `"blink" | "mind" | "deep" | null`. It is derived from the provider that actually served, and only from a configured slot, so the degraded lane that answers without a model is never credited to one. The picker (part 2) will use it to show "answered by Koleex X" after a failover. The fast lane's provider label now records the provider that served rather than the one predicted.

**Operator switch.** `AI_MODELS_DISABLED=deep,blink` (case-insensitive) takes models out of service. Auto can't be switched off.

**The picker's list.** `GET /api/ai/models` (and `/api/v1/ai/models`) sits behind the same sign-in and internal-user check as every Koleex AI endpoint. It returns `{ models: [{ id, available }], default: "auto" }`, with names and booleans only.

**Still to come.** Part 2 adds the picker beside the message box, saved in the account's preferences. Part 3 makes voice calls follow the choice. Part 4 adds smarter Auto routing, the super-admin switch screen and a per-model speed and cost view. Koleex Deep only serves once the four `AI_FALLBACK2_*` variables above are set. Until then it is shown as unavailable.

**Tests.** `validate:ai-models` is a new suite with 47 checks. Each was confirmed by breaking the code on purpose, and all 12 breaks were caught.

## Koleex AI models, part 2: the picker (2026-09-23)

A button beside the message box shows the model in use ("Auto ⌄", "Mind ⌄"). Tapping it opens the list: each model's name, what it is good at, a "Text only" tag on Mind, and a tick on the current one. The list opens above the whole message box, so it never covers what the user is typing. It works in English, Chinese and Arabic, including right-to-left.

**Saved like the orb style.** The choice is stored on the account as `preferences.ai_model`, so the phone, the iPad and the Mac agree. It is copied to the browser's storage so the right name shows on the first frame. `withDefaults` passes it through, so saving another setting never resets it to Auto. The store is `components/ai/model-choice.ts`.

**Available means the server says so.** The picker reads `/api/ai/models`. A model that is not set up, or has been switched off, is dimmed with "Not available right now" and can't be chosen. If that list fails to load, nothing is granted: the server still resolves the choice on every turn.

**Who answered.** Every turn sends `model`. When a chosen model did not answer, because it was down or not set up and the turn failed over, the reply shows a quiet "Answered by Koleex X" under it. Auto, or the model that was asked for, gets no note. This note is only in the browser and is never saved.

**Tests.** `validate:ai-models` now has 58 checks (+11). Each was confirmed by breaking the code on purpose, and all 7 breaks were caught.

## Koleex AI models, part 3: the call follows the model (2026-09-24)

On a call, a model is a line:

| Model | Call line |
|---|---|
| **Auto** | the line the lane rules choose, exactly as before: the server's word, this device's probe and call verdicts, and a line picked by hand earlier |
| **Koleex Blink** | China (Mainland) line |
| **Koleex Mind** | text only, so the call runs on Auto and the call screen says so |
| **Koleex Deep** | International line |

**Where it happens.** `pinnedLaneFor(model, { wsAvailable, fellBack })` in `lib/voice/voice-pref.ts` is pure. `VoiceCallButton.applyModelLane()` runs at the start of every new call, but not on a resume, because a call coming back keeps its line. For Blink and Deep it pins the line. For Auto right after a pinned call, it restores the lane rules' answer. For Auto after Auto it does nothing, so the existing lane machinery is unchanged.

**A preference, not a cage.** If Deep can't have its line, because the international line already failed on this screen or the deployment has none, the call is placed on the mainland line and shows the existing "can't be reached" note. The one-time fallback, the retry and the background re-check all work as before.

**The Line control is replaced by the model list.** The call's settings now list the four models. Each row names the line it uses; the Auto row also shows the line Auto found. Mind is shown but can't be chosen for a call. A choice made here is the same choice as the picker beside the message box, and it is saved on the account through the parent. Picking a model on a different line rebuilds the call there and keeps the transcript. Nothing writes a hand-picked line (`source: "user"`) any more; a verdict saved earlier still counts for Auto.

**Tests.** `validate:ai-models` has 65 checks (+7). `validate:voice-client` has 799, with its five line-control checks rewritten for the model list. Each change was confirmed by breaking the code on purpose, and all 7 breaks were caught.

## Deep check 2026-09-24, phase 1: security

Owner: "make a deep check for this app and fix any issue or bug". Five read-only audits found the issues: chat client, voice, server, performance and UI/UX. The fixes ship in six phases. This one is security.

- **The model can no longer agree on the user's behalf.** Within a single turn, the model could preview a write and then confirm it on its next iteration, and the ledger row would match. A colleague-written task description or a document was enough to steer it there. The orchestrator now gives each turn a set of the previews it made. `dispatchTool` refuses a confirm of any preview in that set, before the ledger and whatever the ledger's mode. Consent can only come from a later user message or a tap on the confirm route. Pinned in `validate:ai-confirm-ledger`.
- **Viewing as someone is read-only in Koleex AI too.** The AI write routes (agent, conversations, projects, feedback, attachments, chunk) now pass `req` to `requireAuth`, which refuses mutating methods while viewing as.
- **The direct storage-path attachment mode is retired.** It accepted any path under `ai-attachments/`, across every account and tenant, then read it and deleted it. The client stopped using it when the chunk relay arrived.
- **The chat list cache is per account.** Its key now carries the account id; the old shared key is removed; a 401/403 clears the list on screen.
- **Knowledge-base text is fenced** as untrusted document content, like attachments and web results.

**Tests.** `validate:ai-deepcheck` is a new suite (18 checks), and `validate:ai-confirm-ledger` has 35 (+9). Each was confirmed by breaking the code on purpose, and all 7 breaks were caught.

## Deep check 2026-09-24, phase 2: voice

- **Pulses and cut sentences on the international line.** The worklet sink *transfers* each audio buffer, and `gate.push(samples.length)` ran after the transfer, so it read 0 every time. The playout gate believed the buffer was always empty: it opened each answer on its timer and closed on every small gap, leaving 0.85–1.45 s of silence inside sentences whose next frames were milliseconds away. The length is now read before the push. The old test pinned the bug; it now pins the fix.
- **"Let me check…" and then silence.** A lookup's answer was sent on the socket its question arrived on. On the socket lane that socket is replaced every ~24 s (handover) and after a cut (resume), and the relay drops frames from a socket it no longer holds. A handover, or a redial the relay reports as `resumed`, now links the old channel to the new one, and answers follow that link. A fresh session gets no link, because its far side never asked the question.
- **Confirm on a call never saved.** The tap sent no `conversation_id`, so the ledger looked for a preview recorded under no conversation and refused. The pending write now carries the conversation id the session used, and the tap sends it.
- **Repeated sentences after a drop.** A drop now marks the open answer as `cut`. When a resumed relay continues the same answer, its final text (which starts with the cut words) folds back into that line, and the persister corrects the saved row. An answer that ended on its own, or a fresh answer that doesn't continue the cut one, stays a separate line.
- **Socket lifetime.** A redial's socket age starts at its own `onopen`, so a refused resume can no longer teach a wrong lifetime.
- **Voice watchdog.** The primary region has refused the watchdog on almost every run for weeks (365 errors in 17 days), while real calls connect on the alternate in ~60 ms. A slot failing while another is healthy is now logged at warn; error means no slot can serve a call.
- **Call settings sheet.** It is capped at 85 dvh and scrolls; on desktop it is at most 480 px wide. The model rows use plain words: Blink "Fastest in China", Deep "The strongest", Auto "Picks what works best on your network", plus the model it is using.
- **Not changed here, and why:**
  - *Relay ticket expiry on long calls (~10 min).* The fix is in `services/voice-relay`, which needs a Railway redeploy.
  - *Handover frame ordering.* Also a relay change.
  - *`CRON_SECRET`.* Kept identical to the other crons, because I can't confirm the variable is set in production.

**Tests.** `validate:ai-deepcheck` has 29 checks (+11: behaviour tests on the transcript fold plus source pins). The `validate:voice-client` and `validate:ai-voice` pins were updated to the new code. Each fix was confirmed by breaking the code on purpose, and all 7 breaks were caught.

## Deep check 2026-09-24, phase 3: chat

- **Duplicate sends on a flaky link.** A dropped send was resent whenever `online` was true. On a link that drops while the device still says it is online (Safari's "Load failed"), that meant at once, and again after every failure: one duplicated message per retry. Now the resend waits until the network has actually come back since the drop (`onlineReturn` counter). The dropped message's bubble is also removed, because its words go back into the composer.
- **Retry did nothing.** A chat whose load failed was treated as "already open". It no longer is.
- **New chat kept the previous chat's spinner and error card.** They are now cleared.
- **First-message race.** If the user opened another chat (or pressed Stop) while the new chat's POST was pending, the new chat was activated anyway: chat B was shown under chat A's id, and the message was lost. `createConversation({ activate: false })` now lets `send()` activate the chat only if the turn is still live.
- **Stop before the request left.** It used to leave an empty "thinking" bubble for ever. Now both bubbles go and the words come back.
- **Regenerate, Edit and tapped answers wiped the composer's draft and files.** Only a turn sent from the composer (typed or dictated) clears it now.
- **Leaving the app** aborts the reply and silences the read-aloud.
- **Task card outcomes** now carry across the placeholder → saved-row id swap.
- **Delete on a dead link** now says so; deleting the open chat also stops its load and clears `?c=`.
- **Code fences with no language** are drawn as code blocks.
- **Server side:**
  - **Stop reaches the server.** The stream's `cancel()` sets `stopped` and every frame goes through `emit()`. The orchestrator checks `isCancelled()` before each model round and before any tool runs, so no write happens after Stop.
  - **A turn no model could answer is a failed turn** (`AgentResponse.failed`). It used to be revealed and saved as the assistant's reply and logged ok=1. Now the stream sends a bare error frame (the browser words it in the user's language), the JSON path answers 503, nothing is saved, and it is logged ok=0.

**Tests.** `validate:ai-deepcheck` has 43 checks (+14), with pins updated in client-render, streaming, core-boundaries and models. Each fix was confirmed by breaking the code on purpose, and all 8 breaks were caught.

## Deep check 2026-09-24, phase 4: speed

- **Still background in the chat.** Per the owner's choice, `<WavyBackground still />` draws one frame. Before, the full-screen field redrew and re-blurred every frame under the glass, the composer and a streaming reply, which was the biggest battery and jank cost on a phone. The Hub's own Reduce Motion setting (`kx-reduce-motion`) is now honoured by the background everywhere.
- **Streaming no longer redraws the sidebar.** `SidebarRow` is memoised, and its handlers take the row, so the app passes the same functions on every render. Before, every streamed frame (~60/s) re-rendered every chat row, even with the drawer hidden.
- **The reply being written is parsed when the device has time.** `MessageMarkdown` parses a `useDeferredValue` of its content, so the growing answer is no longer fully re-parsed on every frame.
- **Lighter first open:**
  - react-markdown (~42 KB gz) is lazy-loaded with a plain-text fallback, and warmed 1.2 s after the app is up. The app always opens on an empty chat.
  - The accounts admin client (~28 KB gz) is imported only when a model choice is saved.
- **One orb stylesheet.** `<style href precedence>` hoists and de-duplicates it. Before, each assistant reply injected its own 17 KB copy.
- **Failover sooner.** A streaming provider that sends no headers is dropped after 30 s instead of 120 s, controlled by `AI_HTTP_HEADER_TIMEOUT_MS` and never above `AI_HTTP_TIMEOUT_MS`. The stall budget still protects slow but healthy answers.
- **Time to first token.** The per-account and per-tenant rate-limit round trip now runs beside the ownership and reply-language reads. A refused turn still returns before any write.

**Tests.** `validate:ai-deepcheck` has 51 checks (+8), with pins updated in client-render, export and models. Each change was confirmed by breaking the code on purpose, and all 6 breaks were caught.

## Deep check 2026-09-24, phase 5: hygiene

- **Dead code removed:**
  - `restoredRef`: written four times, never read. Its comments described an auto-restore effect that no longer exists.
  - `urlModeRef`: never set to anything but "push".
  - `isRtl` / `RTL_RE` in `Bubble.tsx`: superseded by `lib/text-direction`. Its test now checks `textDirection` directly.
  - The `orTypeYourOwn` copy key, which nothing rendered.
- **One network-drop test.** `lib/ai/network-error.ts`'s `isNetworkError()` replaces two copies that disagreed (one called any TypeError a drop, the other missed Chrome's mid-stream "network error").
- **The app has a budget of its own.** Section J of `validate:budgets` finds the Koleex AI app chunk: 115 KB, with a 130 KB ceiling. It also asserts that the markdown renderer stays out of it. Section B only ever measured the `/ai` shell, because the app mounts through `next/dynamic`.
- **Held for phase 6:**
  - The inline SVGs in the message actions and the composer move to library icons there, because both rows are being redesigned.
  - The large `KoleexAiApp` split (sidebar, composer, turn logic) is also done with the redesign, so those screens are rewritten once, not twice.

## Deep check 2026-09-24, phase 6a: design, a quieter screen

- **One "+" in the message box** (`ComposerAddMenu`). It holds two items: "Files and photos" (the picker opens inside the tap, which iOS requires) and "Search the web". This replaces three round buttons: attach, emoji and globe. While search is on, a "Search ×" chip sits beside the "+" and turns it off, so the mode can't be forgotten inside a menu.
- **The emoji picker is gone** (`EmojiButton.tsx` and the 700-line `emojiData.ts`). The phone's keyboard already has emoji.
- **Removed:**
  - the "Koleex AI — Powered by …" line under the box;
  - the header subtitle that repeated the welcome text;
  - the sidebar's own back arrow on desktop, where the page header has one (the phone keeps it, since that drawer is its only way home);
  - the second "New project" row under a header that already has "+".
- **The pin shows only on pinned chats.** On a phone, every row used to show one. Pinning an unpinned chat is in the row's menu.
- **Menus portalled to `<body>` now carry the AI colours** (`.kx-ai-tokens`). Before, the row menu's red "Delete" rendered in plain text colour.
- **Row menu improvements.** It opens on the correct side in Arabic, uses 13 px text, and has 44 px rows on touch screens.
- **Egyptian Arabic throughout the chat.** Examples: النهاردة / امبارح / أقدم, رد حلو / رد مش كويس, وقّف الرد, ابعت, الأنسب, القايمة. The greeting uses each language's own punctuation ("أهلاً يا Kamal", "你好，Kamal。"), not "مرحبًا, Kamal.". The two attachment errors no longer say the same thing.
- **Task card:**
  - priority is shown in the reader's language ("High priority", "أولوية عالية");
  - the colours come from the app's own tokens (it named four that don't exist);
  - no half-pixel text sizes;
  - the "Open in To-do" arrow points the right way in Arabic.

**Tests.** `validate:ai-deepcheck` has 59 checks (+8), with pins updated in client-render and tasks. Each rule was confirmed by breaking the code on purpose, and all 8 breaks were caught. Screenshots were taken at 375 px in English, Arabic and Chinese, dark and light.

## Deep check 2026-09-24, phase 6b: design, the thread

- **One orb, on the latest reply.** The orb is the character and shows what Koleex AI is doing, so it sits on the newest message. Older replies keep its 38 px column as an empty gutter, so nothing shifts sideways when the orb moves to the next answer.
- **No avatar beside your own messages.** The initial or photo circle said nothing.
- **Your messages are a quiet grey** (`--bg-surface-hover`), not the inverted black/white block.
- **Replies are plain text in Core**, like a document (`.kx-ai-reply`). Under Aurora they keep the glass card the owner asked for; the padding, rim and radius live only in that skin's CSS.
- **Actions on the latest reply only.** An older reply shows copy / listen / 👍 👎 on hover or keyboard focus, and on a touch screen after a tap on the message. The tap never steals a tap from a button or link inside it. The per-message Edit works the same way and stays visible while editing.
- **Library icons.** Copy, Check, Volume2, RefreshCw and Pencil come from `icons/ui`. ThumbsUp and ThumbsDown were drawn into the library in the house stroke grammar and exported from the barrel. The inline SVGs and the "✎" text glyph are gone.
- **Attachment chips in your bubble** use the theme border; `border-white/15` vanished in light mode.

**Tests.**
- `validate:ai-deepcheck` has 64 checks (+5), and `validate:ai-client-render` has 3 new rendered checks.
- Each rule was confirmed by breaking the code on purpose, and all 6 breaks were caught.
- Screenshots were taken at 375 px: English dark, Arabic light, and Aurora.

## Deep check 2026-09-24, phase 6c: design, the call screen

- **The type-in line waits behind a keyboard button.** The button is labelled "Type" and sits beside Mic, Settings and End. A call is spoken, and a text box across the bottom of every call said otherwise and pushed the controls up. One tap opens the line with the cursor in it; it stays open while it holds text or a "not live yet" notice. `KeyboardIcon` was drawn into the library in the house stroke grammar.
- **One helper line under the orb, at most.** The order is: the line note ("Koleex Deep can't be reached"), else the text-only note for Mind, else the how-to hint. Before, two or three stacked up.
- **The hint says what to do, not what is missing.** "Just talk. I answer when you pause." / «اتكلم عادي، وأنا هرد لما تسكت.» / 「直接说话，你一停下我就回答。」 replaces "There is no button to hold".
- **The settings button is labelled "Settings".** Before, the voice's name sat under a sliders glyph and read as the name of a different control. The voice is still in the sheet.
- **The four controls fit a 375 px phone** (`gap-6`, `sm:gap-10`).
- **Kept on purpose:** the KOLEEX wordmark at the top. The owner asked for its position on 2026-09-11, and a suite pins it.

**Tests.**
- `validate:ai-deepcheck` has 68 checks (+4).
- `validate:ai-client-render` has a new rendered check for the closed / open type line.
- Pins were updated in client-render, voice-client and models.
- Each rule was confirmed by breaking the code on purpose, and all 4 breaks were caught.
- Screenshots were taken at 375 px in English and Arabic.

## Koleex models 4/4, step 1: the owner's on/off switch per model (2026-09-24)

- **Where:** Settings → Koleex AI → "Koleex models (for everyone)", shown to super admins only.
  - One switch per model, by Koleex name, with a note: Blink keeps China calls; Mind is text only; turning Deep off closes the international call line.
  - A model whose slot isn't set up, or that `AI_MODELS_DISABLED` turns off, is shown but can't be flipped.
- **Storage:** `platform_settings` (the existing KV table, RLS deny-all), keys `ai_model_off_<id>`, booleans.
  - No new table.
  - Written through `/api/platform-settings` PATCH: super admin only, booleans only, known keys only.
  - Not in `READABLE`, so the GET does not hand the switches to everyone.
- **Read:** `provider/model-switches.ts`, cached for 30 s per instance.
  - A save clears the cache on the instance that saved it; other instances follow within 30 s.
  - A failed read keeps the last known state.
  - The env switch and the table switch both count.
- **Effect:**
  - A switched-off model is Auto when chosen and "unavailable" in the picker.
  - It is dropped from Auto and from failover: `chatWithTools` reads the switches once for every caller, and `chatWithToolsVia({ exclude })` drops them.
  - It is still used if it is the only configured model left: a switch never leaves a user without an answer.
  - Deep off also removes the socket call lane (voice session route and ws-session route).
  - Blink's mainland voice lane is never switched off from here.
- **Tests:** `validate:ai-models` has 79 checks (+14). Each rule was confirmed by breaking the code on purpose, and all 6 breaks were caught.
