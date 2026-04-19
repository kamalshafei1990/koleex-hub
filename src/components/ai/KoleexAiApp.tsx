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
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import MenuBurgerIcon from "@/components/icons/ui/MenuBurgerIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import AiFaceIcon from "@/components/icons/AiFaceIcon";
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
    welcomeSub: "What's on your mind? I'm Koleex AI — ask me anything about your business.",
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
      "Draft a polite follow-up email to a customer whose quotation is about to expire.",
      "Translate to Chinese: Please confirm delivery by Friday.",
      "Best practices for setting payment terms with a new supplier?",
      "Summarise the key fields I should fill when creating an invoice.",
    ],
  },
  zh: {
    newChat: "新建对话",
    placeholder: "向 Koleex AI 提问…",
    welcomeTitle: "你好",
    welcomeSub: "有什么可以帮您？我是 Koleex AI — 欢迎咨询您业务的任何问题。",
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
      "为一位报价即将到期的客户起草一封礼貌的跟进邮件。",
      "翻译成英文：请在周五前确认交货。",
      "与新供应商制定付款条款的最佳实践有哪些？",
      "总结创建发票时应填写的关键字段。",
    ],
  },
  ar: {
    newChat: "محادثة جديدة",
    placeholder: "اسأل Koleex AI…",
    welcomeTitle: "مرحبًا",
    welcomeSub: "كيف يمكنني مساعدتك؟ أنا Koleex AI — اسألني عن أي شيء يخص أعمالك.",
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
      "اكتب بريدًا إلكترونيًا مهذبًا للمتابعة لعميل سينتهي عرض السعر الخاص به قريبًا.",
      "ترجم إلى الإنجليزية: الرجاء تأكيد التسليم بحلول يوم الجمعة.",
      "ما أفضل الممارسات لتحديد شروط الدفع مع مورد جديد؟",
      "لخّص الحقول الرئيسية التي يجب ملؤها عند إنشاء فاتورة.",
    ],
  },
};

export default function KoleexAiApp() {
  const { lang } = useTranslation({}) as unknown as { lang: Lang };
  const copy = COPY[lang] ?? COPY.en;
  const { account } = useCurrentAccount();

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile
  /* Desktop sidebar collapse — defaults to COLLAPSED on first visit
     for a cleaner Gemini-like empty state. Persisted after that so the
     preference stays between refreshes. */
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const stored = window.localStorage.getItem("koleex-ai-sidebar-collapsed");
    return stored === null ? true : stored === "1";
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

  /* ── Send a message ── */
  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text) return;
      /* Synchronous guard: flip ref BEFORE any await so a rapid second
         Send click / Enter press can't slip past the state check. */
      if (sendingRef.current) return;
      sendingRef.current = true;
      setSending(true);

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

      try {
        /* Switched to /api/ai/agent — the new orchestrator that runs
           tool calls with permission + audit enforcement. Falls back
           to the classic response shape on errors so the UI behaves. */
        const res = await fetch(`/api/ai/agent`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId,
            content: text,
            user_lang: lang,
          }),
        });
        const json = (await res.json()) as
          | {
              agent: { steps: AgentStep[]; finalReply: string; provider: string };
              message: ChatMsg;
              conversation: { id: string; title: string };
            }
          | { error: string; message?: string };
        if (!res.ok || "error" in json) {
          const errObj = json as { error?: string; message?: string };
          const msg =
            (typeof errObj.message === "string" && errObj.message) ||
            errObj.error ||
            "Failed to get a reply.";
          setError(msg);
          return;
        }
        const { message, conversation: convUpdate, agent } = json;
        const assistantWithSteps: ChatMsg = { ...message, steps: agent.steps };
        setMessages((prev) => [...prev, assistantWithSteps]);
        // Sidebar: bump title + move to top + update preview.
        setConversations((prev) => {
          const next = prev.map((c) =>
            c.id === convUpdate.id
              ? {
                  ...c,
                  title: convUpdate.title,
                  last_preview: message.content.slice(0, 180),
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
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        sendingRef.current = false;
        setSending(false);
      }
    },
    [input, activeId, lang],
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
    }
  }, [activeId, pendingDeleteId]);

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
          Desktop: width morphs between 280px (expanded) and 0px
          (collapsed) on a spring curve. Mobile: overlay that slides in
          via the burger button in the top bar (sidebarOpen state).
          Transparent so the shared backdrop shows through. */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } md:flex flex-col shrink-0 bg-[var(--bg-secondary)]/60 backdrop-blur-xl border-e border-[var(--border-subtle)] overflow-hidden relative z-[1]`}
        style={{
          width: sidebarCollapsed ? 0 : 280,
          minWidth: sidebarCollapsed ? 0 : 280,
          transition: "width 0.35s cubic-bezier(0.34,1.56,0.64,1), min-width 0.35s cubic-bezier(0.34,1.56,0.64,1)",
        }}
        aria-hidden={sidebarCollapsed}
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
            {sending && (
              <div className="flex items-start gap-3">
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
                <div className="rounded-2xl bg-[var(--bg-secondary)]/80 backdrop-blur-md border border-[var(--border-subtle)] px-4 py-2.5 text-[14px] text-[var(--text-dim)] flex items-center gap-2">
                  <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                  {copy.thinking}
                </div>
              </div>
            )}
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
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
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
                  className="flex-1 px-5 py-4 bg-transparent text-[15px] text-[var(--text-primary)] outline-none resize-none max-h-40 placeholder:text-[var(--text-dim)]"
                  style={{ minHeight: "54px" }}
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
        <div
          /* dir="auto" + unicode-bidi: plaintext together make the browser
             apply the first-strong-character algorithm per paragraph AND
             isolate embedded segments properly. That's what fixes Arabic
             replies that also contain English words like "Koleex Hub" —
             without this the hard dir="rtl" can flip the embedded English
             into the wrong visual position. */
          dir="auto"
          className={`rounded-2xl px-4 py-2.5 leading-relaxed whitespace-pre-wrap backdrop-blur-md ${
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
          {msg.content}
        </div>
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
