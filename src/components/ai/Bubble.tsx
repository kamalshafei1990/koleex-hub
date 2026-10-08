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

import { lazy, memo, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { type Lang } from "@/lib/i18n";
import { type OrbState } from "@/components/ai/KoleexOrb";
import KoleexOrb from "@/components/ai/KoleexGlowOrb";
import type { AIOrbActivity } from "@/components/ai-orb/ai-orb-types";
import TypingIndicator from "@/components/ai/TypingIndicator";
import ActivityLine from "@/components/ai/ActivityLine";
import ThinkingPanel from "@/components/ai/ThinkingPanel";
import { hasThinking } from "@/components/ai/thinking-panel-model";
/* THE MARKDOWN RENDERER LOADS WHEN A REPLY NEEDS IT (deep check,
   2026-09-24): react-markdown and its parsers are ~42 KB gzipped, and the
   app always opens on an empty new chat, which needs none of it. The app
   warms it in the background once it is up (KoleexAiApp); until it lands, a
   reply shows as plain text in the same place. */
const MessageMarkdown = lazy(() => import("@/components/ai/MessageMarkdown"));
import { textDirection, textLang, textScript } from "@/lib/text-direction";
import DraftCard from "@/components/ai/DraftCard";
import TaskCard, { type TaskCardState } from "@/components/ai/TaskCard";
import PhotoLightbox, { type LightboxPhoto } from "@/components/ai/PhotoLightbox";
import type { ChatMsg, QuotationDraftPayload } from "@/components/ai/types";
import { COPY } from "@/components/ai/copy";
import { KOLEEX_MODEL_INFO } from "@/lib/ai/koleex-models";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import Volume2Icon from "@/components/icons/ui/Volume2Icon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import ThumbsUpIcon from "@/components/icons/ui/ThumbsUpIcon";
import ThumbsDownIcon from "@/components/icons/ui/ThumbsDownIcon";
import WaveformIcon from "@/components/icons/ui/WaveformIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import StopIcon from "@/components/icons/ui/StopIcon";

/* ── Bubble ── */


function BubbleImpl({
  msg,
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
  onConfirmTask,
  onCancelTask,
  taskStatus,
  lang,
  orbState = "idle",
  orbActivity = "none",
}: {
  msg: ChatMsg;
  /** No longer drawn (UI/UX pass, 2026-09-24: your own face beside every
   *  message you wrote said nothing); accepted so older callers still type. */
  userAvatar?: string | null;
  userInitial?: string;
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
  /** Carries the message id so the parent can pass ONE stable function to
   *  every bubble; a per-row lambda defeated the memo (audit, 2026-09-11). */
  onEdit?: (msgId: string, newText: string) => void;
  /** A clarifying option was tapped — send it as the next user message. */
  onAnswerQuestion?: (msgId: string, answer: string) => void;
  /** The Task card's Save / Cancel (tasks phase 2). The parent carries the
   *  tap to /api/ai/agent/confirm and owns the card's outcome. */
  onConfirmTask?: (msgId: string, pending: { tool: string; args: Record<string, unknown> }) => void;
  onCancelTask?: (msgId: string) => void;
  taskStatus?: TaskCardState;
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
  /* The photo a user attached, expanded in place on a tap — the same
     lightbox product photos use, so a picture the user sent behaves like a
     picture Koleex AI showed. Only this browser holds the preview URL. */
  const [openPhoto, setOpenPhoto] = useState<LightboxPhoto | null>(null);
  const attachedFiles = isUser ? (msg.attachedFiles ?? []) : [];
  /* One measurement drives layout, font and size, so they cannot disagree */
  const bubbleDir = textDirection(msg.content);
  const rtl = bubbleDir === "rtl";
  /* The script decides the size: Arabic and Chinese glyphs sit small at the
     Latin 14px, so both read at 16 (owner, 2026-09-13); Chinese used to be
     judged by direction alone and got the Latin size. The lang attribute
     lets the stylesheet and the browser pick the font and glyph variants. */
  const bubbleScript = textScript(msg.content);
  const bubbleLang = textLang(msg.content);
  /* Memoised so the `?? []` fallback doesn't mint a new array each render
     and re-run everything downstream that depends on it. */
  const steps = useMemo(() => msg.steps ?? [], [msg.steps]);
  /* The Thinking panel (owner, 2026-09-26): shown when this turn looked
     something up or said something before it did. It carries the activity
     itself, so the separate activity line steps aside while it is there. */
  const liveTurn = !!isLast && (orbState === "loading" || orbState === "typing");
  const showThinking = !isUser && hasThinking(steps, msg.thinking);
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
  /* ACTIONS ON THE LATEST REPLY ONLY (UI/UX pass, 2026-09-24). A row of five
     icons under every answer turned a long thread into a column of toolbars.
     The last reply keeps its row; an older one shows it on hover or keyboard
     focus, and on a touch screen after a tap on the message itself. */
  const [revealed, setRevealed] = useState(false);
  const actionsAlwaysOn = !!isLast || revealed;
  const revealCls = actionsAlwaysOn
    ? ""
    /* HIDDEN MEANS UNTAPPABLE. opacity-0 alone left the buttons live: on a
       phone a tap in the blank under an older reply copied it, read it
       aloud or sent a thumbs-down, and under a message of yours opened
       Edit (review, 2026-09-26). Now the tap falls through to the row,
       which reveals them; hover and keyboard focus bring them back too. */
    : "opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity";


  /* Phase 13: edit-and-retry state. Only user messages can be
     edited, and only when the parent allows it (not while another
     send is in-flight). */
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(msg.content);
  const showEditButton = isUser && !!onEdit && canEdit !== false;
  const submitEdit = useCallback(() => {
    const next = editValue.trim();
    /* THE SAME WORDS RESEND. The button says "Save and retry", and after a
       failed reply retrying unchanged is exactly what is wanted — it used
       to just close the editor (review, 2026-09-26). Only an empty box
       cancels. */
    if (!next) {
      setEditing(false);
      setEditValue(msg.content);
      return;
    }
    setEditing(false);
    onEdit?.(msg.id, next);
  }, [editValue, msg.content, msg.id, onEdit]);
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
  /* THE TASK CARD (tasks phase 2): a to-do write tool's first phase, its
     confirm arguments riding on the step (AgentStep.pending). Rendered above
     the answer like the quotation draft; tappable only on the last message
     with no outcome yet. */
  const taskStep = !isUser
    ? steps.find(
        (s) =>
          s.kind === "tool-result" &&
          (s.tool === "createTodo" || s.tool === "updateTodo") &&
          s.permissionStatus === "approval_required" &&
          !!s.pending &&
          typeof s.pending.tool === "string",
      )
    : undefined;
  const taskPreview = taskStep && taskStep.payload && typeof taskStep.payload === "object"
    ? ((taskStep.payload as { preview?: unknown }).preview as Record<string, unknown> | undefined) ?? null
    : null;
  const taskState: TaskCardState = taskStatus ?? { state: "pending" };
  /* ONE ORB, ON THE LATEST REPLY (UI/UX pass, 2026-09-24). The orb is the
     character and it shows what Koleex AI is doing — so it sits where the
     work is: the newest message. Older replies keep its column as an empty
     gutter, so nothing shifts sideways when the orb moves on to the next
     answer. Your own messages carry no avatar: you know who wrote them. */
  return (
    <div
      /* Audit P1 #1 — let the row inherit the document direction so
         screen readers walk avatar→bubble in the natural reading
         order for Arabic users. The previous hardcoded dir="ltr"
         kept the visual gap fine but broke a11y reading order.
         flex-row-reverse on user bubbles below keeps the layout
         "right-aligned" without forcing LTR on the document. */
      className={`group/msg flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}
      onClick={(e) => {
        /* A tap on an older message shows its actions (touch has no hover).
           Taps on the message's own controls and links are theirs. */
        if (isLast || editing) return;
        if ((e.target as HTMLElement).closest("button, a, input, textarea, select, [role=button]")) return;
        setRevealed((v) => !v);
      }}
    >
      {!isUser && (isLast
        ? <KoleexOrb state={orbState} activity={orbActivity} size={38} className="shrink-0" />
        : <span aria-hidden className="w-[38px] shrink-0" data-orb-gutter />)}
      <div className={`flex flex-col gap-2 ${isUser ? "max-w-[85%] items-end" : "min-w-0 flex-1 items-start"}`}>
        {/* Tool-step chips are NOT rendered (owner directive 2026-08-03:
            "just give the answer direct"). The steps still exist on the
            message — the orb's activity label uses the latest tool-call,
            and the quotation DraftCard below still surfaces its result. */}
        {showThinking && (
          <ThinkingPanel steps={steps} thinking={msg.thinking} live={liveTurn} lang={lang} />
        )}
        {draftStep && (
          <DraftCard payload={draftStep.payload as QuotationDraftPayload} lang={lang} />
        )}
        {taskStep && taskStep.pending && (
          <TaskCard
            tool={taskStep.tool ?? taskStep.pending.tool}
            pending={taskStep.pending}
            preview={taskPreview}
            status={taskState}
            live={!!isLast && !!onConfirmTask && !answeredWith}
            lang={lang}
            onSave={() => onConfirmTask?.(msg.id, taskStep.pending!)}
            onCancel={() => onCancelTask?.(msg.id)}
          />
        )}
        {/* WHAT IT IS DOING, IN WORDS. The three anonymous dots said only
            "wait"; this line says why — Thinking, Reading the details, Checking
            the records — from the same activity the orb already shows (the
            latest tool-call step). Shown while the bubble is still empty,
            and again above a reply that is streaming while a lookup runs.
            Owner, looking at Grok: a small title with a simple motion. */}
        {!isUser && !showThinking && msg.content && orbState === "typing" && orbActivity !== "none" && (
          <ActivityLine activity={orbActivity} lang={lang} className="px-1" />
        )}
        {!isUser && !msg.content ? (
          showThinking ? null : orbState === "loading" || orbState === "typing" ? (
            <ActivityLine activity={orbActivity} lang={lang} className="px-1 py-1" />
          ) : (
            <TypingIndicator lang={lang} />
          )
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
            lang={bubbleLang}
            className={`leading-relaxed ${
              isUser ? "rounded-2xl whitespace-pre-wrap [overflow-wrap:anywhere] px-4 py-2.5" : "kx-ai-reply max-w-full"
            } ${
              bubbleScript === "ar" || bubbleScript === "zh" ? "text-[16px]" : "text-[14px]"
            } ${
              isUser
                /* A quiet grey, not the inverted block: your words are
                   the question, not the loudest thing on the screen. */
                ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
                : /* PLAIN TEXT IN CORE, GLASS UNDER AURORA. A reply is the
                     content itself, so in Core it sits on the page like a
                     document (UI/UX pass, 2026-09-24). Under Aurora it keeps
                     the tile glass the owner asked for — .kx-ai-reply adds
                     the padding, rim and radius only there (globals.css).
                     `relative`: the Aurora rim is a ::before drawn against
                     the nearest positioned ancestor. */
                  "kx-glass relative text-[var(--text-primary)]"
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
                  /* No placeholder either — this box opens already full of
                     the message being edited, so there was nothing at all to
                     announce it. */
                  aria-label={copy.editMessageLabel}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    /* Confirming a pinyin candidate is Enter too: not a submit. */
                    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submitEdit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEdit();
                    }
                  }}
                  /* AS TALL AS THE MESSAGE. rows={1} showed one line of a
                     long message and scrolled the rest inside the box
                     (review, 2026-09-26); field-sizing grows it with the
                     text, the rows count is the floor where it is not
                     supported, and the cap keeps it on screen. */
                  rows={Math.min(8, Math.max(1, editValue.split("\n").length))}
                  className="kx-edit-box w-full bg-transparent outline-none resize-none text-inherit leading-relaxed min-w-[180px] max-h-[40vh] overflow-y-auto"
                  style={{ fontFamily: "inherit" }}
                />
              ) : (
                <>
                  {attachedFiles.length > 0 && (
                    /* THE PICTURE SITS IN THE BUBBLE, above the words, the
                       moment the message is sent (owner ask, 2026-09-04:
                       "shows in the chat as a photo, not just the file
                       name"). Documents keep the 📎 chip. Object URLs are
                       the browser's own, so next/image has nothing to
                       optimise here. */
                    <div className="mb-2 flex flex-wrap gap-1.5" data-attached-files>
                      {attachedFiles.map((f, i) => {
                        const url = f.url;
                        return url ? (
                          <button
                            key={`${f.name}-${i}`}
                            type="button"
                            onClick={() => setOpenPhoto({ url, label: f.name })}
                            className="block overflow-hidden rounded-xl border border-[var(--border-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0066FF]"
                            aria-label={f.name}
                            title={f.name}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL held only by this browser */}
                            <img src={url} alt={f.name} className="block h-36 max-w-[240px] object-cover" />
                          </button>
                        ) : (
                          <span
                            key={`${f.name}-${i}`}
                            className="inline-flex max-w-[240px] items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] px-2 py-1 text-[12px]"
                            title={f.name}
                          >
                            <PaperclipIcon size={12} aria-hidden className="shrink-0 opacity-70" />
                            <span className="truncate">{f.name}</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {msg.content}
                  <PhotoLightbox photo={openPhoto} onClose={() => setOpenPhoto(null)} closeLabel={copy.closePhoto} />
                </>
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
                return (
                  <Suspense fallback={<div className="whitespace-pre-wrap [overflow-wrap:anywhere]" dir={bubbleDir}>{msg.content}</div>}>
                    <MessageMarkdown content={msg.content} lang={lang} dir={bubbleDir} />
                  </Suspense>
                );
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
                onAnswerQuestion?.(msg.id, t);
              };
              return (
                <div className="kx-glass-pop -mx-1 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="mb-2.5 px-0.5 text-[14px] font-semibold text-[var(--text-primary)]">
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
                          onClick={() => { setPickedOption(o.label); onAnswerQuestion?.(msg.id, o.label); }}
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
                              <span className="ms-auto shrink-0 rounded-full border border-[var(--border-focus)] px-1.5 py-px text-[12px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                                {cardCopy.recommended}
                              </span>
                            )}
                          </span>
                          {o.detail && (
                            <span
                              className={`mt-1 block text-[12px] leading-snug text-[var(--text-dim)] ${
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
                          <span className="mt-1 block ps-[22px] text-[12px] leading-snug text-[var(--text-dim)]">
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
                            className="shrink-0 rounded-lg border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] font-medium text-[var(--text-primary)] transition-colors hover:border-[var(--border-focus)] hover:bg-[var(--bg-surface-subtle)] disabled:opacity-40"
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
                          <span className="mt-1 block ps-[22px] text-[12px] leading-snug text-[var(--text-dim)]">
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
        {/* SPOKEN, NOT TYPED. A turn from a voice call is a message like any
            other now — same thread, same row — and this is the one thing
            that still distinguishes it: a small waveform and two words,
            so the thread says which of its words were said aloud. The
            assistant's spoken rows were relayed by the browser, not
            generated by the server, and the mark is what carries that fact
            to the reader. Quiet: dim, small, under the bubble. */}
        {msg.source === "voice" && !!msg.content && (
          <span
            className="inline-flex items-center gap-1 text-[12px] text-[var(--text-dim)]"
            title={copy.voiceMessage}
          >
            <WaveformIcon size={12} aria-hidden />
            {copy.voiceMessage}
          </span>
        )}
        {/* CUT SHORT. The caller pressed Stop while this reply was streaming,
            so the text above is the part that arrived, not the answer. Two
            words under the bubble keep it from reading as complete later
            (UI review, 2026-09-12). Browser-only: the row is never saved
            with this flag, so a reload shows the plain partial text. */}
        {!isUser && msg.stopped && (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-dim)]" title={copy.stopped}>
            <StopIcon size={11} aria-hidden />
            {copy.stopped}
          </span>
        )}
        {/* ANSWERED BY ANOTHER MODEL. The user chose a Koleex model and a
            different one replied — the chosen one was down, not set up, or
            switched off, and the turn failed over rather than leave them
            without an answer. Said plainly, by Koleex name, and only then:
            Auto, or the model that was asked for, needs no note. */}
        {!isUser && msg.askedModel && msg.askedModel !== "auto" && msg.servedModel && msg.servedModel !== msg.askedModel && (
          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--text-dim)]">
            {copy.answeredByModel.replace("{model}", KOLEEX_MODEL_INFO[msg.servedModel].name[lang === "zh" || lang === "ar" ? lang : "en"])}
          </span>
        )}
        {/* Phase 13: user-side action row — Edit (re-runs the turn
            with new text) or Save/Cancel while editing. Only shown
            when the parent supplied onEdit and allowed it. */}
        {isUser && showEditButton && (
          <div className={`mt-1 flex items-center gap-2 text-[12px] text-[var(--text-dim)] ${editing ? "" : revealCls}`}>
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={submitEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] transition-opacity"
                  aria-label={copy.saveAndRetry}
                >
                  {copy.saveAndRetry}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
                  aria-label={copy.cancelEdit}
                >
                  {copy.cancel}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditValue(msg.content);
                  setEditing(true);
                }}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={copy.editAndRetry}
              >
                <span aria-hidden className="inline-flex"><PencilIcon size={12} /></span>
                {copy.editShort}
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
          <div className={revealCls}>
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
          </div>
        )}
      </div>
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

/* MEMOISED: the thread re-renders on every streamed token, and a bubble
   whose props did not change must not re-render with it (audit, 2026-09-07).
   Callers pass stable callbacks where they can; the markdown inside is
   memoised on its text besides, so even a re-render is cheap. */
export const Bubble = memo(BubbleImpl);

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
  /* THE LANGUAGE WAS ALREADY BEING PASSED IN AND THROWN AWAY — `void lang`
     is what that line said. Every control in this toolbar carried a
     hardcoded English aria-label and title as a result: an Arabic user
     hovering "Regenerate" saw English, and a screen-reader user heard it. */
  const copy = COPY[lang] ?? COPY.en;
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
  const btnCls = "inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const ICON = 14;
  return (
    <div role="toolbar" aria-label={copy.messageActions} className="mt-1 flex items-center gap-4 text-[12px] text-[var(--text-dim)]">
      <button
        type="button"
        onClick={onCopy}
        className={`${btnCls} ${copied ? "text-[var(--kx-ai-success)]" : ""}`}
        aria-label={copied ? copy.copied : copy.copyMessage}
        title={copied ? copy.copied : copy.copyMessage}
      >
        {copied ? <CheckIcon size={ICON} /> : <CopyIcon size={ICON} />}
      </button>
      {onSpeak && msg.content && (
        <button
          type="button"
          onClick={() => onSpeak(msg.content)}
          className={btnCls}
          aria-label={copy.readAloud}
          title={copy.readAloud}
        >
          <Volume2Icon size={ICON} />
        </button>
      )}
      {isLast && onRegenerate && (
        <button
          type="button"
          onClick={onRegenerate}
          disabled={!canRegenerate}
          className={btnCls}
          aria-label={copy.regenerate}
          title={copy.regenerate}
        >
          <RefreshCwIcon size={ICON} />
        </button>
      )}
      {onFeedback && (
        <>
          <span aria-hidden className="mx-1 h-3 w-px bg-[var(--border-subtle)]" />
          <button
            type="button"
            onClick={() => sendVote("up")}
            className={`${btnCls} ${vote === "up" ? "text-[var(--kx-ai-success)]" : ""}`}
            aria-label={copy.goodResponse}
            title={copy.goodResponse}
          >
            <ThumbsUpIcon size={ICON} fill={vote === "up" ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            onClick={() => sendVote("down")}
            className={`${btnCls} ${vote === "down" ? "text-[var(--kx-ai-danger-text)]" : ""}`}
            aria-label={copy.badResponse}
            title={copy.badResponse}
          >
            <ThumbsDownIcon size={ICON} fill={vote === "down" ? "currentColor" : "none"} />
          </button>
        </>
      )}
    </div>
  );
}

