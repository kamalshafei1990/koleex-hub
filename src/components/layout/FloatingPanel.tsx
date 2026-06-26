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
import KoleexOrb from "@/components/ai/KoleexOrb";
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
  /* Minimised mode — collapses the FAB to a tiny handle in the corner
     so it stops covering report tables (operator complaint: the AI +
     Discuss pill was sitting on top of the Finance Overview's NET
     INCOME row). Persisted to localStorage so the choice survives
     navigation + reloads. */
  const [minimized, setMinimized] = useState<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMinimized(window.localStorage.getItem("koleex-fab-minimized") === "1");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem("koleex-fab-minimized", minimized ? "1" : "0"); } catch { /* private mode */ }
  }, [minimized]);

  /* ── Calm-down: auto-hide the collapsed dock while the operator is
       actively scrolling, so it never sits on top of the content they're
       reading. Reappears after a short pause. Capture-phase so it also
       catches scrolls inside nested overflow containers (e.g. the embedded
       Supplier 360). ── */
  const [scrollHidden, setScrollHidden] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setScrollHidden(true);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setScrollHidden(false), 650);
    };
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, { capture: true } as EventListenerOptions);
      if (timer) clearTimeout(timer);
    };
  }, []);

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

  /* ── Contextual Copilot hints (Phase 1.7) ──
     The active page (e.g. FinanceDashboard) dispatches a CustomEvent
     describing the operational state — overdue AR, supplier pressure,
     liquidity narrative. The panel surfaces the top hints as proactive
     suggestion chips in the Copilot empty-state, so the assistant feels
     situationally aware before the operator types anything. Calm and
     monochrome — these are read like an executive briefing, not chat
     suggestions. */
  type CopilotHint = { key: string; text: string; severity: "info" | "watch" | "risk" };
  const [copilotHints, setCopilotHints] = useState<CopilotHint[]>([]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ hints: CopilotHint[] }>;
      const next = Array.isArray(ce.detail?.hints) ? ce.detail.hints.slice(0, 4) : [];
      setCopilotHints(next);
    };
    window.addEventListener("koleex:copilot-context", handler as EventListener);
    return () => window.removeEventListener("koleex:copilot-context", handler as EventListener);
  }, []);

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
     Inside the AI app the composer fills the bottom of the
     viewport — on mobile it sits at roughly y=683-775 inside an 812 px
     screen (composer ~92 px tall + safe-area). bottom-24 (96 px)
     wasn't enough lift; the FAB landed inside the composer pill.
     bottom-40 (160 px) clears the composer with breathing room.
     Desktop keeps bottom-28 — the composer there sits inside a
     constrained max-w-[820px] block with more chrome below it. */
  const fabBottomClass = isAiApp
    ? "bottom-40 md:bottom-28"
    : "bottom-6";

  /* ── Minimised handle ──
     When the operator collapses the FAB, render only a small chevron
     tab in the corner. Single click/tap re-expands the full pill. We
     keep the same end-6 offset so the visual anchor doesn't jump.
     Sized 32 px on mobile (thumb-friendly tap target) and 28 px on
     desktop where a precise cursor doesn't need the extra surface. */
  if (minimized) {
    return (
      <button
        type="button"
        onClick={() => setMinimized(false)}
        aria-label="Show AI / Discuss"
        title="Show AI / Discuss"
        className={`fixed ${fabBottomClass} end-6 z-[90] flex h-8 w-8 md:h-7 md:w-7 items-center justify-center rounded-full border ${border} ${bg} shadow-lg transition-colors ${hoverBg}`}
        style={{
          boxShadow: dk
            ? "0 4px 14px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.04)"
            : "0 4px 14px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        {totalUnread > 0 && (
          <span
            className="fab-badge absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center"
            style={{ boxShadow: "0 0 6px rgba(239,68,68,0.45)" }}
          >
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
        <AngleLeftIcon size={12} className={dk ? "text-white/65" : "text-black/65"} />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      className={`fab-root fixed ${fabBottomClass} end-6 z-[90]`}
      data-idle={!open ? "true" : "false"}
      data-scrollhidden={scrollHidden && !open ? "true" : "false"}
    >
      {/* ── Panel ── */}
      {(open || closing) && (
        <div
          className={`absolute bottom-[56px] end-0 w-[380px] max-w-[92vw] h-[520px] max-h-[70vh] rounded-2xl flex flex-col overflow-hidden border ${border} ${bg}`}
          style={{
            /* Calm enterprise shadow — same regardless of tab so the
               Copilot panel reads as a Hub surface, not a chatbot
               toy. Removed the cyan/violet glow that was leftover
               from the older "AI" branding. */
            boxShadow: dk
              ? "0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)"
              : "0 12px 48px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)",
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
                      ? dk ? "bg-white/[0.10] text-white shadow-sm" : "bg-black/[0.08] text-black shadow-sm"
                      : dk ? "text-white/35 hover:text-white/55" : "text-black/35 hover:text-black/55"
                  }`}
                >
                  <AiFaceIcon size={14} className={tab === "ai" ? "opacity-90" : "opacity-40"} animated={tab === "ai"} />
                  <span>Copilot</span>
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
                    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
                      <KoleexOrb state={aiSending ? "loading" : "idle"} size={72} />
                      <p className={`text-[13px] font-semibold mt-3 ${textM}`}>Operator briefing</p>
                      <p className={`text-[11px] mt-1 ${textG}`}>Embedded finance intelligence</p>

                      {copilotHints.length > 0 && (
                        <div className="mt-5 w-full max-w-[320px] text-left">
                          <div className={`text-[9px] font-semibold uppercase tracking-[0.18em] mb-2 ${dk ? "text-white/35" : "text-black/40"}`}>
                            Operational read
                          </div>
                          <ul className="space-y-1.5">
                            {copilotHints.map((h) => {
                              const sev =
                                h.severity === "risk"
                                  ? (dk
                                      ? "border-rose-500/[0.22] bg-rose-500/[0.06]"
                                      : "border-rose-500/[0.30] bg-rose-500/[0.04]")
                                  : h.severity === "watch"
                                    ? (dk
                                        ? "border-amber-500/[0.22] bg-amber-500/[0.05]"
                                        : "border-amber-500/[0.30] bg-amber-500/[0.04]")
                                    : (dk
                                        ? "border-white/[0.06] bg-white/[0.02]"
                                        : "border-black/[0.06] bg-black/[0.02]");
                              return (
                                <li key={h.key}>
                                  <button
                                    type="button"
                                    onClick={() => setAiInput(`Tell me more — ${h.text}`)}
                                    className={
                                      "w-full rounded-lg border px-2.5 py-2 text-left text-[11px] leading-snug transition-colors " +
                                      sev + " " +
                                      (dk ? "text-white/80 hover:text-white" : "text-black/80 hover:text-black")
                                    }
                                  >
                                    {h.text}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
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
                  placeholder={tab === "ai" ? "Ask the operator briefing…" : "Type a message…"}
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
        /* Phase UI.3 — AI chrome de-neoned.
           Removed: conic-gradient panel-neon-border, FAB conic
           gradient sweep, fab-shimmer sweep, fab-ambient cyan/violet
           glow pulse, fab-float breathing, ai-neon-text gradient,
           ai-neon-icon colour cycle, ai-lottie-glow drop-shadow,
           cubic-bezier spring transitions.

           Kept: a single optional badge pulse on the unread counter
           (genuine UI signal, not chrome). FAB and panel now read as
           a quiet operator surface — embedded intelligence, not a
           chatbot widget. */
        .fab-outer {
          /* Flat ring, 1px hairline, no animation. */
          background: ${dk ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"};
          padding: 1px;
        }
        .ai-neon-text {
          /* Inherit current text colour — no gradient, no animation. */
          color: inherit;
        }
        .ai-lottie-glow {
          /* No drop-shadow, no animation — let the icon stand on its own. */
          filter: none;
        }
        /* Badge pulse retained — it's a real unread signal. */
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
        .fab-badge { animation: badge-pulse 2s ease-in-out infinite; }

        /* Panel surface — flat, hairline-bordered. */
        .panel-neon-border {
          border: 1px solid ${dk ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"};
          background: ${dk ? "#111" : "#fff"};
        }
        /* Minimise handle — small chevron tab that appears above the
           pill. Lets the operator collapse the FAB so it stops
           covering content (Finance Overview last-row issue).

           Behaviour split by input modality:
             · Desktop (hover-capable):   hidden by default, fade in on
                                           hover so it doesn't add visual noise.
             · Touch (no hover, e.g. iOS/
               Android Safari/Chrome):   ALWAYS visible since there's no
                                           hover state to trigger reveal.
                                           Tap target bumped to 22 px so
                                           it's reachable with a thumb. */
        .fab-minimize {
          position: absolute;
          top: -10px;
          inset-inline-end: -4px;
          width: 22px;
          height: 22px;
          border-radius: 999px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: ${dk ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)"};
          color: ${dk ? "rgba(255,255,255,0.80)" : "rgba(0,0,0,0.70)"};
          border: 1px solid ${dk ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"};
          opacity: 1;
          transform: translateY(0) scale(1);
          transition: opacity 0.18s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
          z-index: 5;
          cursor: pointer;
          /* Touch — keep the hit area generous even though the visual
             button is 22 px. */
          -webkit-tap-highlight-color: transparent;
        }
        /* Desktop (hover-capable pointer) — fade out, reveal on hover. */
        @media (hover: hover) and (pointer: fine) {
          .fab-minimize {
            width: 18px;
            height: 18px;
            opacity: 0;
            transform: translateY(2px) scale(0.85);
            pointer-events: none;
          }
          .fab-wrap:hover .fab-minimize,
          .fab-minimize:focus-visible {
            opacity: 1;
            transform: translateY(0) scale(1);
            pointer-events: auto;
          }
        }
        /* ── Calm-down: the collapsed dock rests at lowered opacity so it
              never competes with page content, and lifts to full strength
              on hover / keyboard focus. Touch devices (no hover) keep it
              fully visible since there's no hover to restore it. ── */
        .fab-root { transition: opacity 0.25s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
        @media (hover: hover) and (pointer: fine) {
          .fab-root[data-idle="true"] { opacity: 0.5; }
          .fab-root[data-idle="true"]:hover,
          .fab-root[data-idle="true"]:focus-within { opacity: 1; }
        }
        /* Auto-hide while the operator is actively scrolling, so the dock
           never sits on top of the row they're reading. Reappears on pause. */
        .fab-root[data-scrollhidden="true"] {
          opacity: 0 !important;
          transform: translateY(16px);
          pointer-events: none;
        }
      `}</style>
      <div className="fab-wrap relative">
        {/* Minimise button — top-right corner of the FAB cluster.
            Hidden by default, fades in on hover. */}
        {!open && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMinimized(true); }}
            className="fab-minimize"
            aria-label="Hide AI / Discuss"
            title="Hide AI / Discuss"
          >
            <CrossIcon size={9} />
          </button>
        )}
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
                    <KoleexOrb state={aiSending ? "loading" : "idle"} size={22} className={tab === "ai" ? "" : "opacity-40"} />
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
