import "server-only";

/* ---------------------------------------------------------------------------
   GET /api/cron/ai-brief — the morning brief, at each person's chosen hour
   (tasks phase 5, 2026-09-13). Runs hourly (vercel.json). For every active
   internal account whose Koleex AI setting names an hour, and whose local
   hour — in their calendar timezone — is that hour now, and who has not
   had today's brief yet: count today's meetings, tasks due or overdue and
   reminders through the app's own scope, then one inbox message and one
   push that open the chat with ?ask=brief. Nothing is written to tasks or
   calendar; the brief informs. Opt-in only; one per person per day.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/server/supabase-server";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { supersedeUnread } from "@/lib/server/inbox-lifecycle";
import { getReplyLanguage } from "@/lib/server/ai/reply-language";
import { normalizeAiPersonalization } from "@/lib/ai-personalization";
import { buildBriefCounts, briefText, hourIn, dayIn } from "@/lib/server/ai/brief";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const now = new Date();

  /* Who asked for a brief at all: the preference lives in accounts.preferences.ai. */
  const { data: accounts, error } = await supabaseServer
    .from("accounts")
    .select("id, tenant_id, preferences, is_super_admin, roles:role_id(is_super_admin, can_view_private)")
    .eq("user_type", "internal")
    .eq("status", "active")
    .not("preferences->ai->>briefHour", "is", null)
    .limit(2000);
  if (error) {
    console.error("[cron/ai-brief] accounts:", error.message);
    return NextResponse.json({ error: "read failed" }, { status: 500 });
  }

  let due = 0, sent = 0, skipped = 0;
  for (const a of (accounts ?? []) as Array<{
    id: string; tenant_id: string | null; preferences: Record<string, unknown> | null; is_super_admin: boolean | null;
    roles: { is_super_admin?: boolean; can_view_private?: boolean } | Array<{ is_super_admin?: boolean; can_view_private?: boolean }> | null;
  }>) {
    const prefs = (a.preferences ?? {}) as { ai?: unknown; calendar?: { timezone?: string } };
    const hour = normalizeAiPersonalization(prefs.ai).briefHour;
    if (hour === null) continue;
    const tz = prefs.calendar?.timezone || "Asia/Dubai";
    if (hourIn(tz, now) !== hour) continue;
    due++;
    const day = dayIn(tz, now);
    /* One per person per day — the inbox row is the record. */
    const { data: already } = await supabaseServer
      .from("inbox_messages")
      .select("id")
      .eq("recipient_account_id", a.id)
      .eq("metadata->>type", "ai_brief")
      .eq("metadata->>day", day)
      .limit(1);
    if ((already ?? []).length > 0) { skipped++; continue; }

    const role = Array.isArray(a.roles) ? a.roles[0] : a.roles;
    const { data: emp } = await supabaseServer.from("koleex_employees").select("department").eq("account_id", a.id).maybeSingle();
    /* THE PERSON'S OWN ITEMS. A super admin's brief is still about their
       own day, not the tenant's: the scope is the non-admin one on purpose. */
    const counts = await buildBriefCounts(
      {
        accountId: a.id,
        tenantId: a.tenant_id,
        department: (emp as { department?: string | null } | null)?.department ?? null,
        isSuperAdmin: false,
        canViewPrivate: Boolean(role?.can_view_private),
      },
      tz,
      now,
    );
    const lang = (await getReplyLanguage(a.id)) ?? "en";
    const text = briefText(counts, lang);
    /* Today's brief replaces yesterday's if it was never opened. */
    await supersedeUnread({ recipients: [a.id], meta: { type: "ai_brief" } });
    const { error: inboxErr } = await supabaseServer.from("inbox_messages").insert({
      recipient_account_id: a.id,
      sender_account_id: null,
      category: "system",
      subject: text.title,
      body: text.body,
      link: "/ai?ask=brief",
      metadata: { type: "ai_brief", day, counts },
    });
    if (inboxErr) { console.error("[cron/ai-brief] inbox:", inboxErr.message); continue; }
    await sendPushToAccounts([a.id], { title: text.title, body: text.body, url: "/ai?ask=brief", tag: `ai-brief-${day}`, kind: "ai_brief" })
      .catch((e) => console.error("[cron/ai-brief] push:", e));
    sent++;
  }
  console.log(`[cron/ai-brief] due=${due} sent=${sent} skipped=${skipped}`);
  return NextResponse.json({ ok: true, due, sent, skipped });
}
