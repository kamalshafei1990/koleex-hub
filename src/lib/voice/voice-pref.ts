/* ---------------------------------------------------------------------------
   voice/voice-pref — which voice the caller chose, remembered on the device.

   The picker restarted the call on every choice and then forgot it: the next
   call pre-selected the first voice again. The same shape as stt-lang.ts,
   for the same reason — a preference the caller expressed once should hold
   until they change it, and storage can be absent or refused, so nothing
   here throws.

   The stored value is the server's OPAQUE key (v1, v2…), never a vendor id:
   the device knows only what the server listed. A saved key the current
   catalogue no longer offers falls back to the first entry, which is the
   voice the vendor uses when none is asked for.
   --------------------------------------------------------------------------- */

export const VOICE_STORAGE_KEY = "koleex-voice-voice";

/**
 * The voice to pre-select: the saved key when the catalogue still offers it,
 * else the first offered, else nothing (no catalogue, no picker). Pure.
 */
export function pickVoiceKey(
  saved: string | null | undefined,
  offered: readonly { key: string }[],
): string | null {
  if (offered.length === 0) return null;
  const want = (saved ?? "").trim();
  return offered.some((v) => v.key === want) ? want : offered[0].key;
}

/** Read the device's memory. Never throws — storage can be absent or refused. */
export function readSavedVoiceKey(): string | null {
  try {
    const v = window.localStorage.getItem(VOICE_STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Remember the caller's choice. Never throws. */
export function saveVoiceKey(key: string): void {
  try {
    window.localStorage.setItem(VOICE_STORAGE_KEY, key);
  } catch {
    /* Private mode or a full store: the choice lasts for this page. */
  }
}

/* ── The region that served this device last ─────────────────────────────
   The server remembers which region answered (#340), but only while its
   instance is warm; the first call after a quiet spell still spent 13 s on
   a mainland endpoint that had not answered all day. The DEVICE remembers
   too: the slot that served its last call is sent as the two-word hint the
   server allow-lists ("primary" | "alt") on every call. The server still
   decides — a hint names an endpoint the server owns, never a url — and a
   stale hint costs one attempt, which is what a wrong guess costs today. */

export const REGION_STORAGE_KEY = "koleex-voice-region";
export type RegionSlot = "primary" | "alt";

export function parseRegionSlot(raw: string | null | undefined): RegionSlot | null {
  return raw === "primary" || raw === "alt" ? raw : null;
}

/** Read the device's memory. Never throws. */
export function readSavedRegion(): RegionSlot | null {
  try {
    return parseRegionSlot(window.localStorage.getItem(REGION_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Remember the slot that served. Never throws. */
export function saveRegion(slot: RegionSlot): void {
  try {
    window.localStorage.setItem(REGION_STORAGE_KEY, slot);
  } catch {
    /* Private mode or a full store: the memory lasts for this page. */
  }
}

/* ── How the caller talks: hands-free or hold to talk ────────────────────
   Roadmap B2. Server-side turn detection listens to the room the whole
   time, and in a loud room — a factory floor, a trade-show hall — the room
   gets turns of its own: phantom turns that cut Koleex AI off, and answers
   to nobody. A caller there wants the microphone open only while they hold
   a button. That is a device-side choice about the microphone, not a session
   setting, so it needs no new handshake and no vendor field: the call
   button gates the mic tracks (VoiceSession.setMuted) around the hold.
   Remembered like the voice: chosen once, kept until changed. */

export const TALK_MODE_STORAGE_KEY = "koleex-voice-talk";
export type TalkMode = "hands-free" | "hold";
export const DEFAULT_TALK_MODE: TalkMode = "hands-free";

export function parseTalkMode(raw: string | null | undefined): TalkMode | null {
  return raw === "hands-free" || raw === "hold" ? raw : null;
}

/** Read the device's memory; hands-free when nothing was chosen. Never throws. */
export function readSavedTalkMode(): TalkMode {
  try {
    return parseTalkMode(window.localStorage.getItem(TALK_MODE_STORAGE_KEY)) ?? DEFAULT_TALK_MODE;
  } catch {
    return DEFAULT_TALK_MODE;
  }
}

/** Remember how the caller talks. Never throws. */
export function saveTalkMode(mode: TalkMode): void {
  try {
    window.localStorage.setItem(TALK_MODE_STORAGE_KEY, mode);
  } catch {
    /* Private mode or a full store: the choice lasts for this page. */
  }
}

/* ---------------------------------------------------------------------------
   WHICH LANE WORKS FROM THIS DEVICE — remembered, with an age.

   The server's country-based answer is a default, not a fact about the
   browser's network (see lane-probe.ts). What the probe or a real call
   found is kept here so the next call starts on the right lane with no
   probe, and forgotten after a while because networks change: a phone
   that leaves the VPN, or the office, is a different network. Pure
   helpers plus two storage wrappers that never throw.
   --------------------------------------------------------------------------- */

export const LANE_STORAGE_KEY = "koleex-voice-lane";
/** How long a probe's or a call's verdict stands before it is re-checked. */
export const LANE_TTL_MS = 6 * 60 * 60 * 1000;
export type VoiceLane = "rtc" | "ws";
/** Who decided: the caller in the Line control, the background probe, or a
 *  call that came up (or fell back) on a lane. A fresh USER verdict is not
 *  overridden by the probe (audit, 2026-09-11). */
/* "server" is the deployment's own answer for this caller's country, learnt
   from the config read and written down so the NEXT page load starts on it
   without waiting for that read again. See startingLane. */
export type LaneSource = "user" | "probe" | "call" | "server";
export type SavedLane = { lane: VoiceLane; at: number; source?: LaneSource };

export function parseSavedLane(raw: string | null | undefined): SavedLane | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { lane?: unknown; at?: unknown; source?: unknown };
    if ((v.lane === "rtc" || v.lane === "ws") && typeof v.at === "number" && Number.isFinite(v.at)) {
      const source = v.source === "user" || v.source === "probe" || v.source === "call" || v.source === "server" ? v.source : undefined;
      return source ? { lane: v.lane, at: v.at, source } : { lane: v.lane, at: v.at };
    }
  } catch {
    /* not ours */
  }
  return null;
}

/** THE LANE A CALL STARTS ON. The server's word wins when it says the
 *  socket lane (a caller it already sends there needs no second opinion);
 *  when it says mainland, a fresh device verdict is where the next tap
 *  goes — with no wait — and a stale or absent one leaves the server's
 *  answer. EITHER WAY THE PROBE RUNS (2026-09-11: the owner switched a VPN
 *  on inside the six hours and the picker kept the mainland voices — a
 *  fresh "mainland" verdict was a lock, and the socket lane was never
 *  re-tried). A verdict is the first call's lane, not the day's; the probe,
 *  in the background, moves the lane when the network has moved. Pure. */
export function verdictIsFresh(saved: SavedLane | null, now: number, ttlMs: number = LANE_TTL_MS): boolean {
  return saved !== null && now - saved.at >= 0 && now - saved.at < ttlMs;
}

export function decideLane(
  server: VoiceLane,
  saved: SavedLane | null,
  now: number,
  ttlMs: number = LANE_TTL_MS,
): { lane: VoiceLane; probe: boolean } {
  const fresh = verdictIsFresh(saved, now, ttlMs);
  /* THE CALLER'S OWN CHOICE STANDS while it is fresh: a probe that happened
     to succeed through a flaky tunnel used to move a caller who had picked
     the mainland line back to the international one on the next load
     (audit, 2026-09-11). Probe and call verdicts are still re-checked. */
  if (fresh && saved && saved.source === "user") return { lane: saved.lane, probe: false };
  /* WHAT THIS NETWORK DID BEATS WHAT THE COUNTRY SAYS (owner, 2026-09-17:
     "still same", a third time).

     `server` is a guess from the country stamp on the request — nothing
     more. It used to be checked FIRST and to end the decision, so a
     deployment that answers "ws" overrode every verdict this device had
     earned on this network. The owner's beacon is what that costs:

       service-unreachable elapsedMs=11698 lane=ws fellBack=true
       err="AbortError: Fetch is aborted" canary=timeout:3502ms+retry

     Our own ws-session route answered 200 twice (04:57:29 and :35) and
     neither answer reached the browser; the canary to our own origin timed
     out at 3.5 s. The call then fell back to the mainland lane and
     connected — and wrote "rtc" down, as it should. On the next load the
     country stamp said "ws" again, the verdict was ignored again, and the
     same twelve seconds were spent again. Every call, which is exactly
     what "always slow" means.

     A verdict from a REAL CALL or a PROBE is evidence from this network; it
     now wins over the guess. The probe still runs behind it, so a network
     that recovers moves the lane back on its own — the lock the 2026-09-11
     note warns about is what `probe: true` exists to prevent. */
  if (fresh && saved && (saved.source === "call" || saved.source === "probe") && saved.lane !== server) {
    return { lane: saved.lane, probe: true };
  }
  if (server === "ws") return { lane: "ws", probe: false };
  return { lane: fresh && saved ? saved.lane : "rtc", probe: true };
}

/* THE VOICE NAMES ARE THE PRODUCT'S, ON BOTH LANES (2026-09-11): the same
   five keys, the same labels, a different vendor id behind each on each
   lane. So a voice cannot name a lane, and a picker that merged both lists
   showed one row (the keys collided). The lane is its own choice — the
   "Line" control in the voice sheet (VoiceCallButton.selectLane); the
   voices offered are the chosen lane's, as before. */
export type VoicesByLane = { rtc: readonly { key: string; label: string }[]; ws: readonly { key: string; label: string }[] };

/* ── WHICH LANE A TAP OPENS ON BEFORE THE SERVER HAS ANSWERED ──────────────
   THE RACE THIS CLOSES (owner, 2026-09-17: "still slow", twice in a row).
   The button held its lane in a ref that started at "rtc" and was corrected
   only when the config read came back — and that read costs the auth
   round trip (measured 470–840 ms, most of it the session lookup). A caller
   who taps inside that window places the call on the mainland lane whatever
   the deployment says, and the production logs show exactly that: two calls
   at 04:32 and 04:33, both preceded by `[ai.voice] lane=ws`, both posting to
   the WebRTC handshake. On this caller's network that lane does not connect
   at all — the beacon reads `ice=new … iceEverConnected=false` after 25 s.

   The device already writes down the lane every probe, every live call and
   every deliberate choice; it just was not reading it at the start. Now it
   does, and the fresh verdict is the tap's starting lane. Pure, so the race
   is closed by a rule rather than by timing. A device with nothing written
   down still starts on "rtc" — the lane that needs no relay — and the
   config's answer corrects it as before, and is now written down too. */
export function startingLane(saved: SavedLane | null, now: number, ttlMs: number = LANE_TTL_MS): VoiceLane {
  if (!saved) return "rtc";
  const fresh = now - saved.at >= 0 && now - saved.at < ttlMs;
  return fresh ? saved.lane : "rtc";
}

export function readSavedLane(): SavedLane | null {
  try {
    return parseSavedLane(window.localStorage.getItem(LANE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveLane(lane: VoiceLane, now: number = Date.now(), source: LaneSource = "probe"): void {
  try {
    window.localStorage.setItem(LANE_STORAGE_KEY, JSON.stringify({ lane, at: now, source } satisfies SavedLane));
  } catch {
    /* storage refused — the next call probes again */
  }
}
