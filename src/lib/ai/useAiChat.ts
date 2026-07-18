"use client";

/* ---------------------------------------------------------------------------
   useAiChat — the single source of truth for a Koleex AI conversation.

   Extracted from FloatingPanel so the same streaming pipeline can back both
   the floating Copilot panel and the "Koleex AI" chat that lives inside the
   Discuss conversation list. It owns the message list, the composer input,
   the SSE stream against /api/ai/chat, and optional text-to-speech for
   voice-originated turns. UI is deliberately NOT here — consumers render it.
   --------------------------------------------------------------------------- */

import { useCallback, useRef, useState } from "react";
import { speakText, type TtsHandle } from "@/components/ai/MicButton";

export type AiChatMessage = { role: "user" | "ai"; text: string };

export function useAiChat() {
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const aiSendingRef = useRef(false);
  const [aiSending, setAiSending] = useState(false);
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const ttsHandleRef = useRef<TtsHandle | null>(null);

  const stopTts = useCallback(() => {
    ttsHandleRef.current?.cancel();
    ttsHandleRef.current = null;
    setAiSpeaking(false);
  }, []);

  /* sendAiText: shared path for typed and voice input. viaVoice=true speaks
     the final sealed reply (never mid-stream deltas, so TTS can't read text
     the server later redacts). Feeds full history back for multi-turn context
     and respects the UI language so replies land in the right locale. */
  const sendAiText = useCallback(
    async (textIn: string, viaVoice: boolean) => {
      const text = textIn.trim();
      if (!text) return;
      if (aiSendingRef.current) return;
      aiSendingRef.current = true;
      setAiSending(true);

      stopTts();
      setAiInput("");
      setAiMessages((prev) => [...prev, { role: "user", text }]);

      const uiLang =
        (typeof document !== "undefined"
          ? (document.documentElement.lang as "en" | "zh" | "ar")
          : "en") || "en";

      const wireMessages = [...aiMessages, { role: "user", text } as const].map(
        (m) => ({
          role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
          content: m.text,
        }),
      );

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            messages: wireMessages,
            user_lang: uiLang,
            stream: true,
          }),
        });

        if (!res.ok || !res.body) {
          const msg = `AI is unavailable right now. (${res.status})`;
          setAiMessages((prev) => [...prev, { role: "ai", text: msg }]);
          return;
        }

        /* Placeholder assistant bubble so deltas visibly stream. */
        let bubbleIndex = -1;
        setAiMessages((prev) => {
          bubbleIndex = prev.length;
          return [...prev, { role: "ai", text: "" }];
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let accumulated = "";
        let finalReply = "";
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const events = buf.split("\n\n");
          buf = events.pop() ?? "";
          for (const ev of events) {
            for (const line of ev.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload) continue;
              try {
                const json = JSON.parse(payload) as
                  | { type: "start" }
                  | { type: "delta"; text: string }
                  | { type: "end"; reply: string }
                  | { type: "error"; message?: string };
                if (json.type === "delta") {
                  accumulated += json.text;
                  setAiMessages((prev) => {
                    if (bubbleIndex < 0 || bubbleIndex >= prev.length) return prev;
                    const next = prev.slice();
                    next[bubbleIndex] = { role: "ai", text: accumulated };
                    return next;
                  });
                } else if (json.type === "end") {
                  finalReply = json.reply;
                  setAiMessages((prev) => {
                    if (bubbleIndex < 0 || bubbleIndex >= prev.length) return prev;
                    const next = prev.slice();
                    next[bubbleIndex] = { role: "ai", text: finalReply };
                    return next;
                  });
                } else if (json.type === "error") {
                  const msg = json.message || "AI is unavailable right now.";
                  setAiMessages((prev) => {
                    if (bubbleIndex < 0 || bubbleIndex >= prev.length) return prev;
                    const next = prev.slice();
                    next[bubbleIndex] = { role: "ai", text: msg };
                    return next;
                  });
                }
              } catch {
                /* Malformed frame — skip, keep streaming. */
              }
            }
          }
        }

        const spokenText = finalReply || accumulated;
        if (viaVoice && spokenText) {
          setAiSpeaking(true);
          ttsHandleRef.current = speakText(spokenText, {
            lang: uiLang,
            onEnd: () => {
              ttsHandleRef.current = null;
              setAiSpeaking(false);
            },
          });
        }
      } catch (e) {
        setAiMessages((prev) => [
          ...prev,
          { role: "ai", text: e instanceof Error ? e.message : "Network error" },
        ]);
      } finally {
        aiSendingRef.current = false;
        setAiSending(false);
      }
    },
    [aiMessages, stopTts],
  );

  const handleAiSend = useCallback(() => {
    void sendAiText(aiInput, false);
  }, [aiInput, sendAiText]);

  return {
    aiInput,
    setAiInput,
    aiMessages,
    setAiMessages,
    aiSending,
    aiSpeaking,
    sendAiText,
    handleAiSend,
    stopTts,
  };
}
