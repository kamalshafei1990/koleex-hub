/* ---------------------------------------------------------------------------
   The Aurora field — its colours and its motion, as data.

   The wave field behind the Aurora skin (WavyBackground) and the dotted AI
   orb under the same skin are one picture: the orb's dots take the field's
   blues and ripple with the field's own noise (owner, 2026-09-23, choosing
   "Aurora flow" from live samples over the real ground). So both read from
   here, and there is one place where the Aurora's look is defined.

   Pure: no React, no DOM. Moved out of WavyBackground unchanged — the
   field's picture is signed-off artwork and nothing here alters it.
   --------------------------------------------------------------------------- */

/* Hub Blue instead of the original's sky / indigo / purple / fuchsia / cyan —
   a rainbow, and against everything the brand says.

   TWO PALETTES, because this now runs on Home as well as the gate and Home
   has a light theme. On white the dark set is invisible: the ground fill is
   what every stroke fades toward, so light-on-light leaves a blank page. The
   light set inverts that relationship — mid and deep blues over a near-white
   ground — rather than lightening the same colours. */
export const AURORA_PALETTES = {
  dark: {
    waves: ["#BCD8F0", "#8FB0D4", "#567FB2", "#2E4B6B", "#1B2A3C"],
    ground: "#05070C",
    floor: "radial-gradient(72% 60% at 50% 50%, rgba(5,7,12,.55) 0%, rgba(5,7,12,.30) 56%, rgba(5,7,12,.74) 100%)",
  },
  light: {
    waves: ["#567FB2", "#8FB0D4", "#3E6796", "#A9C4DE", "#7FA9D6"],
    ground: "#F4F7FA",
    floor: "radial-gradient(72% 60% at 50% 50%, rgba(247,249,252,.62) 0%, rgba(247,249,252,.34) 56%, rgba(247,249,252,.80) 100%)",
  },
} as const;

/* ── 3D simplex noise ────────────────────────────────────────────────────
   The same algorithm `simplex-noise` ships. Inlined because a dependency for
   two drawings is a dependency to maintain forever — and this is the part of
   the component that cannot be approximated. Sines give you corrugated iron;
   noise gives you water. */
const GRAD3 = [
  [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],
  [0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1],
];

export function buildNoise3D(): (x: number, y: number, z: number) => number {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  /* Deterministic shuffle: a ground that differs on every load is a ground
     nobody can review. */
  let seed = 1337;
  for (let i = 255; i > 0; i--) {
    seed = (seed * 16807) % 2147483647;
    const j = seed % (i + 1);
    const tmp = p[i]; p[i] = p[j]; p[j] = tmp;
  }
  const perm = new Uint8Array(512);
  const permMod12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255];
    permMod12[i] = perm[i] % 12;
  }

  const F3 = 1 / 3, G3 = 1 / 6;

  const corner = (gi: number, x: number, y: number, z: number) => {
    let t = 0.6 - x * x - y * y - z * z;
    if (t < 0) return 0;
    t *= t;
    const g = GRAD3[gi];
    return t * t * (g[0] * x + g[1] * y + g[2] * z);
  };

  return function noise3D(xin: number, yin: number, zin: number): number {
    const s = (xin + yin + zin) * F3;
    const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
    const t = (i + j + k) * G3;
    const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);

    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0)      { i1=1;j1=0;k1=0; i2=1;j2=1;k2=0; }
      else if (x0 >= z0) { i1=1;j1=0;k1=0; i2=1;j2=0;k2=1; }
      else               { i1=0;j1=0;k1=1; i2=1;j2=0;k2=1; }
    } else {
      if (y0 < z0)       { i1=0;j1=0;k1=1; i2=0;j2=1;k2=1; }
      else if (x0 < z0)  { i1=0;j1=1;k1=0; i2=0;j2=1;k2=1; }
      else               { i1=0;j1=1;k1=0; i2=1;j2=1;k2=0; }
    }

    const x1=x0-i1+G3,   y1=y0-j1+G3,   z1=z0-k1+G3;
    const x2=x0-i2+2*G3, y2=y0-j2+2*G3, z2=z0-k2+2*G3;
    const x3=x0-1+3*G3,  y3=y0-1+3*G3,  z3=z0-1+3*G3;

    const ii = i & 255, jj = j & 255, kk = k & 255;
    return 32 * (
      corner(permMod12[ii+perm[jj+perm[kk]]], x0,y0,z0) +
      corner(permMod12[ii+i1+perm[jj+j1+perm[kk+k1]]], x1,y1,z1) +
      corner(permMod12[ii+i2+perm[jj+j2+perm[kk+k2]]], x2,y2,z2) +
      corner(permMod12[ii+1+perm[jj+1+perm[kk+1]]], x3,y3,z3)
    );
  };
}
