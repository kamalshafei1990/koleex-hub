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

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    return null;
  }
  return audioCtx;
}

function attachUnlockListeners() {
  if (unlockListenersAttached) return;
  if (typeof window === "undefined") return;
  unlockListenersAttached = true;
  const unlock = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === "suspended") {
      void ctx.resume().catch(() => {});
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
}

/** Play the two-note notification chime. Safe to call from any
 *  callback; if the audio context isn't unlocked yet (no prior user
 *  gesture) the call is a silent no-op. */
export function playNotificationSound() {
  const ctx = getCtx();
  if (!ctx) return;
  attachUnlockListeners();
  if (ctx.state === "suspended") {
    /* No user gesture yet → can't play. Try to resume in case we're in
       a click handler; if not, this just no-ops. */
    void ctx.resume().catch(() => {});
    if (ctx.state === "suspended") return;
  }
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
  } catch {
    /* ignore — audio is non-critical */
  }
}
