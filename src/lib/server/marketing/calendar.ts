import "server-only";

/* ---------------------------------------------------------------------------
   marketing/calendar — what goes out, and what went out, day by day
   (Shanghai days): the space's posts written in the Hub that have a time —
   scheduled, planned in a draft, waiting for approval — or were published;
   and the posts published on its accounts OUTSIDE the Hub (from the Feed),
   so the calendar shows everything that reached the audience. Every read is
   bounded; a range is at most six weeks.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { inChunks } from "@/lib/server/in-chunks";
import { allSpaceAccounts } from "@/lib/server/marketing/accounts";
import { fromShanghai } from "@/lib/marketing/format";
import type { CalendarItem, PostMedia, PostStatus } from "@/lib/marketing/post-types";
import type { MarketingSpace } from "@/lib/marketing/spaces";

const MAX_DAYS = 42;
const CAP = 500;

type PostRow = { id: string; status: PostStatus; body: string; media: PostMedia[] | null; scheduled_at: string | null; published_at: string | null };

const excerptOf = (text: string | null): string | null => {
  const t = (text ?? "").trim();
  if (!t) return null;
  const chars = Array.from(t);
  return chars.length > 140 ? `${chars.slice(0, 140).join("").trimEnd()}…` : t;
};

/** The instants a Shanghai-day range covers, or null when it is not a valid
 *  range of at most six weeks. */
export function calendarRange(from: string, to: string): { start: string; end: string } | null {
  const start = fromShanghai(from, "00:00");
  const endDay = fromShanghai(to, "00:00");
  if (!start || !endDay) return null;
  const days = (Date.parse(endDay) - Date.parse(start)) / 86_400_000;
  if (days < 0 || days > MAX_DAYS) return null;
  return { start, end: new Date(Date.parse(endDay) + 86_400_000).toISOString() };
}

export async function loadCalendar(tenantId: string, space: MarketingSpace, range: { start: string; end: string }): Promise<CalendarItem[]> {
  const cols = "id, status, body, media, scheduled_at, published_at";
  const [planned, published, accounts] = await Promise.all([
    supabaseServer.from("marketing_posts").select(cols).eq("tenant_id", tenantId).eq("space", space)
      .in("status", ["draft", "in_review", "rejected", "approved", "scheduled", "publishing"])
      .gte("scheduled_at", range.start).lt("scheduled_at", range.end).order("scheduled_at", { ascending: true }).limit(CAP),
    supabaseServer.from("marketing_posts").select(cols).eq("tenant_id", tenantId).eq("space", space)
      .in("status", ["published", "partly_published", "failed"])
      .gte("published_at", range.start).lt("published_at", range.end).order("published_at", { ascending: true }).limit(CAP),
    allSpaceAccounts(tenantId, space),
  ]);
  if (planned.error) throw new Error(`marketing posts: ${planned.error.message}`);
  if (published.error) throw new Error(`marketing posts: ${published.error.message}`);
  const byId = new Map<string, PostRow>();
  for (const r of [...(planned.data ?? []), ...(published.data ?? [])] as PostRow[]) byId.set(r.id, r);
  const posts = [...byId.values()];
  const accountOf = new Map(accounts.map((a) => [a.id, a]));

  const { data: targets, error: tErr } = await inChunks<{ post_id: string; account_id: string; id: string }>(posts.map((p) => p.id), (chunk) =>
    supabaseServer.from("marketing_post_targets").select("id, post_id, account_id").in("post_id", chunk).limit(chunk.length * 20));
  if (tErr) throw new Error(`marketing post targets: ${tErr.message}`);
  const targetsOf = new Map<string, Array<{ account_id: string }>>();
  for (const t of targets ?? []) targetsOf.set(t.post_id, [...(targetsOf.get(t.post_id) ?? []), t]);

  const items: CalendarItem[] = posts.map((p) => {
    const media = Array.isArray(p.media) ? p.media : [];
    const at = (["published", "partly_published", "failed"].includes(p.status) ? p.published_at : p.scheduled_at) ?? p.scheduled_at ?? p.published_at ?? range.start;
    return {
      kind: "hub",
      id: p.id,
      at,
      status: p.status,
      excerpt: excerptOf(p.body),
      thumb: media[0] ? { kind: media[0].kind, url: media[0].url } : null,
      accounts: (targetsOf.get(p.id) ?? []).map((t) => accountOf.get(t.account_id)).filter((a): a is NonNullable<typeof a> => !!a).map((a) => ({ id: a.id, platform: a.platform, name: a.name })),
      permalink: null,
    };
  });

  /* Posts on the accounts that did not come from the Hub. */
  const apiIds = accounts.filter((a) => a.connection === "api").map((a) => a.id);
  if (apiIds.length) {
    const { data: remote, error: rErr } = await supabaseServer
      .from("marketing_remote_posts")
      .select("id, account_id, message, media, permalink, posted_at")
      .eq("tenant_id", tenantId)
      .in("account_id", apiIds)
      .is("target_id", null)
      .gte("posted_at", range.start)
      .lt("posted_at", range.end)
      .order("posted_at", { ascending: true })
      .limit(CAP);
    if (rErr) throw new Error(`marketing posts: ${rErr.message}`);
    for (const r of (remote ?? []) as Array<{ id: string; account_id: string; message: string | null; media: Array<{ kind: "image" | "video"; url: string }> | null; permalink: string | null; posted_at: string }>) {
      const a = accountOf.get(r.account_id);
      items.push({
        kind: "remote",
        id: r.id,
        at: r.posted_at,
        status: "outside",
        excerpt: excerptOf(r.message),
        thumb: Array.isArray(r.media) && r.media[0] ? r.media[0] : null,
        accounts: a ? [{ id: a.id, platform: a.platform, name: a.name }] : [],
        permalink: r.permalink,
      });
    }
  }
  return items.sort((x, y) => (x.at < y.at ? -1 : x.at > y.at ? 1 : 0));
}
