"use client";

/* ---------------------------------------------------------------------------
   useReceiverLevel — the orb's far-side meter on the mainland lane, read
   from the WebRTC receiver instead of a second AudioContext over the stream.

   useStreamLevel builds an AudioContext over a MediaStream. For the
   ASSISTANT'S voice on the mainland lane that meant the remote track was
   played by an <audio> element AND tapped by WebAudio at the same time —
   which on Safari is a known source of clicks in the played audio (owner,
   2026-09-12: "pulses… the voice is not clean"). The receiver already knows
   the level of what it is playing (session.farLevel, from the engine's own
   RTP audio-level reading), so this hook polls that once a frame, with the
   same "only when it moved" rule as the other meters, and nothing but the
   element touches the voice.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { LEVEL_EPSILON } from "./level";

export type ReceiverLevelSource = { farLevel(): number | null } | null;

/* The engine's audio level is a linear 0..1 of the RTP header extension —
   quiet speech sits low on it. Lifted the way the analyser meters are, so
   the orb moves as much on this lane as on the other. */
export const RECEIVER_LEVEL_GAIN = 3;

export function useReceiverLevel(sessionRef: MutableRefObject<ReceiverLevelSource>, active: boolean): number {
  const [level, setLevel] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let last = -1;
    const tick = () => {
      if (stopped) return;
      const raw = sessionRef.current?.farLevel() ?? null;
      if (raw !== null) {
        const next = Math.min(1, raw * RECEIVER_LEVEL_GAIN);
        if (Math.abs(next - last) >= LEVEL_EPSILON) {
          last = next;
          setLevel(next);
        }
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

  return active ? level : 0;
}
