/* ===========================================================================
   Intelligence  —  shared behavior helpers.

   Tiny pure utilities used by every behavior engine. Lives at the bottom
   of the dependency graph so all modules can rely on it without cycles.
   ========================================================================== */

import type { Direction } from "./types";

/** Compute mean of an array. Returns 0 on empty. */
export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((s, v) => s + v, 0);
  return sum / values.length;
}

/** Compute median of an array. Returns 0 on empty. */
export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
}

/** Standard deviation. */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Days between two ISO date strings (a − b). Returns null if either is missing. */
export function daysBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  da.setHours(0, 0, 0, 0);
  db.setHours(0, 0, 0, 0);
  return Math.round((da.getTime() - db.getTime()) / 86_400_000);
}

/** Days from today. Positive = future, negative = past. */
export function daysFromToday(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return daysBetween(iso, today.toISOString());
}

/** Categorise a delta in % into a direction. */
export function classifyDirection(deltaPct: number, threshold = 5): Direction {
  if (deltaPct > threshold) return "up";
  if (deltaPct < -threshold) return "down";
  return "flat";
}

/** Clamp a value into [0, 100]. */
export function clamp01(v: number): number {
  if (Number.isNaN(v) || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/**
 * Soft scoring helper — maps a "badness" magnitude (0..N) into a 0..100
 * health score (100 = perfect health, 0 = severe). Uses a smooth curve
 * so small values barely move the score, big values plummet it.
 */
export function softHealth(badness: number, fullDamage = 100): number {
  if (badness <= 0) return 100;
  const ratio = Math.min(1, badness / fullDamage);
  /* 1 − sqrt(ratio) — penalises high magnitudes more sharply. */
  return clamp01((1 - Math.sqrt(ratio)) * 100);
}

/**
 * Percent change between two values. Returns null if `previous` is 0
 * (undefined behaviour). Use `safePct` when callers prefer 0.
 */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function safePct(current: number, previous: number): number {
  const v = pctChange(current, previous);
  return v == null ? 0 : v;
}

/**
 * Stable hash → string id, used so two intelligence runs over the same
 * data produce the same event keys (idempotent).
 */
export function stableId(parts: Array<string | number | null | undefined>): string {
  return parts.filter((p) => p != null && p !== "").join("-");
}
