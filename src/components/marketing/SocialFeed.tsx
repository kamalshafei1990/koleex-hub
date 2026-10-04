"use client";

/* ---------------------------------------------------------------------------
   SocialFeed — the Feed of a marketing space (plan v7, owner-approved: "a
   column for each account, like Odoo"). Each Facebook Page and Instagram
   account is a column: its followers and the change this week, then its
   posts with their numbers, the earlier ones too. A post opens with its
   whole text, its pictures and its comments.

   Freshness: the screen paints what the Hub has at once (and, coming back
   to it, the last answer of this session), then refreshes the accounts the
   answer marks stale — two at a time — redrawing each column as its refresh
   ends. A column's Refresh button forces one (at most once a minute).

   Layout — fits every screen and never slides sideways: the columns sit
   side by side when the Feed is wide enough to give each 280px (a container
   query picked by the number of accounts, so it is decided in CSS on the
   first paint); narrower than that, one column at a time with the accounts
   as chips above it. Inside a column the posts run in 1–4 columns of cards
   by the column's own width.

   Pictures: Meta's picture links expire after some days. A picture that
   fails asks for its post's pictures again, once; then a placeholder.

   Above the columns: the week's plan in one line (PlanFeedCard, fixed
   height from its first frame).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { CaptureButton } from "@/components/marketing/QuickCapture";
import Button from "@/components/kds/Button";
import StatusPill from "@/components/kds/StatusPill";
import EmptyState from "@/components/kds/EmptyState";
import Modal from "@/components/kds/Modal";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import BookmarkIcon from "@/components/icons/ui/BookmarkIcon";
import CommentIcon from "@/components/icons/ui/CommentIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import HeartIcon from "@/components/icons/ui/HeartIcon";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import RefreshCwIcon from "@/components/icons/ui/RefreshCwIcon";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ThumbsUpIcon from "@/components/icons/ui/ThumbsUpIcon";
import TrendingDownIcon from "@/components/icons/ui/TrendingDownIcon";
import TrendingUpIcon from "@/components/icons/ui/TrendingUpIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { compact, dmyHm } from "@/lib/marketing/format";
import { SPACE_ROUTE, type MarketingAccountView, type MarketingSpace } from "@/lib/marketing/spaces";
import type { FeedColumn, FeedComment, FeedPost, FeedResponse, PostDetail } from "@/lib/marketing/feed-types";
import CommentThread, { type ThreadState } from "@/components/marketing/CommentThread";
import PlanFeedCard from "@/components/marketing/PlanFeedCard";
import { groupThreads, needsReply } from "@/lib/marketing/comment-types";

const T: Translations = {
  "loadError":      { en: "Could not load the Feed.", zh: "无法加载动态。", ar: "تعذّر تحميل الـFeed." },
  "refreshError":   { en: "Could not refresh the Feed. What you see is the last copy the Hub has.", zh: "无法刷新动态。您看到的是 Hub 保存的最新副本。", ar: "تعذّر تحديث الـFeed. ما تراه هو آخر نسخة لدى الـHub." },
  "retry":          { en: "Try again", zh: "重试", ar: "إعادة المحاولة" },
  "empty.title":    { en: "No account to show yet", zh: "还没有可显示的账号", ar: "لا توجد حسابات لعرضها بعد" },
  "empty.hint":     { en: "Add a Facebook Page or an Instagram account, and its posts and numbers appear here, the earlier ones too.", zh: "添加 Facebook 主页或 Instagram 账号后，其帖子和数据（包括以往的帖子）会显示在这里。", ar: "أضف صفحة Facebook أو حساب Instagram، وستظهر هنا منشوراته وأرقامه، ومنها المنشورات السابقة." },
  "empty.action":   { en: "Add account", zh: "添加账号", ar: "إضافة حساب" },
  "manual.note":    { en: "Accounts shared by hand (WeChat, WhatsApp, Douyin) have no posts to read, so they are not in the Feed.", zh: "手动分享的账号（微信、WhatsApp、抖音）没有可读取的帖子，因此不在动态中显示。", ar: "الحسابات التي تُشارك يدويًا (WeChat وWhatsApp وDouyin) ليس لها منشورات يمكن قراءتها، لذلك لا تظهر في الـFeed." },
  "publishOnly.note": { en: "LinkedIn is for publishing only: it sends no posts or numbers back, so it is not in the Feed. Each post keeps its LinkedIn link.", zh: "LinkedIn 仅用于发布：它不会回传帖子或数据，因此不在动态中显示。每条帖子都保留其 LinkedIn 链接。", ar: "LinkedIn للنشر فقط: لا يرسل المنشورات أو الأرقام، لذلك لا يظهر في الـFeed. ويحتفظ كل منشور برابطه على LinkedIn." },
  "chips.label":    { en: "Accounts", zh: "账号", ar: "الحسابات" },
  "followers":      { en: "followers", zh: "位粉丝", ar: "متابع" },
  "thisWeek":       { en: "this week", zh: "本周", ar: "هذا الأسبوع" },
  "week.summary":   { en: "Posts in 7 days: {posts} · Engagement: {eng}", zh: "7 天内帖子：{posts} · 互动：{eng}", ar: "منشورات آخر 7 أيام: {posts} · التفاعل: {eng}" },
  "synced":         { en: "Updated {when}", zh: "更新于 {when}", ar: "آخر تحديث: {when}" },
  "syncing":        { en: "Updating…", zh: "正在更新…", ar: "جارٍ التحديث…" },
  "importing":      { en: "Bringing the posts from {platform}…", zh: "正在从 {platform} 获取帖子…", ar: "جارٍ جلب المنشورات من {platform}…" },
  "notSynced":      { en: "Not updated yet", zh: "尚未更新", ar: "لم يُحدَّث بعد" },
  "refresh":        { en: "Refresh", zh: "刷新", ar: "تحديث" },
  "reconnect":      { en: "Reconnect it in Accounts", zh: "在“账号”中重新连接", ar: "أعد ربطه من الحسابات" },
  "status.expired": { en: "Key expired", zh: "密钥已过期", ar: "انتهى المفتاح" },
  "status.revoked": { en: "Access removed", zh: "访问已撤销", ar: "أُلغي الوصول" },
  "status.error":   { en: "Needs attention", zh: "需要处理", ar: "يحتاج متابعة" },
  "posts.empty":    { en: "No posts yet", zh: "还没有帖子", ar: "لا توجد منشورات بعد" },
  "loadMore":       { en: "Show older posts", zh: "显示更早的帖子", ar: "عرض المنشورات الأقدم" },
  "loadingMore":    { en: "Loading…", zh: "正在加载…", ar: "جارٍ التحميل…" },
  "loadMoreFailed": { en: "Could not load older posts.", zh: "无法加载更早的帖子。", ar: "تعذّر تحميل المنشورات الأقدم." },
  "video":          { en: "Video", zh: "视频", ar: "فيديو" },
  "photos":         { en: "{n} photos", zh: "{n} 张图片", ar: "{n} صور" },
  "pname.facebook": { en: "Facebook", zh: "Facebook", ar: "Facebook" },
  "pname.instagram": { en: "Instagram", zh: "Instagram", ar: "Instagram" },
  "kind.facebook":  { en: "Facebook Page", zh: "Facebook 主页", ar: "صفحة Facebook" },
  "kind.instagram": { en: "Instagram account", zh: "Instagram 账号", ar: "حساب Instagram" },
  "m.reactions":    { en: "Reactions", zh: "心情", ar: "التفاعلات" },
  "m.likes":        { en: "Likes", zh: "赞", ar: "الإعجابات" },
  "m.comments":     { en: "Comments", zh: "评论", ar: "التعليقات" },
  "m.shares":       { en: "Shares", zh: "分享", ar: "المشاركات" },
  "m.views":        { en: "Views", zh: "观看", ar: "المشاهدات" },
  "m.reach":        { en: "Reached", zh: "覆盖人数", ar: "الوصول" },
  "m.saved":        { en: "Saved", zh: "收藏", ar: "الحفظ" },
  "openOn":         { en: "Open on {platform}", zh: "在 {platform} 中打开", ar: "فتح على {platform}" },
  "watchOn":        { en: "Play it on {platform}", zh: "在 {platform} 中播放", ar: "شغّله على {platform}" },
  "photoN":         { en: "Picture {n}", zh: "第 {n} 张图片", ar: "الصورة {n}" },
  "comments":       { en: "Comments", zh: "评论", ar: "التعليقات" },
  "noComments":     { en: "No comments yet", zh: "还没有评论", ar: "لا توجد تعليقات بعد" },
  "commentsError":  { en: "Could not load the comments.", zh: "无法加载评论。", ar: "تعذّر تحميل التعليقات." },
  "ours":           { en: "Our reply", zh: "我们的回复", ar: "ردّنا" },
  "someone":        { en: "Someone", zh: "某位用户", ar: "مستخدم" },
  "close":          { en: "Close", zh: "关闭", ar: "إغلاق" },
};

type Tr = (key: string) => string;
type Platform = "facebook" | "instagram";

/* The session's last answer per space: coming back to the Feed paints at
   once instead of from a skeleton. Dropped on 401/403. */
const FEED_CACHE = new Map<MarketingSpace, FeedResponse>();

/* Side by side from the width that gives every column 280px (2 → 36rem,
   3 → 55rem, 4 → 73rem, with the 16px gaps); narrower, one column plus the
   chips. Written out whole: Tailwind only builds classes it can read. */
const SIDE_BY_SIDE: Record<number, { chips: string; others: string; grid: string }> = {
  2: { chips: "@[36rem]:hidden", others: "@max-[36rem]:hidden", grid: "@[36rem]:grid-cols-2" },
  3: { chips: "@[55rem]:hidden", others: "@max-[55rem]:hidden", grid: "@[55rem]:grid-cols-3" },
  4: { chips: "@[73rem]:hidden", others: "@max-[73rem]:hidden", grid: "@[73rem]:grid-cols-4" },
};
function layoutFor(n: number): { chips: string; others: string; grid: string } {
  if (n <= 1) return { chips: "hidden", others: "", grid: "" };
  return SIDE_BY_SIDE[n] ?? { chips: "", others: "hidden", grid: "" };
}

const METRIC_ICON: Record<string, ComponentType<{ size?: number }>> = {
  reactions: ThumbsUpIcon, likes: HeartIcon, comments: CommentIcon, shares: Share2Icon, views: EyeIcon, reach: UsersIcon, saved: BookmarkIcon,
};
const CARD_METRICS: Record<Platform, string[]> = {
  facebook: ["reactions", "comments", "shares", "views"],
  instagram: ["likes", "comments", "views", "saved"],
};
const ALL_METRICS: Record<Platform, string[]> = {
  facebook: ["reactions", "comments", "shares", "views", "reach"],
  instagram: ["likes", "comments", "views", "reach", "saved", "shares"],
};
const platformOf = (a: MarketingAccountView): Platform => (a.platform === "instagram" ? "instagram" : "facebook");

/** The numbers a card shows: views stand in for reach when Meta gave none. */
function cardMetrics(platform: Platform, m: Record<string, number>): Array<[string, number]> {
  return CARD_METRICS[platform]
    .map((k): [string, number | undefined] => (k === "views" && m.views == null && m.reach != null ? ["reach", m.reach] : [k, m[k]]))
    .filter((e): e is [string, number] => typeof e[1] === "number");
}

const STATUS_TONE = { connected: "success", expired: "warning", revoked: "error", error: "error", disconnected: "neutral" } as const;

function withItem(set: ReadonlySet<string>, id: string, on: boolean): ReadonlySet<string> {
  if (set.has(id) === on) return set;
  const next = new Set(set);
  if (on) next.add(id); else next.delete(id);
  return next;
}

async function inTurns<T>(items: readonly T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => { while (next < items.length) await work(items[next++]); };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, worker));
}

/** A refreshed column keeps the older posts already loaded below it. */
function mergeColumn(prev: FeedColumn, fresh: FeedColumn): FeedColumn {
  if (prev.posts.length <= fresh.posts.length) return fresh;
  const seen = new Set(fresh.posts.map((p) => p.id));
  const last = fresh.posts[fresh.posts.length - 1];
  const older = prev.posts.filter((p) => !seen.has(p.id) && (!last || p.posted_at < last.posted_at || (p.posted_at === last.posted_at && p.id < last.id)));
  return { ...fresh, posts: [...fresh.posts, ...older], next: older.length ? prev.next : fresh.next };
}

export default function SocialFeed({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(T);
  const router = useRouter();
  const [feed, setFeed] = useState<FeedResponse | null>(() => FEED_CACHE.get(space) ?? null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [syncing, setSyncing] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState<ReadonlySet<string>>(() => new Set());
  const [moreFailed, setMoreFailed] = useState<ReadonlySet<string>>(() => new Set());
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const repaired = useRef(new Set<string>());
  const [opened, setOpened] = useState<{ post: FeedPost; account: MarketingAccountView } | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const updateColumn = useCallback((accountId: string, change: (c: FeedColumn) => FeedColumn) => {
    setFeed((prev) => {
      if (!prev) return prev;
      const next = { ...prev, columns: prev.columns.map((c) => (c.account.id === accountId ? change(c) : c)) };
      FEED_CACHE.set(space, next);
      return next;
    });
  }, [space]);

  const updatePost = useCallback((post: Pick<FeedPost, "id" | "account_id">, patch: Partial<FeedPost>) => {
    updateColumn(post.account_id, (c) => ({ ...c, posts: c.posts.map((p) => (p.id === post.id ? { ...p, ...patch } : p)) }));
  }, [updateColumn]);

  const refreshAccount = useCallback(async (accountId: string, force: boolean) => {
    setSyncing((s) => withItem(s, accountId, true));
    try {
      await fetch(`/api/marketing/accounts/${accountId}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
    } catch { /* the column keeps what the Hub has */ }
    try {
      const res = await fetch(`/api/marketing/feed?account=${accountId}`, { cache: "no-store" });
      if (res.ok) {
        const { column } = (await res.json()) as { column: FeedColumn };
        updateColumn(accountId, (prev) => mergeColumn(prev, column));
      }
    } catch { /* same */ }
    finally {
      setSyncing((s) => withItem(s, accountId, false));
    }
  }, [updateColumn]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      let body: FeedResponse;
      try {
        const res = await fetch(`/api/marketing/feed?space=${space}`, { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          FEED_CACHE.delete(space);
          if (alive) setFeed(null);
        }
        if (!res.ok) throw new Error(String(res.status));
        body = (await res.json()) as FeedResponse;
      } catch {
        if (alive) setLoadError(true);
        return;
      }
      if (!alive) return;
      FEED_CACHE.set(space, body);
      const stale = body.columns.filter((c) => c.stale).map((c) => c.account.id);
      setFeed(body);
      setLoadError(false);
      /* Marked in the same render as the columns, so a stale column paints
         as "Updating…" from its first frame instead of switching to it. */
      setSyncing(new Set(stale));
      await inTurns(stale, 2, (id) => refreshAccount(id, false));
    })();
    return () => { alive = false; };
  }, [space, attempt, refreshAccount]);

  const loadMore = useCallback(async (col: FeedColumn) => {
    const cursor = col.next;
    if (!cursor) return;
    const id = col.account.id;
    setMoreBusy((s) => withItem(s, id, true));
    setMoreFailed((s) => withItem(s, id, false));
    try {
      const res = await fetch(`/api/marketing/feed?account=${id}&cursor=${encodeURIComponent(cursor)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as { posts: FeedPost[]; next: string | null };
      updateColumn(id, (prev) => {
        const seen = new Set(prev.posts.map((p) => p.id));
        return { ...prev, posts: [...prev.posts, ...page.posts.filter((p) => !seen.has(p.id))], next: page.next };
      });
    } catch {
      setMoreFailed((s) => withItem(s, id, true));
    } finally {
      setMoreBusy((s) => withItem(s, id, false));
    }
  }, [updateColumn]);

  const onThumbError = useCallback(async (post: FeedPost) => {
    if (repaired.current.has(post.id)) { setBroken((s) => withItem(s, post.id, true)); return; }
    repaired.current.add(post.id);
    try {
      const res = await fetch(`/api/marketing/feed/${post.id}?part=media`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const detail = (await res.json()) as PostDetail;
      if (!detail.post.thumb || detail.post.thumb.url === post.thumb?.url) throw new Error("unchanged");
      updatePost(post, { thumb: detail.post.thumb, media_count: detail.post.media_count });
    } catch {
      setBroken((s) => withItem(s, post.id, true));
    }
  }, [updatePost]);

  const openPost = (post: FeedPost, account: MarketingAccountView) => {
    setOpened({ post, account });
    setDrawerOpen(true);
  };

  const columns = feed?.columns ?? [];
  const layout = layoutFor(columns.length);
  const current = columns.some((c) => c.account.id === selected) ? selected : columns[0]?.account.id ?? null;

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <MarketingHeader space={space} action={space === "ceo" ? <CaptureButton /> : undefined} />

      <div className="mt-6">
        {feed === null ? (
          loadError ? (
            <EmptyState
              title={t("loadError")}
              action={<Button type="button" variant="secondary" onClick={() => { setLoadError(false); setAttempt((n) => n + 1); }}>{t("retry")}</Button>}
            />
          ) : (
            <FeedSkeleton />
          )
        ) : columns.length === 0 ? (
          <div className="flex flex-col gap-4">
            {loadError && (
              <p role="status" className="rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">{t("refreshError")}</p>
            )}
            <EmptyState
              icon={<span className="inline-flex gap-2"><BrandGlyph name="facebook" size={22} /><BrandGlyph name="instagram" size={22} /></span>}
              title={t("empty.title")}
              hint={t("empty.hint")}
              action={<Button type="button" onClick={() => router.push(SPACE_ROUTE[space])}>{t("empty.action")}</Button>}
            />
            {feed.manual > 0 && <p className="text-center text-[12px] text-[var(--text-dim)]">{t("manual.note")}</p>}
            {feed.publishOnly > 0 && <p className="text-center text-[12px] text-[var(--text-dim)]">{t("publishOnly.note")}</p>}
          </div>
        ) : (
          <div className="@container flex flex-col gap-4">
            {loadError && (
              <p role="status" className="rounded-xl border border-[#F59E0B]/35 bg-[#F59E0B]/10 px-4 py-3 text-[13px] text-[var(--text-primary)]">{t("refreshError")}</p>
            )}

            <PlanFeedCard space={space} />

            <div role="group" aria-label={t("chips.label")} className={`flex flex-wrap gap-2 ${layout.chips}`}>
              {columns.map((c) => {
                const on = c.account.id === current;
                return (
                  <button
                    key={c.account.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected(c.account.id)}
                    className={`inline-flex h-9 max-w-full items-center gap-2 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                      on
                        ? "border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] text-[var(--text-primary)]"
                        : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <BrandGlyph name={c.account.platform} size={14} />
                    <span className="truncate">{c.account.name}</span>
                  </button>
                );
              })}
            </div>

            <div className={`grid grid-cols-1 items-start gap-4 ${layout.grid}`}>
              {columns.map((col) => (
                <FeedColumnView
                  key={col.account.id}
                  col={col}
                  space={space}
                  t={t}
                  className={col.account.id === current ? "" : layout.others}
                  syncing={syncing.has(col.account.id)}
                  moreBusy={moreBusy.has(col.account.id)}
                  moreFailed={moreFailed.has(col.account.id)}
                  broken={broken}
                  onRefresh={() => void refreshAccount(col.account.id, true)}
                  onMore={() => void loadMore(col)}
                  onOpen={(p) => openPost(p, col.account)}
                  onThumbError={(p) => void onThumbError(p)}
                />
              ))}
            </div>

            {feed.manual > 0 && <p className="text-[12px] text-[var(--text-dim)]">{t("manual.note")}</p>}
            {feed.publishOnly > 0 && <p className="text-[12px] text-[var(--text-dim)]">{t("publishOnly.note")}</p>}
          </div>
        )}
      </div>

      <Modal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        maxWidth="max-w-4xl"
        title={opened ? (
          <span className="flex min-w-0 items-center gap-2">
            <BrandGlyph name={opened.account.platform} size={16} />
            <span className="truncate">{opened.account.name}</span>
          </span>
        ) : null}
        actions={<Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>{t("close")}</Button>}
      >
        {opened && (
          <PostDetailView
            key={opened.post.id}
            post={opened.post}
            platform={platformOf(opened.account)}
            accountName={opened.account.name}
            accountAvatar={opened.account.avatar_url}
            t={t}
            onLoaded={(d) => {
              updatePost(opened.post, { metrics: d.post.metrics, thumb: d.post.thumb, media_count: d.post.media_count });
              /* A fresh picture link gives a broken card its picture back. */
              if (d.post.thumb && d.post.thumb.url !== opened.post.thumb?.url) setBroken((s) => withItem(s, opened.post.id, false));
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div className="@container" aria-busy="true">
      <div className="grid grid-cols-1 items-start gap-4 @[36rem]:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`flex flex-col gap-3 ${i ? "@max-[36rem]:hidden" : ""}`}>
            <div className="h-[140px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
            <div className="aspect-square rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedColumnView({
  col, space, t, className, syncing, moreBusy, moreFailed, broken, onRefresh, onMore, onOpen, onThumbError,
}: {
  col: FeedColumn;
  space: MarketingSpace;
  t: Tr;
  className: string;
  syncing: boolean;
  moreBusy: boolean;
  moreFailed: boolean;
  broken: ReadonlySet<string>;
  onRefresh: () => void;
  onMore: () => void;
  onOpen: (post: FeedPost) => void;
  onThumbError: (post: FeedPost) => void;
}) {
  const a = col.account;
  const platform = platformOf(a);
  return (
    <section aria-label={a.name} className={`@container flex min-w-0 flex-col gap-3 ${className}`}>
      <AccountCard col={col} space={space} t={t} syncing={syncing} onRefresh={onRefresh} />

      {col.posts.length > 0 ? (
        <ul className="grid grid-cols-1 gap-3 @[34rem]:grid-cols-2 @[52rem]:grid-cols-3 @[70rem]:grid-cols-4">
          {col.posts.map((p) => (
            <li key={p.id} className="min-w-0">
              <PostCard post={p} platform={platform} t={t} broken={broken.has(p.id)} onOpen={() => onOpen(p)} onThumbError={() => onThumbError(p)} />
            </li>
          ))}
        </ul>
      ) : !a.last_synced_at && syncing ? (
        <ul aria-hidden="true" className="grid grid-cols-1 gap-3 @[34rem]:grid-cols-2 @[52rem]:grid-cols-3 @[70rem]:grid-cols-4">
          {[0, 1].map((i) => (
            <li key={i} className="aspect-square rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />
          ))}
        </ul>
      ) : a.last_synced_at ? (
        <EmptyState title={t("posts.empty")} />
      ) : null}

      {col.next && (
        <div className="flex flex-col items-center gap-2">
          <Button type="button" variant="secondary" className="w-full" disabled={moreBusy} onClick={onMore}>
            {moreBusy ? t("loadingMore") : t("loadMore")}
          </Button>
          {moreFailed && <p role="alert" className="text-[12px] text-[#FF3333]">{t("loadMoreFailed")}</p>}
        </div>
      )}
    </section>
  );
}

function AccountAvatar({ a }: { a: MarketingAccountView }) {
  const [bad, setBad] = useState(false);
  return (
    <div className="relative shrink-0">
      {a.avatar_url && !bad ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.avatar_url} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} className="h-11 w-11 rounded-full bg-[var(--bg-surface-subtle)] object-cover" />
      ) : (
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-surface-subtle)]">
          <BrandGlyph name={a.platform} size={20} />
        </span>
      )}
      <span className="absolute -bottom-1 -end-1 rounded-full bg-[var(--bg-surface)] p-[2px]">
        <BrandGlyph name={a.platform} size={14} />
      </span>
    </div>
  );
}

function AccountCard({ col, space, t, syncing, onRefresh }: { col: FeedColumn; space: MarketingSpace; t: Tr; syncing: boolean; onRefresh: () => void }) {
  const a = col.account;
  const change = col.week?.audience_change ?? null;
  const week = col.week;
  const status = a.status === "connected" ? null : a.status;
  return (
    <header className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
      <div className="flex items-start gap-3">
        <AccountAvatar a={a} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {a.profile_url ? (
              <a href={a.profile_url} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-[14px] font-semibold text-[var(--text-primary)] hover:underline">
                {a.name}
              </a>
            ) : (
              <span className="min-w-0 truncate text-[14px] font-semibold text-[var(--text-primary)]">{a.name}</span>
            )}
            {status && status !== "disconnected" && (
              <span title={a.last_error ?? undefined}><StatusPill tone={STATUS_TONE[status]}>{t(`status.${status}`)}</StatusPill></span>
            )}
          </div>
          <div className="truncate text-[12px] text-[var(--text-dim)]">
            {t(`kind.${platformOf(a)}`)}{a.handle ? ` · @${a.handle}` : ""}
          </div>
        </div>
        <Button type="button" variant="iconSecondary" onClick={onRefresh} disabled={syncing} aria-label={t("refresh")} title={t("refresh")}>
          {syncing ? <SpinnerIcon size={14} className="motion-safe:animate-spin" /> : <RefreshCwIcon size={14} />}
        </Button>
      </div>

      <div className="mt-3 flex min-h-[28px] flex-wrap items-baseline gap-x-2 gap-y-1">
        {a.audience != null && (
          <>
            <span className="text-[22px] font-semibold leading-7 tabular-nums text-[var(--text-primary)]">{compact(a.audience)}</span>
            <span className="text-[12px] text-[var(--text-dim)]">{t("followers")}</span>
          </>
        )}
        {change != null && change !== 0 && (
          <span className={`inline-flex items-center gap-1 text-[12px] font-medium tabular-nums ${change > 0 ? "text-[#10B981]" : "text-[#FF3333]"}`}>
            {change > 0 ? <TrendingUpIcon size={12} /> : <TrendingDownIcon size={12} />}
            <span dir="ltr">{change > 0 ? "+" : "−"}{compact(Math.abs(change))}</span> {t("thisWeek")}
          </span>
        )}
      </div>
      <p className="mt-1 min-h-[18px] text-[12px] leading-[18px] tabular-nums text-[var(--text-dim)]">
        {week?.posts != null ? t("week.summary").replace("{posts}", String(week.posts)).replace("{eng}", compact(week.engagement ?? 0)) : ""}
      </p>
      <p className="mt-0.5 min-h-4 text-[11px] leading-4 text-[var(--text-dim)]">
        {syncing
          ? (a.last_synced_at ? t("syncing") : t("importing").replace("{platform}", t(`pname.${platformOf(a)}`)))
          : a.last_synced_at ? t("synced").replace("{when}", dmyHm(a.last_synced_at)) : t("notSynced")}
      </p>
      {(a.status === "expired" || a.status === "revoked") && (
        <Link href={SPACE_ROUTE[space]} className="mt-2 inline-flex text-[12px] font-semibold text-[var(--text-primary)] underline underline-offset-2">
          {t("reconnect")}
        </Link>
      )}
    </header>
  );
}

function Metrics({ items, t }: { items: Array<[string, number]>; t: Tr }) {
  return (
    <>
      {items.map(([k, v]) => {
        const Icon = METRIC_ICON[k] ?? EyeIcon;
        return (
          <span key={k} title={t(`m.${k}`)} className="inline-flex items-center gap-1 text-[12px] tabular-nums text-[var(--text-muted)]">
            <Icon size={12} />
            <span className="sr-only">{t(`m.${k}`)}</span>
            {compact(v)}
          </span>
        );
      })}
    </>
  );
}

function PostCard({ post, platform, t, broken, onOpen, onThumbError }: {
  post: FeedPost;
  platform: Platform;
  t: Tr;
  broken: boolean;
  onOpen: () => void;
  onThumbError: () => void;
}) {
  const thumb = post.thumb;
  const kind = thumb?.kind === "video" ? t("video") : post.media_count > 1 ? t("photos").replace("{n}", String(post.media_count)) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-start transition-colors hover:border-[var(--border-focus)] focus-visible:border-[var(--border-focus)] focus-visible:outline-none"
    >
      {thumb && (
        <span className="relative block aspect-square w-full overflow-hidden bg-[var(--bg-surface-subtle)]">
          {broken ? (
            <span className="absolute inset-0 flex items-center justify-center text-[var(--text-dim)]"><ImageRawIcon size={28} /></span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb.url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={onThumbError} className="absolute inset-0 h-full w-full object-cover" />
          )}
        </span>
      )}
      <span className="flex flex-1 flex-col gap-2 p-3">
        {post.excerpt && (
          <span dir="auto" className={`block break-words text-[13px] leading-[18px] text-[var(--text-primary)] ${thumb ? "line-clamp-2" : "line-clamp-6"}`}>
            {post.excerpt}
          </span>
        )}
        <span className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          <Metrics items={cardMetrics(platform, post.metrics)} t={t} />
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-[var(--text-dim)]">
          <span>{dmyHm(post.posted_at)}</span>
          {kind && (
            <span className="inline-flex items-center gap-1">
              {thumb?.kind === "video" && <PlayIcon size={10} />}
              {kind}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

/* A post's comments as threads, «Needs a reply» decided by the shared rule. */
function toThreads(list: FeedComment[]): ThreadState[] {
  return groupThreads(list).map(({ first, replies }) => ({
    first, replies, handled_at: first.handled_at, handled_by_name: null,
    needs_reply: needsReply(first, replies),
  }));
}

function PostDetailView({ post, platform, accountName, accountAvatar, t, onLoaded }: { post: FeedPost; platform: Platform; accountName: string; accountAvatar: string | null; t: Tr; onLoaded: (d: PostDetail) => void }) {
  const [detail, setDetail] = useState<PostDetail | null>(null);
  const [threads, setThreads] = useState<ThreadState[]>([]);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const loaded = useRef(onLoaded);
  useEffect(() => { loaded.current = onLoaded; });

  useEffect(() => {
    let alive = true;
    fetch(`/api/marketing/feed/${post.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<PostDetail>) : Promise.reject(new Error(String(res.status)))))
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setThreads(toThreads(d.comments));
        loaded.current(d);
      }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [post.id]);

  /* A reply whose answer never arrived may still have landed: read the
     post's comments again so the thread shows what the server knows. */
  const reload = useCallback(() => {
    fetch(`/api/marketing/feed/${post.id}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<PostDetail>) : Promise.reject(new Error(String(res.status)))))
      .then((d) => { setDetail(d); setThreads(toThreads(d.comments)); }, () => { /* keep what the screen has */ });
  }, [post.id]);

  const full = detail?.post;
  const media = full && full.media.length ? full.media : post.thumb ? [post.thumb] : [];
  const shown = media[Math.min(index, media.length - 1)];
  const message = full ? full.message : post.excerpt;
  const metrics = full?.metrics ?? post.metrics;
  const numbers = ALL_METRICS[platform].filter((k) => typeof metrics[k] === "number").map((k): [string, number] => [k, metrics[k]]);
  const pname = t(`pname.${platform}`);

  return (
    <div className={`grid gap-5 ${media.length ? "md:grid-cols-2" : ""}`}>
      {shown && (
        <div className="flex min-w-0 flex-col gap-2">
          <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-[var(--bg-surface-subtle)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shown.url} alt="" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain" />
          </div>
          {shown.kind === "video" && post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <PlayIcon size={12} />{t("watchOn").replace("{platform}", pname)}
            </a>
          )}
          {media.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {media.map((m, i) => (
                <button
                  key={`${i}-${m.url}`}
                  type="button"
                  aria-pressed={i === index}
                  aria-label={t("photoN").replace("{n}", String(i + 1))}
                  onClick={() => setIndex(i)}
                  className={`relative h-14 w-14 overflow-hidden rounded-lg border ${i === index ? "border-[var(--border-focus)]" : "border-[var(--border-subtle)]"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--text-dim)]">
          <span className="tabular-nums">{dmyHm(post.posted_at)}</span>
          {post.permalink && (
            <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <ExternalLinkIcon size={12} />{t("openOn").replace("{platform}", pname)}
            </a>
          )}
        </div>

        {message && (
          <p dir="auto" className="whitespace-pre-wrap break-words text-[13px] leading-5 text-[var(--text-primary)]">
            {message}{!full && post.truncated ? "…" : ""}
          </p>
        )}

        {numbers.length > 0 && (
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {numbers.map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2">
                <dt className="text-[11px] text-[var(--text-dim)]">{t(`m.${k}`)}</dt>
                <dd className="text-[15px] font-semibold tabular-nums text-[var(--text-primary)]">{compact(v)}</dd>
              </div>
            ))}
          </dl>
        )}

        <section className="flex flex-col gap-3">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{t("comments")}</h3>
          {failed ? (
            <p role="alert" className="text-[12px] text-[#FF3333]">{t("commentsError")}</p>
          ) : !detail ? (
            <div aria-busy="true" className="flex flex-col gap-3">
              {[0, 1].map((i) => <div key={i} className="h-12 rounded-xl bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)}
            </div>
          ) : threads.length === 0 ? (
            <p className="text-[12px] text-[var(--text-dim)]">{t("noComments")}</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {threads.map((th) => (
                <li key={th.first.id}>
                  <CommentThread
                    thread={th}
                    accountName={accountName}
                    accountAvatar={accountAvatar}
                    canReply={detail.canReply}
                    canHide={detail.canHide}
                    onChange={(next) => setThreads((list) => list.map((x) => (x.first.id === th.first.id ? next : x)))}
                    onReconcile={reload}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
