"use client";

/* ---------------------------------------------------------------------------
   Appearance — the Hub's SECOND styling axis.

   `data-theme` already answers "light or dark". This answers "which visual
   language", and the two are independent: every skin has a light and a dark
   face, so a user picks a style and a brightness, not one of four fixed looks.

     data-kx-skin="aurora"   the wavy ground + glass surfaces (DEFAULT)
     data-kx-skin="core"      the original flat panels

   Owner, 2026-08-10: keep the old look — *"the dark and light mode is basic
   and also not bad"* — make the new one a theme, ship it as the default, and
   roll it out screen by screen. So Core is not deprecated and must keep
   working: it is what the Hub looks like today, and every screen that has not
   been converted yet renders Core regardless of the setting.

   AURORA IS OPT-OUT-ABLE ON PURPOSE. It costs a canvas and a per-tile blur;
   anyone on hardware that cannot afford it, or who simply prefers the flat
   look, gets a first-class alternative rather than a degraded version of the
   new one. See [data-kx-lowpower] in globals.css for the automatic arm.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";

export type Skin = "aurora" | "core";

export const SKINS: { value: Skin; en: string; zh: string; ar: string }[] = [
  { value: "aurora", en: "Aurora", zh: "极光", ar: "أورورا" },
  { value: "core", en: "Core", zh: "基础", ar: "الأساسي" },
];

const KEY = "koleex-skin";
export const DEFAULT_SKIN: Skin = "aurora";

/** The pre-paint stamp, as a string. Injected in layout.tsx so the attribute
 *  is on <html> before the first frame — a skin arriving one frame late means
 *  the whole background appears after paint, which is far more visible than
 *  the theme flash this also fixes. Kept tiny and dependency-free because it
 *  runs before anything else on every page load. */
export const SKIN_BOOTSTRAP = `(function(){try{
var d=document.documentElement,s=localStorage.getItem('${KEY}');
d.setAttribute('data-kx-skin',s==='core'?'core':'${DEFAULT_SKIN}');
var m=localStorage.getItem('koleex-theme-mode'),t=localStorage.getItem('koleex-theme');
var r=m==='light'||m==='dark'?m:(m==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):(t==='light'?'light':'dark'));
d.setAttribute('data-theme',r);
if((navigator.hardwareConcurrency||8)<=4)d.setAttribute('data-kx-lowpower','1');
}catch(e){}})();`;

export function getSkin(): Skin {
  if (typeof window === "undefined") return DEFAULT_SKIN;
  try {
    return localStorage.getItem(KEY) === "core" ? "core" : DEFAULT_SKIN;
  } catch {
    return DEFAULT_SKIN;
  }
}

export function setSkin(skin: Skin): void {
  if (typeof document === "undefined") return;
  try { localStorage.setItem(KEY, skin); } catch { /* storage blocked */ }
  document.documentElement.setAttribute("data-kx-skin", skin);
  window.dispatchEvent(new CustomEvent("skinchange", { detail: skin }));
}

/** Read the current skin and re-render when it changes.
 *
 *  Starts at DEFAULT_SKIN rather than reading storage in the initialiser:
 *  the server renders without localStorage, so reading it during the first
 *  client render is a hydration mismatch. The attribute is already correct on
 *  <html> from the bootstrap, so nothing flashes while this settles — CSS is
 *  driving the paint, and this hook only exists for the components that must
 *  branch in JS (Home mounts a canvas, and that cannot be done in CSS). */
export function useSkin(): Skin {
  const [skin, setSkinState] = useState<Skin>(DEFAULT_SKIN);
  useEffect(() => {
    setSkinState(getSkin());
    const on = () => setSkinState(getSkin());
    window.addEventListener("skinchange", on);
    return () => window.removeEventListener("skinchange", on);
  }, []);
  return skin;
}
