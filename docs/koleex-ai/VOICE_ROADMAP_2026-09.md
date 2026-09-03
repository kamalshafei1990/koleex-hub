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
| B1 | End-of-call summary (in progress) | When the call ends with ≥ 2 exchanges, summarise the transcript (existing chat lane, no new provider) into 3–5 bullets + numbers said; show a card with Copy and "Save as task" (confirmed) |
| B2 | Push-to-talk and noise mode | A mode in the voice sheet: hold to talk (mic track enabled only while held), plus a higher VAD threshold preset for noisy rooms — tuned in a real room, as session-config.ts already notes |
| B3 | Barge-in check | Verify the client stops local playback on `input_audio_buffer.speech_started`; fix if the far side keeps talking over the caller |
| B4 | One voice everywhere | The "listen" button in text chat uses the browser's synthesis today; route it through the vendor's TTS so the character has one voice (mainland-reachable endpoint required) |
| B5 | Survive a locked screen | Investigate wake lock / audio session options for the installed iOS app; document what the platform allows |

## Phase C — capabilities

| # | Item | How |
|---|------|-----|
| C1 | Customers, inventory and pricing rules on a call | Read-only, under the caller's own module permissions (the same `checkModule` gates the text lane uses); still no writes without confirmation |
| C2 | Search across conversations | Sidebar search over titles and message text (server-side, owner-scoped) |
| C3 | Library | A gallery of every picture that appeared in the caller's conversations |
| C4 | Morning voice brief | Open a call in the morning: tasks due, quotations awaiting approval, new customers — built on the existing tools, spoken in the caller's language |

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
