/* ---------------------------------------------------------------------------
   The dotted orb's transition: the dots themselves move into the new shape.

   Owner, 2026-09-23: "there is no transition in the new orb between shape
   and other — should have a very smart and creative transition". He
   compared six live samples against the cut he had (crossfade, morph,
   gather & burst, vortex, dust, scan wipe) and chose MORPH: the same dots
   fly from where they are in the old motion to their place in the new one,
   so the orb reads as one thing changing its shape rather than one picture
   swapped for another.

   HOW DOTS ARE PAIRED. Two motions rarely have the same number of dots, and
   the engine's lists are z-sorted, which says nothing about where a dot is
   on screen. So each frame both lists are ordered by angle around the
   centre (radius breaks ties), and the longer list is walked with the
   shorter one stretched over it: every dot of both shapes is used, a dot of
   the shorter one may lead two of the longer. Pairing by angle keeps each
   flight short and on its own side of the sphere — nothing crosses the
   middle — which is what makes it read as a change of shape and not as a
   shuffle.

   Everything a dot carries — position, radius, ink and alpha — is
   interpolated, so a bright near dot does not pop into a faint far one.

   Pure, so validate:ai-orb checks the geometry without a browser.
   --------------------------------------------------------------------------- */

/** How long one change of shape takes. The samples ran at 800 ms; shorter
 *  read as a flicker at 38 px, longer as lag behind the state it reports. */
export const DOTTED_MORPH_MS = 800;

export interface MorphDot {
  x: number;
  y: number;
  r: number;
  /** The engine's ink value on paper, 0..1. */
  white: number;
  a?: number;
}

/** Smooth start, smooth landing. Pure. */
export function easeInOutCubic(x: number): number {
  const p = x < 0 ? 0 : x > 1 ? 1 : x;
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function byAngle<T extends MorphDot>(dots: readonly T[], c: number): T[] {
  return dots
    .map((d) => ({ d, k: Math.atan2(d.y - c, d.x - c) * 1000 + Math.hypot(d.x - c, d.y - c) * 0.01 }))
    .sort((p, q) => p.k - q.k)
    .map((o) => o.d);
}

/** The pairs a morph flies between: every dot of both shapes is used. Pure. */
export function pairDots<T extends MorphDot>(from: readonly T[], to: readonly T[], c: number): [T, T][] {
  if (from.length === 0 || to.length === 0) return [];
  const a = byAngle(from, c);
  const b = byAngle(to, c);
  const n = Math.max(a.length, b.length);
  const out: [T, T][] = [];
  for (let i = 0; i < n; i++) out.push([a[Math.floor((i * a.length) / n)], b[Math.floor((i * b.length) / n)]]);
  return out;
}

/** The dots of one instant of the morph, `e` eased 0..1 from `from` to
 *  `to`. Either side empty: the other side, faded by `e`. Pure. */
export function morphDots(from: readonly MorphDot[], to: readonly MorphDot[], c: number, e: number): MorphDot[] {
  if (from.length === 0) return to.map((d) => ({ ...d, a: (d.a ?? 1) * e }));
  if (to.length === 0) return from.map((d) => ({ ...d, a: (d.a ?? 1) * (1 - e) }));
  return pairDots(from, to, c).map(([p, q]) => ({
    x: p.x + (q.x - p.x) * e,
    y: p.y + (q.y - p.y) * e,
    r: p.r + (q.r - p.r) * e,
    white: p.white + (q.white - p.white) * e,
    a: (p.a ?? 1) + ((q.a ?? 1) - (p.a ?? 1)) * e,
  }));
}
