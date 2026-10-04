"use client";

/* ---------------------------------------------------------------------------
   useSessionLevels — the orb's meters on the socket lane, read from the
   call's own audio context instead of opened beside it.

   useStreamLevel builds an AudioContext over a MediaStream. On the socket
   lane the call already has one reading the same microphone, and a phone
   given two contexts on one live microphone garbles the second one's
   reader (2026-09-08: noise exactly while the caller speaks). So on that
   lane nothing else touches the microphone: the session's audio measures
   both sides in its own context (ws-audio.ts levels) and this hook polls
   it once a frame, with the same "only when it moved" rule.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { LEVEL_EPSILON } from "./level";

export type SessionLevelSource = { levels(): { mic: number; far: number } | null } | null;

export function useSessionLevels(sessionRef: MutableRefObject<SessionLevelSource>, active: boolean): { mic: number; far: number } {
  const [levels, setLevels] = useState({ mic: 0, far: 0 });
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let lastMic = -1;
    let lastFar = -1;
    const tick = () => {
      if (stopped) return;
      const l = sessionRef.current?.levels() ?? null;
      if (l && (Math.abs(l.mic - lastMic) >= LEVEL_EPSILON || Math.abs(l.far - lastFar) >= LEVEL_EPSILON)) {
        lastMic = l.mic;
        lastFar = l.far;
        setLevels({ mic: l.mic, far: l.far });
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [active, sessionRef]);

  return active ? levels : { mic: 0, far: 0 };
}
