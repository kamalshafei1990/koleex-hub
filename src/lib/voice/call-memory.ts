/* ---------------------------------------------------------------------------
   voice/call-memory — a pulse on the device while a call is up, so a call
   the page died under can be recognised — and reported — when the page is
   back.

   THE EXIT THAT LEAVES NO TRACE. A call ended by fail() beacons its reason;
   one ended by a reload or a hidden page beacons from pagehide. A page the
   phone KILLS (memory, a system interruption) fires nothing at all — the
   document is gone before any handler runs — and the owner's "it closed by
   itself" had no line in the log four times in one evening. Nothing can be
   sent from a page that no longer exists; but the page that comes back can
   read what the dead one wrote every few seconds and say so.

   So a live call writes its pulse to localStorage: the lane, the voice, the
   conversation, when it started, and the session's diagnostics. Hanging up
   clears it. On the next load, a pulse that is recent (younger than
   INTERRUPTED_WITHIN_MS) and never cleared means the page died under a
   call: the button beacons `page-killed` with the last diagnostics, tells
   the caller, and clears the pulse.

   Pure functions over a storage-like object; the browser's localStorage in
   the button, a Map in the suite.
   --------------------------------------------------------------------------- */

export const CALL_PULSE_KEY = "koleex-voice-call-pulse";
/** How often the pulse is written. */
export const CALL_PULSE_EVERY_MS = 5_000;
/** A pulse older than this is a call that ended a long time ago on a page
 *  whose hang-up never cleared it (a crash on the way out): not reported. */
export const INTERRUPTED_WITHIN_MS = 45_000;

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export type CallPulse = {
  at: number;
  startedAt: number;
  lane: string;
  voice: string | null;
  conversation: string | null;
  elapsed_ms: number;
  events: string;
  last_event: string;
  ws_reconnects: number;
  ws_close: string;
};

export function writeCallPulse(storage: StorageLike, pulse: CallPulse): void {
  try {
    storage.setItem(CALL_PULSE_KEY, JSON.stringify(pulse));
  } catch {
    /* Storage full or refused: no pulse, no harm. */
  }
}

export function clearCallPulse(storage: StorageLike): void {
  try {
    storage.removeItem(CALL_PULSE_KEY);
  } catch {
    /* ignore */
  }
}

/** The pulse of a call the page died under, or null. Reading clears it,
 *  so it is reported once. */
export function takeInterruptedCall(storage: StorageLike, now: number = Date.now()): CallPulse | null {
  let raw: string | null = null;
  try {
    raw = storage.getItem(CALL_PULSE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  clearCallPulse(storage);
  try {
    const v = JSON.parse(raw) as Partial<CallPulse>;
    if (!v || typeof v.at !== "number" || !Number.isFinite(v.at)) return null;
    if (now - v.at > INTERRUPTED_WITHIN_MS || now < v.at) return null;
    return {
      at: v.at,
      startedAt: typeof v.startedAt === "number" ? v.startedAt : v.at,
      lane: typeof v.lane === "string" ? v.lane : "rtc",
      voice: typeof v.voice === "string" ? v.voice : null,
      conversation: typeof v.conversation === "string" ? v.conversation : null,
      elapsed_ms: typeof v.elapsed_ms === "number" ? v.elapsed_ms : 0,
      events: typeof v.events === "string" ? v.events : "",
      last_event: typeof v.last_event === "string" ? v.last_event : "",
      ws_reconnects: typeof v.ws_reconnects === "number" ? v.ws_reconnects : 0,
      ws_close: typeof v.ws_close === "string" ? v.ws_close : "",
    };
  } catch {
    return null;
  }
}

export function browserStorage(): StorageLike | null {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}
