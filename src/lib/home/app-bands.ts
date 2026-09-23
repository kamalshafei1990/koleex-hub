/* ---------------------------------------------------------------------------
   Home launcher layout — pure, no React, no DOM.

   The owner's brief (23 Sep 2026, after four rounds of samples on the Design
   canvas): the app squares were too big for a desktop, and once they were
   smaller the groups looked "not organized" — two CSS columns balanced by
   height put the left and right tile rows on different lines, and every small
   group left holes at the end of its row.

   This file answers both:

   · launcherColumns() — how many tile columns fit a width. Size-driven, not
     breakpoint-driven: a tile is never narrower than TILE_MIN_PX (112 px), so
     1440 px gets 10 columns of 121 px, 1200 px gets 9 of 112, 978 px 7 of 116.

   · packAppBands() — lays the groups out in BANDS on ONE shared column grid.
     Every group is a closed rectangle (a group k rows tall is ceil(n/k) wide,
     at least 3 wide, with at most one gap at its end); all groups in a band
     have the same row count, so their headers share a line and their rows
     line up; every band starts with the lowest-numbered group not yet placed,
     so the registry's group order is kept, and an order swap costs enough that
     a small group is not pulled far up to fill a gap. The search is a tiny
     dynamic programme over "which groups are placed" (2^8 states for the 8
     groups the Hub has; 0.06 ms measured).

   Cost, in row units: each band's rows + one header per band + gaps inside
   groups + empty columns at a band's end + order swaps. Weights tuned on the
   real catalogue at 5–10 columns and on smaller role-sized subsets
   (validate:home-layout keeps the owner's layouts pinned).
   --------------------------------------------------------------------------- */

export const TILE_MIN_PX = 112;
export const TILE_GAP_PX = 12;

/** Tile columns that fit `width` px of grid, never fewer than 3. */
export function launcherColumns(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 3;
  return Math.max(3, Math.floor((width + TILE_GAP_PX) / (TILE_MIN_PX + TILE_GAP_PX)));
}

export interface AppBandGroup {
  /** Index of the group in the input order. */
  index: number;
  /** Columns the group spans; its tiles wrap inside that span. */
  span: number;
}
export interface AppBand {
  /** Tile rows every group in the band spans. */
  rows: number;
  groups: AppBandGroup[];
}

const W_HEADER = 0.42;
const W_HOLE = 0.35;
const W_EMPTY = 0.02;
const W_SWAP = 0.15;
const MAX_ROWS_PER_BAND = 3;
/** Above this the exact search is skipped (2^N states); the Hub has 8 groups. */
const MAX_EXACT_GROUPS = 10;

interface Shape { w: number; holes: number }

function shapeFor(n: number, k: number, columns: number): Shape | null {
  if (n <= 0) return null;
  if (k === 1) return n <= columns ? { w: n, holes: 0 } : null;
  const w = Math.ceil(n / k);
  if (w < 3 || w > columns) return null;
  const holes = w * k - n;
  if (holes > 1 || Math.ceil(n / w) !== k) return null;
  return { w, holes };
}

/** A group too big for any shaped band gets a band of its own, full width. */
function soloBand(index: number, n: number, columns: number): AppBand {
  const span = Math.max(1, Math.min(n, columns));
  return { rows: Math.max(1, Math.ceil(n / span)), groups: [{ index, span }] };
}

/**
 * Pack groups of `counts[i]` tiles into bands on a `columns`-wide grid.
 * Every group appears exactly once; empty groups are skipped.
 */
export function packAppBands(counts: readonly number[], columns: number): AppBand[] {
  const cols = Math.max(1, Math.floor(columns));
  const live = counts.map((n, index) => ({ n: Math.max(0, Math.floor(n)), index })).filter((g) => g.n > 0);
  if (live.length === 0) return [];
  if (live.length > MAX_EXACT_GROUPS) return live.map((g) => soloBand(g.index, g.n, cols));

  const N = live.length;
  const FULL = (1 << N) - 1;
  const memo = new Map<number, { cost: number; bands: AppBand[] }>();

  const best = (mask: number): { cost: number; bands: AppBand[] } => {
    if (mask === FULL) return { cost: 0, bands: [] };
    const hit = memo.get(mask);
    if (hit) return hit;
    let first = 0;
    while (mask & (1 << first)) first++;
    const rest: number[] = [];
    for (let i = first + 1; i < N; i++) if (!(mask & (1 << i))) rest.push(i);

    let out: { cost: number; bands: AppBand[] } = { cost: Infinity, bands: [] };
    for (let k = 1; k <= MAX_ROWS_PER_BAND; k++) {
      const s0 = shapeFor(live[first].n, k, cols);
      if (!s0) continue;
      for (let sub = 0; sub < 1 << rest.length; sub++) {
        let w = s0.w;
        let holes = s0.holes;
        let ok = true;
        const members = [first];
        const spans = [s0.w];
        for (let b = 0; b < rest.length; b++) {
          if (!(sub & (1 << b))) continue;
          const s = shapeFor(live[rest[b]].n, k, cols);
          if (!s) { ok = false; break; }
          w += s.w;
          holes += s.holes;
          members.push(rest[b]);
          spans.push(s.w);
          if (w > cols) { ok = false; break; }
        }
        if (!ok) continue;
        let swaps = 0;
        for (const g of members) for (const r of rest) if (r < g && !members.includes(r)) swaps++;
        let next = mask;
        for (const g of members) next |= 1 << g;
        const tail = best(next);
        const cost = k + W_HEADER + holes * W_HOLE + (cols - w) * W_EMPTY + swaps * W_SWAP + tail.cost;
        if (cost < out.cost) {
          out = {
            cost,
            bands: [{ rows: k, groups: members.map((g, i) => ({ index: live[g].index, span: spans[i] })) }, ...tail.bands],
          };
        }
      }
    }
    if (out.cost === Infinity) {
      /* The lowest unplaced group fits no shaped band (more tiles than three
         full rows): it takes a band of its own and the rest carry on. */
      const tail = best(mask | (1 << first));
      const solo = soloBand(live[first].index, live[first].n, cols);
      out = { cost: solo.rows + W_HEADER + tail.cost, bands: [solo, ...tail.bands] };
    }
    memo.set(mask, out);
    return out;
  };

  return best(0).bands;
}
