"use client";

/* ---------------------------------------------------------------------------
   VoiceTranscript — what was just said, while it is being said.

   WHY THIS IS NOT A CHAT BUBBLE. This is the LIVE view: partial text that
   rewrites itself as a person speaks. Settled turns are written into the
   conversation as real messages by src/lib/voice/persist.ts — through a route
   that checks the caller owns the thread — and appear in the message list
   with a voice mark once the server has them. So the caption strip and the
   bubbles are the same words at two moments: here while they are being said,
   there once they are saved. Rendering the live half as bubbles would make a
   half-spoken sentence look like a record.

   (This header used to say voice turns were not persisted and drew the same
   conclusion from the opposite fact. The conclusion survived the fact.)

   PARTIAL TEXT IS SHOWN, NOT WITHHELD. A caption that only appears once a turn
   is final arrives after the moment it was useful. Partial text is dimmed and
   carries no speaker chrome, so it reads as "still being said" without
   pretending to be settled.

   EVERY STRING HERE CAME OFF A NETWORK SOCKET. It is rendered as text and
   nothing else — no markdown, no html, no links. React escapes it, and the
   standing rule that external content is data rather than instruction is why
   this file has no formatting layer at all.
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import { type TranscriptLine } from "@/lib/voice/events";
import { type Lang } from "@/lib/i18n";
import { textDirection } from "@/lib/text-direction";

const SPEAKER_COPY: Record<Lang, { you: string; assistant: string; live: string }> = {
  en: { you: "You", assistant: "Koleex AI", live: "Live transcript" },
  zh: { you: "你", assistant: "Koleex AI", live: "实时字幕" },
  ar: { you: "أنت", assistant: "Koleex AI", live: "النص المباشر" },
};

/* Fewer, larger lines. Six 13px lines crammed into a rounded slab was the
   "too small and not organised well" that came back from a phone: on a call
   screen the last exchange is what matters, and everything above it is
   history nobody is reading while someone is talking. */
const VISIBLE_LINES = 4;

export type VoiceTranscriptProps = {
  lines: readonly TranscriptLine[];
  lang?: Lang;
  className?: string;
};

export default function VoiceTranscript({ lines, lang = "en", className = "" }: VoiceTranscriptProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const copy = SPEAKER_COPY[lang];

  /* Follow the newest line. Captions that stop scrolling are captions that
     stop being read. */
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lines]);

  if (lines.length === 0) return null;
  const shown = lines.slice(-VISIBLE_LINES);

  return (
    <div
      className={`max-w-[820px] mx-auto px-4 md:px-6 ${className}`}
      /* Announced politely: a caption that interrupts a screen reader mid
         sentence is worse than one that arrives a beat late. */
      role="log"
      aria-live="polite"
      aria-label={copy.live}
    >
      {/* NO SLAB. The rounded box was a container drawn around text that needed
          no container — it read as a widget sitting in the page rather than as
          words being spoken. Spacing separates the turns; nothing else has to. */}
      <div className="max-h-[34vh] overflow-y-auto space-y-4">
        {shown.map((line, i) => {
          const isUser = line.role === "user";
          return (
            <div key={`${i}-${line.role}`} className={isUser ? "text-end" : "text-start"}>
              {/* The speaker on its OWN line. Inline, the label ran into the
                  first word and in Arabic — where the text flows the other way
                  — it landed in the middle of the sentence. */}
              <p className="text-[11px] uppercase tracking-wider text-[#666666] mb-1">
                {isUser ? copy.you : copy.assistant}
              </p>
              <p
                dir={textDirection(line.text)}
                /* Partial text is dimmed, NOT italicised: the brand rules
                   exclude italics, and colour carries the same "still being
                   said" meaning without breaking the type system. */
                className={`text-base leading-relaxed ${
                  line.final ? "text-[var(--text-primary)]" : "text-[var(--text-dim)]"
                }`}
              >
                {line.text}
              </p>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
