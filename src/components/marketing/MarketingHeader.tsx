"use client";

/* MarketingHeader — the header of a marketing space's screens: its name and
   the tabs between them (Feed, Insights, Plan, Posts, Calendar, Accounts,
   Comments, Messages). One
   place for its screens, so their header and tabs never drift apart. Tabs
   are routes (key = href); PageHeader lights the one the address matches.

   The Comments tab carries how many comment threads wait for a reply (owner,
   28/09/2026: a number on the tab, no notification per comment), and the
   Messages tab how many conversations do (29/09/2026). They are the LAST
   two tabs, so a number arriving after the first paint moves nothing but
   them; each number is kept for the session and drawn at once, asked again
   at most once a minute and only once the screen's own requests are done.
   The Comments and Messages screens tell it the new number after every
   change.

   CEO Brand's subtitle carries its KPIs from the JD (owner, 30/09/2026):
   this week's posts of 3 and this month's approved posts of 12. The same
   line as the plain subtitle, so the numbers arriving move nothing; kept for
   the session like the counts, and asked again after an approval. */

import { useEffect, useState, type ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import BarChart3Icon from "@/components/icons/ui/BarChart3Icon";
import ClipboardCheckIcon from "@/components/icons/ui/ClipboardCheckIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import PenSquareIcon from "@/components/icons/ui/PenSquareIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import CommentIcon from "@/components/icons/ui/CommentIcon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { whenNetworkQuiet } from "@/lib/net-idle";
import { SPACE_CALENDAR, SPACE_COMMENTS, SPACE_HOME, SPACE_INSIGHTS, SPACE_MESSAGES, SPACE_PLAN, SPACE_POSTS, SPACE_ROUTE, type MarketingSpace } from "@/lib/marketing/spaces";

const T: Translations = {
  "title.company": { en: "Social Marketing", zh: "社交媒体营销", ar: "التسويق عبر السوشيال ميديا" },
  "title.ceo":     { en: "CEO Brand", zh: "CEO 个人品牌", ar: "براند المدير التنفيذي" },
  "sub.company":   { en: "Koleex's social accounts, their posts and numbers", zh: "Koleex 的社交账号及其帖子和数据", ar: "حسابات كولكس على السوشيال ميديا ومنشوراتها وأرقامها" },
  "sub.ceo":       { en: "The CEO's own social accounts", zh: "CEO 本人的社交账号", ar: "حسابات السوشيال ميديا الخاصة بالمدير التنفيذي" },
  "tab.feed":      { en: "Feed", zh: "动态", ar: "الـFeed" },
  "tab.insights":  { en: "Insights", zh: "数据洞察", ar: "الإحصاءات" },
  "tab.plan":      { en: "Plan", zh: "计划", ar: "الخطة" },
  "tab.posts":     { en: "Posts", zh: "帖子", ar: "المنشورات" },
  "tab.calendar":  { en: "Calendar", zh: "日历", ar: "التقويم" },
  "tab.accounts":  { en: "Accounts", zh: "账号", ar: "الحسابات" },
  "tab.comments":  { en: "Comments", zh: "评论", ar: "التعليقات" },
  "tab.messages":  { en: "Messages", zh: "私信", ar: "الرسائل" },
  "kpi.line":      { en: "This week {w} of {wt} posts · This month {m} of {mt} approved", zh: "本周 {w}/{wt} 条帖子 · 本月 {m}/{mt} 条已批准", ar: "هذا الأسبوع {w} من {wt} منشورات · هذا الشهر {m} من {mt} تمت الموافقة عليها" },
};

/* ── How many comment threads and conversations wait for a reply ────────── */

type WaitKind = "comments" | "messages";
const COUNT_TTL_MS = 60_000;
/** Fired by the Comments / Messages screen with the number its list just read. */
export const COMMENTS_COUNT_EVENT = "kx-marketing-comments-count";
export const MESSAGES_COUNT_EVENT = "kx-marketing-messages-count";
const EVENT: Record<WaitKind, string> = { comments: COMMENTS_COUNT_EVENT, messages: MESSAGES_COUNT_EVENT };
const COUNT_URL: Record<WaitKind, string> = { comments: "/api/marketing/comments/count", messages: "/api/marketing/messages/count" };
const memory = new Map<string, { n: number; at: number }>();
const storeKey = (kind: WaitKind, space: MarketingSpace) => `kx.mkt.${kind === "comments" ? "commentsNeeds" : "messagesNeeds"}.${space}`;

function readCount(kind: WaitKind, space: MarketingSpace): { n: number; at: number } | null {
  const held = memory.get(storeKey(kind, space));
  if (held) return held;
  try {
    const raw = sessionStorage.getItem(storeKey(kind, space));
    const v = raw ? (JSON.parse(raw) as { n?: unknown; at?: unknown }) : null;
    if (v && typeof v.n === "number" && typeof v.at === "number") { memory.set(storeKey(kind, space), { n: v.n, at: v.at }); return { n: v.n, at: v.at }; }
  } catch { /* storage blocked: the number just waits for the server */ }
  return null;
}

/** Keep the number (for this session) and tell every header showing it. */
function publishCount(kind: WaitKind, space: MarketingSpace, n: number): void {
  const v = { n, at: Date.now() };
  memory.set(storeKey(kind, space), v);
  try { sessionStorage.setItem(storeKey(kind, space), JSON.stringify(v)); } catch { /* storage blocked */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT[kind], { detail: { space, n } }));
}
export const publishCommentsCount = (space: MarketingSpace, n: number) => publishCount("comments", space, n);
export const publishMessagesCount = (space: MarketingSpace, n: number) => publishCount("messages", space, n);

function useWaitingCount(kind: WaitKind, space: MarketingSpace, enabled = true): number | null {
  /* Read in the initialiser: the kept number is on the first frame. */
  const [n, setN] = useState<number | null>(() => (typeof window === "undefined" ? null : readCount(kind, space)?.n ?? null));
  useEffect(() => {
    if (!enabled) return;
    const onCount = (e: Event) => {
      const d = (e as CustomEvent<{ space: MarketingSpace; n: number }>).detail;
      if (d?.space === space) setN(d.n);
    };
    window.addEventListener(EVENT[kind], onCount);
    let alive = true;
    const held = readCount(kind, space);
    if (!held || Date.now() - held.at > COUNT_TTL_MS) {
      void whenNetworkQuiet().then(async () => {
        if (!alive) return;
        try {
          const res = await fetch(`${COUNT_URL[kind]}?space=${space}`, { cache: "no-store" });
          if (!res.ok) return;
          const body = (await res.json()) as { needs?: unknown };
          if (alive && typeof body.needs === "number") publishCount(kind, space, body.needs);
        } catch { /* offline: the kept number stays */ }
      });
    }
    return () => { alive = false; window.removeEventListener(EVENT[kind], onCount); };
  }, [kind, space, enabled]);
  return enabled ? n : null;
}

/* ── CEO Brand's KPIs ─────────────────────────────────────────────────── */

type CeoKpis = { week: { count: number; target: number }; month: { count: number; target: number } };
const KPI_KEY = "kx.mkt.ceoKpis";
const KPI_EVENT = "kx-marketing-ceo-kpis";
let kpiMemory: { v: CeoKpis; at: number } | null = null;

function readKpis(): { v: CeoKpis; at: number } | null {
  if (kpiMemory) return kpiMemory;
  try {
    const raw = sessionStorage.getItem(KPI_KEY);
    const o = raw ? (JSON.parse(raw) as { v?: CeoKpis; at?: unknown }) : null;
    if (o?.v && typeof o.v.week?.count === "number" && typeof o.v.month?.count === "number" && typeof o.at === "number") {
      kpiMemory = { v: o.v, at: o.at };
      return kpiMemory;
    }
  } catch { /* storage blocked: the numbers just wait for the server */ }
  return null;
}

/** After an approval the kept numbers are out of date: every header showing
 *  them asks again. */
export function forgetCeoKpis(): void {
  kpiMemory = null;
  try { sessionStorage.removeItem(KPI_KEY); } catch { /* storage blocked */ }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(KPI_EVENT));
}

function useCeoKpis(enabled: boolean): CeoKpis | null {
  /* Read in the initialiser: the kept numbers are on the first frame. */
  const [v, setV] = useState<CeoKpis | null>(() => (typeof window === "undefined" || !enabled ? null : readKpis()?.v ?? null));
  const [ask, setAsk] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const onForget = () => setAsk((n) => n + 1);
    window.addEventListener(KPI_EVENT, onForget);
    return () => window.removeEventListener(KPI_EVENT, onForget);
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const held = readKpis();
    if (held && Date.now() - held.at <= COUNT_TTL_MS) return;
    void whenNetworkQuiet().then(async () => {
      if (!alive) return;
      try {
        const res = await fetch("/api/marketing/posts/kpis?space=ceo", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as CeoKpis;
        if (!alive || typeof body?.week?.count !== "number" || typeof body?.month?.count !== "number") return;
        kpiMemory = { v: body, at: Date.now() };
        try { sessionStorage.setItem(KPI_KEY, JSON.stringify(kpiMemory)); } catch { /* storage blocked */ }
        setV(body);
      } catch { /* offline: the kept numbers stay */ }
    });
    return () => { alive = false; };
  }, [enabled, ask]);
  return enabled ? v : null;
}

export default function MarketingHeader({ space, action }: { space: MarketingSpace; action?: ReactNode }) {
  const { t } = useTranslation(T);
  const needs = useWaitingCount("comments", space);
  const kpis = useCeoKpis(space === "ceo");
  /* CEO Brand reads no private messages (owner, 29/09/2026): no tab there. */
  const withMessages = space === "company";
  const waiting = useWaitingCount("messages", space, withMessages);
  return (
    <PageHeader
      title={t(`title.${space}`)}
      subtitle={kpis
        ? t("kpi.line").replace("{w}", String(kpis.week.count)).replace("{wt}", String(kpis.week.target))
          .replace("{m}", String(kpis.month.count)).replace("{mt}", String(kpis.month.target))
        : t(`sub.${space}`)}
      icon={space === "ceo" ? <CrownIcon size={16} /> : <Share2Icon size={16} />}
      backHref="/"
      action={action}
      tabs={[
        { key: SPACE_HOME[space], label: t("tab.feed"), icon: <LayoutGridIcon size={14} /> },
        { key: SPACE_INSIGHTS[space], label: t("tab.insights"), icon: <BarChart3Icon size={14} /> },
        { key: SPACE_PLAN[space], label: t("tab.plan"), icon: <ClipboardCheckIcon size={14} /> },
        { key: SPACE_POSTS[space], label: t("tab.posts"), icon: <PenSquareIcon size={14} /> },
        { key: SPACE_CALENDAR[space], label: t("tab.calendar"), icon: <CalendarRawIcon size={14} /> },
        { key: SPACE_ROUTE[space], label: t("tab.accounts"), icon: <UsersIcon size={14} /> },
        { key: SPACE_COMMENTS[space], label: t("tab.comments"), icon: <CommentIcon size={14} />, badge: needs ?? undefined },
        ...(withMessages ? [{ key: SPACE_MESSAGES[space], label: t("tab.messages"), icon: <MessageSquareIcon size={14} />, badge: waiting ?? undefined }] : []),
      ]}
    />
  );
}
