/* ---------------------------------------------------------------------------
   notificationSound — plays /notification.wav whenever Discuss (and
   later Mail / Notifications) wants to alert the user.

   Implementation:
     · A single shared HTMLAudioElement that points at /notification.wav.
       Reused across calls — we just rewind and play() each time, which
       is much cheaper than creating a new <audio> per ping and avoids
       hitting the browser's max-concurrent-media limit on rapid bursts.
     · The asset lives in /public so it ships with the Next build and is
       served from the same origin (no CORS, no auth headers).

   Browser autoplay policy:
     · Most browsers (Chrome, Safari, Firefox) require a user gesture
       before audio can start. We attach one-shot click/touchstart/
       keydown listeners on first import and use them to "unlock" the
       audio element with a silent muted play() inside the gesture.
       After that, playNotificationSound() can be called from any
       callback (including a Supabase realtime handler) and it just
       plays.
     · If a chime is requested before the unlock has happened we set a
       pending flag, and the very next user gesture fires a single
       backlog chime instead of swallowing it silently.
   --------------------------------------------------------------------------- */

const SOUND_URL = "/notification.wav";

let audioEl: HTMLAudioElement | null = null;
let unlocked = false;
let unlockListenersAttached = false;
let pendingPlayUntilUnlock = false;

function ensureAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (audioEl) return audioEl;
  try {
    const el = new Audio(SOUND_URL);
    el.preload = "auto";
    /* A reasonable default — most users find ~70% pleasant. The user
       can still adjust via the OS volume. */
    el.volume = 0.8;
    audioEl = el;
  } catch {
    return null;
  }
  return audioEl;
}

function tryUnlock() {
  const el = ensureAudio();
  if (!el) return;
  /* Trigger a silent play() inside a user gesture so the autoplay
     unlock happens. We mute it first so the user doesn't hear a stray
     ping during the unlock click. */
  const wasMuted = el.muted;
  el.muted = true;
  const p = el.play();
  if (p && typeof p.then === "function") {
    p.then(() => {
      el.pause();
      el.currentTime = 0;
      el.muted = wasMuted;
      unlocked = true;
      if (pendingPlayUntilUnlock) {
        pendingPlayUntilUnlock = false;
        playNow();
      }
    }).catch(() => {
      el.muted = wasMuted;
    });
  } else {
    el.muted = wasMuted;
    unlocked = true;
  }
}

function attachUnlockListeners() {
  if (unlockListenersAttached) return;
  if (typeof window === "undefined") return;
  unlockListenersAttached = true;
  const onGesture = () => {
    if (!unlocked) tryUnlock();
  };
  window.addEventListener("click", onGesture, { passive: true });
  window.addEventListener("touchstart", onGesture, { passive: true });
  window.addEventListener("keydown", onGesture);
}

function playNow(): boolean {
  const el = ensureAudio();
  if (!el) return false;
  try {
    el.currentTime = 0;
  } catch {
    /* Some browsers throw if the media isn't ready yet — fine, just
       play from wherever. */
  }
  const p = el.play();
  if (p && typeof p.then === "function") {
    p.catch(() => {
      /* Most likely the autoplay policy blocked us. Mark unlocked
         false so the next user gesture re-tries. */
      unlocked = false;
      pendingPlayUntilUnlock = true;
    });
  }
  return true;
}

/** Call once on app mount so the audio asset is preloaded and the
 *  unlock listeners are attached as early as possible. Safe to call
 *  multiple times. */
export function primeNotificationSound() {
  attachUnlockListeners();
  ensureAudio();
}

/** Play the notification sound. Safe to call from any callback — if
 *  the audio element hasn't been unlocked by a user gesture yet, the
 *  call queues a one-shot chime that fires on the next gesture. */
export function playNotificationSound() {
  attachUnlockListeners();
  const el = ensureAudio();
  if (!el) {
    if (typeof console !== "undefined") {
      console.warn("[notificationSound] HTMLAudioElement not available");
    }
    return;
  }
  if (!unlocked) {
    /* No gesture yet — try anyway (some browsers allow play() if the
       call came from inside a recent gesture chain), but also queue. */
    pendingPlayUntilUnlock = true;
    const ok = playNow();
    if (typeof console !== "undefined") {
      console.log(
        ok
          ? "[notificationSound] play() called pre-unlock"
          : "[notificationSound] queued for next user gesture",
      );
    }
    return;
  }
  playNow();
  if (typeof console !== "undefined") {
    console.log("[notificationSound] played");
  }
}
