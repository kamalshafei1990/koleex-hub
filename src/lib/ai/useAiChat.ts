"use client";

/* ---------------------------------------------------------------------------
   useAiChat — the single source of truth for the quick Koleex AI chat
   (today: the "Koleex AI" conversation inside Discuss).

   ⚠️ THE AGENT, NOT THE BARE MODEL. This used to stream /api/ai/chat — a
   plain LLM with no tools — and it invented "1,247 products" for a catalog
   of 205 (owner caught it, 2026-08-20). Every turn now goes through
   /api/ai/agent: the orchestrator with permission-aware tools, so this chat
   knows exactly what the AI app knows, gated by the same roles. The cost is
   streaming (the agent replies as one JSON turn) — consumers already show a
   "Thinking…" state via aiSending.

   The agent needs an owned conversation row; a per-user quick-chat
   conversation id is kept in localStorage (kx_ prefix — wiped on sign-out)
   and recreated transparently if it was deleted.
   --------------------------------------------------------------------------- */

import { useCallback, useRef, useState } from "react";
import { speakText, type TtsHandle } from "@/components/ai/MicButton";

const CONV_KEY = "kx_quick_ai_conv";

async function ensureConversation(forceNew: boolean): Promise<string | null> {
  if (!forceNew) {
    try {
      const saved = window.localStorage.getItem(CONV_KEY);
      if (saved) return saved;
    } catch { /* fall through */ }
  }
  const res = await fetch("/api/ai/conversations", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "Quick chat" }),
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { id?: string; conversation?: { id?: string } };
  const id = j.id ?? j.conversation?.id ?? null;
  if (id) {
    try { window.localStorage.setItem(CONV_KEY, id); } catch { /* fine */ }
  }
  return id;
}

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

      try {
        /* THE AGENT PATH. History lives server-side on the conversation row,
           so each turn sends only the new text. */
        const ask = (convId: string) =>
          fetch("/api/ai/agent", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: convId, content: text, user_lang: uiLang }),
          });

        let convId = await ensureConversation(false);
        let res = convId ? await ask(convId) : null;
        /* The saved conversation can be deleted from the AI app's sidebar —
           the agent 404s. Recreate ONCE, transparently, and retry. */
        if (!res || res.status === 404) {
          convId = await ensureConversation(true);
          res = convId ? await ask(convId) : null;
        }
        if (!res || !res.ok) {
          const msg = `AI is unavailable right now. (${res ? res.status : "no connection"})`;
          setAiMessages((prev) => [...prev, { role: "ai", text: msg }]);
          return;
        }

        const j = (await res.json()) as {
          message?: { content?: string | null } | null;
          agent?: { reply?: string | null } | null;
        };
        const reply = j.message?.content || j.agent?.reply || "";
        setAiMessages((prev) => [
          ...prev,
          { role: "ai", text: reply || "AI returned an empty reply — try again." },
        ]);

        if (viaVoice && reply) {
          setAiSpeaking(true);
          ttsHandleRef.current = speakText(reply, {
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
    [stopTts],
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
