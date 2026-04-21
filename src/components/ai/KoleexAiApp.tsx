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
import { useCurrentAccount } from "@/lib/identity";
import { ConfirmDialog } from "@/components/notes/NotesDialog";

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
    if (activeId) {
      window.localStorage.setItem(activeIdKey, activeId);
    }
  }, [activeId, activeIdKey]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  /* Ref for the composer textarea so autosize can reset height after
     send clears the value (onChange doesn't fire on programmatic clear). */
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
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
    const stored = window.localStorage.getItem("koleex-ai-sidebar-collapsed");
    return stored === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("koleex-ai-sidebar-collapsed", sidebarCollapsed ? "1" : "0");
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
     than 120px from the bottom of the messages container. */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    setShowJumpToBottom(distance > 120);
  }, []);

  /* ── Initial sidebar load ── */
  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/ai/conversations", { credentials: "include" });
    if (!res.ok) return;
    const { conversations: rows } = (await res.json()) as {
      conversations: ConversationRow[];
    };
    setConversations(rows ?? []);
  }, []);

  useEffect(() => {
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
    const stored = window.localStorage.getItem(activeIdKey);
    if (!stored) { restoredRef.current = true; return; }
    const exists = conversations.some((c) => c.id === stored);
    if (exists) {
      restoredRef.current = true;
      void openConversation(stored);
    } else {
      window.localStorage.removeItem(activeIdKey);
      restoredRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, activeIdKey]);

  /* ── Load a conversation's messages ── */
  const openConversation = useCallback(
    async (id: string) => {
      setActiveId(id);
      setMessages([]);
      setSidebarOpen(false);
      setLoadingConv(true);
      try {
        const res = await fetch(`/api/ai/conversations/${id}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const { messages: rows } = (await res.json()) as { messages: ChatMsg[] };
        setMessages(rows ?? []);
      } finally {
        setLoadingConv(false);
      }
    },
    [],
  );

  /* ── New chat — create row, become active, reset messages ── */
  const startNewChat = useCallback(async () => {
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
              setConversations((prev) => {
                const next = prev.map((c) =>
                  c.id === bumpId
                    ? {
                        ...c,
                        title: bumpTitle,
                        last_preview: fallbackReply.slice(0, 180),
                        message_count: c.message_count + 2,
                        updated_at: new Date().toISOString(),
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
              : `Failed to get a reply. (${res.status})`;
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
            setConversations((prev) => {
              const next = prev.map((c) =>
                c.id === bumpId
                  ? {
                      ...c,
                      title: bumpTitle,
                      last_preview: previewText.slice(0, 180),
                      message_count: c.message_count + 2,
                      updated_at: new Date().toISOString(),
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
        setMessages((prev) => prev.filter((m) => m.id !== placeholderId));
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [input, activeId, lang, stopTts],
  );

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
      if (activeIdKey) window.localStorage.removeItem(activeIdKey);
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

  /* ── Group sidebar entries by relative date ── */
  const groups = useMemo(() => groupByDate(conversations, copy), [conversations, copy]);

  /* ── Smart autoscroll ──
     Previous version measured "was at bottom" *after* the new message
     rendered, so a long AI reply would already have expanded
     scrollHeight and the check failed — users ended up stuck mid-pane.
     New approach: any time the message *count* grows, we scroll to the
     end (that's a user-visible event — sent by them or a new reply).
     For non-count changes (e.g. the thinking spinner toggling) we only
     auto-follow when the user is already close to the bottom, so we
     don't yank them up if they've scrolled back to read earlier turns. */
  const firstScrollRef = useRef(true);
  const lastCountRef = useRef(0);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const countGrew = messages.length > lastCountRef.current;
    lastCountRef.current = messages.length;
    const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
    const wasNearBottom = distance < 300;

    const shouldScroll = firstScrollRef.current || countGrew || wasNearBottom;
    if (!shouldScroll) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: firstScrollRef.current ? "auto" : "smooth",
    });
    firstScrollRef.current = false;
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
      className="text-[var(--text-primary)] flex overflow-hidden w-full relative koleex-ai-stage"
      style={{ height: stageHeight }}
    >
      {/* Full-app Gemini-style background — pure black with one soft
          dark-blue glow anchored to the bottom-center. Lives on the
          outermost shell so both the sidebar and the main pane share it
          rather than sitting on a hard flat panel. */}
      <style>{`
        @keyframes koleex-glow-breathe {
          0%, 100% { opacity: 0.85; transform: translate(-50%, 0) scale(1); }
          50%      { opacity: 1;    transform: translate(-50%, -2%) scale(1.05); }
        }
        .koleex-ai-stage { background: #050510; }
        html[data-theme="light"] .koleex-ai-stage { background: var(--bg-primary); }
        .koleex-ai-stage::before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -30%;
          width: 140%;
          height: 85%;
          transform: translate(-50%, 0);
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(50% 60% at 50% 50%, rgba(32, 64, 160, 0.50), rgba(18, 30, 90, 0.22) 45%, transparent 75%);
          animation: koleex-glow-breathe 10s ease-in-out infinite;
          filter: blur(48px);
          will-change: transform, opacity;
        }
        html[data-theme="light"] .koleex-ai-stage::before {
          background:
            radial-gradient(50% 60% at 50% 50%, rgba(120, 150, 255, 0.22), rgba(150, 170, 230, 0.06) 45%, transparent 75%);
        }
      `}</style>

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
        } md:flex flex-col shrink-0 bg-[var(--bg-secondary)]/95 md:bg-[var(--bg-secondary)]/60 backdrop-blur-xl border-e border-[var(--border-subtle)] overflow-hidden fixed md:relative inset-y-0 start-0 z-[40] md:z-[1]`}
        style={{
          /* On mobile we ignore sidebarCollapsed (desktop-only concept).
             On desktop, width morphs 0 ↔ 280 based on collapsed state. */
          width: sidebarOpen ? 280 : (sidebarCollapsed ? 0 : 280),
          minWidth: sidebarOpen ? 280 : (sidebarCollapsed ? 0 : 280),
          transition: "width 0.35s cubic-bezier(0.34,1.56,0.64,1), min-width 0.35s cubic-bezier(0.34,1.56,0.64,1)",
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

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-8 flex flex-col items-center text-center gap-2 text-[var(--text-dim)]">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,212,255,0.12), rgba(123,97,255,0.12) 50%, rgba(255,110,199,0.08))",
                  border: "1px solid rgba(123,97,255,0.2)",
                }}
              >
                <AiFaceIcon size={20} animated />
              </div>
              <div className="text-[12px]">{copy.noChats}</div>
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
        {/* Mobile top bar — translucent so the full-app backdrop shows. */}
        <div className="md:hidden shrink-0 border-b border-[var(--border-subtle)] px-3 py-2 flex items-center gap-2 bg-[var(--bg-primary)]/40 backdrop-blur-md relative z-[2]">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="h-8 w-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] flex items-center justify-center"
          >
            {sidebarOpen ? <CrossIcon size={14} /> : <MenuBurgerIcon size={14} />}
          </button>
          <div className="text-[13px] font-semibold truncate flex-1">
            {active?.title ?? "Koleex AI"}
          </div>
          <button
            onClick={startNewChat}
            className="h-8 w-8 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center"
          >
            <PlusIcon size={14} />
          </button>
        </div>

        {/* Desktop expand-sidebar button — only shown when the sidebar
            is collapsed, so the user always has a way back. Floats in the
            top-left corner of the main pane, styled like the rest of the
            Hub iconography. */}
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            className="hidden md:flex absolute top-3 start-3 z-[3] h-9 w-9 rounded-xl bg-[var(--bg-surface)]/80 backdrop-blur-md border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] items-center justify-center shadow-lg"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <MenuBurgerIcon size={14} />
          </button>
        )}

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
              messages.map((m) => (
                <Bubble
                  key={m.id}
                  msg={m}
                  userAvatar={account?.avatar_url || account?.person?.avatar_url || null}
                  userInitial={(account?.username || account?.person?.full_name || "U")
                    .trim()
                    .charAt(0)
                    .toUpperCase()}
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
              }}
              aria-label="Jump to latest"
              className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[2] h-9 px-3 rounded-full bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] shadow-lg hover:bg-[var(--bg-surface-subtle)] flex items-center gap-1.5"
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
        <div className="shrink-0 bg-transparent">
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
                className="relative flex items-end rounded-[26px] bg-[var(--bg-secondary)]/80 backdrop-blur-xl border border-[var(--border-subtle)] shadow-[0_8px_30px_rgba(0,0,0,0.25)] focus-within:border-[var(--border-focus)] transition-colors"
              >
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

                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="m-2 h-10 w-10 rounded-full bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 disabled:opacity-30 shrink-0 transition-opacity"
                  aria-label="Send"
                >
                  {sending ? (
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <PaperPlaneIcon className="h-4 w-4" />
                  )}
                </button>
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
}: {
  msg: ChatMsg;
  userAvatar?: string | null;
  userInitial: string;
}) {
  const isUser = msg.role === "user";
  const rtl = isRtl(msg.content);
  const steps = msg.steps ?? [];
  const hasToolSteps = !isUser && steps.some((s) =>
    s.kind === "tool-call" || s.kind === "tool-result" || s.kind === "denied",
  );
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
        <div
          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(0,212,255,0.18), rgba(123,97,255,0.18) 50%, rgba(255,110,199,0.12))",
            border: "1px solid rgba(123,97,255,0.25)",
          }}
        >
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
            className={`rounded-2xl px-4 py-2.5 leading-relaxed backdrop-blur-md ${
              isUser ? "whitespace-pre-wrap" : ""
            } ${
              rtl ? "text-[15px]" : "text-[14px]"
            } ${
              isUser
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "bg-[var(--bg-secondary)]/85 border border-[var(--border-subtle)] text-[var(--text-primary)]"
            }`}
            style={{
              unicodeBidi: "plaintext",
              ...(rtl
                ? { fontFamily: '"SF Arabic","Geeza Pro","Noto Naskh Arabic",Arial,sans-serif' }
                : {}),
            }}
          >
            {isUser ? msg.content : <MessageMarkdown content={msg.content} />}
          </div>
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
  /* Gemini-style hero: large personalised greeting centered in the
     available space, a compact AI mark above, and the suggested
     prompts tucked underneath in a minimal single-row strip so they
     feel like chips not cards — matches the less-is-more direction
     Kamal asked for. */
  const greeting = firstName ? `${copy.welcomeTitle}, ${firstName}.` : copy.welcomeTitle;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="inline-flex items-center justify-center mb-6"
        style={{
          filter:
            "drop-shadow(0 0 12px rgba(0,145,255,0.40)) drop-shadow(0 0 28px rgba(123,97,255,0.30))",
        }}
      >
        <AiFaceIcon size={64} animated />
      </div>
      <h2 className="text-[28px] md:text-[36px] font-semibold tracking-tight text-[var(--text-primary)] mb-3 leading-tight">
        {greeting}
      </h2>
      <p className="text-[14px] text-[var(--text-dim)] mb-10 max-w-lg">
        {copy.welcomeSub}
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
        {copy.prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onPick(p)}
            className="px-3.5 py-2 rounded-full bg-[var(--bg-secondary)]/70 backdrop-blur-md border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] text-[12.5px] text-[var(--text-muted)] transition-all"
          >
            {p}
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
