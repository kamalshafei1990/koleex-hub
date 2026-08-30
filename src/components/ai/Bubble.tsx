"use client";

/* ---------------------------------------------------------------------------
   components/ai/Bubble — one message in the transcript, and its action row.

   Phase 2J, sliced verbatim from KoleexAiApp.tsx. Both are module-level and
   prop-only: no parent-state closure, so the move is behaviour-neutral by
   construction. It was held back until the render harness (N9) existed,
   because this is where a silent visual regression would actually hide — and
   the extraction was then proved by rendering the pre-split component and this
   one with identical props and diffing the HTML.
   --------------------------------------------------------------------------- */

import { useCallback, useMemo, useRef, useState } from "react";
import { type Lang } from "@/lib/i18n";
import { type OrbState } from "@/components/ai/KoleexOrb";
import KoleexOrb from "@/components/ai/KoleexGlowOrb";
import type { AIOrbActivity } from "@/components/ai-orb/ai-orb-types";
import TypingIndicator from "@/components/ai/TypingIndicator";
import MessageMarkdown from "@/components/ai/MessageMarkdown";
import { textDirection } from "@/lib/text-direction";
import DraftCard from "@/components/ai/DraftCard";
import type { ChatMsg, QuotationDraftPayload } from "@/components/ai/types";
import { COPY } from "@/components/ai/copy";

/* ── Bubble ── */

/** Arabic / Persian / Hebrew scripts → force RTL direction + slightly
 *  larger type (Arabic glyphs read smaller than Latin at the same px
 *  because of their narrower x-height). Works per-bubble so a Chinese
 *  user can still get an Arabic translation reply rendered correctly
 *  regardless of the surrounding UI language. */
const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
export function isRtl(text: string): boolean {
  return RTL_RE.test(text);
}

export function Bubble({
  msg,
  userAvatar,
  userInitial,
  isLast,
  answeredWith,
  canRegenerate,
  canEdit,
  onCopy,
  onRegenerate,
  onEdit,
  onSpeak,
  onFeedback,
  onAnswerQuestion,
  lang,
  orbState = "idle",
  orbActivity = "none",
}: {
  msg: ChatMsg;
  userAvatar?: string | null;
  userInitial: string;
  isLast?: boolean;
  answeredWith?: string | null;
  /** Live orb reaction for THIS bubble — only the last assistant message
      gets a non-idle value (thinking/typing/success/error); the rest stay
      calm so the transcript doesn't twitch. */
  orbState?: OrbState;
  orbActivity?: AIOrbActivity;
  canRegenerate?: boolean;
  canEdit?: boolean;
  onCopy?: (text: string, renderedEl?: HTMLElement | null) => Promise<boolean> | boolean;
  onRegenerate?: () => void;
  onEdit?: (newText: string) => void;
  /** A clarifying option was tapped — send it as the next user message. */
  onAnswerQuestion?: (answer: string) => void;
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
  /* One measurement drives layout, font and size, so they cannot disagree */
  const bubbleDir = textDirection(msg.content);
  const rtl = bubbleDir === "rtl";
  /* Memoised so the `?? []` fallback doesn't mint a new array each render
     and re-run everything downstream that depends on it. */
  const steps = useMemo(() => msg.steps ?? [], [msg.steps]);
  /* MessageBubble takes `lang`, not the resolved dictionary — resolve it here
     rather than threading another prop through every call site. */
  const copy = COPY[lang] ?? COPY.en;
  /* Which option was tapped, so the card can show the choice instead of
     going inert. Local to the bubble — the real record of the choice is the
     user message it sends. */
  const [pickedOption, setPickedOption] = useState<string | null>(null);
  /* The "something else" row. Owner asked for it explicitly: the composer
     below could always take a free-text reply, but a row INSIDE the card is
     where the eye already is, and it keeps "none of these" part of the same
     choice rather than a separate act. */
  const [otherOpen, setOtherOpen] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [copied, setCopied] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const handleCopyClick = useCallback(async () => {
    if (!onCopy || !msg.content) return;
    const ok = await onCopy(msg.content, bubbleRef.current);
    if (ok) {
      setCopied(true);
      /* Hold the ✓ confirmation a bit longer so the swap is
         clearly perceived. 2 s is the sweet spot in chat-app
         copy buttons (ChatGPT / Linear / Notion all sit ~2 s). */
      setTimeout(() => setCopied(false), 2000);
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
      /* Audit P1 #1 — let the row inherit the document direction so
         screen readers walk avatar→bubble in the natural reading
         order for Arabic users. The previous hardcoded dir="ltr"
         kept the visual gap fine but broke a11y reading order.
         flex-row-reverse on user bubbles below keeps the layout
         "right-aligned" without forcing LTR on the document. */
      className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <KoleexOrb state={orbState} activity={orbActivity} size={38} className="shrink-0" />
      )}
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Tool-step chips are NOT rendered (owner directive 2026-08-03:
            "just give the answer direct"). The steps still exist on the
            message — the orb's activity label uses the latest tool-call,
            and the quotation DraftCard below still surfaces its result. */}
        {draftStep && (
          <DraftCard payload={draftStep.payload as QuotationDraftPayload} />
        )}
        {/* Assistant bubble with no content yet → show typing indicator
            (Phase 6). Replaced by the streamed text as deltas arrive. */}
        {!isUser && !msg.content ? (
          <TypingIndicator />
        ) : (
          <div
            /* Direction is MEASURED from the whole message, not guessed from
               its first letter. `dir="auto"` and `unicode-bidi: plaintext`
               both resolve per paragraph off the first strong character, so
               any Arabic reply opening with "Koleex Hub…" was laid out as an
               English paragraph and rendered reversed. Measuring the message
               also keeps its blocks consistent — a heading like
               "ما يغطيه Koleex Hub" has more Latin letters than Arabic on
               its own and would flip if judged alone. Embedded English still
               sits correctly: the bidi algorithm handles runs inside a
               correctly-directed paragraph, which was never the problem.
               User bubbles keep the whitespace-pre-wrap path (literal text
               only). Assistant bubbles render markdown via MessageMarkdown
               for bullets, headings, code blocks, tables, links. */
            ref={bubbleRef}
            dir={bubbleDir}
            className={`rounded-2xl leading-relaxed ${
              isUser ? "whitespace-pre-wrap px-4 py-2.5" : "px-5 py-3.5"
            } ${
              rtl ? "text-[15px]" : "text-[14px]"
            } ${
              isUser
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : /* Aurora: assistant bubbles wear the tile glass (owner ask).
                     Measured safe: 140 glass tiles over the moving ground
                     dropped 0 frames, and the low-power arm strips blur on
                     weak machines. User bubbles keep the inverted fill — the
                     contrast IS their identity. */
                  "kx-glass bg-[var(--bg-secondary)] border border-[var(--border-subtle)] text-[var(--text-primary)]"
            }`}
            style={{
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
            ) : (() => {
              /* THE QUESTION IS A CARD, not a paragraph with buttons under it.
                 When the assistant asks, the whole reply IS the question, so
                 the card carries it as its own heading and the plain markdown
                 is skipped — rendering both would print the question twice.
                 Only on the LAST message: these are live controls, and leaving
                 them tappable half-way up a transcript invites someone to
                 answer a question that was settled ten messages ago. */
              const q = steps.find((st) => st.kind === "question")?.payload as
                | {
                    question?: string;
                    lang?: "ar" | "zh" | "en";
                    options?: Array<{
                      label: string;
                      detail?: string;
                      recommended?: boolean;
                      photo_url?: string;
                    }>;
                  }
                | undefined;
              const options = q?.options ?? [];
              if (options.length === 0) {
                return <MessageMarkdown content={msg.content} />;
              }
              /* The card OUTLIVES the answer. It stays in the transcript with
                 the chosen row marked and the rest faded, because the question
                 and the options are the context for everything said after it —
                 collapsing back to a line of text loses why the answer took
                 the shape it did. Only the LIVE card is tappable: an answered
                 one, or one half-way up the transcript, is a record. */
              /* The card labels itself in the language of the QUESTION, not the
                 Hub's UI setting: the owner writes to Koleex AI in Arabic while
                 his Hub is in English, and an Arabic card badged RECOMMENDED
                 reads like two different products stapled together. Falls back
                 to the UI copy when the server sent no language. */
              const cardCopy = q?.lang ? COPY[q.lang] : copy;
              const settled = answeredWith ?? pickedOption;
              const live = isLast && !!onAnswerQuestion && !settled;
              /* An answer that matches no option came through the "something
                 else" row (or the composer). The card records it there, so the
                 transcript still shows the question was answered — a settled
                 card with nothing marked reads like it was ignored. */
              const settledIsOther =
                !!settled && !options.some((o) => o.label === settled);
              const submitOther = () => {
                const t = otherText.trim();
                if (!t) return;
                setPickedOption(t);
                onAnswerQuestion?.(t);
              };
              return (
                <div className="kx-glass-pop -mx-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="mb-2.5 px-0.5 text-[13.5px] font-semibold text-[var(--text-primary)]">
                    {q?.question || msg.content}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {options.map((o, i) => {
                      const chosen = settled === o.label;
                      return (
                        <button
                          key={`${o.label}-${i}`}
                          type="button"
                          disabled={!live}
                          onClick={() => { setPickedOption(o.label); onAnswerQuestion?.(o.label); }}
                          className={`group w-full rounded-xl border px-3 py-2.5 text-start transition-all ${
                            chosen
                              ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)]"
                              : !live
                                /* The unpicked options fade rather than vanish:
                                   the transcript should still show what the
                                   choice WAS, not just what was chosen. */
                                ? "border-[var(--border-subtle)] opacity-40"
                                : "border-[var(--border-subtle)] bg-[var(--bg-secondary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"
                          } ${live ? "cursor-pointer" : "cursor-default"}`}
                        >
                          <span className="flex items-center gap-2">
                            {/* A radio mark, so the row reads as "choose one"
                                before it is read as "press me". */}
                            <span
                              aria-hidden
                              className={`inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                                chosen ? "border-[var(--border-focus)]" : "border-[var(--border-color)]"
                              }`}
                            >
                              {chosen && <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />}
                            </span>
                            {/* The product's real photo when the tool resolved
                                one from its code. Machines are far easier to
                                tell apart by sight than by code. */}
                            {o.photo_url && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={o.photo_url}
                                alt=""
                                loading="lazy"
                                className="h-9 w-9 shrink-0 rounded-lg border border-[var(--border-subtle)] object-cover"
                              />
                            )}
                            <span className="text-[13px] font-medium text-[var(--text-primary)]">{o.label}</span>
                            {o.recommended && (
                              <span className="ms-auto shrink-0 rounded-full border border-[var(--border-focus)] px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                {cardCopy.recommended}
                              </span>
                            )}
                          </span>
                          {o.detail && (
                            <span
                              className={`mt-1 block text-[11.5px] leading-snug text-[var(--text-dim)] ${
                                o.photo_url ? "ps-[58px]" : "ps-[22px]"
                              }`}
                            >
                              {o.detail}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {/* No "Other" button: the composer is directly below and
                      already does that job better than a control whose only
                      action is to focus the composer. */}
                  {/* "Something else" — the last row, not a paragraph under
                      the card, so it reads as one more choice in the same
                      list. Tapping it opens a field IN PLACE rather than
                      sending the user down to the composer and back. */}
                  {(live || settledIsOther) && (
                    <div className="mt-1.5">
                      {settledIsOther ? (
                        <div className="w-full rounded-xl border border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] px-3 py-2.5 text-start">
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-[var(--border-focus)]"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-primary)]" />
                            </span>
                            <span className="text-[13px] font-medium text-[var(--text-primary)]">
                              {cardCopy.otherOption}
                            </span>
                          </span>
                          <span className="mt-1 block ps-[22px] text-[11.5px] leading-snug text-[var(--text-dim)]">
                            {settled}
                          </span>
                        </div>
                      ) : otherOpen ? (
                        <div className="flex items-center gap-1.5 rounded-xl border border-[var(--border-focus)] bg-[var(--bg-secondary)] px-2.5 py-1.5">
                          <input
                            autoFocus
                            dir="auto"
                            value={otherText}
                            onChange={(e) => setOtherText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); submitOther(); }
                              if (e.key === "Escape") { setOtherOpen(false); setOtherText(""); }
                            }}
                            placeholder={cardCopy.otherPlaceholder}
                            className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-dim)]"
                          />
                          <button
                            type="button"
                            onClick={submitOther}
                            disabled={!otherText.trim()}
                            className="shrink-0 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] disabled:opacity-40"
                          >
                            {cardCopy.otherSend}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOtherOpen(true)}
                          className="group w-full cursor-pointer rounded-xl border border-dashed border-[var(--border-subtle)] px-3 py-2.5 text-start transition-all hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)]"
                        >
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-color)]"
                            />
                            <span className="text-[13px] font-medium text-[var(--text-primary)]">
                              {cardCopy.otherOption}
                            </span>
                          </span>
                          <span className="mt-1 block ps-[22px] text-[11.5px] leading-snug text-[var(--text-dim)]">
                            {cardCopy.otherPlaceholder}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
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
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-inverted)] text-[var(--text-inverted)] transition-opacity"
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
        {/* No Sources row: the owner asked for the answer alone. The URLs
            still travel in the tool step and stay in the audit trail — this
            only stops them being drawn under the reply. */}
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

export function BubbleActions({
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
    <div role="toolbar" aria-label="Message actions" className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
      <button
        type="button"
        onClick={onCopy}
        className={`${btnCls} ${copied ? "text-emerald-300" : ""}`}
        aria-label={copied ? "Copied" : "Copy message"}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? (
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          /* Lucide "copy" — two overlapping rounded rectangles. The
             previous variant used a single rect + escape-path which
             didn't read as a duplicate at small sizes. */
          <svg aria-hidden viewBox="0 0 24 24" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
          {/* Lucide volume-2 redrawn on a 20×20 viewBox so the
              speaker triangle + arc waves actually fill the box.
              The original 24×24 lucide path only used the left
              ~17 units, which made the icon look noticeably
              smaller next to copy / regenerate / 👍 / 👎. */}
          <svg aria-hidden viewBox="0 0 20 20" width={ICON} height={ICON} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="9 3 4 7 1 7 1 13 4 13 9 17 9 3" />
            <path d="M13 6.5a4.5 4.5 0 0 1 0 7" />
            <path d="M16 4a8 8 0 0 1 0 12" />
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

