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
