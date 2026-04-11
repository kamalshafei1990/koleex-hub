/* ---------------------------------------------------------------------------
   notificationSound — tiny Web Audio "ping" used by Discuss (and later by
   Mail / Notifications) to alert the user when something arrives.

   Why Web Audio and not an <audio> tag with an mp3:
     · Zero network round-trip and zero asset to ship.
     · No CORS / mime-type / preload headaches.
     · Plays the same on every browser that supports AudioContext.

   Browser autoplay policy:
     · Most browsers (Chrome, Safari, Firefox) require a user gesture
       before audio can start. We lazily create the AudioContext and
       attach a one-shot click/touchstart/keydown listener that resumes
       it the first time the user interacts with the page. After that,
       playNotificationSound() can be called from any callback (including
       a Supabase realtime handler) and it just works.

   The tone itself is a quick two-note chime (A5 → E6) — pleasant enough
   to notice but short enough not to be annoying.
   --------------------------------------------------------------------------- */

let audioCtx: AudioContext | null = null;
let unlockListenersAttached = false;
let pendingPlayUntilUnlock = false;

type CtorType = typeof AudioContext | undefined;

function getCtor(): CtorType {
  if (typeof window === "undefined") return undefined;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  );
}

function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor = getCtor();
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    return null;
  }
  /* Newly-created AudioContexts are usually "suspended" until a user
     gesture; resume() inside a gesture promotes them to "running". We
     try here optimistically — if we're not currently in a gesture the
     promise just rejects silently. */
  if (audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function actuallyPlay() {
  const ctx = audioCtx;
  if (!ctx || ctx.state !== "running") return false;
  try {
    const now = ctx.currentTime;
    const tones: Array<{ freq: number; start: number; dur: number }> = [
      { freq: 880, start: 0, dur: 0.13 }, // A5
      { freq: 1320, start: 0.09, dur: 0.2 }, // E6
    ];
    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = tone.freq;
      const t0 = now + tone.start;
      const t1 = t0 + tone.dur;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t1 + 0.02);
    }
    return true;
  } catch {
    return false;
  }
}

function attachUnlockListeners() {
  if (unlockListenersAttached) return;
  if (typeof window === "undefined") return;
  unlockListenersAttached = true;
  const unlock = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().then(() => {
        if (pendingPlayUntilUnlock) {
          pendingPlayUntilUnlock = false;
          actuallyPlay();
        }
      });
    } else if (pendingPlayUntilUnlock) {
      pendingPlayUntilUnlock = false;
      actuallyPlay();
    }
  };
  window.addEventListener("click", unlock, { passive: true });
  window.addEventListener("touchstart", unlock, { passive: true });
  window.addEventListener("keydown", unlock);
}

/** Call once on app mount so the AudioContext is ready as soon as the
 *  user clicks anywhere. Safe to call multiple times — the listeners
 *  are only attached on the first call. */
export function primeNotificationSound() {
  attachUnlockListeners();
  /* Best-effort: try to create the context now. On most browsers it
     starts suspended and the unlock listeners will resume it on the
     first click. */
  ensureCtx();
}

/** Play the two-note notification chime. Safe to call from any
 *  callback. If the audio context can't play yet (no prior user
 *  gesture) we set a flag and the next click/keydown/touchstart will
 *  fire a single chime — better than swallowing it silently. */
export function playNotificationSound() {
  attachUnlockListeners();
  const ctx = ensureCtx();
  if (!ctx) {
    if (typeof console !== "undefined") {
      console.warn("[notificationSound] no AudioContext support");
    }
    return;
  }
  if (ctx.state === "running") {
    actuallyPlay();
    if (typeof console !== "undefined") {
      console.log("[notificationSound] played");
    }
    return;
  }
  /* Suspended → try to resume; if it works inside this turn, play
     immediately. Otherwise queue a one-shot play for the next user
     gesture. */
  void ctx.resume().then(() => {
    if (ctx.state === "running") {
      actuallyPlay();
      if (typeof console !== "undefined") {
        console.log("[notificationSound] played after resume");
      }
    } else {
      pendingPlayUntilUnlock = true;
      if (typeof console !== "undefined") {
        console.log(
          "[notificationSound] suspended — will play on next click",
        );
      }
    }
  });
}
