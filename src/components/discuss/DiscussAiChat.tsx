"use client";

/* ---------------------------------------------------------------------------
   DiscussAiChat — the "Koleex AI" conversation, rendered inside the Discuss
   chat pane exactly like a DM. Selected from the pinned AI row at the top of
   the conversation list. Reuses the shared useAiChat() streaming pipeline so
   it stays identical to the floating Copilot, and matches Discuss's own
   header / WeChat-bubble / composer grammar (design tokens, monochrome).
   --------------------------------------------------------------------------- */

import { useEffect, useRef } from "react";
import KoleexOrb from "@/components/ai/KoleexOrb";
import MicButton from "@/components/ai/MicButton";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import { useAiChat } from "@/lib/ai/useAiChat";

const SUGGESTIONS = [
  "Summarise today's activity",
  "Draft a message to the team",
  "What changed this week?",
];

export default function DiscussAiChat({
  onBack,
  labels,
}: {
  /** Mobile: return to the conversation list. Hidden on desktop. */
  onBack?: () => void;
  labels?: {
    title?: string;
    subtitle?: string;
    placeholder?: string;
    empty?: string;
  };
}) {
  const {
    aiInput,
    setAiInput,
    aiMessages,
    setAiMessages,
    aiSending,
    aiSpeaking,
    sendAiText,
    handleAiSend,
    stopTts,
  } = useAiChat();

  const title = labels?.title ?? "Koleex AI";
  const subtitle = labels?.subtitle ?? "Your assistant · always here";
  const placeholder = labels?.placeholder ?? "Ask Koleex AI anything…";
  const empty = labels?.empty ?? "Ask me anything — I can help across the Hub.";

  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [aiMessages]);

  const lang = (typeof document !== "undefined"
    ? (document.documentElement.lang as "en" | "zh" | "ar")
    : "en");

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--bg-primary)]">
      {/* ── Header — mirrors the conversation header grammar ── */}
      <div className="shrink-0 flex items-center gap-3 px-3 h-[57px] border-b border-[var(--border-subtle)]">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="md:hidden -ms-2 h-9 w-9 shrink-0 flex items-center justify-center rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
            aria-label="Back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        <div className="h-[34px] w-[34px] shrink-0 flex items-center justify-center">
          <KoleexOrb state={aiSending ? "loading" : "idle"} size={30} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
            {title}
          </div>
          <div className="text-[11px] text-[var(--text-dim)] truncate">
            {aiSending ? "Thinking…" : subtitle}
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2"
      >
        {aiMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6">
            <KoleexOrb state="idle" size={64} />
            <div className="mt-4 text-[15px] font-semibold text-[var(--text-primary)]">
              {title}
            </div>
            <div className="mt-1 text-[12.5px] text-[var(--text-dim)] max-w-[300px]">
              {empty}
            </div>
            <div className="mt-5 flex flex-col gap-2 w-full max-w-[320px]">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void sendAiText(s, false)}
                  className="text-start text-[12.5px] px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          aiMessages.map((m, i) => {
            const isSelf = m.role === "user";
            return (
              <div
                key={i}
                className={`flex ${isSelf ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    "inline-block text-start max-w-[min(78%,62ch)] text-[13px] leading-relaxed px-3 py-2 rounded-2xl border whitespace-pre-wrap break-words " +
                    (isSelf
                      ? "bg-[var(--bg-surface-bright)] border-[var(--border-color)] rounded-ee-md text-[var(--text-primary)]"
                      : "bg-[var(--bg-surface)] border-[var(--border-subtle)] rounded-es-md text-[var(--text-primary)]")
                  }
                >
                  {m.text || (
                    <span className="inline-flex gap-1 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)] animate-pulse" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)] animate-pulse [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-dim)] animate-pulse [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Composer — mirrors the Discuss composer ── */}
      <div className="shrink-0 border-t border-[var(--border-subtle)] px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5">
          <input
            type="text"
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleAiSend();
              }
            }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none py-1.5"
          />
          <MicButton
            size={30}
            onTranscript={(t) => void sendAiText(t, true)}
            onError={(msg) =>
              setAiMessages((prev) => [...prev, { role: "ai", text: msg }])
            }
            speaking={aiSpeaking}
            onStopSpeaking={stopTts}
            disabled={aiSending}
            lang={lang}
          />
          <button
            type="button"
            onClick={handleAiSend}
            disabled={!aiInput.trim() || aiSending}
            className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center transition-colors hover:bg-[var(--bg-inverted-hover)] disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Send"
          >
            <PaperPlaneIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
