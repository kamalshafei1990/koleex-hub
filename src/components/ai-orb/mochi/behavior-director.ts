/**
 * Mochi Behavior Director
 *
 * Sits between the app's AI states and the BotEngine. The engine knows how to
 * draw and animate; the director decides *when* which reaction is allowed to
 * play, so the character feels alive instead of twitchy:
 *
 *  - priority gate: Error/Approval > Speaking/Listening > Thinking/Searching/
 *    Working/Question > Finished/Rate-limit > Idle/Sleeping/Dizzy. A lower
 *    number wins; a lower-priority change during a hold is kept in a queue of
 *    length 1 and applied when the hold ends.
 *  - cooldowns: the same emote never refires inside its window (default 8 s,
 *    love 6 s, yawn 20 s, proud 30 s) and the greeting plays at most once a
 *    day (persisted in localStorage).
 *  - attention cycle: while the app is idle, 25 s of no pointer activity →
 *    yawn, 45 s → yawn again, 70 s → sleeping. Any pointer move or state
 *    change wakes him instantly.
 */

import type { BotEngine } from "./engine";
import { Ease } from "./anim";
import type { BotEmoteName } from "./types";

export type MochiSituation =
  | "idle"
  | "listening"
  | "speaking"
  | "thinking"
  | "searching"
  | "working"
  | "approval"
  | "question"
  | "finished"
  | "error"
  | "ratelimit";

/** Lower number = higher priority. */
const PRIORITY: Record<MochiSituation, number> = {
  error: 0,
  approval: 0,
  listening: 1,
  speaking: 1,
  thinking: 2,
  searching: 2,
  working: 2,
  question: 2,
  finished: 3,
  ratelimit: 3,
  idle: 4,
};

const EMOTE_COOLDOWN_MS: Record<BotEmoteName, number> = {
  love: 6_000,
  yawn: 20_000,
  proud: 30_000,
  happy: 8_000,
  wink: 8_000,
  surprised: 8_000,
  annoyed: 8_000,
};

const ATTENTION_YAWN_MS = 25_000;
const ATTENTION_SLEEP_MS = 70_000;
const DIZZY_HOLD_MS = 2_200;

export class MochiBehaviorDirector {
  private engine: BotEngine;
  private current: MochiSituation = "idle";
  private pending: MochiSituation | null = null; // queue of length 1
  private holdUntil = 0;
  private emoteLastAt: Partial<Record<BotEmoteName, number>> = {};
  private lastActivityAt = Date.now();
  private sleeping = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private audioLevel = 0;
  private detachFns: Array<() => void> = [];
  private getOrbCenter: (() => { x: number; y: number } | null) | null = null;
  private ambientNextAt = Date.now() + 8_000;
  private gazeDriftNextAt = Date.now() + 4_000;
  private rareLastAt: Record<string, number> = {};
  private recentAmbient: string[] = [];
  private introEnabled: boolean;

  constructor(
    engine: BotEngine,
    opts?: {
      getOrbCenter?: () => { x: number; y: number } | null;
      /** Opening wave + showcase — only the large, main orbs perform it. */
      intro?: boolean;
    },
  ) {
    this.engine = engine;
    this.getOrbCenter = opts?.getOrbCenter ?? null;
    this.introEnabled = opts?.intro ?? false;

    /* Three quick slaps → dizzy spin, then recover on his own. */
    engine.onDizzy = () => {
      this.engine.setState("dizzy");
      this.holdUntil = Date.now() + DIZZY_HOLD_MS;
      setTimeout(() => {
        if (this.current === "idle" && !this.sleeping) this.engine.setState("idle");
      }, DIZZY_HOLD_MS);
    };
  }

  /** Start timers, window listeners, and the once-a-day greeting. */
  attach(): void {
    if (this.timer) return;

    const onMove = (e: PointerEvent) => {
      this.noteUserActivity();
      /* The gaze follows the pointer — eyes and a leaning head, through the
         engine's lookX/lookY. Sleeping and dizzy states override it inside
         the engine, so there is nothing to gate here. */
      const c = this.getOrbCenter?.();
      if (!c) return;
      const gx = (e.clientX - c.x) / (window.innerWidth * 0.5);
      const gy = (e.clientY - c.y) / (window.innerHeight * 0.5);
      this.engine.lookX = Math.max(-1, Math.min(1, gx));
      this.engine.lookY = Math.max(-1, Math.min(1, gy));
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onMove, { passive: true });
    this.detachFns.push(() => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onMove);
    });

    this.timer = setInterval(() => this.tick(), 250);

    /* OPENING PERFORMANCE (owner, 2026-10-06): every fresh load or refresh
       starts with the coucou wave, then a short one-time showcase — a look
       around, a wink, a happy flash, a little roll — each guarded so a user
       who is already working never gets interrupted. After it, the ambient
       loop takes over (those actions can all appear again later).
       Large orbs only — a page full of waving bubbles is a circus. */
    if (!this.introEnabled) return;
    const intro: Array<[number, () => void]> = [
      [500, () => { this.rareLastAt.wave = Date.now(); this.engine.greet(); }],
      [2600, () => { // double take — left, right, back
        this.glance(-0.7, 0, 700);
        setTimeout(() => this.glance(0.7, 0, 700), 750);
        setTimeout(() => { this.engine.lookX = 0; this.engine.lookY = 0; }, 1500);
      }],
      [4400, () => this.fireEmote("wink")],
      [6200, () => this.fireEmote("happy")],
      [8000, () => { this.engine.squash(); setTimeout(() => this.engine.doRoll(950, 1), 160); }],
    ];
    for (const [delay, run] of intro) {
      const t = setTimeout(() => {
        if (this.current === "idle" && !this.sleeping) run();
      }, delay);
      this.detachFns.push(() => clearTimeout(t));
    }
  }

  detach(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.detachFns.forEach((fn) => fn());
    this.detachFns = [];
    this.engine.onDizzy = null;
  }

  /** Any user activity (pointer, slap, state change) resets the attention clock. */
  noteUserActivity(): void {
    this.lastActivityAt = Date.now();
    if (this.sleeping) {
      this.sleeping = false;
      if (this.current === "idle") this.engine.setState("idle");
    }
  }

  slap(): void {
    this.noteUserActivity();
    this.engine.slap();
  }

  /** Live mic/TTS level 0..1 — drives the mouth (speaking) and attention (listening). */
  setAudioLevel(level: number): void {
    this.audioLevel = Math.min(1, Math.max(0, level));
    if (this.current === "speaking") {
      this.engine.slotHTarget = 0.08 + this.audioLevel * 0.34;
    } else if (this.current === "listening") {
      this.engine.tgEs = 1 + this.audioLevel * 0.2;
    }
  }

  /** The app reports what the AI is doing; the director decides what plays. */
  setSituation(next: MochiSituation): void {
    this.noteUserActivity();
    if (next === this.current && next !== "finished") return;

    const held = Date.now() < this.holdUntil;
    if (held && PRIORITY[next] > PRIORITY[this.current]) {
      this.pending = next; // queue of length 1 — newest wins
      return;
    }
    this.apply(next);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private tick(): void {
    const nowMs = Date.now();

    /* flush the queued situation once the hold expires */
    if (this.pending && nowMs >= this.holdUntil) {
      const next = this.pending;
      this.pending = null;
      this.apply(next);
    }

    /* attention cycle — only when there is nothing going on */
    if (this.current !== "idle") return;
    const idleFor = nowMs - this.lastActivityAt;
    if (!this.sleeping && idleFor >= ATTENTION_SLEEP_MS) {
      this.sleeping = true;
      this.engine.setState("sleeping");
      return;
    }
    if (this.sleeping) return;
    if (idleFor >= ATTENTION_YAWN_MS) {
      this.fireEmote("yawn");
      return;
    }

    /* GAZE DRIFT (owner, 2026-10-06): the eyes wander on their own in idle —
       a soft look in a random direction every 5–9 s, held briefly, then back.
       Pointer gaze overwrites it the moment the user moves, which is right:
       a real person beats a daydream. */
    if (nowMs >= this.gazeDriftNextAt) {
      this.gazeDriftNextAt = nowMs + 5_000 + Math.random() * 4_000;
      const angle = Math.random() * Math.PI * 2;
      const mag = 0.25 + Math.random() * 0.3;
      this.glance(Math.cos(angle) * mag, Math.sin(angle) * mag, 1500 + Math.random() * 1200);
    }

    /* AMBIENT LIFE (owner, 2026-10-06): an idle Mochi is not a statue — but
       idle stays the main act. The loop is: long idle → one action → long
       idle → a DIFFERENT action (no repeating the last two). Small reactions
       often, bigger ones rare and minutes-gated (love, proud, gulp, roll,
       wave), so a busy minute never turns twitchy. */
    if (nowMs >= this.ambientNextAt) {
      this.ambientNextAt = nowMs + 12_000 + Math.random() * 14_000;
      this.ambientAction(nowMs);
    }
  }

  /** One ambient beat. Rotates the menu — the same action never plays twice
      within the last two picks; rare actions carry their own minutes gates. */
  private ambientAction(nowMs: number): void {
    const rareOk = (key: string, gapMs: number) => {
      if (nowMs - (this.rareLastAt[key] ?? 0) < gapMs) return false;
      this.rareLastAt[key] = nowMs;
      return true;
    };

    const pool: Array<{ key: string; w: number; run: () => void }> = [
      { key: "wink", w: 18, run: () => this.fireEmote("wink") },
      { key: "happy", w: 14, run: () => this.fireEmote("happy") },
      { key: "glance", w: 14, run: () => this.glance(Math.random() < 0.5 ? -0.75 : 0.75, 0, 1400) },
      { key: "double-take", w: 10, run: () => { /* left, then right, then back */
        this.glance(-0.7, 0, 700);
        setTimeout(() => this.glance(0.7, 0, 700), 750);
        setTimeout(() => { if (this.current === "idle" && !this.sleeping) { this.engine.lookX = 0; this.engine.lookY = 0; } }, 1500);
      } },
      { key: "surprised", w: 8,  run: () => this.fireEmote("surprised") },
      { key: "look-up", w: 8,  run: () => this.glance(0, -0.6, 1200) }, // curious look up
      { key: "look-down", w: 6,  run: () => this.glance(0, 0.55, 1300) }, // thoughtful look down
      { key: "diagonal", w: 6,  run: () => { // a corner of the room caught his eye
        const sx = Math.random() < 0.5 ? -0.6 : 0.6;
        const sy = Math.random() < 0.5 ? -0.45 : 0.45;
        this.glance(sx, sy, 1400);
      } },
      { key: "look-around", w: 5,  run: () => { // three wandering stops
        const stops = [0, 1, 2].map(() => {
          const a = Math.random() * Math.PI * 2;
          const m = 0.4 + Math.random() * 0.3;
          return { x: Math.cos(a) * m, y: Math.sin(a) * m };
        });
        stops.forEach((s, i) => setTimeout(() => {
          if (this.current === "idle" && !this.sleeping) { this.engine.lookX = s.x; this.engine.lookY = s.y; }
        }, i * 800));
        setTimeout(() => {
          if (this.current === "idle" && !this.sleeping) { this.engine.lookX = 0; this.engine.lookY = 0; }
        }, 2500);
      } },
      { key: "lean", w: 8,  run: () => { /* shift his weight — the whole body
          leans to one side and rests there a moment, gaze following, instead
          of standing square like a statue (owner, 2026-10-06) */
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.engine.anim("ox", [
          [0.14 * dir, 500, Ease.inOut], [0.14 * dir, 1500, Ease.lin], [0, 650, Ease.inOut],
        ]);
        this.glance(dir * 0.5, 0.08, 2500);
      } },
      { key: "stretch", w: 6,  run: () => { /* rises tall, settles back down */
        this.engine.anim("sy", [
          [1.1, 420, Ease.out], [1.1, 700, Ease.lin], [1, 550, Ease.inOut],
        ]);
        this.engine.anim("sx", [
          [0.95, 420, Ease.out], [0.95, 700, Ease.lin], [1, 550, Ease.inOut],
        ]);
        this.glance(0, -0.4, 1500);
      } },
      { key: "love", w: 7,  run: () => { if (rareOk("love", 3 * 60_000)) this.fireEmote("love"); else this.fireEmote("happy"); } },
      { key: "proud", w: 7,  run: () => { if (rareOk("proud", 4 * 60_000)) this.fireEmote("proud"); else this.fireEmote("wink"); } },
      { key: "gulp", w: 6,  run: () => { if (rareOk("gulp", 4 * 60_000)) this.engine.gulp(); else this.engine.blink(); } },
      { key: "roll", w: 5,  run: () => { if (rareOk("roll", 5 * 60_000)) { this.engine.squash(); setTimeout(() => this.engine.doRoll(950, 1), 160); } else this.fireEmote("happy"); } },
      { key: "wave", w: 3,  run: () => { if (rareOk("wave", 10 * 60_000)) this.engine.greet(); else this.fireEmote("wink"); } },
    ];

    /* no repeats: drop whatever played in the last two beats */
    const fresh = pool.filter((p) => !this.recentAmbient.includes(p.key));
    const menu = fresh.length > 0 ? fresh : pool;
    const total = menu.reduce((s, p) => s + p.w, 0);
    let pick = Math.random() * total;
    for (const p of menu) {
      pick -= p.w;
      if (pick <= 0) {
        this.recentAmbient.push(p.key);
        if (this.recentAmbient.length > 2) this.recentAmbient.shift();
        p.run();
        return;
      }
    }
  }

  /** A glance to a point, held for `holdMs`, then released if still idle. */
  private glance(x: number, y: number, holdMs: number): void {
    this.engine.lookX = x;
    this.engine.lookY = y;
    setTimeout(() => {
      if (this.current === "idle" && !this.sleeping) {
        this.engine.lookX = 0;
        this.engine.lookY = 0;
      }
    }, holdMs);
  }

  private apply(next: MochiSituation): void {
    const prev = this.current;
    this.current = next;
    this.holdUntil = 0;

    /* leaving a voice mode resets the face overrides it installed */
    if (prev === "listening" || prev === "speaking") {
      this.engine.eyeOverride = null;
      this.engine.eyeOverrideUntil = 0;
      this.engine.tgEs = 1;
      this.engine.speakMode = false;
      this.engine.slotHTarget = 0;
    }
    if (this.sleeping && next !== "idle") {
      this.sleeping = false;
    }

    switch (next) {
      case "listening":
        this.engine.setState("idle");
        this.engine.eyeOverride = "wide";
        this.engine.eyeOverrideUntil = performance.now() / 1000 + 9999;
        this.engine.tgEs = 1 + this.audioLevel * 0.2;
        break;
      case "speaking":
        this.engine.setState("idle");
        this.engine.speakMode = true;
        this.engine.slotHTarget = 0.08 + this.audioLevel * 0.34;
        break;
      case "thinking":
        this.engine.setState("thinking");
        break;
      case "searching":
        this.engine.setState("searching");
        break;
      case "working":
        this.engine.setState("working");
        break;
      case "approval":
        this.engine.setState("approval");
        break;
      case "question":
        this.engine.setState("question");
        break;
      case "finished":
        /* AN ANSWER IS NOT A CELEBRATION (owner, 2026-10-06): a finished turn
           used to fire the full roll + sparks + proud emote on every reply,
           which read as over-excitement. A content little squash and a brief
           happy flash is the right scale; the big roll stays available in the
           engine for moments that genuinely earn it. */
        this.engine.setState("idle");
        this.engine.squash();
        this.fireEmote("happy");
        this.holdUntil = Date.now() + 400;
        break;
      case "error":
        this.engine.setState("error");
        this.fireEmote("annoyed");
        break;
      case "ratelimit":
        this.engine.setState("ratelimit");
        break;
      case "idle":
      default:
        this.engine.setState(this.sleeping ? "sleeping" : "idle");
        break;
    }
  }

  private fireEmote(name: BotEmoteName): void {
    const nowMs = Date.now();
    const cooldown = EMOTE_COOLDOWN_MS[name] ?? 8_000;
    if (nowMs - (this.emoteLastAt[name] ?? 0) < cooldown) return;
    this.emoteLastAt[name] = nowMs;
    this.engine.triggerEmote(name);
  }
}
