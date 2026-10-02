"use client";

/* ---------------------------------------------------------------------------
   SocialMessages — the Messages tab (owner, 29/09/2026): the customers'
   private conversations on the connected Facebook Page (Messenger) and
   Instagram account, those waiting for an answer first.

   Desktop: the conversations on one side, the open one beside them. Phone:
   the list, and a conversation opens full width with a way back. Answering
   happens in place — the server checks the same rights and Meta's 24-hour
   window, and the screen says plainly when answering must happen on the
   platform. Koleex AI can draft an answer (suggestions only). The tab's
   number follows every change (publishMessagesCount).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MarketingHeader, { publishMessagesCount } from "@/components/marketing/MarketingHeader";
import Button from "@/components/kds/Button";
import EmptyState from "@/components/kds/EmptyState";
import StatusPill from "@/components/kds/StatusPill";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import { useTranslation } from "@/lib/i18n";
import { MESSAGES_T } from "@/lib/marketing/messages-i18n";
import { dmyHm } from "@/lib/marketing/format";
import { SPACE_ROUTE, accountLabel, type MarketingAccountView, type MarketingSpace } from "@/lib/marketing/spaces";
import {
  MESSAGE_MAX, canReplyNow, conversationNeedsReply, platformInboxUrl, replyWindowEnd,
  type ConversationView, type MessageAttachment, type MessageFilter, type MessageView,
} from "@/lib/marketing/message-types";

type ListResponse = { conversations: ConversationView[]; next: number | null; counts: { needs: number }; canReply: boolean };
type Detail = { conversation: ConversationView; messages: MessageView[]; canReply: boolean };
type Json = Record<string, unknown> | null;
type Tr = (k: string) => string;

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
  if (code && MESSAGES_T[`err.${code}`]) return t(`err.${code}`);
  if (code === "platform" && typeof json?.error === "string") return json.error;
  return t("err.failed");
}

/** The conversation after a change, «Needs a reply» decided again by the
 *  rule the server counts with. */
const settle = (c: ConversationView): ConversationView => ({
  ...c,
  needs_reply: conversationNeedsReply(c),
  window_ends_at: replyWindowEnd(c.last_customer_at),
});

const who = (c: ConversationView, t: Tr) => c.customer.name || (c.customer.username ? `@${c.customer.username}` : t("someone"));

export default function SocialMessages({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(MESSAGES_T);
  const router = useRouter();
  const [filter, setFilter] = useState<MessageFilter>("needs");
  const [account, setAccount] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MarketingAccountView[] | null>(null);
  /* The accounts could not be read: no chips, and no «connect one» either. */
  const [accountsFailed, setAccountsFailed] = useState(false);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [moreBusy, setMoreBusy] = useState(false);

  const url = useCallback((cursor: number) =>
    `/api/marketing/messages?space=${space}&filter=${filter}${account ? `&account=${account}` : ""}&cursor=${cursor}`, [space, filter, account]);

  const load = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch(url(0), { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as ListResponse);
    } catch {
      setError(true);
    }
  }, [url]);

  useEffect(() => { setData(null); void load(); }, [load]);

  /* A bell notice's link opens its conversation (?c=<id>): the list has it
     → it opens; answered already (not under «Needs a reply») → the filter
     flips to «All» once; gone from the window → nothing opens. */
  const [wanted, setWanted] = useState<string | null>(null);
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("c");
    if (c) { setWanted(c); window.history.replaceState(null, "", window.location.pathname); }
  }, []);
  useEffect(() => {
    if (!wanted || !data) return;
    if (data.conversations.some((c) => c.id === wanted)) { setOpenId(wanted); setWanted(null); }
    else if (filter !== "all") setFilter("all");
    else setWanted(null);
  }, [wanted, data, filter]);

  /* The tab's number: only the all-accounts count is the tab's. */
  const needsNow = data?.counts.needs ?? null;
  useEffect(() => {
    if (needsNow !== null && !account) publishMessagesCount(space, needsNow);
  }, [needsNow, account, space]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/marketing/accounts?space=${space}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ accounts?: MarketingAccountView[] }>) : Promise.reject(new Error(String(res.status)))))
      .then((body) => { if (alive) setAccounts((body.accounts ?? []).filter((a) => a.connection === "api" && (a.platform === "facebook" || a.platform === "instagram"))); },
        () => { if (alive) { setAccountsFailed(true); setAccounts([]); } });
    return () => { alive = false; };
  }, [space]);

  const refresh = async () => {
    setRefreshing(true);
    await call("/api/marketing/messages/refresh", { space });
    await load();
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (!data?.next || moreBusy) return;
    setMoreBusy(true);
    try {
      const res = await fetch(url(data.next), { cache: "no-store" });
      if (res.ok) {
        const page = (await res.json()) as ListResponse;
        setData((d) => (d ? { ...page, conversations: [...d.conversations, ...page.conversations.filter((c) => !d.conversations.some((x) => x.id === c.id))] } : page));
      }
    } finally {
      setMoreBusy(false);
    }
  };

  /* A conversation changed in the open pane: the list follows, and so does
     the count (the rule decides again). Shown for one account, the count is
     that account's — the tab's number is read again instead. */
  const onChanged = (c: ConversationView) => {
    setData((d) => {
      if (!d) return d;
      const before = d.conversations.find((x) => x.id === c.id);
      const delta = before ? Number(c.needs_reply) - Number(before.needs_reply) : 0;
      return { ...d, conversations: d.conversations.map((x) => (x.id === c.id ? c : x)), counts: { needs: Math.max(0, d.counts.needs + delta) } };
    });
    if (account) {
      fetch(`/api/marketing/messages/count?space=${space}`, { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ needs?: unknown }>) : null))
        .then((body) => { if (typeof body?.needs === "number") publishMessagesCount(space, body.needs); }, () => {});
    }
  };

  const list = data?.conversations ?? [];

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <MarketingHeader
        space={space}
        action={
          <Button type="button" variant="secondary" disabled={refreshing} onClick={() => void refresh()}>
            <RefreshCwIcon size={14} className={refreshing ? "motion-safe:animate-spin" : ""} />{refreshing ? t("refreshing") : t("refresh")}
          </Button>
        }
      />

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("filters")} className="flex flex-wrap gap-2">
            <Chip on={filter === "needs"} onClick={() => { setFilter("needs"); setOpenId(null); }}>
              {t("f.needs")}{needsNow ? <span className="rounded-full bg-[var(--bg-inverted)] px-1.5 text-[10px] leading-4 text-[var(--text-inverted)] tabular-nums">{needsNow}</span> : null}
            </Chip>
            <Chip on={filter === "all"} onClick={() => { setFilter("all"); setOpenId(null); }}>{t("f.all")}</Chip>
          </div>
          {accounts && accounts.length > 1 && (
            <div role="group" aria-label={t("accounts")} className="flex flex-wrap gap-2 md:ms-auto">
              <Chip on={account === null} onClick={() => { setAccount(null); setOpenId(null); }}>{t("allAccounts")}</Chip>
              {accounts.map((a) => (
                <Chip key={a.id} on={account === a.id} onClick={() => { setAccount(a.id); setOpenId(null); }}>
                  <BrandGlyph name={a.platform} size={13} /><span className="truncate"><bdi>{accountLabel(a)}</bdi></span>
                </Chip>
              ))}
            </div>
          )}
        </div>

        {error && !data ? (
          <EmptyState title={t("loadError")} action={<Button type="button" variant="secondary" onClick={() => void load()}>{t("retry")}</Button>} />
        ) : !data || accounts === null ? (
          <div aria-busy="true" className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] rounded-xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)}</div>
            <div className="hidden h-[420px] rounded-2xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse lg:block" />
          </div>
        ) : accounts.length === 0 && !accountsFailed ? (
          <EmptyState title={t("empty")} hint={t("emptyHint")} action={<Button type="button" variant="secondary" onClick={() => router.push(SPACE_ROUTE[space])}>{t("openAccounts")}</Button>} />
        ) : (
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <section aria-label={t("list")} className={`flex min-w-0 flex-col gap-2 ${openId ? "hidden lg:flex" : ""}`}>
              {list.length === 0 ? (
                <EmptyState title={t(`none.${filter}`)} hint={t("none.hint")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {list.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        aria-current={openId === c.id ? "true" : undefined}
                        className={`flex w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-start transition-colors ${openId === c.id ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-focus)]"}`}
                      >
                        <Avatar name={who(c, t)} url={c.customer.avatar_url} />
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]"><bdi>{who(c, t)}</bdi></span>
                            <BrandGlyph name={c.account.platform} size={12} />
                            {c.last_message_at && <span dir="ltr" className="ms-auto shrink-0 text-[11px] tabular-nums text-[var(--text-dim)]">{dmyHm(c.last_message_at)}</span>}
                          </span>
                          <span dir="auto" className="line-clamp-1 break-words text-[12px] text-[var(--text-muted)]">{c.snippet ?? t("attachment")}</span>
                          {c.needs_reply && <span className="mt-0.5"><StatusPill tone="warning">{t("waiting")}</StatusPill></span>}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {data.next !== null && <Button type="button" variant="secondary" disabled={moreBusy} onClick={() => void loadMore()}>{t("more")}</Button>}
            </section>

            <section className={`min-w-0 ${openId ? "" : "hidden lg:block"}`}>
              {openId ? (
                <ConversationPane key={openId} id={openId} t={t} onBack={() => setOpenId(null)} onChanged={onChanged} />
              ) : (
                <p className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center text-[13px] text-[var(--text-muted)]">{t("pick")}</p>
              )}
            </section>
          </div>
        )}
        {data && list.length > 0 && <p className="text-center text-[11px] text-[var(--text-dim)]">{t("tz")}</p>}
      </div>
    </div>
  );
}

function ConversationPane({ id, t, onBack, onChanged }: { id: string; t: Tr; onBack: () => void; onChanged: (c: ConversationView) => void }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"send" | "suggest" | "handled" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ideas, setIdeas] = useState<string[] | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/marketing/messages/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as Detail;
        if (alive) setDetail(body);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [id]);

  /* The newest message in view. */
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [detail?.messages.length]);

  if (failed) return <p role="alert" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 text-[13px] text-[#FF3333]">{t("loadError")}</p>;
  if (!detail) return <div aria-busy="true" className="h-[420px] rounded-2xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />;

  const c = detail.conversation;
  const platform = t(`kind.${c.account.platform}`);
  const open = canReplyNow(c.last_customer_at);
  const length = Array.from(text.trim()).length;
  const update = (next: ConversationView) => { const s = settle(next); setDetail((d) => (d ? { ...d, conversation: s } : d)); onChanged(s); };

  const send = async () => {
    if (!length || length > MESSAGE_MAX || busy) return;
    setBusy("send");
    setError(null);
    const r = await call(`/api/marketing/messages/${c.id}/reply`, { message: text });
    setBusy(null);
    if (!r.ok || !r.json?.message) { setError(refusal(t, r.json)); return; }
    const m = r.json.message as MessageView;
    setDetail((d) => (d ? { ...d, messages: [...d.messages, m] } : d));
    update({ ...c, last_from_us: true, last_message_at: m.sent_at ?? new Date().toISOString(), snippet: m.text });
    setText("");
    setIdeas(null);
  };

  const suggest = async () => {
    if (busy) return;
    setBusy("suggest");
    setError(null);
    const r = await call(`/api/marketing/messages/${c.id}/suggest`, {});
    setBusy(null);
    const list = Array.isArray(r.json?.replies) ? (r.json!.replies as unknown[]).filter((x): x is string => typeof x === "string") : [];
    if (!r.ok || !list.length) { setIdeas(null); setError(r.ok ? t("suggestNone") : refusal(t, r.json)); return; }
    setIdeas(list);
  };

  const setHandled = async (handled: boolean) => {
    if (busy) return;
    setBusy("handled");
    setError(null);
    const r = await call(`/api/marketing/messages/${c.id}/handled`, { handled });
    setBusy(null);
    if (!r.ok) { setError(refusal(t, r.json)); return; }
    const at = typeof r.json?.handled_at === "string" ? r.json.handled_at : null;
    update({ ...c, handled_at: at, handled_by_name: at && typeof r.json?.handled_by_name === "string" ? r.json.handled_by_name : null });
  };

  const handledNow = !c.needs_reply && !c.last_from_us && !!c.handled_at;

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
      <header className="flex min-w-0 items-center gap-2.5 border-b border-[var(--border-subtle)] p-3">
        <Button type="button" variant="iconSecondary" aria-label={t("back")} onClick={onBack} className="lg:hidden">
          <AngleLeftIcon size={14} className="rtl:rotate-180" />
        </Button>
        <Avatar name={who(c, t)} url={c.customer.avatar_url} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold text-[var(--text-primary)]"><bdi>{who(c, t)}</bdi></span>
          <span className="flex min-w-0 items-center gap-1 text-[12px] text-[var(--text-muted)]">
            <BrandGlyph name={c.account.platform} size={12} className="shrink-0" /><span dir="auto" className="truncate">{platform} · {accountLabel(c.account)}</span>
          </span>
        </span>
        <span className="shrink-0">
          {c.needs_reply ? <StatusPill tone="warning">{t("waiting")}</StatusPill>
            : c.last_from_us ? <StatusPill tone="success">{t("answered")}</StatusPill>
            : handledNow ? <StatusPill>{c.handled_by_name ? t("handledBy").replace("{name}", c.handled_by_name) : t("handled")}</StatusPill> : null}
        </span>
      </header>

      <div ref={scroller} className="flex max-h-[55vh] min-h-[240px] flex-col gap-2 overflow-y-auto p-3">
        {detail.messages.map((m) => <Bubble key={m.id} m={m} t={t} />)}
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] p-3">
        {!detail.canReply ? (
          <p className="text-[12px] text-[var(--text-dim)]">{t("viewOnly")}</p>
        ) : !open ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-[12px] text-[#F59E0B]">{t("windowClosed").replace("{platform}", platform)}</p>
            <Button type="button" variant="secondary" onClick={() => window.open(platformInboxUrl(c.account), "_blank", "noopener,noreferrer")}>
              <ExternalLinkIcon size={14} />{t("openOn").replace("{platform}", platform)}
            </Button>
          </div>
        ) : (
          <>
            <textarea
              dir="auto"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("replyAs").replace("{account}", accountLabel(c.account))}
              className="w-full resize-y rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[13px] leading-5 text-[var(--text-primary)] placeholder:text-[var(--text-dim)] focus:border-[var(--border-focus)] focus:outline-none"
            />
            {ideas && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] text-[var(--text-dim)]">{t("suggestPick")}</span>
                {ideas.map((idea, i) => (
                  <button key={i} type="button" dir="auto" onClick={() => setText(idea)}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-start text-[12px] leading-[18px] text-[var(--text-primary)] hover:border-[var(--border-focus)]">
                    {idea}
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" disabled={busy !== null || !length || length > MESSAGE_MAX} onClick={() => void send()}>{busy === "send" ? t("sending") : t("send")}</Button>
              <Button type="button" variant="secondary" className="kx-ai-glow" disabled={busy !== null} onClick={() => void suggest()}>
                <SparklesIcon size={14} />{busy === "suggest" ? t("suggesting") : t("suggest")}
              </Button>
              <span dir="ltr" className={`ms-auto text-[11px] tabular-nums ${length > MESSAGE_MAX ? "text-[#FF3333]" : "text-[var(--text-dim)]"}`}>
                {t("chars").replace("{n}", String(length)).replace("{max}", String(MESSAGE_MAX))}
              </span>
            </div>
            {c.window_ends_at && <p className="text-[11px] text-[var(--text-dim)]">{t("windowOpen")} <span dir="ltr" className="tabular-nums">{dmyHm(c.window_ends_at)}</span></p>}
          </>
        )}
        {detail.canReply && (c.needs_reply || handledNow) && (
          <div>
            <button type="button" disabled={busy !== null} onClick={() => void setHandled(c.needs_reply)}
              className="inline-flex items-center gap-1 rounded-md px-1 text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-50">
              {c.needs_reply ? <><CheckIcon size={12} />{t("noReply")}</> : t("needsAgain")}
            </button>
          </div>
        )}
        {error && <p role="alert" dir="auto" className="text-[12px] text-[#FF3333]">{error}</p>}
      </div>
    </div>
  );
}

function Bubble({ m, t }: { m: MessageView; t: Tr }) {
  return (
    <div className={`flex max-w-[85%] flex-col gap-1 ${m.from_us ? "items-end self-end" : "items-start self-start"}`}>
      {(m.text || m.attachments.length > 0) && (
        <div className={`flex flex-col gap-1.5 rounded-2xl px-3 py-2 text-[13px] leading-5 ${m.from_us ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"}`}>
          {m.text && <p dir="auto" className="whitespace-pre-wrap break-words">{m.text}</p>}
          {m.attachments.map((a, i) => <Attachment key={i} a={a} t={t} />)}
        </div>
      )}
      <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-dim)]">
        {m.from_us && m.sent_by_name && <span>{t("by").replace("{name}", m.sent_by_name)}</span>}
        {m.sent_at && <span dir="ltr" className="tabular-nums">{dmyHm(m.sent_at)}</span>}
      </span>
    </div>
  );
}

/* Meta's picture links expire: a picture that no longer loads becomes a
   link to it, never a broken image. */
function Attachment({ a, t }: { a: MessageAttachment; t: Tr }) {
  const [bad, setBad] = useState(false);
  if (a.kind === "image" && !bad) {
    return (
      <a href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="max-h-48 w-auto max-w-full object-cover" />
      </a>
    );
  }
  return (
    <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[12px] underline">
      <PaperclipIcon size={12} />{a.name || t("openFile")}
    </a>
  );
}

/* The customer's picture from Meta; its first letter while there is none or
   once Meta's link has expired. */
function Avatar({ name, url }: { name: string; url: string | null }) {
  const [bad, setBad] = useState(false);
  if (url && !bad) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} className="h-9 w-9 shrink-0 rounded-full bg-[var(--bg-surface-subtle)] object-cover" />;
  }
  return <Initial name={name} />;
}

function Initial({ name }: { name: string }) {
  return (
    <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--bg-surface-subtle)] text-[13px] font-semibold text-[var(--text-muted)]">
      {Array.from(name.replace(/^@/, ""))[0]?.toUpperCase() ?? "?"}
    </span>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-9 max-w-[220px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
        on ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      }`}
    >
      {children}
    </button>
  );
}
