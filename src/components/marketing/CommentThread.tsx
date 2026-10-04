"use client";

/* ---------------------------------------------------------------------------
   CommentThread — one comment thread and what the caller may do with it:
   reply as the account (Koleex AI can draft it), «No reply needed», and —
   approvers only — hide a comment or show it again. Used by the Comments
   tab and by a post's panel in the Feed. Every action goes through the
   server, which checks the same rights; the thread then updates in place.
   --------------------------------------------------------------------------- */

import { useState, type ReactNode } from "react";
import Button from "@/components/kds/Button";
import StatusPill from "@/components/kds/StatusPill";
import ReplyIcon from "@/components/icons/ui/ReplyIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import EyeOffIcon from "@/components/icons/ui/EyeOffIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import { useTranslation } from "@/lib/i18n";
import { COMMENTS_T } from "@/lib/marketing/comments-i18n";
import { dmyHm } from "@/lib/marketing/format";
import { REPLY_MAX, lastVisible, needsReply, type CommentView } from "@/lib/marketing/comment-types";

export interface ThreadState {
  first: CommentView;
  replies: CommentView[];
  handled_at: string | null;
  handled_by_name: string | null;
  needs_reply: boolean;
}

type Tr = (k: string) => string;
type Json = Record<string, unknown> | null;

/** The thread after a change, with «Needs a reply» decided again by the
 *  same rule the server counts with. */
function settle(s: Omit<ThreadState, "needs_reply">): ThreadState {
  return { ...s, needs_reply: needsReply({ ...s.first, handled_at: s.handled_at }, s.replies) };
}

async function call(url: string, body: unknown): Promise<{ ok: boolean; json: Json }> {
  try {
    const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: res.ok, json: (await res.json().catch(() => null)) as Json };
  } catch {
    return { ok: false, json: null };
  }
}

/** A refusal in words: ours when we know it, the platform's own otherwise. */
function refusal(t: Tr, json: Json): string {
  const code = typeof json?.code === "string" ? json.code : null;
  if (code && COMMENTS_T[`err.${code}`]) return t(`err.${code}`);
  if (code === "platform" && typeof json?.error === "string") return json.error;
  return t("err.failed");
}

const textBtn = "inline-flex items-center gap-1 rounded-md px-1 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--border-focus)]";

export default function CommentThread({ thread, accountName, accountAvatar, canReply, canHide, onChange, onReconcile }: {
  thread: ThreadState;
  accountName: string;
  /** The account's own picture — Meta sends none for its own comments. */
  accountAvatar?: string | null;
  canReply: boolean;
  canHide: boolean;
  onChange: (next: ThreadState) => void;
  /** The send's answer never arrived (or came back «already sent»): the
   *  reply may still have landed — the caller reloads so the screen shows
   *  what the server knows, not a stale thread. */
  onReconcile?: () => void;
}) {
  const { t } = useTranslation(COMMENTS_T);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[] | null>(null);

  /* A reply answers the newest comment that is not the account's own. */
  const last = lastVisible(thread.first, thread.replies);
  const target = last.is_ours ? thread.first : last;
  const length = Array.from(text.trim()).length;

  const send = async () => {
    if (!length || length > REPLY_MAX || busy) return;
    setBusy("send");
    setError(null);
    const r = await call(`/api/marketing/comments/${target.id}/reply`, { message: text });
    setBusy(null);
    if (!r.ok || !r.json?.comment) {
      /* No answer at all (the network dropped a send the server may have
         finished) or «already sent»: the reply may be in the thread — the
         caller reloads, so the truth shows even though this send looked lost. */
      if (!r.json || r.json.code === "duplicate") onReconcile?.();
      setError(refusal(t, r.json));
      return;
    }
    onChange(settle({ ...thread, replies: [...thread.replies, r.json.comment as CommentView] }));
    setText("");
    setIdeas(null);
    setOpen(false);
  };

  const suggest = async () => {
    if (busy) return;
    setBusy("suggest");
    setError(null);
    const r = await call(`/api/marketing/comments/${target.id}/suggest`, {});
    setBusy(null);
    const list = Array.isArray(r.json?.replies) ? (r.json!.replies as unknown[]).filter((x): x is string => typeof x === "string") : [];
    if (!r.ok || !list.length) { setIdeas(null); setError(r.ok ? t("suggestNone") : refusal(t, r.json)); return; }
    setIdeas(list);
  };

  const setHandled = async (handled: boolean) => {
    if (busy) return;
    setBusy("handled");
    setError(null);
    const r = await call(`/api/marketing/comments/${thread.first.id}/handled`, { handled });
    setBusy(null);
    if (!r.ok) { setError(refusal(t, r.json)); return; }
    const at = typeof r.json?.handled_at === "string" ? r.json.handled_at : null;
    const by = typeof r.json?.handled_by_name === "string" ? r.json.handled_by_name : null;
    onChange(settle({ ...thread, handled_at: at, handled_by_name: at ? by : null }));
  };

  const setHidden = async (c: CommentView, hidden: boolean) => {
    if (busy) return;
    setBusy(`hide:${c.id}`);
    setError(null);
    const r = await call(`/api/marketing/comments/${c.id}/hide`, { hidden });
    setBusy(null);
    if (!r.ok) { setError(refusal(t, r.json)); return; }
    const flip = (x: CommentView) => (x.id === c.id ? { ...x, hidden } : x);
    onChange(settle({ ...thread, first: flip(thread.first), replies: thread.replies.map(flip) }));
  };

  const line = (c: CommentView) => (
    <CommentLine
      c={c}
      accountName={accountName}
      accountAvatar={accountAvatar ?? null}
      t={t}
      action={canHide && !c.is_ours ? (
        <button type="button" className={textBtn} disabled={busy !== null} onClick={() => void setHidden(c, !c.hidden)} title={c.hidden ? undefined : t("hideHint")}>
          {c.hidden ? <EyeIcon size={12} /> : <EyeOffIcon size={12} />}{c.hidden ? t("unhide") : t("hide")}
        </button>
      ) : null}
    />
  );

  const answered = !thread.needs_reply && last.is_ours && !thread.first.hidden;
  const handledNow = !thread.needs_reply && !last.is_ours && !!thread.handled_at;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      {line(thread.first)}
      {thread.replies.length > 0 && (
        <ul className="ms-4 flex flex-col gap-2 border-s border-[var(--border-subtle)] ps-3">
          {thread.replies.map((r) => <li key={r.id}>{line(r)}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 ps-[38px]">
        {thread.needs_reply ? <StatusPill tone="warning">{t("waiting")}</StatusPill>
          : answered ? <StatusPill tone="success">{t("answered")}</StatusPill>
          : handledNow ? <StatusPill>{thread.handled_by_name ? t("handledBy").replace("{name}", thread.handled_by_name) : t("handled")}</StatusPill>
          : null}
        {canReply && !thread.first.hidden && (
          <>
            {!open && (
              <button type="button" className={textBtn} disabled={busy !== null} onClick={() => { setOpen(true); setError(null); }}>
                <ReplyIcon size={12} />{t("reply")}
              </button>
            )}
            {thread.needs_reply ? (
              <button type="button" className={textBtn} disabled={busy !== null} onClick={() => void setHandled(true)}>
                <CheckIcon size={12} />{t("noReply")}
              </button>
            ) : handledNow ? (
              <button type="button" className={textBtn} disabled={busy !== null} onClick={() => void setHandled(false)}>
                {t("needsAgain")}
              </button>
            ) : null}
          </>
        )}
      </div>

      {open && canReply && (
        <div className="flex flex-col gap-2 ps-[38px]">
          <textarea
            dir="auto"
            rows={3}
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            placeholder={t("replyAs").replace("{account}", accountName)}
            className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)] focus:outline-none"
          />
          {ideas && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] text-[var(--text-dim)]">{t("suggestPick")}</span>
              {ideas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  dir="auto"
                  onClick={() => setText(idea)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-start text-[12px] leading-[18px] text-[var(--text-primary)] hover:border-[var(--border-focus)]"
                >
                  {idea}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" disabled={busy !== null || !length || length > REPLY_MAX} onClick={() => void send()}>
              {busy === "send" ? t("sending") : t("send")}
            </Button>
            <Button type="button" variant="secondary" className="kx-ai-glow" disabled={busy !== null} onClick={() => void suggest()}>
              <SparklesIcon size={14} />{busy === "suggest" ? t("suggesting") : t("suggest")}
            </Button>
            <Button type="button" variant="ghost" disabled={busy === "send"} onClick={() => { setOpen(false); setIdeas(null); setError(null); }}>
              {t("cancel")}
            </Button>
            <span dir="ltr" className={`ms-auto text-[11px] tabular-nums ${length > REPLY_MAX ? "text-[#FF3333]" : "text-[var(--text-dim)]"}`}>
              {t("chars").replace("{n}", String(length)).replace("{max}", String(REPLY_MAX))}
            </span>
          </div>
        </div>
      )}

      {error && <p role="alert" dir="auto" className="ps-[38px] text-[12px] text-[#FF3333]">{error}</p>}
    </div>
  );
}

function CommentLine({ c, accountName, accountAvatar, t, action }: { c: CommentView; accountName: string; accountAvatar: string | null; t: Tr; action: ReactNode }) {
  const [bad, setBad] = useState(false);
  const name = c.is_ours ? accountName : c.author_name ?? t("someone");
  /* Our own comment carries the ACCOUNT's picture (Meta sends none for the
     page itself on Facebook, and never one on Instagram). */
  const avatar = c.is_ours ? accountAvatar : c.author_avatar_url;
  return (
    <div className={`flex gap-2.5 ${c.hidden ? "opacity-60" : ""}`}>
      {avatar && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="h-7 w-7 shrink-0 rounded-full bg-[var(--bg-surface-subtle)] object-cover" />
      ) : (
        <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${c.is_ours ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]"}`}>
          {Array.from(name)[0]?.toUpperCase() ?? "?"}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[12px] font-semibold text-[var(--text-primary)]">{name}</span>
          {c.is_ours && c.replied_by_name && <span className="text-[11px] text-[var(--text-dim)]">{t("by").replace("{name}", c.replied_by_name)}</span>}
          {c.hidden && <StatusPill>{t("hiddenTag")}</StatusPill>}
          {c.commented_at && <span dir="ltr" className="text-[11px] tabular-nums text-[var(--text-dim)]">{dmyHm(c.commented_at)}</span>}
          {action && <span className="ms-auto">{action}</span>}
        </div>
        {c.message && <p dir="auto" className="mt-0.5 whitespace-pre-wrap break-words text-[12px] leading-[18px] text-[var(--text-muted)]">{c.message}</p>}
      </div>
    </div>
  );
}
