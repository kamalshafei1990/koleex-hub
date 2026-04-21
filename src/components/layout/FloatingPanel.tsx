"use client";

/* ---------------------------------------------------------------------------
   FloatingPanel — unified FAB with Discuss quick-reply + AI chat.

   · Single glowing FAB button (bottom-end corner).
   · Opens a floating panel with two tabs: Discuss and AI.
   · Discuss tab: recent channels with unread → click to chat inline.
   · AI tab: placeholder chat interface.
   · Unread badge on FAB from Discuss notifications.
   · Available globally via RootShell.
   --------------------------------------------------------------------------- */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { usePathname } from "next/navigation";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import MicButton, { speakText, type TtsHandle } from "@/components/ai/MicButton";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import AiFaceIcon from "@/components/icons/AiFaceIcon";
import DiscussIcon from "@/components/icons/DiscussIcon";
import {
  fetchMyChannels,
  fetchChannelMessages,
  sendDiscussMessage,
  markChannelRead,
  subscribeToMyChannels,
  subscribeToChannel,
} from "@/lib/discuss";
import { useCurrentAccount } from "@/lib/identity";
import type {
  DiscussChannelWithState,
  DiscussMessageWithAuthor,
} from "@/types/supabase";

/* ── Theme hook ── */
function useTheme() {
  const [dk, setDk] = useState(true);
  useEffect(() => {
    const sync = () =>
      setDk(document.documentElement.getAttribute("data-theme") !== "light");
    sync();
    const h = () => sync();
    window.addEventListener("themechange", h);
    return () => window.removeEventListener("themechange", h);
  }, []);
  return dk;
}

/* ── Time formatting ── */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function channelLabel(ch: DiscussChannelWithState): string {
  if (ch.name?.trim()) return ch.name;
  if (ch.other) return ch.other.full_name || ch.other.username || "Direct message";
  if (ch.linked_contact) return ch.linked_contact.display_name;
  return "Untitled";
}

function channelAvatar(ch: DiscussChannelWithState): string | null {
  if (ch.other?.avatar_url) return ch.other.avatar_url;
  return null;
}

/* ═══════════════════════════════════════════════════
   FLOATING PANEL COMPONENT
   ═══════════════════════════════════════════════════ */

export default function FloatingPanel() {
  const pathname = usePathname();
  const dk = useTheme();
  const { account } = useCurrentAccount();
  const accountId = account?.id ?? null;
  const accountIdRef = useRef(accountId);
  useEffect(() => { accountIdRef.current = accountId; }, [accountId]);

  /* ── Context-aware visibility ──
     · On /ai  → hide the AI side of the pill (only Discuss stays).
     · On /discuss → hide the Discuss side (only AI stays).
     · Elsewhere → both sides show as normal.
     Width/opacity animate so it feels smooth when you navigate. */
  const isAiApp = pathname === "/ai" || !!pathname?.startsWith("/ai/");
  const isDiscussApp = pathname === "/discuss" || !!pathname?.startsWith("/discuss/");
  const showAi = !isAiApp;
  const showDiscuss = !isDiscussApp;
  const showDivider = showAi && showDiscuss;
  const soloMode = !showDivider; // exactly one side visible

  /* ── State ── */
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [tab, setTab] = useState<"ai" | "discuss">("ai");

  /* ── Auto-switch tab when the current one becomes hidden.
     Keeps the sliding highlight behind whatever side is visible. */
  useEffect(() => {
    if (!showAi && tab === "ai") setTab("discuss");
    if (!showDiscuss && tab === "discuss") setTab("ai");
  }, [showAi, showDiscuss, tab]);
  const [channels, setChannels] = useState<DiscussChannelWithState[]>([]);
  const [activeChannel, setActiveChannel] = useState<DiscussChannelWithState | null>(null);
  const [messages, setMessages] = useState<DiscussMessageWithAuthor[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<Array<{ role: "user" | "ai"; text: string }>>([]);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  /* ── Discuss unread ── */
  const totalUnread = useMemo(
    () => channels.reduce((acc, c) => acc + (c.unread_count ?? 0), 0),
    [channels],
  );

  /* ── Fetch channels ── */
  const loadChannels = useCallback(async () => {
    const aid = accountIdRef.current;
    if (!aid) return;
    try {
      const rows = await fetchMyChannels(aid);
      setChannels(rows);
    } catch { /* keep prior */ }
  }, []);

  useEffect(() => { void loadChannels(); }, [accountId, loadChannels]);

  /* ── Realtime channel updates ── */
  useEffect(() => {
    if (!accountId) return;
    return subscribeToMyChannels({
      onMessageInsert: (msg) => {
        if (msg.author_account_id === accountIdRef.current) return;
        setChannels(prev =>
          prev.map(c =>
            c.id === msg.channel_id
              ? { ...c, unread_count: (c.unread_count ?? 0) + 1 }
              : c,
          ),
        );
        void loadChannels();
      },
      onChannelChange: () => void loadChannels(),
    });
  }, [accountId, loadChannels]);

  /* ── Open channel chat ── */
  const openChannel = useCallback(async (ch: DiscussChannelWithState) => {
    const aid = accountIdRef.current;
    if (!aid) return;
    setActiveChannel(ch);
    setLoadingMsgs(true);
    setMessages([]);
    try {
      const msgs = await fetchChannelMessages(ch.id, { currentAccountId: aid, limit: 40 });
      setMessages(msgs.reverse()); // oldest first
      await markChannelRead(ch.id, aid);
      setChannels(prev => prev.map(c => c.id === ch.id ? { ...c, unread_count: 0 } : c));
      window.dispatchEvent(new CustomEvent("discuss:unread-changed"));
    } catch { /* ignore */ }
    setLoadingMsgs(false);
  }, []);

  /* ── Realtime messages for active channel ── */
  useEffect(() => {
    if (!activeChannel) return;
    const unsub = subscribeToChannel(activeChannel.id, {
      onMessageInsert: (msg) => {
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg as unknown as DiscussMessageWithAuthor];
        });
        // Auto mark read
        const aid = accountIdRef.current;
        if (aid && msg.author_account_id !== aid) {
          void markChannelRead(activeChannel.id, aid);
          setChannels(prev => prev.map(c => c.id === activeChannel.id ? { ...c, unread_count: 0 } : c));
        }
      },
      onMessageUpdate: () => {},
      onReactionInsert: () => {},
      onReactionDelete: () => {},
    });
    return unsub;
  }, [activeChannel]);

  /* ── Auto scroll ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* ── Send message ── */
  const handleSend = useCallback(async () => {
    const aid = accountIdRef.current;
    if (!aid || !activeChannel || !msgInput.trim()) return;
    const body = msgInput.trim();
    setMsgInput("");
    setSending(true);
    try {
      await sendDiscussMessage({
        channelId: activeChannel.id,
        authorId: aid,
        body,
        kind: "text",
      });
    } catch { /* ignore */ }
    setSending(false);
  }, [activeChannel, msgInput]);

  /* ── AI send — real call against /api/ai/chat ──
     Feeds the full in-panel history back so the model gets multi-turn
     context, adds an optimistic user bubble, and surfaces a graceful
     error line if the provider returns a problem. Respects the UI
     language so replies land in the right locale. */
  const aiSendingRef = useRef(false);
  const [aiSending, setAiSending] = useState(false);
  /* Voice-chat state. Phase 1: we only track whether TTS is currently
     speaking so the mic button can swap to a "stop" state. Transcript
     flows through the normal input → handleAiSend path. */
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const ttsHandleRef = useRef<TtsHandle | null>(null);
  const stopTts = useCallback(() => {
    ttsHandleRef.current?.cancel();
    ttsHandleRef.current = null;
    setAiSpeaking(false);
  }, []);
  /* sendAiText: the shared send path for both typed and voice input.
     Used directly by MicButton (viaVoice=true → speak the reply) and
     indirectly by handleAiSend for the textarea. Keeping both on one
     function means voice can never drift from the typed pipeline. */
  const sendAiText = useCallback(
    async (textIn: string, viaVoice: boolean) => {
      const text = textIn.trim();
      if (!text) return;
      if (aiSendingRef.current) return;
      aiSendingRef.current = true;
      setAiSending(true);

      /* A fresh message replaces any in-progress TTS so the user
         isn't hearing the previous answer while a new one loads. */
      stopTts();
      setAiInput("");
      setAiMessages(prev => [...prev, { role: "user", text }]);

      const uiLang = (typeof document !== "undefined"
        ? (document.documentElement.lang as "en" | "zh" | "ar")
        : "en") || "en";

      const wireMessages = [
        ...[...aiMessages, { role: "user", text } as const].map(m => ({
          role: m.role === "ai" ? ("assistant" as const) : ("user" as const),
          content: m.text,
        })),
      ];

      try {
        /* Streaming fetch (Phase 2). The server emits SSE events:
             start | delta | end
           We append a placeholder AI bubble, mutate it as deltas
           arrive, then replace its text with the canonical sealed
           `end.reply` at stream close. Voice-originated turns speak
           only the final sealed reply (NOT mid-stream deltas) so
           TTS can't say pricing that the server later redacted. */
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
          setAiMessages(prev => [...prev, { role: "ai", text: msg }]);
          return;
        }

        /* Insert placeholder assistant bubble so deltas visibly
           stream. Track its index for in-place mutation. */
        let bubbleIndex = -1;
        setAiMessages(prev => {
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
                  setAiMessages(prev => {
                    if (bubbleIndex < 0 || bubbleIndex >= prev.length) return prev;
                    const next = prev.slice();
                    next[bubbleIndex] = { role: "ai", text: accumulated };
                    return next;
                  });
                } else if (json.type === "end") {
                  finalReply = json.reply;
                  setAiMessages(prev => {
                    if (bubbleIndex < 0 || bubbleIndex >= prev.length) return prev;
                    const next = prev.slice();
                    next[bubbleIndex] = { role: "ai", text: finalReply };
                    return next;
                  });
                } else if (json.type === "error") {
                  const msg = json.message || "AI is unavailable right now.";
                  setAiMessages(prev => {
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
        setAiMessages(prev => [
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
    sendAiText(aiInput, false);
  }, [aiInput, sendAiText]);

  /* ── Close with animation ── */
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 200);
  }, []);

  /* ── Close on outside click ── */
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, handleClose]);

  /* ── Back from chat ── */
  const handleBack = () => {
    setActiveChannel(null);
    setMessages([]);
    setMsgInput("");
  };

  /* ── Sorted channels ── */
  const sortedChannels = useMemo(() =>
    [...channels].sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bt - at;
    }).slice(0, 20),
    [channels],
  );

  /* ── Token colors ── */
  const bg = dk ? "bg-[#111]" : "bg-white";
  const border = dk ? "border-white/[0.08]" : "border-black/[0.08]";
  const textP = dk ? "text-white" : "text-black";
  const textM = dk ? "text-white/50" : "text-black/50";
  const textG = dk ? "text-white/25" : "text-black/25";
  const hoverBg = dk ? "hover:bg-white/[0.04]" : "hover:bg-black/[0.03]";

  /* ── Position offset ──
     Inside the AI app on mobile the FAB sits right on top of the
     composer Send button. Lift it up so both remain tappable. On
     desktop and elsewhere the default 24px is fine. */
  const fabBottomClass = isAiApp
    ? "bottom-24 md:bottom-6"
    : "bottom-6";

  return (
    <div ref={panelRef} className={`fixed ${fabBottomClass} end-6 z-[90]`}>
      {/* ── Panel ── */}
      {(open || closing) && (
        <div
          className={`absolute bottom-[56px] end-0 w-[380px] max-w-[92vw] h-[520px] max-h-[70vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
            tab === "ai" && !closing ? "panel-neon-border" : `border ${border}`
          } ${bg}`}
          style={{
            boxShadow: tab === "ai" && !closing
              ? dk
                ? "0 8px 40px rgba(0,0,0,0.8), 0 0 20px rgba(0,212,255,0.08), 0 0 40px rgba(123,97,255,0.06)"
                : "0 8px 40px rgba(0,0,0,0.15), 0 0 20px rgba(0,212,255,0.06), 0 0 40px rgba(123,97,255,0.04)"
              : dk
                ? "0 8px 40px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)"
                : "0 8px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)",
            transition: "opacity 0.2s ease-out, transform 0.2s ease-out",
            opacity: closing ? 0 : 1,
            transform: closing ? "translateY(8px) scale(0.97)" : "translateY(0) scale(1)",
          }}
        >
          {/* ── Header ── */}
          <div className={`flex items-center justify-between px-3 py-2.5 border-b ${border} shrink-0`}>
            {tab === "discuss" && activeChannel ? (
              <div className="flex items-center gap-2 min-w-0">
                <button onClick={handleBack} className={`p-1 rounded-lg transition-colors ${hoverBg} ${textM}`}>
                  <AngleLeftIcon size={16} />
                </button>
                <span className={`text-[13px] font-semibold truncate ${textP}`}>
                  {channelLabel(activeChannel)}
                </span>
              </div>
            ) : (
              <div
                className="flex items-center rounded-xl p-[3px] flex-1"
                style={{
                  background: dk ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)",
                  border: dk ? "1px solid rgba(255,255,255,0.06)" : "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <button
                  onClick={() => setTab("ai")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-[9px] text-[12px] font-semibold transition-all duration-300 ${
                    tab === "ai"
                      ? "shadow-sm"
                      : dk ? "text-white/35 hover:text-white/55" : "text-black/35 hover:text-black/55"
                  }`}
                  style={tab === "ai" ? {
                    background: dk
                      ? "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(123,97,255,0.12), rgba(255,110,199,0.06))"
                      : "linear-gradient(135deg, rgba(0,212,255,0.10), rgba(123,97,255,0.08))",
                  } : undefined}
                >
                  <AiFaceIcon size={16} className={tab === "ai" ? "ai-lottie-glow" : "opacity-40"} animated={tab === "ai"} />
                  <span className={tab === "ai" ? "ai-neon-text" : ""}>AI</span>
                </button>
                <button
                  onClick={() => { setTab("discuss"); setActiveChannel(null); }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-[9px] text-[12px] font-semibold transition-all duration-300 ${
                    tab === "discuss"
                      ? dk ? "bg-white/[0.10] text-white shadow-sm" : "bg-black/[0.08] text-black shadow-sm"
                      : dk ? "text-white/35 hover:text-white/55" : "text-black/35 hover:text-black/55"
                  }`}
                >
                  <DiscussIcon size={13} />
                  Discuss
                  {totalUnread > 0 && (
                    <span
                      className="min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
                      style={{ boxShadow: "0 0 6px rgba(239,68,68,0.4)" }}
                    >
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </button>
              </div>
            )}
            <button
              onClick={handleClose}
              className={`p-1.5 rounded-lg transition-colors ${hoverBg} ${textM}`}
              title="Close"
            >
              <CrossIcon size={14} />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {tab === "discuss" ? (
              activeChannel ? (
                /* ── Chat view ── */
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                    {loadingMsgs && (
                      <div className="flex justify-center py-8">
                        <SpinnerIcon className={`h-5 w-5 animate-spin ${textG}`} />
                      </div>
                    )}
                    {messages.map((msg) => {
                      const isMe = msg.author_account_id === accountId;
                      const authorName = msg.author
                        ? (Array.isArray(msg.author) ? null : (msg.author as any)?.full_name || (msg.author as any)?.username)
                        : null;
                      if (msg.deleted_at) return null;
                      return (
                        <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] ${isMe ? "order-1" : ""}`}>
                            {!isMe && authorName && (
                              <span className={`text-[10px] font-medium mb-0.5 block ${textM}`}>
                                {authorName}
                              </span>
                            )}
                            <div className={`px-3 py-2 rounded-2xl text-[13px] leading-relaxed ${
                              isMe
                                ? dk ? "bg-white/[0.12] text-white" : "bg-black/[0.08] text-black"
                                : dk ? "bg-white/[0.05] text-white/80" : "bg-black/[0.04] text-black/80"
                            }`}>
                              {msg.body}
                            </div>
                            <span className={`text-[9px] mt-0.5 block ${isMe ? "text-end" : ""} ${textG}`}>
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              ) : (
                /* ── Channel list ── */
                <div className="py-1">
                  {sortedChannels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                      <DiscussIcon size={24} className={textG} />
                      <p className={`text-[12px] font-medium mt-3 ${textM}`}>No conversations yet</p>
                      <p className={`text-[11px] mt-1 ${textG}`}>Messages from Discuss will appear here</p>
                    </div>
                  ) : (
                    sortedChannels.map((ch) => {
                      const hasUnread = (ch.unread_count ?? 0) > 0;
                      const preview = ch.last_message?.body?.trim() || "";
                      const author = ch.last_message?.author_username;
                      const avatar = channelAvatar(ch);
                      return (
                        <button
                          key={ch.id}
                          onClick={() => openChannel(ch)}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${hoverBg}`}
                        >
                          {/* Avatar */}
                          <div className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-[13px] font-semibold ${
                            dk ? "bg-white/[0.08] text-white/60" : "bg-black/[0.06] text-black/60"
                          }`}>
                            {avatar ? (
                              <img src={avatar} alt="" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              channelLabel(ch).charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[13px] font-semibold truncate ${hasUnread ? textP : textM}`}>
                                {channelLabel(ch)}
                              </span>
                              <span className={`text-[10px] shrink-0 ${textG}`}>
                                {ch.last_message_at ? timeAgo(ch.last_message_at) : ""}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <span className={`text-[11.5px] truncate ${hasUnread ? (dk ? "text-white/60" : "text-black/60") : textG}`}>
                                {author && preview ? `${author}: ${preview}` : preview || "No messages"}
                              </span>
                              {hasUnread && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                                  {ch.unread_count! > 99 ? "99+" : ch.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )
            ) : (
              /* ── AI Tab ── */
              <div className="flex flex-col h-full">
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                  {aiMessages.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                      <AiFaceIcon size={64} animated />
                      <p className={`text-[13px] font-semibold mt-3 ${textM}`}>Koleex AI</p>
                      <p className={`text-[11px] mt-1 ${textG}`}>Ask anything about your business data</p>
                    </div>
                  )}
                  {aiMessages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                      {/* Avatar */}
                      <div className="shrink-0 mt-0.5">
                        {m.role === "user" ? (
                          <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center" style={{ background: dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }}>
                            {account?.avatar_url || account?.person?.avatar_url ? (
                              <img src={(account?.avatar_url || account?.person?.avatar_url)!} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className={`text-[10px] font-bold ${dk ? "text-white/50" : "text-black/50"}`}>
                                {(account?.username || "U").charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                        ) : (
                          <AiFaceIcon size={28} animated />
                        )}
                      </div>
                      {/* Message bubble */}
                      <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed whitespace-pre-line ${
                        m.role === "user"
                          ? dk ? "bg-white/[0.12] text-white" : "bg-black/[0.08] text-black"
                          : dk ? "bg-white/[0.05] text-white/80" : "bg-black/[0.04] text-black/80"
                      }`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
                  {aiSending && (
                    <div className="flex gap-2 flex-row">
                      <div className="shrink-0 mt-0.5">
                        <AiFaceIcon size={28} animated />
                      </div>
                      <div className={`px-3 py-2 rounded-2xl text-[13px] flex items-center gap-1.5 ${
                        dk ? "bg-white/[0.05] text-white/60" : "bg-black/[0.04] text-black/60"
                      }`}>
                        <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                        <span>…</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            )}
          </div>

          {/* ── Input bar ── */}
          {(tab === "ai" || (tab === "discuss" && activeChannel)) && (
            <div className={`shrink-0 border-t ${border} px-3 py-2.5`}>
              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${
                dk ? "border-white/[0.08] bg-white/[0.03]" : "border-black/[0.06] bg-black/[0.02]"
              }`}>
                <input
                  type="text"
                  placeholder={tab === "ai" ? "Ask Koleex AI..." : "Type a message..."}
                  value={tab === "ai" ? aiInput : msgInput}
                  onChange={(e) => tab === "ai" ? setAiInput(e.target.value) : setMsgInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      tab === "ai" ? handleAiSend() : handleSend();
                    }
                  }}
                  className={`flex-1 bg-transparent text-[13px] outline-none ${
                    dk ? "text-white placeholder:text-white/25" : "text-black placeholder:text-black/25"
                  }`}
                />
                {/* Mic button — AI tab only (FloatingPanel is Chat-mode
                    by design; no Agent mode here). Clicking speaks the
                    transcript into sendAiText(viaVoice=true) which then
                    reads the reply aloud via speechSynthesis. */}
                {tab === "ai" && (
                  <MicButton
                    size={28}
                    onTranscript={(t) => sendAiText(t, true)}
                    onError={(msg) =>
                      setAiMessages(prev => [...prev, { role: "ai", text: msg }])
                    }
                    speaking={aiSpeaking}
                    onStopSpeaking={stopTts}
                    disabled={aiSending}
                    lang={(typeof document !== "undefined"
                      ? (document.documentElement.lang as "en" | "zh" | "ar")
                      : "en")}
                  />
                )}
                <button
                  onClick={tab === "ai" ? handleAiSend : handleSend}
                  disabled={tab === "ai" ? (!aiInput.trim() || aiSending) : (!msgInput.trim() || sending)}
                  className={`p-1.5 rounded-lg transition-all disabled:opacity-20 ${
                    dk ? "text-white/60 hover:text-white hover:bg-white/[0.06]" : "text-black/60 hover:text-black hover:bg-black/[0.06]"
                  }`}
                >
                  <PaperPlaneIcon size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── FAB Pill / Circle ── */}
      <style>{`
        /* ── Rotating aurora border ── */
        @keyframes fab-border-spin {
          0% { --fab-angle: 0deg; }
          100% { --fab-angle: 360deg; }
        }
        @property --fab-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        .fab-outer {
          animation: fab-border-spin 4s linear infinite;
          background: conic-gradient(
            from var(--fab-angle),
            ${dk ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"},
            ${dk ? "rgba(0,212,255,0.25)" : "rgba(0,212,255,0.15)"},
            ${dk ? "rgba(123,97,255,0.25)" : "rgba(123,97,255,0.15)"},
            ${dk ? "rgba(255,110,199,0.20)" : "rgba(255,110,199,0.12)"},
            ${dk ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"}
          );
          padding: 1px;
        }

        /* ── Floating / breathing ── */
        @keyframes fab-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }
        .fab-outer { animation: fab-border-spin 4s linear infinite, fab-float 3s ease-in-out infinite; }

        /* ── Surface shimmer sweep ── */
        @keyframes fab-sweep {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .fab-shimmer {
          position: absolute;
          top: 0; bottom: 0;
          width: 40%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            ${dk ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.3)"} 50%,
            transparent 100%
          );
          animation: fab-sweep 3s ease-in-out infinite;
          pointer-events: none;
          z-index: 1;
        }

        /* ── Ambient glow pulse ── */
        @keyframes fab-ambient {
          0%, 100% {
            box-shadow:
              0 4px 20px ${dk ? "rgba(0,212,255,0.08)" : "rgba(0,0,0,0.06)"},
              0 0 40px ${dk ? "rgba(123,97,255,0.06)" : "rgba(0,0,0,0.03)"};
          }
          50% {
            box-shadow:
              0 6px 28px ${dk ? "rgba(0,212,255,0.14)" : "rgba(0,0,0,0.10)"},
              0 0 56px ${dk ? "rgba(123,97,255,0.10)" : "rgba(0,0,0,0.06)"};
          }
        }
        .fab-outer { animation: fab-border-spin 4s linear infinite, fab-float 3s ease-in-out infinite, fab-ambient 3s ease-in-out infinite; }

        /* ── AI neon text gradient ── */
        @keyframes ai-shimmer {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .ai-neon-text {
          background: linear-gradient(135deg, #00d4ff, #7b61ff, #ff6ec7, #00d4ff);
          background-size: 300% 300%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: ai-shimmer 3s ease-in-out infinite;
        }

        /* ── AI icon color cycle + glow ── */
        @keyframes ai-icon-glow {
          0%, 100% {
            filter: drop-shadow(0 0 3px rgba(0,212,255,0.7)) drop-shadow(0 0 8px rgba(123,97,255,0.4));
            color: #00d4ff;
          }
          33% {
            filter: drop-shadow(0 0 5px rgba(123,97,255,0.8)) drop-shadow(0 0 12px rgba(255,110,199,0.4));
            color: #7b61ff;
          }
          66% {
            filter: drop-shadow(0 0 5px rgba(255,110,199,0.7)) drop-shadow(0 0 12px rgba(0,212,255,0.4));
            color: #ff6ec7;
          }
        }
        .ai-neon-icon { animation: ai-icon-glow 3s ease-in-out infinite; }

        /* ── Lottie icon glow (pulsing neon shadow around the Lottie container) ── */
        @keyframes ai-lottie-pulse {
          0%, 100% {
            filter: drop-shadow(0 0 3px rgba(0,212,255,0.5)) drop-shadow(0 0 6px rgba(123,97,255,0.3));
          }
          50% {
            filter: drop-shadow(0 0 5px rgba(123,97,255,0.6)) drop-shadow(0 0 10px rgba(255,110,199,0.4));
          }
        }
        .ai-lottie-glow { animation: ai-lottie-pulse 3s ease-in-out infinite; }

        /* ── X rotate on open ── */
        @keyframes fab-x-spin {
          from { transform: rotate(-90deg) scale(0.5); opacity: 0; }
          to { transform: rotate(0deg) scale(1); opacity: 1; }
        }
        .fab-x-enter { animation: fab-x-spin 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }

        /* ── Notification badge pulse ── */
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .fab-badge { animation: badge-pulse 2s ease-in-out infinite; }

        /* ── Panel neon border (AI tab) ── */
        @property --panel-angle {
          syntax: "<angle>";
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes panel-border-spin {
          0% { --panel-angle: 0deg; }
          100% { --panel-angle: 360deg; }
        }
        .panel-neon-border {
          animation: panel-border-spin 3s linear infinite;
          border: 1px solid transparent;
          background-origin: border-box;
          background-clip: padding-box, border-box;
          background-image:
            linear-gradient(${dk ? "#111" : "#fff"}, ${dk ? "#111" : "#fff"}),
            conic-gradient(
              from var(--panel-angle),
              rgba(0,212,255,0.4),
              rgba(123,97,255,0.4),
              rgba(255,110,199,0.3),
              rgba(0,212,255,0.1),
              rgba(123,97,255,0.4),
              rgba(0,212,255,0.4)
            );
        }
      `}</style>
      <div className="relative">
        {/* Notification badge — positioned outside overflow container */}
        {!open && totalUnread > 0 && (
          <span className="fab-badge absolute -top-1.5 z-10 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center"
            style={{
              insetInlineEnd: "4px",
              boxShadow: "0 0 8px rgba(239,68,68,0.5), 0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
        <div
          className="fab-outer rounded-full"
          style={{
            transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div
            className="relative flex items-center justify-center rounded-full cursor-pointer"
            style={{
              width: open ? 44 : undefined,
              height: open ? 44 : undefined,
              transition: "all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
              background: dk
                ? "linear-gradient(135deg, rgba(18,18,18,0.95) 0%, rgba(10,10,10,0.98) 100%)"
                : "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,248,248,0.98) 100%)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              overflow: "hidden",
            }}
          >
            {/* Shimmer sweep effect */}
            {!open && <div className="fab-shimmer" />}

            {open ? (
              /* ── Collapsed: circle X button ── */
              <button
                onClick={handleClose}
                className="flex items-center justify-center w-full h-full"
              >
                <CrossIcon size={16} className={`fab-x-enter ${dk ? "text-white/60" : "text-black/60"}`} />
              </button>
            ) : (
              /* ── Expanded: pill with AI | Discuss (solo-aware) ── */
              <div className="relative flex items-center z-[2]">
                {/* Sliding selection indicator.
                    In solo mode it stretches to fill the whole (single) button;
                    in dual mode it snaps under the active tab. */}
                <div
                  className="absolute top-[4px] bottom-[4px] rounded-full pointer-events-none"
                  style={{
                    width: soloMode ? "calc(100% - 8px)" : "calc(50% - 5px)",
                    insetInlineStart: soloMode
                      ? "4px"
                      : tab === "ai" ? "4px" : "calc(50% + 1px)",
                    background: tab === "ai"
                      ? dk
                        ? "linear-gradient(135deg, rgba(0,212,255,0.10) 0%, rgba(123,97,255,0.10) 50%, rgba(255,110,199,0.06) 100%)"
                        : "linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(123,97,255,0.08) 100%)"
                      : dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    transition: "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                />
                {/* AI side — wrapper animates width to 0 when hidden (in /ai app).
                    Responsive size (40px mobile / 88px desktop) is handled by tailwind
                    classes; the hidden state overrides with inline max-width: 0. */}
                <div
                  className="overflow-hidden"
                  style={{
                    maxWidth: showAi ? 200 : 0,
                    opacity: showAi ? 1 : 0,
                    transform: showAi ? "scale(1)" : "scale(0.85)",
                    transition:
                      "max-width 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <button
                    onClick={() => {
                      if (!showAi) return;
                      /* Both sides of the FAB pill open the floating
                         panel. Two-click UX: first click switches
                         tab, second click opens the panel. If this
                         tab is already active, one click opens it. */
                      if (tab === "ai") { setOpen(true); }
                      else { setTab("ai"); }
                    }}
                    aria-hidden={!showAi}
                    tabIndex={showAi ? 0 : -1}
                    className={`relative flex items-center justify-center gap-1.5 w-10 md:w-[88px] py-2.5 md:py-3 transition-all duration-300 ${
                      tab !== "ai" ? dk ? "text-white/30 hover:text-white/55" : "text-black/30 hover:text-black/55" : ""
                    }`}
                    style={{ pointerEvents: showAi ? "auto" : "none" }}
                  >
                    <AiFaceIcon size={16} className={tab === "ai" ? "ai-lottie-glow" : "opacity-30"} animated={tab === "ai"} />
                    <span className={`hidden md:inline text-[11px] font-bold tracking-wide ${tab === "ai" ? "ai-neon-text" : ""}`}>
                      AI
                    </span>
                  </button>
                </div>

                {/* Divider — only when both sides visible */}
                <div
                  className={`${dk ? "bg-white/[0.06]" : "bg-black/[0.05]"}`}
                  style={{
                    width: showDivider ? 1 : 0,
                    height: 24,
                    opacity: showDivider ? 1 : 0,
                    transition: "width 0.35s ease, opacity 0.25s ease",
                  }}
                />

                {/* Discuss side — wrapper animates width to 0 when hidden (in /discuss app) */}
                <div
                  className="overflow-hidden"
                  style={{
                    maxWidth: showDiscuss ? 200 : 0,
                    opacity: showDiscuss ? 1 : 0,
                    transform: showDiscuss ? "scale(1)" : "scale(0.85)",
                    transition:
                      "max-width 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.35s ease, transform 0.5s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                >
                  <button
                    onClick={() => {
                      if (!showDiscuss) return;
                      if (tab === "discuss") { setOpen(true); setActiveChannel(null); }
                      else { setTab("discuss"); }
                    }}
                    aria-hidden={!showDiscuss}
                    tabIndex={showDiscuss ? 0 : -1}
                    className={`relative flex items-center justify-center gap-1.5 w-10 md:w-[88px] py-2.5 md:py-3 transition-all duration-300 ${
                      tab === "discuss"
                        ? dk ? "text-white/90" : "text-black/90"
                        : dk ? "text-white/30 hover:text-white/55" : "text-black/30 hover:text-black/55"
                    }`}
                    style={{ pointerEvents: showDiscuss ? "auto" : "none" }}
                  >
                    <DiscussIcon size={14} />
                    <span className="hidden md:inline text-[11px] font-semibold tracking-wide">Discuss</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
