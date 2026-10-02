"use client";

/* ---------------------------------------------------------------------------
   SocialCalendar — the month of a marketing space, in SHANGHAI time (owner,
   27/09/2026): each day shows what goes out (scheduled, and posts still being
   written or approved that have a time) and what went out (published from the
   Hub, and posts published on the accounts outside the Hub). A post opens in
   the composer; a post from outside opens on its platform; an empty day (today
   or later) starts a new post on that day.

   Fits every screen, never slides sideways: a 7-day grid when the page is
   wide enough, a list of days on a narrow one — chosen by a container query,
   so nothing moves after the first paint. Weeks start on Monday.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import Button from "@/components/kds/Button";
import EmptyState from "@/components/kds/EmptyState";
import Modal from "@/components/kds/Modal";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import AngleLeftIcon from "@/components/icons/ui/AngleLeftIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import { useTranslation } from "@/lib/i18n";
import { POSTS_T } from "@/lib/marketing/posts-i18n";
import { dayKey, hm, shanghai } from "@/lib/marketing/format";
import { SPACE_POSTS, type MarketingSpace } from "@/lib/marketing/spaces";
import type { CalendarItem } from "@/lib/marketing/post-types";

type Tr = (key: string) => string;
type Month = { y: number; m: number };

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const MAX_IN_CELL = 3;

/* The grid's days: from the Monday on or before the 1st to the Sunday on or
   after the last day (4–6 weeks). Plain calendar arithmetic on UTC dates. */
function monthGrid({ y, m }: Month): Array<{ key: string; day: number; inMonth: boolean }> {
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const total = Math.ceil((lead + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i));
    return { key: keyOf(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1 };
  });
}

/* Colour by where it stands; semantic, never decorative. */
function dotCls(i: CalendarItem): string {
  if (i.status === "outside") return "border border-[var(--text-dim)] bg-transparent";
  if (i.status === "published") return "bg-[#10B981]";
  if (i.status === "partly_published" || i.status === "failed") return "bg-[#F59E0B]";
  if (i.status === "scheduled" || i.status === "approved" || i.status === "publishing") return "bg-[#567FB2]";
  return "bg-[var(--text-dim)]";
}

export default function SocialCalendar({ space }: { space: MarketingSpace }) {
  const { t } = useTranslation(POSTS_T);
  const router = useRouter();
  const postsHome = SPACE_POSTS[space];
  const today = dayKey(new Date());
  const [month, setMonth] = useState<Month>(() => {
    const s = shanghai(new Date());
    return { y: s?.y ?? 2026, m: s?.m ?? 1 };
  });
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [error, setError] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);

  const grid = useMemo(() => monthGrid(month), [month]);

  /* Retry state: the month being shown, how many quiet retries ran, and the
     pending timer. A new month starts the count over; leaving the screen
     cancels whatever is pending. */
  const retries = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const monthRef = useRef(month);
  monthRef.current = month;

  const load = useCallback(async (m: Month) => {
    const days = monthGrid(m);
    setError(false);
    try {
      const res = await fetch(`/api/marketing/calendar?space=${space}&from=${days[0].key}&to=${days[days.length - 1].key}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { items: CalendarItem[]; canCreate: boolean };
      retries.current = 0;
      setItems(body.items);
      setCanCreate(body.canCreate);
    } catch {
      setError(true);
      /* A cold server or a dropped connection heals by itself: two quiet
         retries (4s, then 12s), only while the failed month is still shown. */
      if (retries.current < 2) {
        retries.current += 1;
        const delay = retries.current === 1 ? 4_000 : 12_000;
        retryTimer.current = window.setTimeout(() => {
          const cur = monthRef.current;
          if (cur.y === m.y && cur.m === m.m) void load(m);
        }, delay);
      }
    }
  }, [space]);

  useEffect(() => { retries.current = 0; }, [month]);
  useEffect(() => () => { if (retryTimer.current !== null) window.clearTimeout(retryTimer.current); }, []);

  useEffect(() => { void load(month); }, [load, month]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const i of items ?? []) map.set(dayKey(i.at), [...(map.get(dayKey(i.at)) ?? []), i]);
    return map;
  }, [items]);

  const shift = (n: number) => {
    setItems(null);
    setMonth((cur) => {
      const d = new Date(Date.UTC(cur.y, cur.m - 1 + n, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1 };
    });
  };
  const goToday = () => {
    const s = shanghai(new Date());
    if (!s || (s.y === month.y && s.m === month.m)) return;
    setItems(null);
    setMonth({ y: s.y, m: s.m });
  };
  const open = (i: CalendarItem) => {
    if (i.kind === "hub") router.push(`${postsHome}/${i.id}`);
    else if (i.permalink) window.open(i.permalink, "_blank", "noopener,noreferrer");
  };
  const newOn = (key: string) => router.push(`${postsHome}/new?date=${key}`);
  const monthItems = (items ?? []).filter((i) => dayKey(i.at).startsWith(`${month.y}-${pad(month.m)}`));
  const agendaDays = [...new Set([...monthItems.map((i) => dayKey(i.at)), ...(today.startsWith(`${month.y}-${pad(month.m)}`) ? [today] : [])])].sort();
  const dayLabel = (key: string) => {
    const [, mm, dd] = key.split("-").map(Number);
    const wd = (new Date(`${key}T00:00:00Z`).getUTCDay() + 6) % 7;
    return `${t(`wd.${wd}`)} ${dd} ${t(`m.${mm}`)}`;
  };

  return (
    <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
      <MarketingHeader space={space} />

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="iconSecondary" aria-label={t("cal.prev")} onClick={() => shift(-1)}><AngleLeftIcon size={14} className="rtl:rotate-180" /></Button>
          <h2 className="min-w-[160px] text-center text-[15px] font-semibold text-[var(--text-primary)]">{t(`m.${month.m}`)} {month.y}</h2>
          <Button type="button" variant="iconSecondary" aria-label={t("cal.next")} onClick={() => shift(1)}><AngleRightIcon size={14} className="rtl:rotate-180" /></Button>
          <Button type="button" variant="secondary" onClick={goToday}>{t("cal.today")}</Button>
        </div>
        <span className="text-[11px] text-[var(--text-dim)]">{t("tz.label")}</span>
      </div>

      <div className="@container mt-4">
        {error && !items ? (
          <EmptyState title={t("cal.loadError")} action={<Button type="button" variant="secondary" onClick={() => void load(month)}>{t("retry")}</Button>} />
        ) : (
          <>
            {/* The month as a grid, when there is room for seven days. */}
            <div className="@max-[44rem]:hidden">
              <div className="grid grid-cols-7 gap-1.5 pb-1.5">
                {Array.from({ length: 7 }, (_, i) => (
                  <div key={i} className="truncate px-2 text-[11px] font-semibold text-[var(--text-dim)]">{t(`wd.${i}`)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5" aria-busy={items === null}>
                {grid.map((cell) => {
                  const list = byDay.get(cell.key) ?? [];
                  const isToday = cell.key === today;
                  const canStart = canCreate && cell.key >= today;
                  return (
                    <div key={cell.key} className={`group relative flex min-h-[120px] min-w-0 flex-col gap-1 rounded-xl border p-1.5 ${
                      isToday ? "border-[var(--border-focus)]" : "border-[var(--border-subtle)]"
                    } ${cell.inMonth ? "bg-[var(--bg-surface)]" : "bg-[var(--bg-surface-subtle)] opacity-60"}`}>
                      <div className="flex items-center justify-between gap-1 px-0.5">
                        <span className={`text-[12px] tabular-nums ${isToday ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-muted)]"}`}>{cell.day}</span>
                        {canStart && (
                          <button type="button" aria-label={t("cal.newOn").replace("{day}", dayLabel(cell.key))} onClick={() => newOn(cell.key)}
                            className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--text-dim)] opacity-0 transition-opacity hover:text-[var(--text-primary)] focus-visible:opacity-100 group-hover:opacity-100">
                            <PlusIcon size={12} />
                          </button>
                        )}
                      </div>
                      {items === null ? null : list.slice(0, MAX_IN_CELL).map((i) => <ItemChip key={`${i.kind}-${i.id}`} item={i} t={t} onOpen={() => open(i)} />)}
                      {list.length > MAX_IN_CELL && (
                        <button type="button" onClick={() => setOpenDay(cell.key)} className="px-1 text-start text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)]">
                          {t("cal.more").replace("{n}", String(list.length - MAX_IN_CELL))}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* A list of days, on a narrow screen. */}
            <div className="@[44rem]:hidden flex flex-col gap-3" aria-busy={items === null}>
              {items === null ? (
                [0, 1].map((i) => <div key={i} className="h-[88px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] motion-safe:animate-pulse" />)
              ) : agendaDays.map((key) => (
                <section key={key} className={`flex flex-col gap-2 rounded-2xl border p-3 ${key === today ? "border-[var(--border-focus)]" : "border-[var(--border-subtle)]"} bg-[var(--bg-surface)]`}>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold text-[var(--text-primary)]">{dayLabel(key)}</h3>
                    {canCreate && key >= today && (
                      <button type="button" onClick={() => newOn(key)} className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                        <PlusIcon size={12} />{t("list.new")}
                      </button>
                    )}
                  </div>
                  {(byDay.get(key) ?? []).map((i) => <ItemChip key={`${i.kind}-${i.id}`} item={i} t={t} onOpen={() => open(i)} wide />)}
                </section>
              ))}
            </div>

            {items !== null && monthItems.length === 0 && <p className="mt-4 text-center text-[12px] text-[var(--text-dim)]">{t("cal.empty")}</p>}
          </>
        )}
      </div>

      <Modal open={!!openDay} onClose={() => setOpenDay(null)} title={openDay ? dayLabel(openDay) : ""} maxWidth="max-w-lg"
        actions={<Button type="button" variant="ghost" onClick={() => setOpenDay(null)}>{t("ai.close")}</Button>}>
        <div className="flex flex-col gap-2">
          {(openDay ? byDay.get(openDay) ?? [] : []).map((i) => <ItemChip key={`${i.kind}-${i.id}`} item={i} t={t} onOpen={() => { setOpenDay(null); open(i); }} wide />)}
        </div>
      </Modal>
    </div>
  );
}

function ItemChip({ item, t, onOpen, wide = false }: { item: CalendarItem; t: Tr; onOpen: () => void; wide?: boolean }) {
  const title = item.status === "outside" ? t("cal.outside") : t(`st.${item.status}`);
  return (
    <button type="button" onClick={onOpen} title={title}
      className={`flex w-full min-w-0 items-center gap-1.5 rounded-lg border border-transparent px-1.5 text-start transition-colors hover:border-[var(--border-focus)] ${wide ? "py-2" : "py-1"} bg-[var(--bg-surface-subtle)]`}>
      <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${dotCls(item)}`} />
      <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">{hm(item.at)}</span>
      <span className="inline-flex shrink-0 items-center gap-0.5">{item.accounts.slice(0, 3).map((a) => <BrandGlyph key={a.id} name={a.platform} size={11} />)}</span>
      <span dir="auto" className={`min-w-0 flex-1 truncate text-[12px] text-[var(--text-primary)] ${wide ? "" : "text-[11px]"}`}>{item.excerpt ?? title}</span>
      <span className="sr-only">{title}</span>
    </button>
  );
}
