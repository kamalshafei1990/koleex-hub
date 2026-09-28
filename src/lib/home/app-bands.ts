/* ---------------------------------------------------------------------------
   Home launcher layout — pure, no React, no DOM.

   Owner, 28/09/2026 (sample B on the Design canvas, "Aligned grid"): "just
   organize the apps to be same rows and columns in the home page". The
   earlier layout (owner pick F, 23/09) folded each group into its own
   rectangle — 3×3 here, 3×4 there — so groups left holes inside them and the
   headers of neighbouring groups started on different columns.

   Now every group is ONE ROW of tiles on one shared column grid, and groups
   that are short share a line so it fills up:

   · launcherColumns() — how many tile columns fit a width. A tile is never
     narrower than TILE_MIN_PX (112 px — the tile size from before, owner:
     "i want the app sizes same as before") and there are never more than
     MAX_COLUMNS (12): 1440 px gets 10 columns of 121 px, 1200 px 9, 978 px 7.

   · packAppBands() — lays the groups out in LINES. Each line starts with the
     lowest-numbered group not yet placed, so the registry's order leads, and
     takes whichever later groups fill the rest of the line best. Fewest lines
     first, then the fullest lines, then the fewest groups pulled ahead of
     their turn. A group wider than the grid gets lines of its own, full
     width, its tiles wrapping — still on the same columns. A tiny dynamic
     programme over "which groups are placed" (2^9 states for the Hub's 9).
   --------------------------------------------------------------------------- */

export const TILE_MIN_PX = 112;
export const TILE_GAP_PX = 12;
export const MAX_COLUMNS = 12;

/** Tile columns that fit `width` px of grid: at least 3, at most 12. */
export function launcherColumns(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 3;
  return Math.min(MAX_COLUMNS, Math.max(3, Math.floor((width + TILE_GAP_PX) / (TILE_MIN_PX + TILE_GAP_PX))));
}

export interface AppBandGroup {
  /** Index of the group in the input order. */
  index: number;
  /** Columns the group spans; its tiles wrap inside that span. */
  span: number;
}
export interface AppBand {
  /** Tile rows the band spans (1, unless one group is wider than the grid). */
  rows: number;
  groups: AppBandGroup[];
}

const W_EMPTY = 0.02;
const W_SWAP = 0.15;
/** Above this the exact search is skipped (2^N states); the Hub has 9 groups. */
const MAX_EXACT_GROUPS = 14;

/** A group too big for one line gets full-width lines of its own. */
function soloBand(index: number, n: number, columns: number): AppBand {
  const span = Math.max(1, Math.min(n, columns));
  return { rows: Math.max(1, Math.ceil(n / span)), groups: [{ index, span }] };
}

/**
 * Pack groups of `counts[i]` tiles into lines on a `columns`-wide grid.
 * Every group appears exactly once, as one row; empty groups are skipped.
 * `share: false` gives every group a line of its own (phones).
 */
export function packAppBands(counts: readonly number[], columns: number, share = true): AppBand[] {
  const cols = Math.max(1, Math.floor(columns));
  const live = counts.map((n, index) => ({ n: Math.max(0, Math.floor(n)), index })).filter((g) => g.n > 0);
  if (live.length === 0) return [];
  if (!share || live.length > MAX_EXACT_GROUPS) return live.map((g) => soloBand(g.index, g.n, cols));

  const N = live.length;
  const FULL = (1 << N) - 1;
  const memo = new Map<number, { cost: number; bands: AppBand[] }>();

  const best = (mask: number): { cost: number; bands: AppBand[] } => {
    if (mask === FULL) return { cost: 0, bands: [] };
    const hit = memo.get(mask);
    if (hit) return hit;
    let first = 0;
    while (mask & (1 << first)) first++;

    let out: { cost: number; bands: AppBand[] };
    if (live[first].n > cols) {
      const solo = soloBand(live[first].index, live[first].n, cols);
      const tail = best(mask | (1 << first));
      out = { cost: solo.rows + tail.cost, bands: [solo, ...tail.bands] };
    } else {
      const rest: number[] = [];
      for (let i = first + 1; i < N; i++) if (!(mask & (1 << i)) && live[i].n <= cols) rest.push(i);
      out = { cost: Infinity, bands: [] };
      for (let sub = 0; sub < 1 << rest.length; sub++) {
        let w = live[first].n;
        const members = [first];
        for (let b = 0; b < rest.length && w <= cols; b++) {
          if (!(sub & (1 << b))) continue;
          w += live[rest[b]].n;
          members.push(rest[b]);
        }
        if (w > cols) continue;
        let swaps = 0;
        for (const g of members) for (const r of rest) if (r < g && !members.includes(r)) swaps++;
        let next = mask;
        for (const g of members) next |= 1 << g;
        const tail = best(next);
        const cost = 1 + (cols - w) * W_EMPTY + swaps * W_SWAP + tail.cost;
        if (cost < out.cost) {
          out = {
            cost,
            bands: [{ rows: 1, groups: members.map((g) => ({ index: live[g].index, span: live[g].n })) }, ...tail.bands],
          };
        }
      }
    }
    memo.set(mask, out);
    return out;
  };

  return best(0).bands;
}
