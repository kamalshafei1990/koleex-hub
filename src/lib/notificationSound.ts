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

import { classifyNotificationActivity } from "./notification-activity";

const SOUND_URL = "/notification.wav";

/* ── The Koleex tone library ──────────────────────────────────────────────
   Real recordings supplied by the owner, in /public/sounds. Each was
   trimmed of leading/trailing silence and loudness-matched to ≈ −15 LUFS,
   so no tone is jarringly louder than its neighbour in the picker (the
   sources ranged over 15 dB). They are fetched ON DEMAND — see prime() —
   because 24 files is far too much to pull on boot for a sound most users
   will never change. */
export const SOUND_LIBRARY = [
  "alert", "announce", "arrive", "beacon", "bloom", "bounce",
  "bright", "confirm", "depart", "galaxy", "inbox", "lantern",
  "mail", "marker", "message", "note", "ping", "prompt",
  "signal", "sparkle", "success", "surface", "tap", "task",
] as const;
export type LibraryTone = (typeof SOUND_LIBRARY)[number];

/** Display names for the library, in picker order. */
export const LIBRARY_LABELS: Record<LibraryTone, string> = {
  alert: "Alert", announce: "Announce", arrive: "Arrive", beacon: "Beacon",
  bloom: "Bloom", bounce: "Bounce", bright: "Bright", confirm: "Confirm",
  depart: "Depart", galaxy: "Galaxy", inbox: "Inbox", lantern: "Lantern",
  mail: "Mail", marker: "Marker", message: "Message", note: "Note",
  ping: "Ping", prompt: "Prompt", signal: "Signal", sparkle: "Sparkle",
  success: "Success", surface: "Surface", tap: "Tap", task: "Task",
};

const LIBRARY_SET = new Set<string>(SOUND_LIBRARY);

/** Where a tone's audio lives, or null when it is synthesized. */
function toneSrc(tone: SoundTone): string | null {
  if (tone === "classic") return SOUND_URL;
  if (LIBRARY_SET.has(tone)) return `/sounds/${tone}.mp3`;
  return null;
}

/* ── Sound preferences (Settings → Sounds) ────────────────────────────────
   ONE source of truth for every sound the Hub makes. Before this, the bell
   played the WAV with no way to turn it off, and Discuss synthesized its own
   different chime behind its own toggle — two systems, two tones, and
   "sound off" in one didn't silence the other. Every sound now flows
   through playAppSound(category), which consults these prefs.

   Stored in localStorage (device-level preference, like ringtones on a
   phone): instant, offline-safe, no migration. */

export type SynthTone =
  | "chime"     // two-tone rising sweep (the old Discuss bloop)
  | "ding" | "bell" | "pop" | "glass" | "pulse";

export type SoundTone =
  | "classic"   // the original /notification.wav
  | SynthTone
  | LibraryTone // the owner's recorded tones in /public/sounds
  | "none";

export type SoundCategory = "notification" | "message";

/* The same activity keys as Settings → Notification preferences "By
   activity", so the two screens describe the same events. */
export const SOUND_ACTIVITIES = [
  "mentions", "approvals", "assignments", "tasks_due",
  "quotation_activity", "low_stock", "qa_reports", "price_fx",
] as const;
export type SoundActivity = (typeof SOUND_ACTIVITIES)[number];

export interface SoundPrefs {
  master: boolean;                                  // one switch to rule them all
  dnd: boolean;                                     // do not disturb
  volume: number;                                   // 0..1
  notification: {
    enabled: boolean;
    tone: SoundTone;                                // the default notification tone
    /** Per-activity overrides — an activity without an entry inherits the
        default tone above, so "one sound for everything" stays one line of
        config and specialising is opt-in per activity. */
    activityTones?: Partial<Record<SoundActivity, SoundTone>>;
  };
  message: { enabled: boolean; tone: SoundTone };      // Discuss messages
}

/** Classify an inbox message into an activity key from its metadata.type
 *  (set by every notifier in the Hub). Unknown/absent → null → default tone.
 *  Thin wrapper over the SHARED classifier in lib/notification-activity.ts —
 *  the server push sender applies the same rules, so muting an activity in
 *  Settings silences its chime AND its push with one switch. */
export function classifyInboxActivity(meta: unknown): SoundActivity | null {
  return classifyNotificationActivity((meta as { type?: string } | null)?.type);
}

/** The built-in tones: the original WAV plus the six synthesized ones.
 *  Kept separate from SOUND_LIBRARY so the picker can group them — the
 *  synthesized set needs no network and works offline, which is why it
 *  stays even now that there are real recordings. */
export const SOUND_TONES: Array<"classic" | SynthTone> = [
  "classic", "chime", "ding", "bell", "pop", "glass", "pulse",
];

const PREFS_KEY = "kx:sound:prefs:v1";

const DEFAULT_PREFS: SoundPrefs = {
  master: true,
  dnd: false,
  volume: 0.8,
  notification: { enabled: true, tone: "classic" },
  message: { enabled: true, tone: "classic" },
};

let prefsCache: SoundPrefs | null = null;
const prefListeners = new Set<(p: SoundPrefs) => void>();

export function getSoundPrefs(): SoundPrefs {
  if (prefsCache) return prefsCache;
  if (typeof window === "undefined") return DEFAULT_PREFS;
  let stored: Partial<SoundPrefs> | null = null;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) stored = JSON.parse(raw) as Partial<SoundPrefs>;
  } catch { /* corrupted — fall back to defaults */ }

  if (!stored) {
    /* First run: honour the OLD Discuss-local toggles so nobody who had
       already silenced Discuss suddenly gets sound back. */
    const legacySound = localStorage.getItem("discuss:pref:sound");
    const legacyDnd = localStorage.getItem("discuss:pref:dnd");
    prefsCache = {
      ...DEFAULT_PREFS,
      dnd: legacyDnd === "1",
      message: { ...DEFAULT_PREFS.message, enabled: legacySound !== "0" },
    };
    return prefsCache;
  }
  prefsCache = {
    ...DEFAULT_PREFS,
    ...stored,
    notification: { ...DEFAULT_PREFS.notification, ...(stored.notification ?? {}) },
    message: { ...DEFAULT_PREFS.message, ...(stored.message ?? {}) },
  };
  return prefsCache;
}

export function setSoundPrefs(patch: {
  master?: boolean; dnd?: boolean; volume?: number;
  notification?: Partial<SoundPrefs["notification"]>;
  message?: Partial<SoundPrefs["message"]>;
}): SoundPrefs {
  const cur = getSoundPrefs();
  const next: SoundPrefs = {
    master: patch.master ?? cur.master,
    dnd: patch.dnd ?? cur.dnd,
    volume: patch.volume !== undefined ? Math.min(1, Math.max(0, patch.volume)) : cur.volume,
    notification: {
      ...cur.notification,
      ...(patch.notification ?? {}),
      activityTones: {
        ...(cur.notification.activityTones ?? {}),
        ...(patch.notification?.activityTones ?? {}),
      },
    },
    message: { ...cur.message, ...(patch.message ?? {}) },
  };
  prefsCache = next;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  prefListeners.forEach((fn) => fn(next));
  return next;
}

/** Subscribe to pref changes (Settings UI ↔ Discuss toggles stay in sync). */
export function subscribeSoundPrefs(fn: (p: SoundPrefs) => void): () => void {
  prefListeners.add(fn);
  return () => prefListeners.delete(fn);
}

/* ── Synthesized tones ───────────────────────────────────────────────────
   Each tone is a tiny Web Audio recipe — no assets, no network, identical
   offline and in mainland China. All routed through a GainNode so the
   volume pref applies uniformly. */
function synthTone(ctx: AudioContext, tone: SoundTone, volume: number): void {
  const now = ctx.currentTime;
  const master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);

  const note = (
    freq: number, at: number, dur: number, peak: number,
    type: OscillatorType = "sine", glideTo?: number,
  ) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + at);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, now + at + dur * 0.55);
    gain.gain.setValueAtTime(0.0001, now + at);
    gain.gain.exponentialRampToValueAtTime(peak, now + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
    osc.connect(gain).connect(master);
    osc.start(now + at);
    osc.stop(now + at + dur + 0.05);
  };

  switch (tone) {
    case "chime": note(880, 0, 0.22, 0.5, "sine", 1320); break;
    case "ding":  note(1568, 0, 0.35, 0.5); break;
    case "bell":  note(660, 0, 0.5, 0.45, "triangle"); note(1320, 0, 0.35, 0.18, "sine"); break;
    case "pop":   note(440, 0, 0.09, 0.4, "square"); break;
    case "glass": note(2093, 0, 0.18, 0.35); note(2637, 0.07, 0.22, 0.3); break;
    case "pulse": note(980, 0, 0.08, 0.45); note(980, 0.13, 0.08, 0.45); break;
    default: break;
  }
}

let audioCtx: AudioContext | null = null;
/* One decoded buffer per URL. Was a single global back when there was
   exactly one WAV; with a 24-tone library each tone caches independently
   and only the ones actually used are ever fetched. */
const buffers = new Map<string, AudioBuffer>();
const decodes = new Map<string, Promise<AudioBuffer | null>>();
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

/** Fetch + decode one tone's audio. Memoized per URL; subsequent calls
 *  return the same promise. Old Safari needs the callback form of
 *  decodeAudioData, modern browsers return a promise — we handle both. */
function decode(url: string = SOUND_URL): Promise<AudioBuffer | null> {
  const cached = buffers.get(url);
  if (cached) return Promise.resolve(cached);
  const inflight = decodes.get(url);
  if (inflight) return inflight;
  const ctx = ensureCtx();
  if (!ctx) return Promise.resolve(null);
  const job = (async () => {
    try {
      const r = await fetch(url);
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
      buffers.set(url, buf);
      return buf;
    } catch (e) {
      if (typeof console !== "undefined") {
        console.warn("[notificationSound] decode failed", url, e);
      }
      /* Drop the memo so a transient network failure can be retried the
         next time this tone is asked for, instead of staying dead. */
      decodes.delete(url);
      return null;
    }
  })();
  decodes.set(url, job);
  return job;
}

function playBufferNow(url: string = SOUND_URL, volume?: number): boolean {
  const ctx = audioCtx;
  const buf = buffers.get(url);
  if (!ctx || !buf) return false;
  try {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = volume ?? getSoundPrefs().volume;
    src.connect(gain).connect(ctx.destination);
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

  /* Mobile browsers (iOS Safari, Chrome Android) suspend the
     AudioContext when the tab goes to background and do NOT auto-resume
     it when the user returns. We try to resume on every visibility
     change so notifications can play the moment the user switches back.
     The resume() call itself doesn't count as a user gesture on iOS, so
     if the context was never unlocked this won't help — but once the
     user has tapped anywhere, subsequent background/foreground cycles
     will keep the context alive. */
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const ctx = audioCtx;
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().then(() => {
        unlocked = true;
      });
    }
  });
}

/** Every file-backed tone the user has actually selected — the default
 *  notification and message tones plus any per-activity overrides. This is
 *  what prime() warms, so a 24-tone library still costs at most a couple of
 *  small fetches on boot instead of 700 KB. */
function selectedSrcs(): string[] {
  const p = getSoundPrefs();
  const tones: SoundTone[] = [
    p.notification.tone,
    p.message.tone,
    ...Object.values(p.notification.activityTones ?? {}),
  ];
  const srcs = new Set<string>();
  for (const t of tones) {
    const src = toneSrc(t);
    if (src) srcs.add(src);
  }
  return [...srcs];
}

/** Call once on app mount so the audio is preloaded and the unlock
 *  listeners are attached as early as possible. Safe to call multiple
 *  times. */
export function primeNotificationSound() {
  attachUnlockListeners();
  ensureCtx();
  for (const src of selectedSrcs()) void decode(src);
}

/** Play a tone through the shared context, resuming it first if the
 *  browser has it suspended. Handles both file-backed and synthesized
 *  tones so the three entry points below don't each re-implement it. */
function playTone(tone: SoundTone, volume: number) {
  if (tone === "none") return;
  attachUnlockListeners();
  const ctx = ensureCtx();
  if (!ctx) return;
  const src = toneSrc(tone);

  const fire = () => {
    const c = audioCtx;
    if (!c || c.state !== "running") return;
    if (src) {
      if (!playBufferNow(src, volume)) void decode(src).then(() => playBufferNow(src, volume));
    } else {
      try { synthTone(c, tone, volume); } catch { /* stay silent */ }
    }
  };

  if (ctx.state === "suspended") {
    void ctx.resume().then(fire);
    return;
  }
  /* A file tone that hasn't been decoded yet needs one await; a synth tone
     and an already-decoded file play in this same turn. */
  if (src && !buffers.has(src)) { void decode(src).then(fire); return; }
  fire();
}

/** Play the sound for a CATEGORY, honouring the user's Settings → Sounds
 *  preferences (master switch, do-not-disturb, per-category enable, chosen
 *  tone, volume). This is THE way any part of the Hub makes a sound. */
export function playAppSound(category: SoundCategory, activity?: SoundActivity | null) {
  const prefs = getSoundPrefs();
  if (!prefs.master || prefs.dnd) return;
  const cat = prefs[category];
  if (!cat.enabled) return;
  /* Per-activity override (notifications only) — falls back to the
     category's default tone when the activity has no override. */
  const tone: SoundTone =
    (category === "notification" && activity
      ? prefs.notification.activityTones?.[activity]
      : undefined) ?? cat.tone;
  if (tone === "none") return;
  /* The classic WAV keeps the backlog path: if the context is still locked
     it queues one chime for the next gesture rather than swallowing it. */
  if (tone === "classic") {
    playNotificationSound();
    return;
  }
  playTone(tone, prefs.volume);
}

/** Preview a tone at a given volume — used by Settings → Sounds. Ignores
 *  the enable/DND switches on purpose: previewing while "off" is how you
 *  choose the tone you'll turn back on. Always called from a click, so
 *  the context is already unlockable. */
export function previewSound(tone: SoundTone, volume?: number) {
  playTone(tone, volume ?? getSoundPrefs().volume);
}

/** Play the classic notification WAV. Prefer playAppSound(category) — this
 *  stays exported for the unlock/backlog machinery and the classic tone. */
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
  if (ctx.state === "running" && buffers.has(SOUND_URL)) {
    playBufferNow();
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
    if (audioCtx && audioCtx.state === "running" && buffers.has(SOUND_URL)) {
      pendingPlayOnUnlock = false;
      playBufferNow();
    }
  });
}
