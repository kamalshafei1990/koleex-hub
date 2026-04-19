"use client";

/* ---------------------------------------------------------------------------
   Koleex AI — full-page chat assistant powered by whichever provider
   is currently wired into /api/ai/chat (Gemini Flash on the free tier
   today, swappable to Claude / OpenAI without touching this component).

   Keeps the conversation ephemeral on the client for now; later stages
   will persist threads to Supabase so the user can revisit past chats.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation, type Lang } from "@/lib/i18n";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import AiFaceIcon from "@/components/icons/AiFaceIcon";
import PaperPlaneIcon from "@/components/icons/ui/PaperPlaneIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";

type ChatMsg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS: Record<Lang, string[]> = {
  en: [
    "Draft a polite follow-up email to a customer whose quotation is about to expire.",
    "Translate this to Chinese: Please confirm delivery by Friday.",
    "What are best practices for setting payment terms with a new supplier?",
    "Summarise the key fields I should fill when creating an invoice.",
  ],
  zh: [
    "为一位报价即将到期的客户起草一封礼貌的跟进邮件。",
    "翻译成英文：请在周五前确认交货。",
    "与新供应商制定付款条款的最佳实践有哪些？",
    "总结创建发票时应填写的关键字段。",
  ],
  ar: [
    "اكتب بريدًا إلكترونيًا مهذبًا للمتابعة لعميل سينتهي عرض السعر الخاص به قريبًا.",
    "ترجم إلى الإنجليزية: الرجاء تأكيد التسليم بحلول يوم الجمعة.",
    "ما أفضل الممارسات لتحديد شروط الدفع مع مورد جديد؟",
    "لخّص الحقول الرئيسية التي يجب ملؤها عند إنشاء فاتورة.",
  ],
};

export default function KoleexAiApp() {
  const { lang } = useTranslation({}) as unknown as { lang: Lang };
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const send = useCallback(
    async (textOverride?: string) => {
      const text = (textOverride ?? input).trim();
      if (!text || sending) return;
      setError(null);
      const next: ChatMsg[] = [...messages, { role: "user", content: text }];
      setMessages(next);
      setInput("");
      setSending(true);

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.map((m) => ({ role: m.role, content: m.content })),
            user_lang: lang,
          }),
        });
        const json = (await res.json()) as
          | { reply: string; provider: string }
          | { error: string; message?: string };
        if (!res.ok || "error" in json) {
          const msg =
            ("message" in json && json.message) ||
            ("error" in json && json.error) ||
            "AI is unavailable right now.";
          setError(msg);
          return;
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: (json as { reply: string }).reply },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Network error");
      } finally {
        setSending(false);
      }
    },
    [input, messages, sending, lang],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  const placeholder =
    lang === "zh"
      ? "向 Koleex AI 提问…"
      : lang === "ar"
        ? "اسأل Koleex AI…"
        : "Ask Koleex AI…";

  return (
    <div
      className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
      style={{ height: "calc(100dvh - 3.5rem)" }}
    >
      {/* Header */}
      <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full overflow-x-hidden">
        <div className="max-w-[1100px] mx-auto px-4 md:px-6 lg:px-8 min-w-0">
          <div className="flex items-center gap-3 pt-5 pb-4">
            <Link
              href="/"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
            >
              <ArrowLeftIcon className="h-4 w-4" />
            </Link>
            <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center text-white shrink-0">
              <AiFaceIcon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                Koleex AI
              </h1>
              <p className="text-[11px] text-[var(--text-dim)] truncate">
                {lang === "zh"
                  ? "您的多语言业务助手"
                  : lang === "ar"
                    ? "مساعد الأعمال متعدد اللغات"
                    : "Your multilingual business assistant"}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-rose-400 text-[12px] font-semibold flex items-center gap-1.5"
              >
                <TrashIcon className="h-3 w-3" />
                <span className="hidden sm:inline">
                  {lang === "zh" ? "清空对话" : lang === "ar" ? "مسح المحادثة" : "Clear"}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[900px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-3">
          {messages.length === 0 ? (
            <WelcomeCard
              lang={lang}
              onPick={(p) => send(p)}
            />
          ) : (
            messages.map((m, i) => <Bubble key={i} msg={m} />)
          )}
          {sending && (
            <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)]">
              <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
              <span>
                {lang === "zh"
                  ? "思考中…"
                  : lang === "ar"
                    ? "جارٍ التفكير…"
                    : "Thinking…"}
              </span>
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
        <div className="max-w-[900px] mx-auto px-4 md:px-6 lg:px-8 py-3">
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
              placeholder={placeholder}
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)] resize-none max-h-40"
              style={{ minHeight: "44px" }}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="h-11 w-11 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center hover:opacity-90 disabled:opacity-40 shrink-0"
            >
              <PaperPlaneIcon className="h-4 w-4" />
            </button>
          </form>
          <div className="text-[10px] text-[var(--text-dim)] mt-2 text-center">
            Powered by Gemini · replies match your UI language · never shares
            data outside your tenant
          </div>
        </div>
      </div>
    </div>
  );
}

function Bubble({ msg }: { msg: ChatMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
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

function WelcomeCard({
  lang,
  onPick,
}: {
  lang: Lang;
  onPick: (prompt: string) => void;
}) {
  const title =
    lang === "zh"
      ? "你好，我是 Koleex AI"
      : lang === "ar"
        ? "مرحبًا، أنا Koleex AI"
        : "Hi, I'm Koleex AI";
  const sub =
    lang === "zh"
      ? "问我关于您业务的任何问题 — 我会用您的语言回答。"
      : lang === "ar"
        ? "اسألني عن أي شيء يخص أعمالك — سأردّ بلغتك."
        : "Ask me anything about your business — I'll reply in your language.";
  const prompts = QUICK_PROMPTS[lang] ?? QUICK_PROMPTS.en;

  return (
    <div className="pt-10 pb-4 text-center">
      <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-500 items-center justify-center text-white mb-4">
        <AiFaceIcon className="h-6 w-6" />
      </div>
      <h2 className="text-[18px] font-bold text-[var(--text-primary)] mb-1">
        {title}
      </h2>
      <p className="text-[12px] text-[var(--text-dim)] mb-6">{sub}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-xl mx-auto">
        {prompts.map((p, i) => (
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
