"use client";

/* ---------------------------------------------------------------------------
   SocialPosts — the Posts tab: every post written in the Hub for this space,
   newest change first, filtered by where it stands (drafts, waiting for
   approval, published, problems). "New post" opens the composer; a card
   opens its post. Approvers see how many posts wait for them.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { CaptureButton } from "@/components/marketing/QuickCapture";
import Button from "@/components/kds/Button";
import StatusPill from "@/components/kds/StatusPill";
import EmptyState from "@/components/kds/EmptyState";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import ImageRawIcon from "@/components/icons/ui/ImageRawIcon";
import PlayIcon from "@/components/icons/ui/PlayIcon";
import { useTranslation } from "@/lib/i18n";
import { POSTS_T } from "@/lib/marketing/posts-i18n";
import { dmyHm } from "@/lib/marketing/format";
import type { MarketingSpace } from "@/lib/marketing/spaces";
import { POST_TONE } from "@/lib/marketing/post-status";
import type { PostFilter, PostSummary, PostsResponse } from "@/lib/marketing/post-types";

const FILTERS: PostFilter[] = ["all", "drafts", "review", "scheduled", "published", "problems"];


const postsHome = (space: MarketingSpace) => (space === "ceo" ? "/ceo-brand/posts" : "/social-marketing/posts");

export default function SocialPosts({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(POSTS_T);
  const router = useRouter();
  const newPost = () => router.push(`${postsHome(space)}/new`);
  const [filter, setFilter] = useState<PostFilter>("all");
  const [data, setData] = useState<PostsResponse | null>(null);
  const [error, setError] = useState(false);
  const [more, setMore] = useState(false);

  const load = useCallback(async (f: PostFilter) => {
    setError(false);
    try {
      const res = await fetch(`/api/marketing/posts?space=${space}&filter=${f}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as PostsResponse);
    } catch {
      setError(true);
    }
  }, [space]);

  useEffect(() => { void load(filter); }, [load, filter]);

  const loadMore = async () => {
    if (!data?.next) return;
    setMore(true);
    try {
      const res = await fetch(`/api/marketing/posts?space=${space}&filter=${filter}&cursor=${encodeURIComponent(data.next)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as PostsResponse;
      setData((prev) => (prev ? { ...page, posts: [...prev.posts, ...page.posts.filter((p) => !prev.posts.some((q) => q.id === p.id))] } : page));
    } catch {
      setError(true);
    } finally {
      setMore(false);
    }
  };

  const count = (f: PostFilter) => (f === "drafts" ? data?.counts.drafts : f === "review" ? data?.counts.review : f === "scheduled" ? data?.counts.scheduled : f === "problems" ? data?.counts.problems : undefined);

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <MarketingHeader
        space={space}
        action={space === "ceo"
          ? <div className="flex flex-wrap gap-2"><CaptureButton /><Button type="button" onClick={newPost}>{t("list.new")}</Button></div>
          : <Button type="button" onClick={newPost}>{t("list.new")}</Button>}
      />

      <div className="mt-6 flex flex-col gap-4">
        <div role="group" aria-label={t("filter.all")} className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
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
                {t(`filter.${f}`)}
                {!!n && (
                  <span className={`min-w-5 rounded-full px-1.5 text-center text-[11px] tabular-nums ${f === "review" && data?.canApprove ? "bg-[#567FB2] text-white" : "bg-[var(--bg-inverted)]/[0.08] text-[var(--text-muted)]"}`}>{n}</span>
                )}
              </button>
            );
          })}
        </div>

        {error && !data ? (
          <EmptyState title={t("list.loadError")} action={<Button type="button" variant="secondary" onClick={() => void load(filter)}>{t("retry")}</Button>} />
        ) : !data ? (
          <ul aria-busy="true" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <li key={i} className="h-[112px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)}
          </ul>
        ) : data.posts.length === 0 ? (
          filter === "all" ? (
            <EmptyState
              icon={<span className="inline-flex gap-2"><BrandGlyph name="facebook" size={22} /><BrandGlyph name="instagram" size={22} /></span>}
              title={t("list.empty")}
              hint={t("list.emptyHint")}
              action={<Button type="button" onClick={newPost}>{t("list.new")}</Button>}
            />
          ) : (
            <EmptyState title={t("list.emptyFilter")} />
          )
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.posts.map((p) => <li key={p.id} className="min-w-0"><PostCard post={p} href={`${postsHome(space)}/${p.id}`} t={t} /></li>)}
          </ul>
        )}

        {data?.next && (
          <div className="flex justify-center">
            <Button type="button" variant="secondary" disabled={more} onClick={() => void loadMore()}>{t("list.more")}</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function PostCard({ post, href, t }: { post: PostSummary; href: string; t: (k: string) => string }) {
  return (
    <Link href={href} className="flex h-full min-w-0 gap-3 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 transition-colors hover:border-[var(--border-focus)]">
      <span className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]">
        {post.thumb?.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumb.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : post.thumb?.kind === "video" ? (
          <PlayIcon size={20} />
        ) : (
          <ImageRawIcon size={20} />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill tone={POST_TONE[post.status]}>{t(`st.${post.status}`)}</StatusPill>
          {post.failed > 0 && <StatusPill tone="error">{t("list.failedOn").replace("{n}", String(post.failed))}</StatusPill>}
          {post.to_share > 0 && <StatusPill tone="warning">{t("list.toShare").replace("{n}", String(post.to_share))}</StatusPill>}
        </span>
        <span dir="auto" className="line-clamp-2 break-words text-[13px] leading-[18px] text-[var(--text-primary)]">{post.excerpt ?? "—"}</span>
        <span className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-[var(--text-dim)]">
          <span className="inline-flex items-center gap-1">
            {post.accounts.slice(0, 6).map((a) => <BrandGlyph key={a.id} name={a.platform} size={12} />)}
          </span>
          {post.author && <span className="truncate">{t("list.by").replace("{name}", post.author)}</span>}
          <span className="tabular-nums">{post.status === "scheduled" && post.scheduled_at ? t("list.scheduledFor").replace("{when}", dmyHm(post.scheduled_at)) : t("list.updated").replace("{when}", dmyHm(post.updated_at))}</span>
        </span>
      </span>
    </Link>
  );
}
