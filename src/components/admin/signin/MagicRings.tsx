"use client";

/* ---------------------------------------------------------------------------
   MagicRings — the second background the owner asked to compare.

   The fragment shader is reactbits.dev/animations/magic-rings verbatim, read
   from the site's own code panel. The React wrapper around it is not: the
   original imports `three` to draw a single full-screen quad, which is 150 KB
   gzipped of scene graph, cameras, geometry and material system to run one
   shader on two triangles.

   This runs the identical shader on raw WebGL — a quad, one program, six
   uniform writes per frame — in about sixty lines and no dependency at all.
   Pixel for pixel the same picture.

   Same discipline as the waves: 30fps, stops on tab hidden and on unmount,
   one still frame under prefers-reduced-motion, DPR capped at 1 on phones,
   and a resize path that is actually torn down.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";

/* Hub Blue. The original ships #A855F7 → #6366F1, purple into indigo. */
const COLOR_A = [0x56 / 255, 0x7f / 255, 0xb2 / 255];   // #567FB2
const COLOR_B = [0xbc / 255, 0xd8 / 255, 0xf0 / 255];   // #BCD8F0

const FPS = 30;
const FRAME_MS = 1000 / FPS;

const VERT = `attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;

/* Verbatim from reactbits, minus the mouse/hover/burst uniforms — this is a
   background behind a password field, not a toy to poke at. */
const FRAG = `precision highp float;
uniform float uTime, uAttenuation, uLineThickness;
uniform float uBaseRadius, uRadiusStep, uScaleRate;
uniform float uOpacity, uNoiseAmount, uRotation, uRingGap;
uniform float uFadeIn, uFadeOut;
uniform vec2 uResolution;
uniform vec3 uColor, uColorTwo;
uniform int uRingCount;

const float HP = 1.5707963;
const float CYCLE = 3.45;

float fade(float t){
  return t < uFadeIn ? smoothstep(0.0, uFadeIn, t) : 1.0 - smoothstep(uFadeOut, CYCLE - 0.2, t);
}
float ring(vec2 p, float ri, float cut, float t0, float px){
  float t = mod(uTime + t0, CYCLE);
  float r = ri + t / CYCLE * uScaleRate;
  float d = abs(length(p) - r);
  float a = atan(abs(p.y), abs(p.x)) / HP;
  float th = max(1.0 - a, 0.5) * px * uLineThickness;
  float h = (1.0 - smoothstep(th, th * 1.5, d)) + 1.0;
  d += pow(cut * a, 3.0) * r;
  return h * exp(-uAttenuation * d) * fade(t);
}
void main(){
  float px = 1.0 / min(uResolution.x, uResolution.y);
  vec2 p = (gl_FragCoord.xy - 0.5 * uResolution.xy) * px;
  float cr = cos(uRotation), sr = sin(uRotation);
  p = mat2(cr, -sr, sr, cr) * p;
  vec3 c = vec3(0.0);
  float rcf = max(float(uRingCount) - 1.0, 1.0);
  for (int i = 0; i < 10; i++){
    if (i >= uRingCount) break;
    float fi = float(i);
    vec3 rc = mix(uColor, uColorTwo, fi / rcf);
    c = mix(c, rc, vec3(ring(p, uBaseRadius + fi * uRadiusStep, pow(uRingGap, fi), i == 0 ? 0.0 : 2.95 * fi, px)));
  }
  float n = fract(sin(dot(gl_FragCoord.xy + uTime * 100.0, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) * uNoiseAmount;
  gl_FragColor = vec4(c, max(c.r, max(c.g, c.b)) * uOpacity);
}`;

export default function MagicRings() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const gl = cv.getContext("webgl", { alpha: true, antialias: false, premultipliedAlpha: false });
    /* No WebGL — an old machine, a locked-down browser, a VM. The screen keeps
       working; it simply has a plain dark ground. */
    if (!gl) return;

    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT);
    const fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uTime = u("uTime"), uRes = u("uResolution");

    /* RETUNED FOR FULL BLEED. The demo's defaults are for the 600x400 box on
       its own page — at that size attenuation 10 is a crisp ring, but across
       a 2372px canvas the same falloff spreads into a grey wash that fills
       the screen and washes the whole gate out. Everything below is the demo
       value; only attenuation, noise and opacity move. */
    gl.uniform1f(u("uAttenuation"), 46);
    gl.uniform1f(u("uLineThickness"), 5);
    gl.uniform1f(u("uBaseRadius"), 0.35);
    gl.uniform1f(u("uRadiusStep"), 0.1);
    gl.uniform1f(u("uScaleRate"), 0.1);
    gl.uniform1f(u("uOpacity"), 0.9);
    gl.uniform1f(u("uNoiseAmount"), 0.015);
    gl.uniform1f(u("uRotation"), 0);
    gl.uniform1f(u("uRingGap"), 1.5);
    gl.uniform1f(u("uFadeIn"), 0.7);
    gl.uniform1f(u("uFadeOut"), 0.5);
    gl.uniform1i(u("uRingCount"), 6);
    gl.uniform3fv(u("uColor"), COLOR_A);
    gl.uniform3fv(u("uColorTwo"), COLOR_B);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const small = window.matchMedia("(max-width: 767px)").matches;
    const dpr = small ? 1 : Math.min(window.devicePixelRatio || 1, 2);

    const size = () => {
      const w = Math.max(1, Math.round(cv.clientWidth * dpr));
      const h = Math.max(1, Math.round(cv.clientHeight * dpr));
      cv.width = w; cv.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    };

    const draw = (t: number) => {
      gl.uniform1f(uTime, t);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    size();

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (still) { draw(1.2); return; }

    let raf = 0, last = 0, t = 0, running = true;
    const loop = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      if (now - last < FRAME_MS) return;
      last = now;
      t += 0.012;
      draw(t);
    };
    raf = requestAnimationFrame(loop);

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; last = 0; raf = requestAnimationFrame(loop); }
    };
    document.addEventListener("visibilitychange", onVis);

    let rz = 0;
    const onResize = () => {
      window.clearTimeout(rz);
      rz = window.setTimeout(() => { size(); draw(t); }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.clearTimeout(rz);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("resize", onResize);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buf);
      /* NO loseContext() here, however tempting. React runs effects twice in
         development, so the first cleanup would kill the context permanently
         and the second mount would get a dead one — a grey field, no current
         program, and uniform writes that silently go nowhere. That is exactly
         what happened, and it cost an hour. Deleting the program, shaders and
         buffer is enough; the context goes with the canvas element. */
    };
  }, []);

  return (
    <>
      <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full pointer-events-none" />
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(72% 60% at 50% 50%, rgba(5,7,12,.58) 0%, rgba(5,7,12,.34) 56%, rgba(5,7,12,.78) 100%)",
        }}
      />
    </>
  );
}
