import "server-only";

/* ---------------------------------------------------------------------------
   Web Push sender (VAPID).

   Sends a push payload to a set of account ids by looking up their ACTIVE
   push_subscriptions and delivering via web-push. Best-effort: failures are
   logged to notification_logs and dead endpoints (404/410) are deactivated so
   we never spam a removed device. Returns a small summary.

   Env required (server): VAPID_PRIVATE_KEY, VAPID_SUBJECT, and the public key
   NEXT_PUBLIC_VAPID_PUBLIC_KEY. If unset, push is a no-op (in-app still works).
   --------------------------------------------------------------------------- */

/* Cold-start note (Phase 4 — Platform Speed Max-Out, Workstream 2):
   `web-push` (+ its https/crypto/asn1 transitive tree) is loaded LAZILY inside
   the send path via dynamic import — NOT at module scope. This module is pulled
   in (transitively, for a rarely-taken notify branch) by the Discuss mutate
   route, the activity heartbeat, signin, and every audit-instrumented mutation
   route; keeping `web-push` off their module graph removes it from those
   routes' serverless cold start. `isPushConfigured()` stays a pure env check so
   callers can gate cheaply without loading the package. */
import type WebPush from "web-push";
import { supabaseServer } from "@/lib/server/supabase-server";
import { activityAllowed, classifyNotificationActivity, inQuietHours } from "@/lib/notification-activity";

/** Are the VAPID keys present? Pure env check — does NOT load `web-push`. */
export function isPushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured: boolean | null = null;

/** Lazily import `web-push`, configure VAPID once, and return the module — or
    null if keys are missing / setup fails. The dynamic import is what keeps the
    package off the cold-start graph of every route that transitively imports
    this file for a notify path it may never take. */
async function loadConfiguredWebPush(): Promise<typeof WebPush | null> {
  if (!isPushConfigured()) return null;
  const webpush = (await import("web-push")).default;
  if (configured === true) return webpush;
  if (configured === false) return null;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@koleexgroup.com";
  try {
    webpush.setVapidDetails(subject, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    configured = true;
    return webpush;
  } catch (e) {
    console.error("[web-push] setVapidDetails failed:", e instanceof Error ? e.message : e);
    configured = false;
    return null;
  }
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  kind?: string;
}

interface SubRow {
  id: string;
  account_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Send a push to every active device of the given accounts. Logs each attempt
 *  to notification_logs and prunes dead endpoints. */
export async function sendPushToAccounts(
  accountIds: string[],
  payload: PushPayload,
  opts?: { actorAccountId?: string | null },
): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  const ids = Array.from(new Set(accountIds.filter(Boolean)));
  if (ids.length === 0) return result;

  const webpush = await loadConfiguredWebPush();
  if (!webpush) {
    // Keys not set — record as skipped so the SA panel shows why.
    await logPush(ids[0], opts?.actorAccountId, payload, "skipped", "vapid_not_configured", null).catch(
      () => undefined,
    );
    result.skipped = ids.length;
    return result;
  }

  /* Per-activity preference gate. The eight "By activity" switches in
     Settings → Notifications live in accounts.preferences.notifications;
     until this gate existed they were written but never read, so turning
     "Task reminders" off changed nothing. Classify the payload kind with the
     SAME shared rules the client chime uses; recipients who disabled that
     activity are skipped (logged once as activity_disabled). Kinds outside
     the eight activities (payments, answers, new-device alerts…) are never
     gated. Unset keys default to ON, so this cannot silence anyone who has
     not explicitly opted out. */
  const activity = classifyNotificationActivity(payload.kind);
  let allowedIds = ids;
  {
    const { data: prefRows } = await supabaseServer
      .from("accounts")
      .select("id, preferences")
      .in("id", ids);
    type PrefRow = { id: string; preferences: { notifications?: Record<string, unknown> } | null };
    const rows = (prefRows ?? []) as PrefRow[];
    const now = new Date();
    const activityMuted = new Set(
      rows.filter((r) => !activityAllowed(r.preferences?.notifications, activity)).map((r) => r.id),
    );
    /* Quiet hours — evaluated on the RECIPIENT's saved local window/zone.
       Independent of the activity gate: it silences every push kind. */
    const quiet = new Set(
      rows
        .filter((r) => !activityMuted.has(r.id))
        .filter((r) => inQuietHours(
          (r.preferences?.notifications as { quiet_hours?: { enabled?: boolean; start?: string; end?: string; tz?: string } } | undefined)?.quiet_hours,
          now,
        ))
        .map((r) => r.id),
    );
    if (activityMuted.size) {
      result.skipped += activityMuted.size;
      await logPush(
        [...activityMuted][0], opts?.actorAccountId, payload, "skipped",
        `activity_disabled:${activity} (${activityMuted.size})`, null,
      ).catch(() => undefined);
    }
    if (quiet.size) {
      result.skipped += quiet.size;
      await logPush(
        [...quiet][0], opts?.actorAccountId, payload, "skipped",
        `quiet_hours (${quiet.size})`, null,
      ).catch(() => undefined);
    }
    if (activityMuted.size || quiet.size) {
      allowedIds = ids.filter((id) => !activityMuted.has(id) && !quiet.has(id));
    }
    if (allowedIds.length === 0) return result;
  }

  const { data } = await supabaseServer
    .from("push_subscriptions")
    .select("id, account_id, endpoint, p256dh, auth")
    .in("account_id", allowedIds)
    .eq("is_active", true);
  const subs = (data ?? []) as SubRow[];
  if (subs.length === 0) return result;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? "",
    url: payload.url ?? "/super-admin/activity",
    tag: payload.tag,
  });

  const deadIds: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        /* timeout: the push services (FCM/APNs/Mozilla) normally answer in
           <1s, but a stale endpoint can black-hole the socket with NO
           default timeout — which once held the sign-in response hostage
           until the function limit. 8s library timeout + a 10s outer race
           as the hard backstop. */
        await Promise.race([
          webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
            { TTL: 60 * 60 * 24, urgency: "high", timeout: 8000 },
          ),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("push_send_timeout")), 10_000),
          ),
        ]);
        result.sent += 1;
        await logPush(s.account_id, opts?.actorAccountId, payload, "sent", null, s.endpoint);
      } catch (e: unknown) {
        const status = (e as { statusCode?: number })?.statusCode;
        const msg = e instanceof Error ? e.message : String(e);
        // 404/410 = subscription gone → deactivate so we stop trying it.
        if (status === 404 || status === 410) deadIds.push(s.id);
        result.failed += 1;
        await logPush(s.account_id, opts?.actorAccountId, payload, "failed", msg, s.endpoint);
      }
    }),
  );

  if (deadIds.length) {
    await supabaseServer
      .from("push_subscriptions")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .in("id", deadIds);
  }
  return result;
}

async function logPush(
  recipient: string | null,
  actor: string | null | undefined,
  payload: PushPayload,
  status: "sent" | "failed" | "skipped",
  error: string | null,
  endpoint: string | null,
): Promise<void> {
  try {
    await supabaseServer.from("notification_logs").insert({
      recipient_account_id: recipient,
      actor_account_id: actor ?? null,
      kind: payload.kind ?? "push",
      title: payload.title,
      body: payload.body ?? null,
      channel: "push",
      status,
      error,
      endpoint,
    });
  } catch {
    /* logging must never throw */
  }
}
