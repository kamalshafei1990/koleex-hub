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
