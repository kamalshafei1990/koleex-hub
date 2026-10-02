"use client";

/* ---------------------------------------------------------------------------
   SocialComments — the Comments tab: comment threads on the space's posts
   (the last 90 days), newest activity first. «Needs a reply» first — the
   threads where the customer spoke last — then All, and Hidden for the
   people who may hide. Each thread answers in place (CommentThread). A
   thread answered while «Needs a reply» is open stays where it is, marked
   answered, until the list is loaded again: nothing jumps under the reader.
   Refresh brings in new comments now; the cron does it every 15 minutes.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import MarketingHeader, { publishCommentsCount } from "@/components/marketing/MarketingHeader";
import CommentThread, { type ThreadState } from "@/components/marketing/CommentThread";
import Button from "@/components/kds/Button";
import EmptyState from "@/components/kds/EmptyState";
import StatusPill from "@/components/kds/StatusPill";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import { useTranslation } from "@/lib/i18n";
import { COMMENTS_T } from "@/lib/marketing/comments-i18n";
import { dmyHm } from "@/lib/marketing/format";
import { accountLabel, type MarketingAccountView, type MarketingSpace } from "@/lib/marketing/spaces";
import type { CommentFilter, CommentThread as Thread } from "@/lib/marketing/comment-types";
import type { PostDetail } from "@/lib/marketing/feed-types";

type ListResponse = { threads: Thread[]; next: number | null; counts: { needs: number; hidden: number }; canReply: boolean; canHide: boolean };

const PLATFORM_NAME: Record<string, string> = {
  facebook: "Facebook", instagram: "Instagram", linkedin: "LinkedIn", youtube: "YouTube", tiktok: "TikTok", x: "X", wechat: "WeChat", whatsapp: "WhatsApp", douyin: "Douyin",
};

export default function SocialComments({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(COMMENTS_T);
  const [filter, setFilter] = useState<CommentFilter>("needs");
  const [account, setAccount] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<MarketingAccountView[] | null>(null);
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const url = useCallback((cursor: number) => {
    const q = new URLSearchParams({ space, filter, cursor: String(cursor) });
    if (account) q.set("account", account);
    return `/api/marketing/comments?${q}`;
  }, [space, filter, account]);

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

  /* A bell notice's link opens its thread (?t=<id>): found in the list →
     scrolled to and flashed; answered already (not under «Needs a reply») →
     the filter flips to «All» once; gone from the window → nothing opens. */
  const [wanted, setWanted] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  useEffect(() => {
    const tid = new URLSearchParams(window.location.search).get("t");
    if (tid) { setWanted(tid); window.history.replaceState(null, "", window.location.pathname); }
  }, []);
  useEffect(() => {
    if (!wanted || !data) return;
    if (data.threads.some((th) => th.id === wanted)) { setFlash(wanted); setWanted(null); }
    else if (filter !== "all") setFilter("all");
    else setWanted(null);
  }, [wanted, data, filter]);
  useEffect(() => {
    if (!flash) return;
    document.querySelector(`[data-thread-id="${flash}"]`)?.scrollIntoView({ block: "center" });
    const off = window.setTimeout(() => setFlash(null), 2500);
    return () => window.clearTimeout(off);
  }, [flash]);

  /* The header's number follows the list's — told after the render, never
     from inside a state update. Only the all-accounts count is the tab's. */
  const needsNow = data?.counts.needs ?? null;
  useEffect(() => {
    if (needsNow !== null && !account) publishCommentsCount(space, needsNow);
  }, [needsNow, account, space]);

  useEffect(() => {
    let alive = true;
    fetch(`/api/marketing/accounts?space=${space}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<{ accounts?: MarketingAccountView[] }>) : Promise.reject(new Error(String(res.status)))))
      .then((body) => { if (alive) setAccounts((body.accounts ?? []).filter((a) => a.connection === "api")); }, () => { if (alive) setAccounts([]); });
    return () => { alive = false; };
  }, [space]);

  const loadMore = async () => {
    if (data?.next == null) return;
    setMore(true);
    try {
      const res = await fetch(url(data.next), { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as ListResponse;
      setData((prev) => (prev ? { ...page, threads: [...prev.threads, ...page.threads.filter((x) => !prev.threads.some((y) => y.id === x.id))] } : page));
    } catch {
      setError(true);
    } finally {
      setMore(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      await fetch("/api/marketing/comments/refresh", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ space }) });
    } catch { /* the list below still reloads what the Hub has */ }
    await load();
    setRefreshing(false);
  };

  /* A thread changed in place: the counts follow, the list does not move. */
  const changed = (id: string, next: ThreadState) => {
    setData((prev) => {
      if (!prev) return prev;
      const before = prev.threads.find((x) => x.id === id);
      if (!before) return prev;
      const delta = Number(next.needs_reply) - Number(before.needs_reply);
      const hiddenDelta = Number(next.first.hidden || next.replies.some((r) => r.hidden)) - Number(before.first.hidden || before.replies.some((r) => r.hidden));
      const counts = { needs: Math.max(0, prev.counts.needs + delta), hidden: Math.max(0, prev.counts.hidden + hiddenDelta) };
      return { ...prev, counts, threads: prev.threads.map((x) => (x.id === id ? { ...x, ...next } : x)) };
    });
  };

  const filters: CommentFilter[] = data?.canHide ? ["needs", "all", "hidden"] : ["needs", "all"];
  const count = (f: CommentFilter) => (f === "needs" ? data?.counts.needs : f === "hidden" ? data?.counts.hidden : undefined);

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
            {filters.map((f) => {
              const n = count(f);
              const on = filter === f;
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f)}
                  className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                    on ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {t(`f.${f}`)}
                  {!!n && <span className={`min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums ${f === "needs" ? "bg-[#567FB2] text-white" : "bg-[var(--bg-inverted)]/[0.08] text-[var(--text-muted)]"}`}>{n}</span>}
                </button>
              );
            })}
          </div>
          {accounts && accounts.length > 1 && (
            <div role="group" aria-label={t("accounts")} className="flex flex-wrap gap-2 md:ms-auto">
              {[null, ...accounts.map((a) => a.id)].map((id) => {
                const a = id ? accounts.find((x) => x.id === id) : null;
                const on = account === id;
                return (
                  <button
                    key={id ?? "all"}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAccount(id)}
                    className={`inline-flex h-9 max-w-[220px] items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                      on ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]" : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {a && <BrandGlyph name={a.platform} size={13} />}
                    <span className="truncate">{a ? <bdi>{accountLabel(a)}</bdi> : t("allAccounts")}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error && !data ? (
          <EmptyState title={t("loadError")} action={<Button type="button" variant="secondary" onClick={() => void load()}>{t("retry")}</Button>} />
        ) : !data ? (
          <ul aria-busy="true" className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {[0, 1, 2, 3].map((i) => <li key={i} className="h-[148px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)}
          </ul>
        ) : data.threads.length === 0 ? (
          <EmptyState title={t(`empty.${filter}`)} hint={t("empty.hint")} />
        ) : (
          <ul className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {data.threads.map((th) => (
              <li key={th.id} data-thread-id={th.id} className={`min-w-0 rounded-2xl border bg-[var(--bg-surface)] p-3 transition-shadow md:p-4 ${flash === th.id ? "border-[var(--border-focus)] shadow-[0_0_0_3px_var(--border-focus)]" : "border-[var(--border-subtle)]"}`}>
                <ThreadHeader thread={th} t={t} />
                <div className="mt-3">
                  <CommentThread
                    thread={th}
                    accountName={accountLabel(th.account)}
                    accountAvatar={th.account.avatar_url}
                    canReply={data.canReply}
                    canHide={data.canHide}
                    onChange={(next) => changed(th.id, next)}
                    onReconcile={() => void load()}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        {data?.next != null && (
          <div className="flex justify-center">
            <Button type="button" variant="secondary" disabled={more} onClick={() => void loadMore()}>{t("more")}</Button>
          </div>
        )}
        {data && data.threads.length > 0 && <p className="text-center text-[11px] text-[var(--text-dim)]">{t("tz")}</p>}
      </div>
    </div>
  );
}

function ThreadHeader({ thread, t }: { thread: Thread; t: (k: string) => string }) {
  const p = thread.post;
  const platform = PLATFORM_NAME[thread.account.platform] ?? thread.account.platform;
  return (
    <div className="flex min-w-0 items-start gap-2.5 border-b border-[var(--border-subtle)] pb-3">
      <PostThumb key={p?.thumb ?? "none"} post={p} platform={thread.account.platform} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-[var(--text-primary)]">
          <BrandGlyph name={thread.account.platform} size={12} />
          <span className="truncate"><bdi>{accountLabel(thread.account)}</bdi></span>
          {p?.is_ad && <StatusPill tone="brand" className="shrink-0">{t("ad")}</StatusPill>}
          {p?.posted_at && <span className="shrink-0 font-normal text-[var(--text-dim)]">· <span dir="ltr" className="tabular-nums">{dmyHm(p.posted_at)}</span></span>}
        </span>
        <span dir="auto" className="line-clamp-1 break-words text-[12px] text-[var(--text-muted)]">
          {p?.is_ad ? t("onAd") : t("onPost")}: {p?.excerpt ?? "—"}
        </span>
      </span>
      {p?.permalink && (
        <a href={p.permalink} target="_blank" rel="noopener noreferrer" aria-label={t("openOn").replace("{platform}", platform)} className="shrink-0 rounded-md p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
          <ExternalLinkIcon size={14} />
        </a>
      )}
    </div>
  );
}

/* The post's picture. The platforms' picture links stop working after some
   days: a broken one is fetched again once, the way the Feed does, and if
   that fails too the platform's mark stands in — never an empty square. */
function PostThumb({ post, platform }: { post: Thread["post"]; platform: string }) {
  const [src, setSrc] = useState(post?.thumb ?? null);
  const [failed, setFailed] = useState(false);
  const repaired = useRef(false);

  const onError = async () => {
    /* An ad's picture is not a Feed post's: no second fetch, the mark stands in. */
    if (!post || post.is_ad || repaired.current) { setFailed(true); return; }
    repaired.current = true;
    try {
      const res = await fetch(`/api/marketing/feed/${post.id}?part=media`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = ((await res.json()) as PostDetail).post.thumb?.url;
      if (!next || next === src) throw new Error("unchanged");
      setSrc(next);
    } catch {
      setFailed(true);
    }
  };

  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--bg-surface-subtle)]">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => void onError()} className="h-full w-full object-cover" />
      ) : (
        <BrandGlyph name={platform} size={18} />
      )}
    </span>
  );
}
