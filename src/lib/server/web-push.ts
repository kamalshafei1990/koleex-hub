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

import webpush from "web-push";
import { supabaseServer } from "@/lib/server/supabase-server";

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@koleexgroup.com";
  if (!publicKey || !privateKey) {
    configured = false;
    return false;
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  } catch (e) {
    console.error("[web-push] setVapidDetails failed:", e instanceof Error ? e.message : e);
    configured = false;
  }
  return configured;
}

/** Is server-side Web Push usable (keys present)? */
export function isPushConfigured(): boolean {
  return ensureConfigured();
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

  if (!ensureConfigured()) {
    // Keys not set — record as skipped so the SA panel shows why.
    await logPush(ids[0], opts?.actorAccountId, payload, "skipped", "vapid_not_configured", null).catch(
      () => undefined,
    );
    result.skipped = ids.length;
    return result;
  }

  const { data } = await supabaseServer
    .from("push_subscriptions")
    .select("id, account_id, endpoint, p256dh, auth")
    .in("account_id", ids)
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
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
          { TTL: 60 * 60 * 24, urgency: "high" },
        );
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
