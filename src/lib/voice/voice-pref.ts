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
export type SavedLane = { lane: VoiceLane; at: number };

export function parseSavedLane(raw: string | null | undefined): SavedLane | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { lane?: unknown; at?: unknown };
    if ((v.lane === "rtc" || v.lane === "ws") && typeof v.at === "number" && Number.isFinite(v.at)) return { lane: v.lane, at: v.at };
  } catch {
    /* not ours */
  }
  return null;
}

/** THE LANE A CALL STARTS ON. The server's word wins when it says the
 *  socket lane (a caller it already sends there needs no second opinion);
 *  when it says mainland, a fresh device verdict overrides it in either
 *  direction; a stale or absent verdict leaves the server's answer and
 *  asks for a probe. Pure. */
export function decideLane(
  server: VoiceLane,
  saved: SavedLane | null,
  now: number,
  ttlMs: number = LANE_TTL_MS,
): { lane: VoiceLane; probe: boolean } {
  if (server === "ws") return { lane: "ws", probe: false };
  const fresh = saved !== null && now - saved.at >= 0 && now - saved.at < ttlMs;
  if (fresh && saved) return { lane: saved.lane, probe: false };
  return { lane: "rtc", probe: true };
}

export function readSavedLane(): SavedLane | null {
  try {
    return parseSavedLane(window.localStorage.getItem(LANE_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveLane(lane: VoiceLane, now: number = Date.now()): void {
  try {
    window.localStorage.setItem(LANE_STORAGE_KEY, JSON.stringify({ lane, at: now } satisfies SavedLane));
  } catch {
    /* storage refused — the next call probes again */
  }
}
