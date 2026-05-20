"use client";

/* ---------------------------------------------------------------------------
   Koleex AI — ChatGPT-style two-pane layout in the Hub design system.

     ┌───────────────────┬──────────────────────────────────────────┐
     │  [+ New chat]     │                                          │
     │                   │         message stream                    │
     │  Today            │                                          │
     │  · Invoice draft  │                                          │
     │  · Supplier notes │                                          │
     │                   │                                          │
     │  Yesterday        │                                          │
     │  · Translate spec │                                          │
     │                   ├──────────────────────────────────────────┤
     │                   │  [ Ask Koleex AI… ]            [➤ Send ] │
     └───────────────────┴──────────────────────────────────────────┘

   Conversations persist to Supabase (ai_conversations + ai_messages).
   Replies come from whichever AI provider is wired in /api/ai/chat
   (Gemini Flash on the free tier today).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation, type Lang } from "@/lib/i18n";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import MicButton, { speakText, type TtsHandle } from "@/components/ai/MicButton";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import MenuBurgerIcon from "@/components/icons/ui/MenuBurgerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AiFaceIcon from "@/components/icons/AiFaceIcon";
import TypingIndicator from "@/components/ai/TypingIndicator";
import MessageMarkdown from "@/components/ai/MessageMarkdown";
import EmojiButton from "@/components/ai/EmojiButton";
import { useCurrentAccount } from "@/lib/identity";
import { ConfirmDialog } from "@/components/notes/NotesDialog";
import { humanizeError } from "@/lib/ui/humanize-error";

type MsgRole = "user" | "assistant" | "system";
interface AgentStep {
  kind: "answer" | "tool-call" | "tool-result" | "recommendation" | "draft" | "denied";
  text?: string;
  tool?: string;
  payload?: unknown;
  permissionStatus?: "allowed" | "limited" | "denied" | "approval_required";
  sources?: string[];
  filteredFields?: string[];
}
interface ChatMsg {
  id: string;
  role: MsgRole;
  content: string;
  created_at: string;
  /** Set only on assistant messages from the live agent turn —
   *  renders the tool-call / tool-result chips inline. Not persisted;
   *  audit table is the permanent record. */
  steps?: AgentStep[];
}
interface ConversationRow {
  id: string;
  title: string;
  last_preview: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

/* ── Localised copy ── */
const COPY: Record<Lang, {
  newChat: string;
  placeholder: string;
  welcomeTitle: string;
  welcomeSub: string;
  thinking: string;
  noChats: string;
  today: string;
  yesterday: string;
  previous7: string;
  previous30: string;
  earlier: string;
  delete: string;
  rename: string;
  confirmDelete: string;
  renamePrompt: string;
  footer: string;
  stopped: string;
  searchChats?: string;
  noSearchResults?: string;
  prompts: string[];
}> = {
  en: {
    newChat: "New chat",
    placeholder: "Ask Koleex AI…",
    welcomeTitle: "Hi",
    welcomeSub: "What's on your mind? I'm Koleex AI — ask me anything, big or small.",
    thinking: "Thinking…",
    noChats: "No chats yet",
    today: "Today",
    yesterday: "Yesterday",
    previous7: "Previous 7 days",
    previous30: "Previous 30 days",
    earlier: "Earlier",
    delete: "Delete",
    rename: "Rename",
    confirmDelete: "Delete this conversation?",
    renamePrompt: "New title",
    footer: "Koleex AI — Powered by Koleex Technology Systems",
    stopped: "Stopped",
    searchChats: "Search chats…",
    noSearchResults: "No chats match your search.",
    prompts: [
      "What's a good way to start my day at work?",
      "Help me write a polite reply to a customer email.",
      "Explain how pricing bands generally work.",
      "Translate to Chinese: Please confirm delivery by Friday.",
    ],
  },
  zh: {
    newChat: "新建对话",
    placeholder: "向 Koleex AI 提问…",
    welcomeTitle: "你好",
    welcomeSub: "想聊点什么？我是 Koleex AI — 大事小事都可以问我。",
    thinking: "思考中…",
    noChats: "还没有对话",
    today: "今天",
    yesterday: "昨天",
    previous7: "过去 7 天",
    previous30: "过去 30 天",
    earlier: "更早",
    delete: "删除",
    rename: "重命名",
    confirmDelete: "删除这个对话？",
    renamePrompt: "新标题",
    footer: "Koleex AI — 由 Koleex 技术系统驱动",
    stopped: "已停止",
    searchChats: "搜索对话…",
    noSearchResults: "没有匹配的对话。",
    prompts: [
      "早上开始工作的好方法是什么？",
      "帮我给客户写一封礼貌的回复邮件。",
      "简单解释一下价格区间是怎么运作的。",
      "翻译成英文：请在周五前确认交货。",
    ],
  },
  ar: {
    newChat: "محادثة جديدة",
    placeholder: "اسأل Koleex AI…",
    welcomeTitle: "مرحبًا",
    welcomeSub: "ما الذي يدور في بالك؟ أنا Koleex AI — اسألني عن أي شيء، صغيرًا كان أم كبيرًا.",
    thinking: "جارٍ التفكير…",
    noChats: "لا توجد محادثات بعد",
    today: "اليوم",
    yesterday: "أمس",
    previous7: "آخر 7 أيام",
    previous30: "آخر 30 يومًا",
    earlier: "قبل ذلك",
    delete: "حذف",
    rename: "إعادة تسمية",
    confirmDelete: "حذف هذه المحادثة؟",
    renamePrompt: "عنوان جديد",
    footer: "Koleex AI — بدعم من أنظمة Koleex التقنية",
    stopped: "تم الإيقاف",
    searchChats: "ابحث في المحادثات…",
    noSearchResults: "لا توجد محادثات تطابق بحثك.",
    prompts: [
      "ما طريقة جيدة لبدء يومي في العمل؟",
      "ساعدني في كتابة رد مهذب على رسالة من عميل.",
      "اشرح لي ببساطة كيف تعمل شرائح الأسعار.",
      "ترجم إلى الإنجليزية: الرجاء تأكيد التسليم بحلول يوم الجمعة.",
    ],
  },
};

export default function KoleexAiApp() {
  const { lang } = useTranslation({}) as unknown as { lang: Lang };
  const copy = COPY[lang] ?? COPY.en;
  const { account } = useCurrentAccount();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /* Remember the last opened chat across refreshes so hitting ⌘R
     doesn't throw you back to the empty welcome state. Stored per-
     account-id so if two users share a browser they don't see each
     other's stale selection. Cleared automatically when the stored
     conversation no longer exists (deleted from another tab). */
  const activeIdKey = account?.id ? `koleex-ai-active-chat:${account.id}` : null;
  useEffect(() => {
    if (!activeIdKey) return;
    if (!activeId) return;
    /* Safari private mode + quota-exceeded throw on setItem; the
       conversation persistence is best-effort, so swallow the error
       instead of crashing the whole component. Audit P0 #4. */
    try { window.localStorage.setItem(activeIdKey, activeId); } catch { /* ignore */ }
  }, [activeId, activeIdKey]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  /* Ref for the composer textarea so autosize can reset height after
     send clears the value (onChange doesn't fire on programmatic clear). */
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  /* Phase 12: AbortController for the in-flight send. Lets the user
     cancel a streaming reply mid-answer. Reset per-turn in send(). */
  const abortRef = useRef<AbortController | null>(null);
  const [sending, setSending] = useState(false);
  /* Mode separates the two AI personalities served by this page:
       · "chat"  → fast, router-driven reply via /api/ai/chat
                   (Groq for chat / unknown, DeepSeek for business).
                   No tools, no DB reads, no persistence.
       · "agent" → the full orchestrator at /api/ai/agent with
                   permission-aware tool calls, audit logging, and
                   conversation persistence.
     Defaults to chat so common prompts stay fast; users explicitly
     opt in to agent mode when they need to take action. */
  /* Voice-chat state. Chat and Agent are unified — every turn runs
     through the orchestrator (/api/ai/agent) which may or may not
     call tools. Voice in, voice out works on every turn. TTS speaks
     only on voice-initiated replies; typed turns stay silent. */
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const ttsHandleRef = useRef<TtsHandle | null>(null);
  const stopTts = useCallback(() => {
    ttsHandleRef.current?.cancel();
    ttsHandleRef.current = null;
    setAiSpeaking(false);
  }, []);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile
  /* Desktop sidebar collapse — defaults to EXPANDED on first visit
     (the sidebar is the primary nav into chat history; hiding it by
     default was confusing — users couldn't find it). Persisted after
     that so an explicit collapse sticks between refreshes. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem("koleex-ai-sidebar-collapsed") === "1";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("koleex-ai-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
    } catch { /* private mode / quota — best-effort */ }
  }, [sidebarCollapsed]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  /* ── Synchronous lock against double-submit races.
     The `sending` react-state updates are async, so two fast clicks can both
     pass `if (sending) return` before either re-render happens. A ref flips
     synchronously inside the same event loop tick, closing that gap. */
  const sendingRef = useRef(false);

  /* Close the mobile sidebar on Escape. Keeps the close paths
     redundant (button + scrim + key) so the user always has a way
     back out on small screens. No-op on desktop — the sidebar there
     is a non-overlay pane. */
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  /* Show the "jump to latest" chip when the user has scrolled up more
     than 120 px from the bottom. Phase 13.1: also maintain a sticky
     "user is following the stream" flag — true until they scroll up
     a meaningful amount, then false until they re-engage by hitting
     the chip or by sending a new message. The autoscroll effect
     reads this to decide whether to snap-track mid-stream. */
  const userFollowingRef = useRef(true);
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    setShowJumpToBottom(distance > 120);
    /* 120 px threshold matches the chip — once the user has clearly
       moved away we stop tracking; they'll re-engage manually. */
    if (distance > 120) userFollowingRef.current = false;
    else if (distance < 24) userFollowingRef.current = true;
  }, []);

  /* ── Initial sidebar load with sessionStorage cache ──
     Phase 13: seed the sidebar from sessionStorage on mount so the
     panel renders instantly instead of appearing empty for ~300 ms
     while /api/ai/conversations round-trips. Then fire the network
     fetch and overwrite with fresh data. Stale-while-revalidate.
     Cache is session-scoped (not persisted) so a logout / fresh tab
     still gets a clean load. */
  const CONV_CACHE_KEY = "koleex-ai-conversations-cache-v1";
  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/ai/conversations", { credentials: "include" });
    if (!res.ok) return;
    const { conversations: rows } = (await res.json()) as {
      conversations: ConversationRow[];
    };
    const fresh = rows ?? [];
    setConversations(fresh);
    if (typeof window !== "undefined") {
      try {
        window.sessionStorage.setItem(CONV_CACHE_KEY, JSON.stringify(fresh));
      } catch {
        /* Quota / private-mode — cache is a best-effort optimisation. */
      }
    }
  }, []);

  useEffect(() => {
    /* Read cache synchronously BEFORE the network fetch so the UI
       never paints the empty state. Invalid / expired JSON is just
       ignored. */
    if (typeof window !== "undefined") {
      try {
        const raw = window.sessionStorage.getItem(CONV_CACHE_KEY);
        if (raw) {
          const cached = JSON.parse(raw) as ConversationRow[];
          if (Array.isArray(cached) && cached.length > 0) {
            setConversations(cached);
          }
        }
      } catch {
        /* Stale / corrupt cache — silently discard. */
      }
    }
    loadConversations();
  }, [loadConversations]);

  /* Auto-restore the previously opened conversation after the sidebar
     loads. Only fires once per mount (restoredRef) so manually opening
     another chat later doesn't get overridden. If the stored id no
     longer exists (deleted elsewhere), clear the key and fall through
     to the welcome state. */
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!activeIdKey) return;
    if (conversations.length === 0) return;
    let stored: string | null;
    try { stored = window.localStorage.getItem(activeIdKey); }
    catch { stored = null; }
    if (!stored) { restoredRef.current = true; return; }
    const exists = conversations.some((c) => c.id === stored);
    if (exists) {
      restoredRef.current = true;
      void openConversation(stored);
    } else {
      try { window.localStorage.removeItem(activeIdKey); } catch { /* ignore */ }
      restoredRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, activeIdKey]);

  /* ── Load a conversation's messages ── */
  const openConversation = useCallback(
    async (id: string) => {
      /* Audit P0 #1 — abort any in-flight send before switching
         conversations. Without this, the SSE reader keeps consuming
         deltas into a placeholder that no longer exists in the
         currently-visible thread (silent dropped reply) and the
         server's keepalive timer keeps pinging until TCP drops. */
      abortRef.current?.abort();
      setActiveId(id);
      setMessages([]);
      setSidebarOpen(false);
      setLoadingConv(true);
      try {
        const res = await fetch(`/api/ai/conversations/${id}`, {
          credentials: "include",
        });
        if (!res.ok) {
          /* Audit P1 #9 — surface a load error instead of silently
             showing the welcome card on an existing chat. */
          setError(humanizeError(`HTTP ${res.status}`));
          return;
        }
        const { messages: rows } = (await res.json()) as { messages: ChatMsg[] };
        setMessages(rows ?? []);
      } catch (e) {
        setError(humanizeError(e));
      } finally {
        setLoadingConv(false);
      }
    },
    [],
  );

  /* ── New chat — create row, become active, reset messages ── */
  const startNewChat = useCallback(async () => {
    /* Same abort as openConversation — audit P0 #1. */
    abortRef.current?.abort();
    const res = await fetch("/api/ai/conversations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const { conversation } = (await res.json()) as { conversation: ConversationRow };
    setConversations((prev) => [conversation, ...prev]);
    setActiveId(conversation.id);
    setMessages([]);
    setInput("");
    setError(null);
    setSidebarOpen(false);
    /* Same race guard as send() — see the comment there for why. */
    restoredRef.current = true;
  }, []);

  /* ── Send a message ──
     Unified path: every turn runs through /api/ai/agent (the
     orchestrator). The model can either reply naturally for
     conversational turns or call tools for data/action turns — it
     picks per prompt. All server-side guards (execution v1/v2/v3,
     pricing, quotation hard mode) run every time.

     `viaVoice` — when true the assistant reply is also read aloud
     via speechSynthesis. Typed turns stay silent. */
  const send = useCallback(
    async (textOverride?: string, viaVoice = false) => {
      const text = (textOverride ?? input).trim();
      if (!text) return;
      /* Synchronous guard: flip ref BEFORE any await so a rapid second
         Send click / Enter press can't slip past the state check. */
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);
      /* New turn cancels any in-flight TTS so audio never stacks. */
      stopTts();

      // Ensure we have a conversation first
      let conversationId = activeId;
      if (!conversationId) {
        const res = await fetch("/api/ai/conversations", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          setError("Couldn't start a new chat.");
          sendingRef.current = false;
          setSending(false);
          return;
        }
        const { conversation } = (await res.json()) as {
          conversation: ConversationRow;
        };
        setConversations((prev) => [conversation, ...prev]);
        conversationId = conversation.id;
        setActiveId(conversationId);
        /* Fix: mark auto-restore as done so it doesn't race us on
           the first-ever send. Without this, the effect that watches
           `conversations` would fire post-render, read the activeId
           we just wrote to localStorage, match the brand-new conv,
           and call openConversation(newId) — which resets messages
           to [] and fetches server state (empty because we haven't
           POSTed to /api/ai/agent yet). End result: the user's
           message + placeholder get wiped, and the SSE stream has
           no placeholder to update, so the send appears to vanish. */
        restoredRef.current = true;
      }

      setError(null);
      const optimistic: ChatMsg = {
        id: `tmp-${Date.now()}`,
        role: "user",
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setInput("");
      /* Autosize reset: onChange doesn't fire on programmatic clear,
         so reset the textarea height manually after sending. */
      if (composerRef.current) {
        composerRef.current.style.height = "auto";
      }

      /* Placeholder assistant bubble that mutates as deltas arrive.
         We append it immediately so the TypingIndicator (keyed off
         messages[last].role === "assistant" && empty content) can
         appear without waiting for the first byte. */
      const placeholderId = `tmp-ai-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: placeholderId,
          role: "assistant",
          content: "",
          created_at: new Date().toISOString(),
          steps: [],
        },
      ]);

      try {
        /* Phase 6: SSE streaming. Emits start → (steps) → delta* → end.
           The client mutates the placeholder bubble as deltas arrive so
           the reply reveals progressively; the TypingIndicator shows
           while the content is still empty. */
        /* Phase 12: new AbortController per turn. On user Stop click
           we call .abort() which closes the fetch + reader, stops
           the SSE loop, and lets the finally block clean up state. */
        const aborter = new AbortController();
        abortRef.current = aborter;
        const res = await fetch(`/api/ai/agent`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            conversationId,
            content: text,
            user_lang: lang,
            stream: true,
          }),
          signal: aborter.signal,
        });

        /* Phase 9 resilience: if the server returned a JSON body
           despite our Accept: text/event-stream header (e.g. an old
           canned fast-path, an upstream 4xx envelope), parse it as
           JSON instead of fruitlessly scanning for SSE frames. This
           keeps legacy JSON clients working and stops the bug where
           a plain-JSON response would result in "No reply was
           received." because the SSE parser found nothing. */
        const ct = (res.headers.get("content-type") ?? "").toLowerCase();
        if (res.ok && res.body && !ct.includes("text/event-stream")) {
          const json = (await res.json().catch(() => null)) as
            | {
                agent?: { steps: AgentStep[]; finalReply: string; provider: string };
                message?: ChatMsg;
                conversation?: { id: string; title: string };
                error?: string;
                reply?: string;
              }
            | null;
          const fallbackReply =
            json?.message?.content ||
            json?.agent?.finalReply ||
            json?.reply ||
            "";
          if (fallbackReply) {
            const persisted = json?.message ?? {
              id: `tmp-ai-${Date.now()}`,
              role: "assistant" as const,
              content: fallbackReply,
              created_at: new Date().toISOString(),
            };
            setMessages((prev) => {
              const idx = prev.findIndex((m) => m.id === placeholderId);
              if (idx < 0) return prev;
              const next = prev.slice();
              next[idx] = {
                ...persisted,
                steps: json?.agent?.steps ?? [],
              };
              return next;
            });
            /* Voice TTS on the sealed reply, same semantics as streamed path. */
            if (viaVoice && fallbackReply) {
              setAiSpeaking(true);
              ttsHandleRef.current = speakText(fallbackReply, {
                lang,
                onEnd: () => {
                  ttsHandleRef.current = null;
                  setAiSpeaking(false);
                },
              });
            }
            if (json?.conversation) {
              const bumpId = json.conversation.id;
              const bumpTitle = json.conversation.title;
              /* Audit P0 #5 — capture the timestamp BEFORE the updater
                 so the setState callback stays pure (no Date.now() /
                 new Date() inside the function React calls during
                 commit-replay). */
              const bumpNow = new Date().toISOString();
              setConversations((prev) => {
                const next = prev.map((c) =>
                  c.id === bumpId
                    ? {
                        ...c,
                        title: bumpTitle,
                        last_preview: fallbackReply.slice(0, 180),
                        message_count: c.message_count + 2,
                        updated_at: bumpNow,
                      }
                    : c,
                );
                next.sort(
                  (a, b) =>
                    new Date(b.updated_at).getTime() -
                    new Date(a.updated_at).getTime(),
                );
                return next;
              });
            }
            return;
          }
          /* JSON with no usable reply — fall through to the error path. */
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setError(json?.error || "No reply was received.");
          return;
        }

        if (!res.ok || !res.body) {
          const msg =
            res.status === 503
              ? "AI is not configured yet."
              : humanizeError(`HTTP ${res.status}`);
          setError(msg);
          /* Drop the placeholder so the UI doesn't show an empty bubble. */
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let accumulated = "";
        let finalMessage: ChatMsg | null = null;
        let finalSteps: AgentStep[] = [];
        let convUpdateId: string | null = null;
        let convUpdateTitle: string | null = null;

        const pushPatch = (patch: Partial<ChatMsg>) => {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === placeholderId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = { ...next[idx], ...patch };
            return next;
          });
        };

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
                  | { type: "steps"; steps: AgentStep[] }
                  | { type: "delta"; text: string }
                  | {
                      type: "end";
                      agent: {
                        steps: AgentStep[];
                        finalReply: string;
                        provider: string;
                      };
                      message: ChatMsg;
                      conversation: { id: string; title: string };
                    }
                  | { type: "error"; message?: string };

                if (json.type === "steps") {
                  finalSteps = json.steps;
                  pushPatch({ steps: json.steps });
                } else if (json.type === "delta") {
                  accumulated += json.text;
                  pushPatch({ content: accumulated });
                } else if (json.type === "end") {
                  finalMessage = json.message;
                  finalSteps = json.agent.steps;
                  convUpdateId = json.conversation.id;
                  convUpdateTitle = json.conversation.title;
                } else if (json.type === "error") {
                  setError(json.message || "AI is unavailable right now.");
                }
              } catch {
                /* Malformed frame — skip, keep streaming. */
              }
            }
          }
        }

        /* Swap the placeholder bubble with the persisted message +
           final steps (id/created_at now come from Supabase, not the
           temporary placeholder). */
        if (finalMessage) {
          const persistedId = finalMessage.id;
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === placeholderId);
            if (idx < 0) return prev;
            const next = prev.slice();
            next[idx] = {
              ...finalMessage!,
              steps: finalSteps,
            };
            return next;
          });
          /* Voice-initiated turn speaks the FINAL sealed reply only —
             never the mid-stream deltas — so TTS can't say pricing
             that the server later redacted. */
          if (viaVoice && finalMessage.content) {
            setAiSpeaking(true);
            ttsHandleRef.current = speakText(finalMessage.content, {
              lang,
              onEnd: () => {
                ttsHandleRef.current = null;
                setAiSpeaking(false);
              },
            });
          }
          // Sidebar update once everything's in.
          if (convUpdateId && convUpdateTitle && finalMessage) {
            const previewText = finalMessage.content;
            const bumpId = convUpdateId;
            const bumpTitle = convUpdateTitle;
            /* Audit P0 #5 — capture timestamp outside the updater. */
            const bumpNow = new Date().toISOString();
            setConversations((prev) => {
              const next = prev.map((c) =>
                c.id === bumpId
                  ? {
                      ...c,
                      title: bumpTitle,
                      last_preview: previewText.slice(0, 180),
                      message_count: c.message_count + 2,
                      updated_at: bumpNow,
                    }
                  : c,
              );
              next.sort(
                (a, b) =>
                  new Date(b.updated_at).getTime() -
                  new Date(a.updated_at).getTime(),
              );
              return next;
            });
          }
          void persistedId;
        } else if (accumulated) {
          /* Stream closed without an `end` event but we got text —
             keep what we have so the user at least sees the reply. */
          pushPatch({ content: accumulated });
        } else {
          /* Nothing useful came through — drop the placeholder. */
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setError((prev) => prev ?? "No reply was received.");
        }
      } catch (e) {
        /* Phase 12: user cancelled via Stop — keep whatever was
           already streamed; drop the placeholder only if it's still
           empty (no tokens arrived before abort). No red error for
           user-initiated cancels. */
        const isAbort =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && e.name === "AbortError");
        if (isAbort) {
          setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === placeholderId);
            if (idx < 0) return prev;
            if (!prev[idx].content) {
              /* No tokens before abort → drop the empty bubble. */
              return prev.filter((m) => m.id !== placeholderId);
            }
            /* Keep the partial text the user already saw. */
            return prev;
          });
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
          setError(e instanceof Error ? e.message : "Network error");
        }
      } finally {
        abortRef.current = null;
        sendingRef.current = false;
        setSending(false);
      }
    },
    [input, activeId, lang, stopTts],
  );

  /* ── Phase 12: message-level actions ────────────────────────── */

  /** Stop generation — aborts the in-flight fetch. Any text that
   *  already streamed in stays on screen; the placeholder with
   *  no content gets dropped (see catch block in send). */
  const handleStop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Insert an emoji at the current cursor position in the composer.
   *  Preserves selection/typing context so the user can pick several
   *  emojis in a row without losing their place. Falls back to
   *  append-to-end when the textarea ref isn't available. */
  const insertEmoji = useCallback((emoji: string) => {
    const ta = composerRef.current;
    if (!ta) {
      setInput((prev) => prev + emoji);
      return;
    }
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, start);
    const after = ta.value.slice(end);
    const next = before + emoji + after;
    setInput(next);
    /* Restore focus + place caret right after the inserted emoji on
       the next frame (after React's re-render commits the new
       value). preventScroll keeps the page stable on iOS. */
    requestAnimationFrame(() => {
      try { ta.focus({ preventScroll: true }); } catch { ta.focus(); }
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
      /* Kick the autosize onChange path so the textarea grows if the
         added emoji pushed content onto a new line. */
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
    });
  }, []);

  /** Copy an assistant message to the clipboard. Shows a tiny
   *  "Copied" hint by mutating a per-message state (not here — the
   *  bubble handles its own feedback). */
  const handleCopy = useCallback(async (content: string): Promise<boolean> => {
    if (!content) return false;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(content);
        return true;
      }
    } catch {
      /* Clipboard API denied — fall through to failure. The bubble
         already offers text selection so there's a manual escape. */
    }
    return false;
  }, []);

  /** Per-message TTS replay — stops whatever is currently speaking,
   *  then queues this message via the existing speakText helper.
   *  Same engine the auto-playback for voice turns uses, so the
   *  selected output voice + language are consistent. */
  const handleSpeak = useCallback((text: string) => {
    if (!text) return;
    /* Stop any in-flight playback (voice-turn auto-read or a previous
       Speak click) before starting the new one. */
    ttsHandleRef.current?.cancel?.();
    setAiSpeaking(true);
    ttsHandleRef.current = speakText(text, {
      lang,
      onEnd: () => setAiSpeaking(false),
      onError: () => setAiSpeaking(false),
    });
  }, [lang]);

  /** Per-message 👍 / 👎 feedback. Fire-and-forget — the server
   *  endpoint is a stub today (it accepts the row and ack-200s);
   *  the value is logged client-side so we can see signal flowing
   *  even before the backend rolls. Failure is silent so the UX
   *  never penalises the user for telemetry being down. */
  const handleFeedback = useCallback((messageId: string, value: "up" | "down") => {
    void fetch("/api/ai/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId, value }),
      keepalive: true,
    }).catch(() => { /* telemetry — silent on failure */ });
  }, []);

  /** Phase 13: edit-and-retry on a user message. Given the index of
   *  the user message and its new text, trim the client view back
   *  to just before that message and re-send with the edited text.
   *  Server creates a fresh turn — old user + assistant entries
   *  stay in ai_messages for audit, the UI just shortens its view. */
  const handleEditAndRetry = useCallback(
    (index: number, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return;
      if (sendingRef.current) return;
      /* Sanity: make sure the indexed message is actually a user turn. */
      const target = messages[index];
      if (!target || target.role !== "user") return;
      /* Slice off everything from this user message forward so
         send() can re-add the user bubble + placeholder cleanly. */
      setMessages((prev) => prev.slice(0, index));
      void send(trimmed, false);
    },
    [messages, send],
  );

  /** Regenerate the last assistant reply. Finds the most recent
   *  user message, removes any trailing assistant messages, and
   *  re-runs send() with that same text. Server treats it as a
   *  fresh turn — new assistant insert, history will show both the
   *  old and the new reply (so users can see both). */
  const handleRegenerate = useCallback(() => {
    if (sendingRef.current) return;
    /* Walk backwards to find the last user message. */
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    if (lastUserIdx < 0) return;
    const lastUserText = messages[lastUserIdx].content;
    /* Audit P0 #8 — collapse the previous two setMessages into one
       (send() re-adds the user bubble itself, so we just trim back
       to BEFORE the last user message). Keeps the rebase atomic and
       removes the off-by-one risk if a new turn lands between the
       two updates. */
    setMessages((prev) => prev.slice(0, lastUserIdx));
    void send(lastUserText, false);
  }, [messages, send]);

  /* Two-step delete using the Hub's ConfirmDialog component. The old
     flow called window.confirm() — that's the white-on-black native
     browser dialog that doesn't match the Hub's design language. Now we
     stash the pending id in state and render a branded confirmation
     modal instead. */
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const requestDeleteConversation = useCallback((id: string) => {
    setPendingDeleteId(id);
  }, []);
  const confirmDeleteConversation = useCallback(async () => {
    const id = pendingDeleteId;
    if (!id) return;
    const res = await fetch(`/api/ai/conversations/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) return;
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
      /* Keep the persisted "last opened" key in sync so a refresh
         after a delete doesn't try to reopen the now-gone chat. */
      if (activeIdKey) {
        try { window.localStorage.removeItem(activeIdKey); } catch { /* ignore */ }
      }
    }
  }, [activeId, pendingDeleteId, activeIdKey]);

  const renameConversation = useCallback(
    async (id: string, currentTitle: string) => {
      const next = prompt(copy.renamePrompt, currentTitle);
      if (!next || next.trim() === currentTitle) return;
      const res = await fetch(`/api/ai/conversations/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.trim() }),
      });
      if (!res.ok) return;
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: next.trim() } : c)),
      );
    },
    [copy.renamePrompt],
  );

  /* ── Phase 13: sidebar search ──
     Simple substring filter on title + last_preview. Case-insensitive.
     Empty query shows everything, matches the original grouped view.
     When the filter is active, results flatten (no date groups) so
     scanning is quicker — users who typed a query want hits, not
     chronology. */
  const [sidebarQuery, setSidebarQuery] = useState("");
  const filteredConversations = useMemo(() => {
    const q = sidebarQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => {
      const title = (c.title || "").toLowerCase();
      const preview = (c.last_preview || "").toLowerCase();
      return title.includes(q) || preview.includes(q);
    });
  }, [conversations, sidebarQuery]);

  /* ── Group sidebar entries by relative date ──
     Only applied when the search box is empty; filtered searches
     render flat. */
  const groups = useMemo(
    () =>
      sidebarQuery.trim()
        ? [{ label: "", rows: filteredConversations }]
        : groupByDate(filteredConversations, copy),
    [filteredConversations, sidebarQuery, copy],
  );

  /* ── Smart autoscroll (Phase 13.1 rewrite) ──
     Two problems the previous version had:
       1. Triggered a SMOOTH scrollTo on every stream delta.
          Smooth animations overlap — a brand answer streams 40+
          deltas, so 40 overlapping animations made the list jerk
          instead of track the bottom cleanly.
       2. "wasNearBottom" threshold of 300 px was too loose. A user
          scrolling up to re-read the previous paragraph would stay
          within 300 px of bottom for a moment — and get yanked back
          down as soon as the next delta arrived.

     New rules:
       · Count GROWS (user sent / reply finalised / fresh turn):
         jump to bottom smoothly. This is a deliberate user event.
       · Content grows mid-stream AND user is within 60 px of bottom:
         snap (behavior:auto, no animation). Tracks the stream without
         jerkiness. 60 px is "effectively at bottom" visually.
       · User has scrolled up > 60 px: never auto-follow. The "↓ Latest"
         chip already exists for them to snap back when they want. */
  const firstScrollRef = useRef(true);
  const lastCountRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const countGrew = messages.length > lastCountRef.current;
    lastCountRef.current = messages.length;

    if (firstScrollRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      firstScrollRef.current = false;
      userFollowingRef.current = true;
      return;
    }
    if (countGrew) {
      /* New turn (user send or reply finalised). Scroll smoothly to
         bottom and resume following. */
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      userFollowingRef.current = true;
      return;
    }
    /* Mid-stream delta or other state change. Only snap-track when
       the user hasn't scrolled away. The sticky flag in handleScroll
       keeps us tracking even when content grows past the instant
       threshold — what matters is whether the user touched the
       scrollbar, not the momentary pixel distance. */
    if (userFollowingRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, sending]);

  /* Reset the "first scroll" flag when opening a different conversation
     so the jump-to-bottom behaviour is instant for each fresh load. */
  useEffect(() => {
    firstScrollRef.current = true;
    lastCountRef.current = 0;
  }, [activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  /* ── Mobile viewport stabilisation ──
     iOS Safari / Android Chrome show and hide their url/toolbar chrome
     on scroll, and `100dvh` chases that — so the messages pane grows
     and shrinks by ~80 px mid-scroll, which is exactly what Kamal saw
     as the page "shaking". Snapshotting the initial `innerHeight` and
     only updating it on orientationchange (and significant width
     changes that imply a real layout shift, not chrome slide) locks the
     chat in place while the browser chrome animates. Desktop keeps
     100dvh because it has no such chrome. */
  const [stageHeight, setStageHeight] = useState<string>("calc(100dvh - 3.5rem)");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = () => window.matchMedia("(max-width: 767px)").matches;
    const apply = () => {
      if (isMobile()) {
        // 56 px = height of the Hub top chrome above the AI app shell.
        setStageHeight(`${window.innerHeight - 56}px`);
      } else {
        setStageHeight("calc(100dvh - 3.5rem)");
      }
    };
    apply();
    let lastWidth = window.innerWidth;
    const onResize = () => {
      // Ignore pure-height changes on mobile (browser chrome show/hide);
      // only react when the viewport width actually changes.
      if (isMobile() && window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      apply();
    };
    window.addEventListener("orientationchange", apply);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      className="text-[var(--text-primary)] flex overflow-hidden w-full relative bg-[var(--bg-primary)]"
      style={{ height: stageHeight }}
    >
      {/* Hub design system: solid bg-primary surface, no animated halo.
          Matches FinanceHome / InvoicesApp / Sales etc. The previous
          Gemini-style breathing radial-gradient lived here and was
          removed during the polish pass — Hub apps are calm, dense, and
          monochrome by default; the chat content carries the page. */}

      {/* ── Sidebar ──
          Desktop: inline flex sibling; width morphs between 280px
          (expanded) and 0px (collapsed) on a spring curve.
          Mobile: fixed overlay drawer that slides in via the burger
          in the top bar (sidebarOpen). Crucially on mobile the
          desktop collapse flag is ignored — otherwise the drawer
          would render at width:0 and look broken.
          Transparent so the shared backdrop shows through. */}

      {/* Mobile backdrop scrim. Tap to dismiss. Only rendered on
          mobile (md:hidden) and only when the drawer is open — the
          sidebar sits at z-[40], the scrim at z-[39], so the scrim
          covers the rest of the app but not the drawer. */}
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 z-[39] bg-black/50 backdrop-blur-sm"
        />
      )}

      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } md:flex flex-col shrink-0 bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)] overflow-hidden fixed md:relative inset-y-0 start-0 z-[40] md:z-[1]`}
        style={{
          /* On mobile we ignore sidebarCollapsed (desktop-only concept).
             On desktop, width morphs 0 ↔ 280 based on collapsed state. */
          width: sidebarOpen ? 280 : (sidebarCollapsed ? 0 : 280),
          minWidth: sidebarOpen ? 280 : (sidebarCollapsed ? 0 : 280),
          /* Phase UI.3 — spring cubic-bezier replaced with a calm ease-out. */
          transition: "width 0.25s ease-out, min-width 0.25s ease-out",
        }}
        aria-hidden={!sidebarOpen && sidebarCollapsed}
      >
        <div className="p-3 flex items-center gap-2 border-b border-[var(--border-subtle)]">
          <Link
            href="/"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] shrink-0"
            title="Back"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <button
            onClick={startNewChat}
            className="flex-1 h-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center justify-center gap-1.5 hover:opacity-90"
          >
            <PlusIcon size={14} />
            {copy.newChat}
          </button>
          {/* Mobile-only close button. On mobile the sidebar is a
              z-[40] overlay that covers the top-bar burger, so users
              need a close control INSIDE the drawer. Hidden on
              desktop where the collapse button next door handles it. */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="md:hidden h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] items-center justify-center shrink-0 flex"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <CrossIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(true)}
            className="hidden md:flex h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] items-center justify-center shrink-0"
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <MenuBurgerIcon size={14} />
          </button>
        </div>

        {/* Phase 13: sidebar search. Only renders when there are
            enough conversations to make scanning hard. */}
        {conversations.length > 3 && (
          <div className="px-2 pb-1 pt-1">
            <input
              type="search"
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder={copy.searchChats ?? "Search chats…"}
              className="w-full h-8 px-2.5 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]"
              aria-label="Search conversations"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 flex flex-col items-center text-center gap-2 text-[var(--text-dim)]">
              <div className="h-10 w-10 rounded-full flex items-center justify-center border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                <AiFaceIcon size={20} animated />
              </div>
              <div className="text-[12px]">{copy.noChats}</div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-6 text-center text-[12px] text-[var(--text-dim)]">
              {copy.noSearchResults ?? "No chats match your search."}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.label}>
                <div className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold text-[var(--text-dim)]">
                  {g.label}
                </div>
                {g.rows.map((c) => (
                  <SidebarRow
                    key={c.id}
                    row={c}
                    active={c.id === activeId}
                    onOpen={() => openConversation(c.id)}
                    onRename={() => renameConversation(c.id, c.title)}
                    onDelete={() => requestDeleteConversation(c.id)}
                    renameLabel={copy.rename}
                    deleteLabel={copy.delete}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ── Main pane ── */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        {/* Mobile top bar — Hub-native pattern.
            Solid bg-secondary panel + hairline border, matching the
            FinanceHeader / InvoicesApp top bars rather than a glass
            blur over a glow. */}
        <div className="md:hidden shrink-0 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 flex items-center gap-2 relative z-[2]">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <CrossIcon size={14} /> : <MenuBurgerIcon size={14} />}
          </button>
          {/* AI icon mark — same family as the Finance / Inventory app
              icons in the Hub header, but uses the live AI face. */}
          <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <AiFaceIcon size={16} animated />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold truncate text-[var(--text-primary)]">
              {active?.title ?? "Koleex AI"}
            </div>
          </div>
          <button
            type="button"
            onClick={startNewChat}
            className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90"
            aria-label={copy.newChat}
            title={copy.newChat}
          >
            <PlusIcon size={14} />
          </button>
        </div>

        {/* Desktop top bar — Hub-native page header (back arrow + AI icon
            + h1 + subtitle on the left, expand-sidebar control + new-chat
            on the right when collapsed). Mirrors FinanceHeader so an
            operator moving Finance → AI doesn't see a foreign UI. */}
        <div className="hidden md:flex shrink-0 items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 lg:px-6 py-3 relative z-[2]">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center shrink-0"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <MenuBurgerIcon size={14} />
            </button>
          )}
          <Link
            href="/"
            aria-label="Back to Hub"
            className="h-8 w-8 shrink-0 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="h-8 w-8 shrink-0 flex items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <AiFaceIcon size={16} animated />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-[16px] md:text-[17px] font-bold tracking-tight text-[var(--text-primary)] truncate leading-snug">
              {active?.title || "Koleex AI"}
            </h1>
            {!active && (
              <p className="text-[11.5px] text-[var(--text-dim)] truncate">{copy.welcomeSub}</p>
            )}
          </div>
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={startNewChat}
              className="h-8 px-3 rounded-md border border-emerald-300/40 bg-emerald-300/[0.08] text-[12px] text-emerald-100 hover:bg-emerald-300/[0.14] inline-flex items-center gap-1.5"
              title={copy.newChat}
            >
              <PlusIcon size={12} />
              {copy.newChat}
            </button>
          )}
        </div>

        {/* Messages — transparent; shared backdrop lives on outer shell. */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="relative flex-1 overflow-y-auto"
        >

          <div className="relative z-[1] max-w-[820px] mx-auto px-4 md:px-6 py-6 space-y-4">
            {loadingConv ? (
              <div className="flex items-center justify-center py-20">
                <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <WelcomeCard
                copy={copy}
                onPick={(p) => send(p)}
                firstName={(account?.person?.full_name || account?.username || "")
                  .trim()
                  .split(/\s+/)[0] || ""}
              />
            ) : (
              messages.map((m, i) => (
                <Bubble
                  key={m.id}
                  msg={m}
                  userAvatar={account?.avatar_url || account?.person?.avatar_url || null}
                  userInitial={(account?.username || account?.person?.full_name || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
                  isLast={i === messages.length - 1}
                  canRegenerate={!sending}
                  canEdit={!sending}
                  onCopy={handleCopy}
                  onRegenerate={handleRegenerate}
                  onEdit={(newText) => handleEditAndRetry(i, newText)}
                  onSpeak={handleSpeak}
                  onFeedback={handleFeedback}
                  lang={lang}
                />
              ))
            )}
            {/* Legacy global "Thinking…" pill removed in Phase 8.
                The placeholder assistant bubble added in send() now
                renders TypingIndicator inline (empty content = dots),
                which gives the same feedback without stacking two
                waiting indicators on top of each other. */}
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 px-3 py-2 text-[12px]">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Floating "jump to latest" button — only shown when user has
              scrolled up more than ~120px from the bottom of a populated
              conversation. Clicking smooths back down. */}
          {showJumpToBottom && (
            <button
              type="button"
              onClick={() => {
                const el = scrollRef.current;
                if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                /* Phase 13.1: clicking "↓ Latest" re-engages the
                   stream-tracker so subsequent deltas follow again. */
                userFollowingRef.current = true;
                setShowJumpToBottom(false);
              }}
              aria-label="Jump to latest"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[2] h-8 px-3 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11.5px] text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] flex items-center gap-1.5"
            >
              ↓ Latest
            </button>
          )}
        </div>

        {/* Composer — single unified pill (Gemini-style).
            Input textarea sits in a big rounded container with the Send
            button tucked inside the right edge. Borderless on the parent
            div so the pill floats over the aurora background instead of
            sitting on a hard horizontal line. */}
        {/* Phase 15: respect the iOS home-indicator safe area so the
            composer sits above the bar on iPhones without a notch
            guard. env(safe-area-inset-bottom) is 34 px on modern
            devices, 0 on desktops — additive to the existing pb. */}
        <div
          className="shrink-0 bg-transparent"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <div className="max-w-[820px] mx-auto px-4 md:px-6 pt-2 pb-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                /* Also dismiss the keyboard when the Send button is
                   tapped on mobile. Without this, hitting Send leaves
                   the on-screen keyboard up and the chat half-hidden. */
                if (
                  typeof window !== "undefined" &&
                  window.matchMedia("(max-width: 767px)").matches
                ) {
                  const ta = (e.currentTarget as HTMLFormElement).querySelector(
                    "textarea",
                  );
                  (ta as HTMLTextAreaElement | null)?.blur();
                }
                send();
              }}
              className="relative"
            >
              <div
                className="relative flex items-end rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] focus-within:border-[var(--border-focus)] transition-colors"
              >
                {/* Phase 14.1: emoji picker lives on the LEFT of the
                    composer. Popover anchors to its left edge so the
                    grid opens rightward into empty space above the
                    pill instead of clipping off the right edge.
                    Using m-2 + self-end to match the mic / send
                    buttons on the right — so all three composer
                    buttons bottom-align at the exact same y-pixel
                    regardless of textarea height. */}
                <EmojiButton
                  onSelect={insertEmoji}
                  className="m-2 self-end h-10 w-10 rounded-full flex items-center justify-center text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
                />
                <textarea
                  ref={composerRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    /* Autosize: reset first so shrinking works, then
                       grow to fit up to maxHeight (enforced via the
                       Tailwind max-h-40 cap = 160 px). Happens on every
                       keystroke but is effectively free — scrollHeight
                       read is ~0.1 ms. */
                    const ta = e.currentTarget;
                    ta.style.height = "auto";
                    const next = Math.min(ta.scrollHeight, 160);
                    ta.style.height = next + "px";
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      /* On mobile, Enter should send AND dismiss the
                         on-screen keyboard so the chat is visible
                         again. Blur the textarea on narrow viewports —
                         desktop keeps focus like ChatGPT/Gemini so you
                         can keep typing without re-clicking. */
                      if (
                        typeof window !== "undefined" &&
                        window.matchMedia("(max-width: 767px)").matches
                      ) {
                        (e.target as HTMLTextAreaElement).blur();
                      }
                      send();
                    }
                    /* Shift+Enter inserts a newline via the browser's
                       default textarea behaviour — no handler needed. */
                  }}
                  placeholder={copy.placeholder}
                  rows={1}
                  dir={isRtl(input) ? "rtl" : "auto"}
                  /* `enterKeyHint="send"` tells iOS Safari / Android
                     Chrome to render the return key as a coloured Send
                     button instead of an ambiguous arrow — pairs with
                     the preventDefault+send handler above. */
                  enterKeyHint="send"
                  inputMode="text"
                  autoComplete="off"
                  autoCorrect="on"
                  className="flex-1 px-5 py-4 bg-transparent text-[16px] text-[var(--text-primary)] outline-none resize-none max-h-40 placeholder:text-[var(--text-dim)]"
                  /* 16px font-size prevents iOS Safari from zooming in
                     on focus — a <16px input triggers the zoom. */
                  style={{ minHeight: "54px" }}
                />
                {/* Phase 14.1: emoji button moved to the LEFT of the
                    composer above. Mic stays adjacent to Send so the
                    right-edge action group remains "speak | send". */}
                {/* Mic button — always mounted now that Chat and Agent
                    are unified. Voice turns route through the same
                    orchestrator as typed turns. On transcript we call
                    send(text, viaVoice=true) which both sends the
                    message and reads the reply aloud. */}
                <MicButton
                  className="m-2"
                  size={40}
                  onTranscript={(t) => send(t, true)}
                  onError={(msg) => setError(msg)}
                  speaking={aiSpeaking}
                  onStopSpeaking={stopTts}
                  disabled={sending}
                  lang={lang}
                />

                {/* Phase 12: swap Send → Stop during streaming. The
                    Stop button aborts the in-flight fetch; partial
                    content that already streamed in is kept. Using
                    type="button" so the form doesn't try to submit
                    (submit path is disabled + different handler). */}
                {sending ? (
                  <button
                    type="button"
                    onClick={handleStop}
                    className="m-2 h-10 w-10 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 shrink-0 transition-opacity"
                    aria-label="Stop generating"
                    title="Stop generating"
                  >
                    <span
                      aria-hidden
                      className="block h-3 w-3 rounded-[2px] bg-[var(--text-inverted)]"
                    />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="m-2 h-10 w-10 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 disabled:opacity-30 shrink-0 transition-opacity"
                    aria-label="Send"
                  >
                    <PaperPlaneIcon className="h-4 w-4" />
                  </button>
                )}
              </div>
            </form>
            <div className="text-[10px] text-[var(--text-dim)] mt-2.5 text-center">
              {copy.footer}
            </div>
          </div>
        </div>
      </main>

      {/* Hub-branded delete confirmation dialog (replaces window.confirm) */}
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title={copy.confirmDelete}
        variant="danger"
        confirmLabel={copy.delete}
        onConfirm={confirmDeleteConversation}
        onClose={() => setPendingDeleteId(null)}
      />
    </div>
  );
}

/* ── Draft quotation card ──
   Rendered when an assistant message has a tool-result step with
   tool="createQuotationDraft". Shows the draft id, customer, total,
   and a prominent "Review in Quotations" button that deep-links into
   the existing Quotations app for the human to finalise. Never
   surfaces cost / margin side — those never reach the client. */
interface QuotationDraftPayload {
  id: string;
  quote_no: string;
  customer_id: string;
  total: number;
  currency: string;
  status: "draft";
  line_count: number;
  approval_required: boolean;
  review_url: string;
}
function DraftCard({ payload }: { payload: QuotationDraftPayload }) {
  const needsApproval = payload.approval_required;
  return (
    <div
      className={`rounded-2xl border backdrop-blur-md px-4 py-3.5 ${
        needsApproval
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-[var(--border-subtle)] bg-[var(--bg-secondary)]/75"
      }`}
      style={{ maxWidth: 460 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
          needsApproval
            ? "bg-amber-500/20 text-amber-200 border border-amber-500/40"
            : "bg-[var(--bg-surface)]/80 text-[var(--text-muted)] border border-[var(--border-subtle)]"
        }`}>
          {needsApproval ? "Draft · needs approval" : "Draft"}
        </span>
        <span className="text-[12px] font-semibold text-[var(--text-primary)]">
          {payload.quote_no}
        </span>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
          {payload.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="text-[12px] text-[var(--text-muted)]">{payload.currency}</span>
        <span className="text-[11px] text-[var(--text-dim)] ms-auto">
          {payload.line_count} line{payload.line_count === 1 ? "" : "s"}
        </span>
      </div>
      <Link
        href={payload.review_url}
        className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90"
      >
        Review in Quotations →
      </Link>
    </div>
  );
}

/* ── Agent step chip ──
   Renders one tool-call or tool-result as a small pill above the
   assistant bubble. Colour-coded by permission status so a denied or
   limited call is visually obvious (users deserve to see WHY data is
   missing). Clicking/hovering reveals sources + filtered fields. */
function AgentStepChip({ step }: {
  step: {
    kind: string;
    text?: string;
    tool?: string;
    permissionStatus?: "allowed" | "limited" | "denied" | "approval_required";
    sources?: string[];
    filteredFields?: string[];
  };
}) {
  const status = step.permissionStatus;
  const colour =
    status === "denied"          ? "border-rose-500/40   text-rose-300 bg-rose-500/10" :
    status === "limited"         ? "border-amber-500/40  text-amber-200 bg-amber-500/10" :
    status === "approval_required" ? "border-sky-500/40  text-sky-200  bg-sky-500/10" :
                                     "border-[var(--border-subtle)] text-[var(--text-muted)] bg-[var(--bg-surface)]/60";
  const icon =
    step.kind === "tool-call"   ? "🔍" :
    step.kind === "tool-result" ? (status === "limited" ? "⚠️" : "📋") :
    step.kind === "denied"      ? "🔒" :
                                  "•";
  const label = step.text ?? step.tool ?? step.kind;
  const sourcesTitle = [
    step.sources && step.sources.length
      ? `Sources: ${step.sources.join(", ")}`
      : null,
    step.filteredFields && step.filteredFields.length
      ? `Hidden fields: ${step.filteredFields.join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span
      title={sourcesTitle || undefined}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] border backdrop-blur-md ${colour}`}
    >
      <span className="text-[12px] leading-none">{icon}</span>
      <span className="truncate max-w-[260px]">{label}</span>
    </span>
  );
}

/* ── Bubble ── */

/** Arabic / Persian / Hebrew scripts → force RTL direction + slightly
 *  larger type (Arabic glyphs read smaller than Latin at the same px
 *  because of their narrower x-height). Works per-bubble so a Chinese
 *  user can still get an Arabic translation reply rendered correctly
 *  regardless of the surrounding UI language. */
const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
function isRtl(text: string): boolean {
  return RTL_RE.test(text);
}

function Bubble({
  msg,
  userAvatar,
  userInitial,
  isLast,
  canRegenerate,
  canEdit,
  onCopy,
  onRegenerate,
  onEdit,
  onSpeak,
  onFeedback,
  lang,
}: {
  msg: ChatMsg;
  userAvatar?: string | null;
  userInitial: string;
  isLast?: boolean;
  canRegenerate?: boolean;
  canEdit?: boolean;
  onCopy?: (text: string) => Promise<boolean> | boolean;
  onRegenerate?: () => void;
  onEdit?: (newText: string) => void;
  /** Per-message TTS replay — gets the bubble's text and the chosen
   *  language; returns a handle the bubble can use to stop playback. */
  onSpeak?: (text: string) => void;
  /** Per-message 👍 / 👎 feedback. Fire-and-forget — the bubble shows
   *  a brief confirmation chip; the parent decides where the signal
   *  goes (server endpoint, local telemetry, …). */
  onFeedback?: (msgId: string, value: "up" | "down") => void;
  lang: Lang;
}) {
  const isUser = msg.role === "user";
  const rtl = isRtl(msg.content);
  const steps = msg.steps ?? [];
  const hasToolSteps = !isUser && steps.some((s) =>
    s.kind === "tool-call" || s.kind === "tool-result" || s.kind === "denied",
  );
  const [copied, setCopied] = useState(false);
  const handleCopyClick = useCallback(async () => {
    if (!onCopy || !msg.content) return;
    const ok = await onCopy(msg.content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [onCopy, msg.content]);
  /* Show the action row on assistant messages that have real
     content. Placeholder bubbles (empty content = typing dots)
     get no actions. */
  const showActions = !isUser && !!msg.content;

  /* Phase 13: edit-and-retry state. Only user messages can be
     edited, and only when the parent allows it (not while another
     send is in-flight). */
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);
  const showEditButton = isUser && !!onEdit && canEdit !== false;
  const submitEdit = useCallback(() => {
    const next = editValue.trim();
    if (!next || next === msg.content) {
      setEditing(false);
      setEditValue(msg.content);
      return;
    }
    setEditing(false);
    onEdit?.(next);
  }, [editValue, msg.content, onEdit]);
  const cancelEdit = useCallback(() => {
    setEditing(false);
    setEditValue(msg.content);
  }, [msg.content]);
  /* Surface any draft-quotation tool result as a full-sized branded
     card instead of a tiny chip — the user's most important action is
     "review the draft", so it deserves its own UI. */
  const draftStep = !isUser
    ? steps.find(
        (s) =>
          s.kind === "tool-result" &&
          s.tool === "createQuotationDraft" &&
          s.payload &&
          typeof (s.payload as { review_url?: unknown }).review_url === "string",
      )
    : undefined;
  /* Both sides now get an avatar so the transcript reads like a real
     conversation — matches the ChatGPT / Gemini visual pattern Kamal
     referenced. User side: real profile photo (or initial fallback).
     AI side: the animated AI face icon with its neon gradient. */
  return (
    <div
      dir="ltr" /* Keep the row's gap order stable regardless of content */
      className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <AiFaceIcon size={18} animated />
        </div>
      )}
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Tool-call / tool-result chips render ABOVE the final assistant
            text so the user can see WHAT Koleex AI looked up before
            reading the answer. Permission status drives the colour. */}
        {hasToolSteps && (
          <div className="flex flex-wrap gap-1.5">
            {steps
              .filter((s) => s.kind === "tool-call" || s.kind === "tool-result" || s.kind === "denied")
              .map((s, i) => (
                <AgentStepChip key={i} step={s} />
              ))}
          </div>
        )}
        {draftStep && (
          <DraftCard payload={draftStep.payload as QuotationDraftPayload} />
        )}
        {/* Assistant bubble with no content yet → show typing indicator
            (Phase 6). Replaced by the streamed text as deltas arrive. */}
        {!isUser && !msg.content ? (
          <TypingIndicator />
        ) : (
          <div
            /* dir="auto" + unicode-bidi: plaintext together make the browser
               apply the first-strong-character algorithm per paragraph AND
               isolate embedded segments properly. That's what fixes Arabic
               replies that also contain English words like "Koleex Hub" —
               without this the hard dir="rtl" can flip the embedded English
               into the wrong visual position. User bubbles keep the
               whitespace-pre-wrap path (literal text only). Assistant
               bubbles render markdown via MessageMarkdown for bullets,
               headings, code blocks, tables, links. */
            dir="auto"
            className={`rounded-2xl px-4 py-2.5 leading-relaxed ${
              isUser ? "whitespace-pre-wrap" : ""
            } ${
              rtl ? "text-[15px]" : "text-[14px]"
            } ${
              isUser
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            }`}
            style={{
              unicodeBidi: "plaintext",
              ...(rtl
                ? { fontFamily: '"SF Arabic","Geeza Pro","Noto Naskh Arabic",Arial,sans-serif' }
                : {}),
            }}
          >
            {isUser ? (
              editing ? (
                <textarea
                  /* Phase 13.1: use ref + focus({preventScroll:true})
                     instead of autoFocus. On iOS Safari autoFocus
                     triggers the browser's "scroll focused element
                     into view" which shoves the chat pane up in a
                     jarring way. preventScroll keeps the scroll
                     position stable while still taking focus. */
                  ref={(el) => {
                    if (el && document.activeElement !== el) {
                      try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                      const len = el.value.length;
                      el.setSelectionRange(len, len);
                    }
                  }}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  rows={1}
                  className="w-full bg-transparent outline-none resize-none text-inherit leading-relaxed min-w-[180px]"
                  style={{ fontFamily: "inherit" }}
                />
              ) : (
                msg.content
              )
            ) : (
              <MessageMarkdown content={msg.content} />
            )}
          </div>
        )}
        {/* Phase 13: user-side action row — Edit (re-runs the turn
            with new text) or Save/Cancel while editing. Only shown
            when the parent supplied onEdit and allowed it. */}
        {isUser && showEditButton && (
          <div className="mt-1 flex items-center gap-2 text-[11px] text-[var(--text-dim)]">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={submitEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 transition-opacity"
                  aria-label="Save and retry"
                >
                  Save & retry
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label="Cancel edit"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditValue(msg.content);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Edit and retry"
              >
                ✎ Edit
              </button>
            )}
          </div>
        )}
        {/* Phase 12: assistant action row — Copy + (on last msg)
            Regenerate. User bubbles get no actions. Rendered outside
            the bubble div so it doesn't inherit the bubble's padding /
            background. */}
        {showActions && (
          <BubbleActions
            msg={msg}
            isLast={!!isLast}
            canRegenerate={!!canRegenerate}
            copied={copied}
            onCopy={handleCopyClick}
            onRegenerate={onRegenerate}
            onSpeak={onSpeak}
            onFeedback={onFeedback}
            lang={lang}
          />
        )}
      </div>
      {isUser && (
        <div
          className="h-8 w-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
          aria-hidden
        >
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[11px] font-bold text-[var(--text-primary)]">
              {userInitial}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Bubble action row ──
   Per-message actions under each assistant bubble. Copy + (last only)
   Regenerate were already here; Phase polish adds:

     · 🔊 Speak — replay this specific reply aloud via TTS. Useful when
       the user wants to re-hear a long answer or didn't catch the
       voice-turn auto-playback.
     · 👍 / 👎 — operator feedback. Fire-and-forget; the parent picks
       where the signal goes (today: console.info + analytics ping
       endpoint stub, tomorrow: server-side feedback table).
   ──────────────────────────────────────────────────────────────────── */

function BubbleActions({
  msg, isLast, canRegenerate, copied, onCopy, onRegenerate, onSpeak, onFeedback, lang,
}: {
  msg: ChatMsg;
  isLast: boolean;
  canRegenerate: boolean;
  copied: boolean;
  onCopy: () => void;
  onRegenerate?: () => void;
  onSpeak?: (text: string) => void;
  onFeedback?: (msgId: string, value: "up" | "down") => void;
  lang: Lang;
}) {
  void lang;
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const sendVote = (v: "up" | "down") => {
    setVote(v);
    onFeedback?.(msg.id, v);
  };
  /* All five action buttons share the same 28×28 hit target and a
     fixed 14×14 icon glyph so the row reads as a uniform strip
     instead of "copy and regenerate are smaller than the speaker".
     Earlier draft mixed 12 / 13 / 14 px icons which the user spotted
     as a visible alignment bug. */
  const btnCls = "inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const ICON = 14;
  return (
    <div className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
      <button
        type="button"
        onClick={onCopy}
        className={btnCls}
        aria-label={copied ? "Copied" : "Copy message"}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="11" height="11" rx="2" />
            <path d="M5 15V5a2 2 0 0 1 2-2h10" />
          </svg>
        )}
      </button>
      {onSpeak && msg.content && (
        <button
          type="button"
          onClick={() => onSpeak(msg.content)}
          className={btnCls}
          aria-label="Read aloud"
          title="Read aloud"
        >
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="currentColor">
            <path d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06c2.89 0 5.25 2.36 5.25 5.25S16.89 15.79 14 15.79v2.06c4.02 0 7.31-3.29 7.31-7.31S18.02 3.23 14 3.23z" />
          </svg>
        </button>
      )}
      {isLast && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={!canRegenerate}
          className={btnCls}
          aria-label="Regenerate response"
          title="Regenerate"
        >
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 0 1 15.5-6.36L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-15.5 6.36L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      )}
      {onFeedback && (
        <>
          <span aria-hidden className="mx-1 h-3 w-px bg-[var(--border-subtle)]" />
          <button
            type="button"
            onClick={() => sendVote("up")}
            className={`${btnCls} ${vote === "up" ? "text-emerald-300" : ""}`}
            aria-label="Good response"
            title="Good response"
          >
            <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill={vote === "up" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => sendVote("down")}
            className={`${btnCls} ${vote === "down" ? "text-rose-300" : ""}`}
            aria-label="Bad response"
            title="Bad response"
          >
            <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill={vote === "down" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

/* ── Sidebar row with hover actions ── */

function SidebarRow({
  row,
  active,
  onOpen,
  onRename,
  onDelete,
  renameLabel,
  deleteLabel,
}: {
  row: ConversationRow;
  active: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  renameLabel: string;
  deleteLabel: string;
}) {
  return (
    <div
      onClick={onOpen}
      className={`group px-3 py-2 mx-2 my-0.5 rounded-lg cursor-pointer transition-colors flex items-center gap-2 ${
        active
          ? "bg-[var(--bg-surface-active)] text-[var(--text-primary)]"
          : "hover:bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]"
      }`}
    >
      <div className="text-[12px] font-medium truncate flex-1 min-w-0">
        {row.title}
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0">
        <button
          onClick={(e) => { e.stopPropagation(); onRename(); }}
          className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center justify-center"
          title={renameLabel}
        >
          <PencilIcon className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="h-6 w-6 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center"
          title={deleteLabel}
        >
          <TrashIcon className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/* ── Welcome landing ── */

function WelcomeCard({
  copy,
  onPick,
  firstName,
}: {
  copy: typeof COPY["en"];
  onPick: (prompt: string) => void;
  firstName: string;
}) {
  /* Hub-native welcome — same layout vocabulary as FinanceHome.
     Small icon mark in a Hub-themed tile, a tight h2 + caption pair,
     then suggestion tiles in a 2-column grid (matching the
     "What do you want to do?" pattern on /finance). No drop-shadow
     halos, no glass blur, no centered-pill chips. */
  const greeting = firstName ? `${copy.welcomeTitle}, ${firstName}.` : copy.welcomeTitle;
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-2 py-8">
      <div className="h-14 w-14 inline-flex items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] mb-4">
        <AiFaceIcon size={32} animated />
      </div>
      <h2 className="text-[22px] md:text-[26px] font-bold tracking-tight text-[var(--text-primary)] mb-2 leading-tight">
        {greeting}
      </h2>
      <p className="text-[12.5px] text-[var(--text-dim)] mb-8 max-w-md">
        {copy.welcomeSub}
      </p>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
        {copy.prompts.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPick(p)}
            className="group flex items-start gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3.5 py-3 text-start text-[12.5px] text-[var(--text-primary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] transition-colors"
          >
            <span className="mt-0.5 h-5 w-5 shrink-0 inline-flex items-center justify-center rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] group-hover:text-[var(--text-primary)]">
              <AiFaceIcon size={11} animated={false} />
            </span>
            <span className="flex-1 leading-snug">{p}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Date grouping ── */

function groupByDate(
  rows: ConversationRow[],
  copy: typeof COPY["en"],
): Array<{ label: string; rows: ConversationRow[] }> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const oneDay = 86_400_000;
  const bucket = {
    today: [] as ConversationRow[],
    yesterday: [] as ConversationRow[],
    week: [] as ConversationRow[],
    month: [] as ConversationRow[],
    older: [] as ConversationRow[],
  };
  for (const r of rows) {
    const t = new Date(r.updated_at).getTime();
    const diff = today - t;
    if (t >= today) bucket.today.push(r);
    else if (diff < oneDay) bucket.yesterday.push(r);
    else if (diff < 7 * oneDay) bucket.week.push(r);
    else if (diff < 30 * oneDay) bucket.month.push(r);
    else bucket.older.push(r);
  }
  const out: Array<{ label: string; rows: ConversationRow[] }> = [];
  if (bucket.today.length) out.push({ label: copy.today, rows: bucket.today });
  if (bucket.yesterday.length) out.push({ label: copy.yesterday, rows: bucket.yesterday });
  if (bucket.week.length) out.push({ label: copy.previous7, rows: bucket.week });
  if (bucket.month.length) out.push({ label: copy.previous30, rows: bucket.month });
  if (bucket.older.length) out.push({ label: copy.earlier, rows: bucket.older });
  return out;
}
