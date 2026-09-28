"use client";

/* MarketingHeader — the header of a marketing space's screens: its name and
   the tabs between them (Feed, Insights, Posts, Calendar, Accounts, Comments). One
   place for its screens, so their header and tabs never drift apart. Tabs
   are routes (key = href); PageHeader lights the one the address matches.

   The Comments tab carries how many comment threads wait for a reply (owner,
   28/09/2026: a number on the tab, no notification per comment). It is the
   LAST tab, so a number arriving after the first paint moves no other tab;
   the last number is kept for the session and drawn at once, asked again
   at most once a minute and only once the screen's own requests are done.
   The Comments screen tells it the new number after every change. */

import { useEffect, useState, type ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import PenSquareIcon from "@/components/icons/ui/PenSquareIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import CommentIcon from "@/components/icons/ui/CommentIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { whenNetworkQuiet } from "@/lib/net-idle";
import { SPACE_CALENDAR, SPACE_COMMENTS, SPACE_HOME, SPACE_INSIGHTS, SPACE_POSTS, SPACE_ROUTE, type MarketingSpace } from "@/lib/marketing/spaces";

const T: Translations = {
  "title.company": { en: "Social Marketing", zh: "社交媒体营销", ar: "التسويق عبر السوشيال ميديا" },
  "title.ceo":     { en: "CEO Brand", zh: "CEO 个人品牌", ar: "براند المدير التنفيذي" },
  "sub.company":   { en: "Koleex's social accounts, their posts and numbers", zh: "Koleex 的社交账号及其帖子和数据", ar: "حسابات كولكس على السوشيال ميديا ومنشوراتها وأرقامها" },
  "sub.ceo":       { en: "The CEO's own social accounts", zh: "CEO 本人的社交账号", ar: "حسابات السوشيال ميديا الخاصة بالمدير التنفيذي" },
  "tab.feed":      { en: "Feed", zh: "动态", ar: "الـFeed" },
  "tab.insights":  { en: "Insights", zh: "数据洞察", ar: "الإحصاءات" },
  "tab.posts":     { en: "Posts", zh: "帖子", ar: "المنشورات" },
  "tab.calendar":  { en: "Calendar", zh: "日历", ar: "التقويم" },
  "tab.accounts":  { en: "Accounts", zh: "账号", ar: "الحسابات" },
  "tab.comments":  { en: "Comments", zh: "评论", ar: "التعليقات" },
};

/* ── How many threads wait for a reply ─────────────────────────────────── */

const COUNT_TTL_MS = 60_000;
/** Fired by the Comments screen with the number its list just read. */
export const COMMENTS_COUNT_EVENT = "kx-marketing-comments-count";
const memory = new Map<MarketingSpace, { n: number; at: number }>();
const storeKey = (space: MarketingSpace) => `kx.mkt.commentsNeeds.${space}`;

function readCount(space: MarketingSpace): { n: number; at: number } | null {
  const held = memory.get(space);
  if (held) return held;
  try {
    const raw = sessionStorage.getItem(storeKey(space));
    const v = raw ? (JSON.parse(raw) as { n?: unknown; at?: unknown }) : null;
    if (v && typeof v.n === "number" && typeof v.at === "number") { memory.set(space, { n: v.n, at: v.at }); return { n: v.n, at: v.at }; }
  } catch { /* storage blocked: the number just waits for the server */ }
  return null;
}

/** Keep the number (for this session) and tell every header showing it. */
export function publishCommentsCount(space: MarketingSpace, n: number): void {
  const v = { n, at: Date.now() };
  memory.set(space, v);
  try { sessionStorage.setItem(storeKey(space), JSON.stringify(v)); } catch { /* storage blocked */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(COMMENTS_COUNT_EVENT, { detail: { space, n } }));
}

function useCommentsNeeds(space: MarketingSpace): number | null {
  /* Read in the initialiser: the kept number is on the first frame. */
  const [n, setN] = useState<number | null>(() => (typeof window === "undefined" ? null : readCount(space)?.n ?? null));
  useEffect(() => {
    const onCount = (e: Event) => {
      const d = (e as CustomEvent<{ space: MarketingSpace; n: number }>).detail;
      if (d?.space === space) setN(d.n);
    };
    window.addEventListener(COMMENTS_COUNT_EVENT, onCount);
    let alive = true;
    const held = readCount(space);
    if (!held || Date.now() - held.at > COUNT_TTL_MS) {
      void whenNetworkQuiet().then(async () => {
        if (!alive) return;
        try {
          const res = await fetch(`/api/marketing/comments/count?space=${space}`, { cache: "no-store" });
          if (!res.ok) return;
          const body = (await res.json()) as { needs?: unknown };
          if (alive && typeof body.needs === "number") publishCommentsCount(space, body.needs);
        } catch { /* offline: the kept number stays */ }
      });
    }
    return () => { alive = false; window.removeEventListener(COMMENTS_COUNT_EVENT, onCount); };
  }, [space]);
  return n;
}

export default function MarketingHeader({ space, action }: { space: MarketingSpace; action?: ReactNode }) {
  const { t } = useTranslation(T);
  const needs = useCommentsNeeds(space);
  return (
    <PageHeader
      title={t(`title.${space}`)}
      subtitle={t(`sub.${space}`)}
      icon={space === "ceo" ? <CrownIcon size={16} /> : <Share2Icon size={16} />}
      backHref="/"
      action={action}
      tabs={[
        { key: SPACE_HOME[space], label: t("tab.feed"), icon: <LayoutGridIcon size={14} /> },
        { key: SPACE_INSIGHTS[space], label: t("tab.insights"), icon: <BarChart3Icon size={14} /> },
        { key: SPACE_POSTS[space], label: t("tab.posts"), icon: <PenSquareIcon size={14} /> },
        { key: SPACE_CALENDAR[space], label: t("tab.calendar"), icon: <CalendarRawIcon size={14} /> },
        { key: SPACE_ROUTE[space], label: t("tab.accounts"), icon: <UsersIcon size={14} /> },
        { key: SPACE_COMMENTS[space], label: t("tab.comments"), icon: <CommentIcon size={14} />, badge: needs ?? undefined },
      ]}
    />
  );
}
