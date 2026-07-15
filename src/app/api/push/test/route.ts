import "server-only";

/* POST /api/push/test — send a real test push to the calling Super Admin's own
   registered devices. Super-Admin only. */

import { NextResponse } from "next/server";
import { getServerAuth } from "@/lib/server/auth";
import { sendPushToAccounts, isPushConfigured } from "@/lib/server/web-push";
import { requestMeta, locationLabel } from "@/lib/server/activity";

export async function POST(req: Request) {
  const auth = await getServerAuth();
  if (!auth) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  /* Any signed-in user may register / test their OWN device for push
     (Discuss message alerts, mentions, etc.); every send is per-account. */

  if (!isPushConfigured()) {
    return NextResponse.json(
      { ok: false, error: "VAPID keys are not configured on the server." },
      { status: 503 },
    );
  }

  const accountId = auth.real_account_id ?? auth.account_id;
  // Mirror the live alert format so the test previews the real thing:
  //   Koleex Hub (app) › {account name} › Sent a test notification · from {loc}
  const loc = locationLabel(requestMeta(req));
  const summary = await sendPushToAccounts(
    [accountId],
    {
      title: auth.username || "Koleex Hub",
      body: `Sent a test notification${loc ? ` · from ${loc}` : ""}`,
      url: "/settings/notifications",
      tag: "test",
      kind: "test",
    },
    { actorAccountId: accountId },
  );
  return NextResponse.json({ ok: summary.sent > 0, ...summary });
}
