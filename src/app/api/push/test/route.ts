import "server-only";

/* POST /api/push/test — send a real test push to the calling Super Admin's own
   registered devices. Super-Admin only. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { sendPushToAccounts, isPushConfigured } from "@/lib/server/web-push";

export async function POST() {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!auth.is_super_admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!isPushConfigured()) {
    return NextResponse.json(
      { ok: false, error: "VAPID keys are not configured on the server." },
      { status: 503 },
    );
  }

  const accountId = auth.real_account_id ?? auth.account_id;
  const summary = await sendPushToAccounts(
    [accountId],
    {
      title: "Koleex Hub",
      body: "Push notifications are working successfully.",
      url: "/settings/notifications",
      tag: "test",
      kind: "test",
    },
    { actorAccountId: accountId },
  );
  return NextResponse.json({ ok: summary.sent > 0, ...summary });
}
