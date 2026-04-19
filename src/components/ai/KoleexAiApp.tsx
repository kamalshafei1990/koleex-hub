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

type MsgRole = "user" | "assistant" | "system";
interface ChatMsg {
  id: string;
  role: MsgRole;
  content: string;
  created_at: string;
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
    welcomeTitle: "Hi, I'm Koleex AI",
    welcomeSub: "Ask me anything about your business — I'll reply in your language.",
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
    footer: "Koleex AI · replies in your UI language · tenant-isolated",
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
    welcomeTitle: "你好，我是 Koleex AI",
    welcomeSub: "问我关于您业务的任何问题 — 我会用您的语言回答。",
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
    footer: "Koleex AI · 按您的界面语言回复 · 租户隔离",
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
    welcomeTitle: "مرحبًا، أنا Koleex AI",
    welcomeSub: "اسألني عن أي شيء يخص أعمالك — سأردّ بلغتك.",
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
    footer: "Koleex AI · يردّ بلغتك · معزول لكل مؤسسة",
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

  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingConv, setLoadingConv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile
  const bottomRef = useRef<HTMLDivElement>(null);

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
      if (!text || sending) return;

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
      setSending(true);

      try {
        const res = await fetch(
          `/api/ai/conversations/${conversationId}/messages`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: text, user_lang: lang }),
          },
        );
        const json = (await res.json()) as
          | { message: ChatMsg; conversation: { id: string; title: string } }
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
        const { message, conversation: convUpdate } = json as {
          message: ChatMsg;
          conversation: { id: string; title: string };
        };
        setMessages((prev) => [...prev, message]);
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
        setSending(false);
      }
    },
    [input, activeId, sending, lang],
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!confirm(copy.confirmDelete)) return;
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
    },
    [activeId, copy.confirmDelete],
  );

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

  /* ── Autoscroll messages to bottom on change ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* ── Sidebar ── */}
      <aside
        className={`${
          sidebarOpen ? "flex" : "hidden"
        } md:flex flex-col w-[280px] shrink-0 bg-[var(--bg-secondary)] border-e border-[var(--border-subtle)]`}
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
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-[var(--text-dim)]">
              {copy.noChats}
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
                    onDelete={() => deleteConversation(c.id)}
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
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden shrink-0 border-b border-[var(--border-subtle)] px-3 py-2 flex items-center gap-2">
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

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[820px] mx-auto px-4 md:px-6 py-6 space-y-4">
            {loadingConv ? (
              <div className="flex items-center justify-center py-20">
                <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <WelcomeCard
                copy={copy}
                onPick={(p) => send(p)}
              />
            ) : (
              messages.map((m) => <Bubble key={m.id} msg={m} />)
            )}
            {sending && (
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white shrink-0">
                  <AiFaceIcon className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-4 py-2.5 text-[13px] text-[var(--text-dim)] flex items-center gap-2">
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
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-primary)]">
          <div className="max-w-[820px] mx-auto px-4 md:px-6 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2"
            >
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={copy.placeholder}
                rows={1}
                className="flex-1 px-4 py-3 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none max-h-40"
                style={{ minHeight: "46px" }}
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                className="h-11 w-11 rounded-2xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 disabled:opacity-40 shrink-0"
                aria-label="Send"
              >
                <PaperPlaneIcon className="h-4 w-4" />
              </button>
            </form>
            <div className="text-[10px] text-[var(--text-dim)] mt-2 text-center">
              {copy.footer}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Bubble ── */

function Bubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white shrink-0">
          <AiFaceIcon className="h-3.5 w-3.5" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
          isUser
            ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
            : "bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
        }`}
      >
        {msg.content}
      </div>
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
}: {
  copy: typeof COPY["en"];
  onPick: (prompt: string) => void;
}) {
  return (
    <div className="pt-10 pb-4 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 items-center justify-center text-white mb-4">
        <AiFaceIcon className="h-6 w-6" />
      </div>
      <h2 className="text-[18px] font-bold text-[var(--text-primary)] mb-1">
        {copy.welcomeTitle}
      </h2>
      <p className="text-[12px] text-[var(--text-dim)] mb-6">{copy.welcomeSub}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {copy.prompts.map((p, i) => (
          <button
            key={i}
            onClick={() => onPick(p)}
            className="text-start p-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] text-[12px] text-[var(--text-muted)] transition-all"
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
