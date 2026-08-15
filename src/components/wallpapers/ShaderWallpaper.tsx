"use client";

/* ShaderWallpaper — mounts exactly one animated ground, and only when chosen.
   ---------------------------------------------------------------------------
   The still wallpapers in lib/wallpaper.ts are CSS gradients: measured free,
   zero requests, nothing running. These are NOT that, and the difference is
   worth stating plainly rather than burying:

     · a fragment shader runs every pixel, every frame, for as long as the tab
       is visible;
     · it needs OGL, which nobody downloads until a shader is picked.

   So everything here is about paying that cost only for the person who asked
   for it, and not one frame more:

   ONLY THE CHOSEN ONE LOADS. LOADERS holds twenty-five static import paths, so
   the bundler splits them; picking Aurora fetches Aurora and OGL, and no other
   shader's code is ever requested.

   REDUCED MOTION IS HONOURED BY NOT MOUNTING. Someone who has asked their
   system for less movement should not be handed a permanently animating
   screen. They get the still ground instead — the caller renders it because
   this returns null.

   THE TAB DOES NOT ANIMATE IN THE BACKGROUND. Each component runs its own rAF
   loop; a hidden tab must not keep a GPU busy on a machine that is doing
   something else. Unmounting on hide releases the WebGL context outright,
   which is stronger than pausing and is what the components' own cleanup is
   written for. */

import { useEffect, useState, type ComponentType } from "react";
import { LOADERS, getShader, palette } from "@/lib/wallpaper-shaders";

const DEFAULT_TINT = "#567FB2";   /* Hub Blue, when a shader is chosen but no colour is */

export default function ShaderWallpaper({ id, tint }: { id: string; tint?: string }) {
  /* Keyed to the shader it belongs to, so a late-arriving chunk cannot mount
     itself over a newer choice. */
  const [loaded, setLoaded] = useState<{ key: string; C: ComponentType<Record<string, unknown>> } | null>(null);
  /* Read, not assumed. A tab restored from the background mounts hidden, and
     `useState(true)` had it spinning up a WebGL context for a screen nobody
     was looking at — caught by checking document.hidden while the shader was
     confirmed running, not by reasoning about it. */
  const [visible, setVisible] = useState(() =>
    typeof document === "undefined" ? true : !document.hidden);
  const [allowed, setAllowed] = useState(false);

  /* Asked once, and re-asked if the setting changes — this is a preference a
     person can turn on mid-session, usually because something on screen is
     making them uncomfortable. */
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setAllowed(!mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  useEffect(() => {
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const shader = getShader(id);
  const key = shader?.component;

  useEffect(() => {
    if (!key || !allowed || !visible) return;
    let live = true;
    /* `live` matters: switching wallpapers quickly starts two loads, and the
       slower one must not win and mount the shader nobody is looking at. */
    LOADERS[key]?.()
      .then((m) => { if (live) setLoaded({ key, C: m.default }); })
      .catch(() => { /* a failed chunk leaves the still fallback on screen */ });
    return () => { live = false; };
  }, [key, allowed, visible]);

  /* Decided at RENDER, not stored. Hiding the tab or turning on reduced motion
     must unmount the shader on the very next render — routing that through
     setState would both lag by a frame and be the "setState inside an effect"
     the hooks rule refuses, correctly. Keeping `loaded` purely additive means
     switching back does not re-download anything. */
  const Comp = loaded && loaded.key === key && allowed && visible ? loaded.C : null;

  if (!shader || !Comp) return null;

  /* The user's colour wins; then the pattern's OWN colour; Hub Blue only if a
     shader has not declared one. Before this every shader opened Hub Blue, so
     picking one showed its shape and never its intent. */
  const props = shader.tint(palette(tint || shader.defaultTint || DEFAULT_TINT));
  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden>
      {/* Cursor-following off, but ONLY on the two components that have a prop
          for it. Passing both to all of them put an unknown attribute on a real
          DOM node — several spread `...rest` onto their container — and React
          says so in the console. This is a BACKGROUND: a ground that chases the
          cursor competes with whatever is being pointed at, and keeps a
          mousemove listener alive for a decoration. */}
      <Comp {...props} {...(shader.mouseProp ? { [shader.mouseProp]: false } : {})} />
    </div>
  );
}
