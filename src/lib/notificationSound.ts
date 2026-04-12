/* ---------------------------------------------------------------------------
   notificationSound — plays /notification.wav whenever Discuss (and
   later Mail / Notifications) wants to alert the user.

   Why Web Audio API + decoded buffer instead of <audio>:
     · HTMLAudioElement on iOS Safari is fragile — it respects the
       hardware mute switch even on websites, suspends in background
       tabs aggressively, and the autoplay-unlock dance is finicky.
     · Decoded AudioBuffer playback through an AudioContext is the
       pattern every serious mobile chat app uses (Slack, WhatsApp Web,
       Discord). It plays consistently on Android Chrome and modern
       iOS, unlocks once and stays unlocked, and has near-zero latency.

   Asset:
     · /notification.wav lives in /public, served same-origin so there
       are no CORS preflights. We fetch + decodeAudioData once on
       prime, then create a fresh BufferSourceNode per ping (sources
       are one-shot by design).

   Autoplay policy:
     · The AudioContext starts "suspended" until a user gesture. We
       attach one-shot click/touchstart/keydown listeners on first
       import and resume() inside the gesture, then mark the context
       as unlocked. Subsequent playNotificationSound() calls fire
       immediately.
     · If a chime is requested before the unlock has happened we set a
       pending flag, and the very next user gesture fires a single
       backlog chime instead of swallowing it silently.
   --------------------------------------------------------------------------- */

const SOUND_URL = "/notification.wav";

let audioCtx: AudioContext | null = null;
let decodedBuffer: AudioBuffer | null = null;
let decodePromise: Promise<AudioBuffer | null> | null = null;
let unlocked = false;
let unlockListenersAttached = false;
let pendingPlayOnUnlock = false;

type Ctor = typeof AudioContext | undefined;

function getCtor(): Ctor {
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
  const C = getCtor();
  if (!C) return null;
  try {
    audioCtx = new C();
  } catch {
    return null;
  }
  return audioCtx;
}

/** Fetch + decode the WAV once. Memoized; subsequent calls return the
 *  same promise. Old Safari needs the callback form of decodeAudioData,
 *  modern browsers return a promise — we handle both. */
function decode(): Promise<AudioBuffer | null> {
  if (decodedBuffer) return Promise.resolve(decodedBuffer);
  if (decodePromise) return decodePromise;
  const ctx = ensureCtx();
  if (!ctx) return Promise.resolve(null);
  decodePromise = (async () => {
    try {
      const r = await fetch(SOUND_URL);
      if (!r.ok) {
        if (typeof console !== "undefined") {
          console.warn(
            "[notificationSound] fetch failed",
            r.status,
            r.statusText,
          );
        }
        return null;
      }
      const ab = await r.arrayBuffer();
      const buf = await new Promise<AudioBuffer>((resolve, reject) => {
        let settled = false;
        try {
          const maybe = ctx.decodeAudioData(
            ab,
            (b) => {
              if (settled) return;
              settled = true;
              resolve(b);
            },
            (err) => {
              if (settled) return;
              settled = true;
              reject(err);
            },
          );
          if (maybe && typeof (maybe as Promise<AudioBuffer>).then === "function") {
            (maybe as Promise<AudioBuffer>).then(
              (b) => {
                if (settled) return;
                settled = true;
                resolve(b);
              },
              (err) => {
                if (settled) return;
                settled = true;
                reject(err);
              },
            );
          }
        } catch (e) {
          if (settled) return;
          settled = true;
          reject(e);
        }
      });
      decodedBuffer = buf;
      if (typeof console !== "undefined") {
        console.log(
          "[notificationSound] decoded",
          buf.duration.toFixed(2),
          "s",
        );
      }
      return buf;
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn("[notificationSound] decode failed", e);
      }
      return null;
    }
  })();
  return decodePromise;
}

function playBufferNow(): boolean {
  const ctx = audioCtx;
  if (!ctx || !decodedBuffer) return false;
  try {
    const src = ctx.createBufferSource();
    src.buffer = decodedBuffer;
    src.connect(ctx.destination);
    src.start(0);
    return true;
  } catch {
    return false;
  }
}

function attachUnlockListeners() {
  if (unlockListenersAttached) return;
  if (typeof window === "undefined") return;
  unlockListenersAttached = true;
  const onGesture = () => {
    const ctx = ensureCtx();
    if (!ctx) return;
    /* Resume the context inside the gesture — this is what unlocks
       playback on iOS / strict autoplay browsers. Always start the
       decode here too in case prime() ran before the gesture and the
       fetch was deprioritized. */
    if (ctx.state === "suspended") {
      void ctx.resume().then(() => {
        unlocked = true;
        if (typeof console !== "undefined") {
          console.log("[notificationSound] unlocked");
        }
        void decode().then(() => {
          if (pendingPlayOnUnlock) {
            pendingPlayOnUnlock = false;
            playBufferNow();
          }
        });
      });
    } else {
      unlocked = true;
      void decode().then(() => {
        if (pendingPlayOnUnlock) {
          pendingPlayOnUnlock = false;
          playBufferNow();
        }
      });
    }
  };
  window.addEventListener("click", onGesture, { passive: true });
  window.addEventListener("touchstart", onGesture, { passive: true });
  window.addEventListener("keydown", onGesture);
}

/** Call once on app mount so the audio is preloaded and the unlock
 *  listeners are attached as early as possible. Safe to call multiple
 *  times. */
export function primeNotificationSound() {
  attachUnlockListeners();
  ensureCtx();
  void decode();
}

/** Play the notification sound. Safe to call from any callback. If
 *  the audio context can't play yet (no prior user gesture) the call
 *  is queued and the next user gesture will fire a single backlog
 *  chime. */
export function playNotificationSound() {
  attachUnlockListeners();
  const ctx = ensureCtx();
  if (!ctx) {
    if (typeof console !== "undefined") {
      console.warn("[notificationSound] no AudioContext support");
    }
    return;
  }

  /* Hot path: context running and buffer ready → play immediately. */
  if (ctx.state === "running" && decodedBuffer) {
    const ok = playBufferNow();
    if (typeof console !== "undefined") {
      console.log("[notificationSound]", ok ? "played" : "play failed");
    }
    return;
  }

  /* Cold path: try to resume + decode. If both succeed inside this
     turn we play immediately, otherwise we queue for the next user
     gesture so the user gets a backlog chime instead of silence. */
  pendingPlayOnUnlock = true;
  void Promise.all([
    ctx.state === "suspended" ? ctx.resume() : Promise.resolve(),
    decode(),
  ]).then(() => {
    if (audioCtx && audioCtx.state === "running" && decodedBuffer) {
      pendingPlayOnUnlock = false;
      const ok = playBufferNow();
      if (typeof console !== "undefined") {
        console.log(
          "[notificationSound]",
          ok ? "played after unlock" : "play failed after unlock",
        );
      }
    } else {
      if (typeof console !== "undefined") {
        console.log(
          "[notificationSound] state",
          audioCtx?.state,
          "buffer",
          !!decodedBuffer,
          "— queued for next gesture",
        );
      }
    }
  });
}
