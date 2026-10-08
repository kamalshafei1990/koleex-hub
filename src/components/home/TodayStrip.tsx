"use client";

/* ---------------------------------------------------------------------------
   TodayStrip — what needs the person first, above the apps (owner pick,
   28/09/2026: Home sample 2, "Workspace Today").

   Four cards, each opening its app: open tasks on you (To-do), unread
   Discuss messages, unread notifications, and the next calendar event in
   the next three days. The first three are numbers Home already holds for
   its tile badges — no request of their own. Only the calendar card reads
   something, once, after Home is interactive, and only for someone whose
   launcher shows Calendar. A card whose app the person cannot open is not
   drawn; a number still on its way shows a dash, never a false 0.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import BoundIcon from "@/components/common/BoundIcon";
import AppLaunchLink from "@/components/layout/AppLaunchLink";
import type { AppDef } from "@/lib/navigation";

type NextEvent = { title: string; start: Date } | null;

function dateLocaleFor(lang: string): string {
  return lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-SA" : "en-US";
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function TodayStrip({
  apps,
  t,
  lang,
  dk,
  ready,
  accountId,
  todoOpen,
  discussUnread,
  notifUnread,
  onPrefetch,
}: {
  /** The person's launcher apps, keyed by id — a card shows only when its
   *  app is here and active. */
  apps: Map<string, AppDef>;
  t: (key: string, fb: string) => string;
  lang: string;
  dk: boolean;
  /** Home is interactive: the calendar read may start. */
  ready: boolean;
  accountId: string | null;
  todoOpen: number | null;
  discussUnread: number | null;
  notifUnread: number | null;
  onPrefetch: (app: AppDef) => void;
}) {
  const calendar = apps.get("calendar");
  const [next, setNext] = useState<NextEvent | undefined>(undefined);

  useEffect(() => {
    if (!ready || !accountId || !calendar?.active) return;
    let cancelled = false;
    const now = new Date();
    const end = new Date(now.getTime() + 3 * 86_400_000);
    void import("@/lib/calendar-events")
      .then(({ fetchEventsInRange }) => fetchEventsInRange(accountId, now, end))
      .then(({ ok, events }) => {
        if (cancelled || !ok) return;
        /* The person's own events and the ones they are invited to — not the
           mirrors of tasks, shifts or leave, and not all-day items, which
           have no time to show. Declined invitations are left out. */
        const first = events
          .filter((e) => !e.source && !e.all_day && e.invite_status !== "declined" && Date.parse(e.end_at) > now.getTime())
          .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0];
        setNext(first ? { title: first.title, start: new Date(first.start_at) } : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [ready, accountId, calendar?.active]);

  const cardCls = `group flex flex-col gap-2 min-w-0 rounded-2xl border p-4 md:p-5 transition-colors outline-none focus-visible:ring-2 kx-glass ${
    dk
      ? "bg-[#0c0c0c] border-white/[0.06] hover:border-white/[0.14] focus-visible:ring-white/35"
      : "bg-[#f8f8f8] border-black/[0.06] hover:border-black/[0.14] focus-visible:ring-black/25"
  }`;
  const big = (n: number | null) => (n === null ? "–" : n > 99 ? "99+" : String(n));

  const card = (id: string, value: string, caption: string, muted: boolean) => {
    const app = apps.get(id);
    if (!app?.active) return null;
    const Icon = app.icon;
    return (
      <AppLaunchLink key={id} app={app} onPreload={onPrefetch} className={cardCls}>
        <span className={`flex items-center gap-2 text-[12px] font-medium ${dk ? "text-white/55" : "text-black/55"}`}>
          <BoundIcon semanticKey={`app.${id}`} className="h-4 w-4" fallback={<Icon size={16} />} />
          <span className="truncate">{t(app.tKey, app.name)}</span>
        </span>
        <span
          className={`text-[26px] md:text-[30px] font-bold leading-none tracking-tight tabular-nums truncate ${
            muted ? (dk ? "text-white/35" : "text-black/35") : dk ? "text-white" : "text-black"
          }`}
        >
          {value}
        </span>
        <span className={`text-[12px] md:text-[13px] leading-snug line-clamp-2 ${dk ? "text-white/50" : "text-black/50"}`}>
          {caption}
        </span>
      </AppLaunchLink>
    );
  };

  let calValue = "–";
  let calCaption = t("home.nextThreeDays", "in the next 3 days");
  if (next === null) {
    calValue = "—";
    calCaption = t("home.nothingScheduled", "Nothing scheduled");
  } else if (next) {
    const locale = dateLocaleFor(lang);
    calValue = next.start.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const day =
      dayKey(next.start) === dayKey(today)
        ? t("home.today", "Today")
        : dayKey(next.start) === dayKey(tomorrow)
          ? t("home.tomorrow", "Tomorrow")
          : next.start.toLocaleDateString(locale, { weekday: "long" });
    calCaption = `${day} · ${next.title}`;
  }

  const cards = [
    card("todo", big(todoOpen), t("home.tasksOpen", "open tasks on you"), !todoOpen),
    card("discuss", big(discussUnread), t("home.msgsUnread", "unread messages"), !discussUnread),
    card("inbox", big(notifUnread), t("home.notifsUnread", "unread notifications"), !notifUnread),
    card("calendar", calValue, calCaption, !next),
  ].filter(Boolean);
  if (cards.length === 0) return null;

  return (
    <section className="mb-7" aria-label={t("home.today", "Today")}>
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`shrink-0 text-[11px] font-semibold tracking-[1px] uppercase ${dk ? "text-white/25" : "text-black/25"}`}>
          {t("home.today", "Today")}
        </span>
        <div className={`flex-1 h-px ${dk ? "bg-white/[0.04]" : "bg-black/[0.04]"}`} />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{cards}</div>
    </section>
  );
}
