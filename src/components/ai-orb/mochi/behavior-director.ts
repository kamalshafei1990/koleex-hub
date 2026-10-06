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
const GREET_KEY = "koleex.mochi.greeted";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

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
  private lastGreetAt = 0;

  constructor(
    engine: BotEngine,
    opts?: { getOrbCenter?: () => { x: number; y: number } | null },
  ) {
    this.engine = engine;
    this.getOrbCenter = opts?.getOrbCenter ?? null;

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

    /* Once-a-day greeting (the "coucou"). */
    try {
      if (localStorage.getItem(GREET_KEY) !== todayKey()) {
        localStorage.setItem(GREET_KEY, todayKey());
        this.lastGreetAt = Date.now();
        setTimeout(() => this.engine.greet(), 600);
      }
    } catch {
      /* storage unavailable — skip the greeting quietly */
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

    /* AMBIENT LIFE (owner, 2026-10-06): an idle Mochi is not a statue. Every
       12–28 s he does something small — a wink, a happy flash, a glance to
       the side, a surprised take, and rarely the peek wave. Emote cooldowns
       still apply, so a busy minute never turns twitchy. */
    if (nowMs >= this.ambientNextAt) {
      this.ambientNextAt = nowMs + 12_000 + Math.random() * 16_000;
      const r = Math.random();
      if (r < 0.3) {
        this.fireEmote("wink");
      } else if (r < 0.55) {
        this.fireEmote("happy");
      } else if (r < 0.75) {
        /* glance aside, then back to center */
        const dir = Math.random() < 0.5 ? -0.75 : 0.75;
        this.engine.lookX = dir;
        setTimeout(() => {
          if (this.current === "idle" && !this.sleeping) this.engine.lookX = 0;
        }, 1400);
      } else if (r < 0.9) {
        this.fireEmote("surprised");
      } else if (nowMs - this.lastGreetAt > 10 * 60_000) {
        this.lastGreetAt = nowMs;
        this.engine.greet();
      }
    }
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
