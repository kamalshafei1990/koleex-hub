import "server-only";

/* ---------------------------------------------------------------------------
   /api/inbox/mute — the caller's muted notification topics.

   GET [?lang=zh|ar]     → the caller's mutes (Settings → Notifications), each
                           named in that language from its template
   POST { id }           → mute the topic of one of the caller's notifications
   POST { unmute: id }   → unmute

   Always the session's own account (lib/server/notification-mutes).
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { listMutes, muteTopicOf, unmute } from "@/lib/server/notification-mutes";
/* The dictionary rides THIS route only — never lib/server/notification-
   mutes, which the push sender imports. */
import { partsText, renderNotification } from "@/lib/notification-templates";
import type { Lang } from "@/lib/i18n";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const rows = await listMutes(auth.account_id);
  if (!rows) return NextResponse.json({ error: "Could not read mutes" }, { status: 500 });
  const q = new URL(req.url).searchParams.get("lang");
  const lang: Lang = q === "zh" || q === "ar" ? q : "en";
  const data = rows.map((m) => {
    const r = m.tpl ? renderNotification({ tpl: m.tpl }, lang) : null;
    return { id: m.id, app: m.app, name: (r ? partsText(r.subject) : "") || m.label || "—", created_at: m.created_at };
  });
  return NextResponse.json({ ok: true, data });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  let body: { id?: unknown; unmute?: unknown };
  try { body = (await req.json()) as typeof body; }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  if (typeof body.unmute === "string") {
    if (!UUID.test(body.unmute)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    const ok = await unmute(auth.account_id, body.unmute);
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Could not unmute" }, { status: 500 });
  }
  if (typeof body.id !== "string" || !UUID.test(body.id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
  const r = await muteTopicOf(auth.account_id, body.id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json({ ok: true, mute: r.mute });
}
