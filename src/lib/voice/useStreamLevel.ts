"use client";

/* ---------------------------------------------------------------------------
   useStreamLevel — how loud a MediaStream is, right now, as 0..1.

   The orb already accepts an `audioLevel` and already has `listening` and
   `speaking` states built around it. What was missing was anything measuring
   the audio, so the orb had a sense it could not use.

   WHY WEB AUDIO AND NOT SOMETHING SIMPLER. There is no other way: a
   MediaStream carries no amplitude you can read. An AnalyserNode over the
   stream is the browser's own meter.

   WHY RMS AND NOT PEAK. Peak jumps on a single loud sample and makes an orb
   flicker; RMS is the energy over the window and moves the way a voice
   actually does. The orb applies its own smoothing on top, so this stays raw.

   EVERY RESOURCE HERE OUTLIVES A RENDER AND MUST BE RELEASED. An AudioContext
   is a real audio-hardware handle: leaking one per call leaves the browser
   holding contexts open until the tab dies, and browsers cap how many may
   exist. The cleanup closes the context, cancels the frame loop, and
   disconnects the graph — on unmount and on every stream change.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { rmsLevel, LEVEL_EPSILON } from "./level";

/* Small enough to feel immediate, large enough that one noisy sample does not
   move the number. 512 samples is ~11ms at 48kHz. */
export const FFT_SIZE = 512;

/* NOT ON THE SOCKET LANE (2026-09-08: "still a strange voice and noise
   while I am talking and the AI is listening"). This hook opens its own
   AudioContext over the microphone stream. On the WebRTC lane that is
   harmless — the browser carries the call's audio itself. On the socket
   lane the call's audio is ANOTHER AudioContext reading the same
   microphone, and a phone with two contexts on one live microphone
   garbles the second one's reader — heard as noise exactly while the
   caller speaks. The socket lane meters inside its own context
   (ws-audio.ts levels, useSessionLevels); the button passes this hook a
   null stream there. */

/**
 * Returns 0..1 while `stream` is non-null and `active` is true, and 0
 * otherwise. Inactive means the meter is torn down, not merely ignored: a
 * running analyser on a call nobody is watching is wasted CPU on a phone.
 */
export function useStreamLevel(stream: MediaStream | null, active: boolean): number {
  const [level, setLevel] = useState(0);
  /* The rAF callback reads this rather than closing over `level`, so the loop
     never restarts and never sees a stale value. */
  const frameRef = useRef<number | null>(null);
  /* ONE CONTEXT PER STREAM, not one per phase. `active` flips at every turn
     boundary, and tearing the context down and building it again twice per
     turn cost 50-150 ms each on an iPhone with a WebRTC session up — a click
     or a level dip right where the caller starts talking (audit, 2026-09-07).
     The analyser lives as long as the stream; `active` only runs or stops
     the frame loop. */
  const graphRef = useRef<{ ctx: AudioContext; source: MediaStreamAudioSourceNode; analyser: AnalyserNode } | null>(null);

  useEffect(() => {
    if (!stream) return;

    /* Safari still ships the prefixed constructor. Feature-detected rather
       than assumed: a missing AudioContext must mean "no meter", never a
       thrown error that takes a working call down with it. */
    const Ctor =
      typeof window !== "undefined"
        ? window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        : undefined;
    if (!Ctor) return;

    let ctx: AudioContext;
    let source: MediaStreamAudioSourceNode;
    let analyser: AnalyserNode;
    try {
      ctx = new Ctor();
      source = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      source.connect(analyser);
      /* Deliberately NOT connected to ctx.destination. Routing the microphone
         to the speakers is feedback, and the remote audio is already played by
         its own element. */
    } catch {
      /* A stream with no audio track, or a context the browser refused. No
         meter is a still orb; it is not a broken call. */
      return;
    }
    graphRef.current = { ctx, source, analyser };

    return () => {
      graphRef.current = null;
      try {
        source.disconnect();
        analyser.disconnect();
      } catch {
        /* Already torn down by a closing context — cleanup must not throw. */
      }
      /* An AudioContext is a hardware handle. Browsers cap how many may exist,
         so one leaked per call ends with calls that cannot open a meter at
         all. */
      void ctx.close().catch(() => {});
    };
  }, [stream]);

  useEffect(() => {
    if (!stream || !active) return;
    const graph = graphRef.current;
    if (!graph) return;
    const { analyser } = graph;
    const buf = new Uint8Array(analyser.fftSize);
    let stopped = false;
    let lastPushed = -1;

    const tick = () => {
      if (stopped) return;
      analyser.getByteTimeDomainData(buf);
      const next = rmsLevel(buf);
      /* ONLY WHEN IT MEANINGFULLY MOVED. Calling setState every animation
         frame re-renders the whole call screen sixty times a second for
         changes far below what an eye can see — on a phone that is the
         difference between a call that feels calm and one that heats the
         handset. The orb lerps toward whatever it is given, so a step of 2%
         still reads as continuous motion. */
      if (Math.abs(next - lastPushed) >= LEVEL_EPSILON) {
        lastPushed = next;
        setLevel(next);
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [stream, active]);

  /* DERIVED, NOT STORED. Zeroing the level with a setState inside the effect
     is a synchronous state write during synchronisation — it cascades renders
     and lint rejects it. An inactive meter simply reads as silence, which is
     what it is, and the stale value can never leak into the next call. */
  return stream && active ? level : 0;
}
