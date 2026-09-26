import "server-only";

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { logPrivateCalendarReads, orLikeTerm } from "@/lib/server/calendar-access";
import { accountTimezones } from "@/lib/server/calendar-notify";
import { loadExceptions } from "@/lib/server/calendar-exceptions";
import { expandWithExceptions, type CalendarRec } from "@/lib/calendar-recurrence";
import { allDayKeys } from "@/lib/calendar-tz";
import type { CalendarSearchHit } from "@/lib/calendar-types";

/* GET /api/calendar/search?q=<text>[&accountId=<id>]  → { hits: CalendarSearchHit[] }

   The Calendar's search box: the account's OWN events and the events it is
   invited to whose title, location or description contains the text, within
   three months either side of today. A recurring event is one hit, at its
   next occurrence (exceptions applied) — or its last one in the window when
   the series is over. Upcoming hits first, then the most recent past ones.

   The account is the caller's own; `accountId` names another one only for a
   Super Admin (the rule of GET /api/calendar/events), and then the feed's
   private-record rule applies: that account's private events are left out
   unless the role has can_view_private, and a disclosed one is logged.

   The text is matched literally (LIKE metacharacters escaped, and the
   characters that would re-shape the PostgREST filter neutralised). */

const SPAN_MS = 92 * 86_400_000;
const LIMIT = 50;

type Row = {
  id: string; account_id: string; title: string; location: string | null;
  start_at: string; end_at: string; all_day: boolean; is_private: boolean | null;
  recurrence: CalendarRec; recurrence_until: string | null;
};
const COLS = "id, account_id, title, location, start_at, end_at, all_day, is_private, recurrence, recurrence_until";

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Calendar");
  if (deny) return deny;

  const params = new URL(req.url).searchParams;
  const q = (params.get("q") ?? "").trim().slice(0, 100);
  const accountId = params.get("accountId") || auth.account_id;
  const viewingOwn = accountId === auth.account_id;
  if (!viewingOwn && !auth.is_super_admin) {
    return NextResponse.json({ error: "Only a Super Admin can search another account's calendar" }, { status: 403 });
  }
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const hidePrivate = !viewingOwn && !auth.can_view_private;

  const now = Date.now();
  const from = new Date(now - SPAN_MS);
  const to = new Date(now + SPAN_MS);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const fromDate = fromISO.slice(0, 10);
  const term = orLikeTerm(q);
  const text = `title.ilike.${term},location.ilike.${term},description.ilike.${term}`;

  const base = (invited: boolean) => {
    let b = invited
      ? supabaseServer
          .from("koleex_calendar_events")
          .select(`${COLS}, koleex_calendar_event_attendees!inner(account_id)`)
          .eq("koleex_calendar_event_attendees.account_id", accountId)
          .neq("account_id", accountId)
      : supabaseServer.from("koleex_calendar_events").select(COLS).eq("account_id", accountId);
    if (auth.tenant_id) b = b.eq("tenant_id", auth.tenant_id);
    if (!invited && hidePrivate) b = b.eq("is_private", false);
    return b.or(text);
  };
  const oneOffs = (invited: boolean) => base(invited).is("recurrence", null).lt("start_at", toISO).gte("end_at", fromISO).limit(100);
  const series = (invited: boolean) => base(invited)
    .not("recurrence", "is", null).lte("start_at", toISO)
    .or(`recurrence_until.is.null,recurrence_until.gte.${fromDate}`).limit(100);

  const results = await Promise.all([oneOffs(false), series(false), oneOffs(true), series(true)]);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    console.error("[api/calendar/search]", failed.error.message);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
  const rows = results.flatMap((r, i) => ((r.data ?? []) as unknown as Row[]).map((row) => ({ row, invited: i >= 2 })));
  if (rows.length === 0) return NextResponse.json({ hits: [] });
  if (!viewingOwn && auth.can_view_private) {
    logPrivateCalendarReads(auth, rows.filter((r) => !r.invited && r.row.is_private).map((r) => r.row.id));
  }

  const [tzs, exceptions] = await Promise.all([
    accountTimezones(rows.map((r) => r.row.account_id)),
    loadExceptions(rows.filter((r) => r.row.recurrence).map((r) => r.row.id)),
  ]);

  const hits: CalendarSearchHit[] = [];
  for (const { row, invited: inv } of rows) {
    const tz = tzs.get(row.account_id) ?? "UTC";
    let start = row.start_at;
    let end = row.end_at;
    let occurrence: string | undefined;
    let title = row.title;
    let location = row.location;
    let own: Pick<CalendarSearchHit, "meeting_url" | "description"> = {};
    if (row.recurrence) {
      const occ = expandWithExceptions(row.start_at, row.end_at, row.recurrence, row.recurrence_until, from, to, exceptions.get(row.id), 800, tz);
      if (occ.length === 0) continue;
      const pick = occ.find((o) => o.end.getTime() >= now) ?? occ[occ.length - 1];
      start = pick.start.toISOString();
      end = pick.end.toISOString();
      occurrence = pick.original.toISOString();
      if (pick.override?.title) title = pick.override.title;
      if (pick.override?.location != null) location = pick.override.location || null;
      /* '' = none for this occurrence; NULL = as the series. */
      if (pick.override?.meeting_url != null) own = { ...own, meeting_url: pick.override.meeting_url || null };
      if (pick.override?.description != null) own = { ...own, description: pick.override.description || null };
    }
    const dates = row.all_day ? allDayKeys(start, end, tz) : null;
    hits.push({
      id: row.id,
      title,
      location,
      start_at: start,
      end_at: end,
      all_day: row.all_day,
      ...(dates ? { start_date: dates.start, end_date: dates.end } : {}),
      recurring: !!row.recurrence,
      invited: inv,
      ...(occurrence ? { occurrence_start: occurrence } : {}),
      ...own,
    });
  }

  const upcoming = hits.filter((h) => Date.parse(h.end_at) >= now).sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  const past = hits.filter((h) => Date.parse(h.end_at) < now).sort((a, b) => Date.parse(b.start_at) - Date.parse(a.start_at));
  return NextResponse.json(
    { hits: [...upcoming, ...past].slice(0, LIMIT) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
