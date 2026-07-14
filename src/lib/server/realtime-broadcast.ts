import "server-only";

/* ---------------------------------------------------------------------------
   Server → client realtime pings (RLS realtime-lockdown P3, broadcast model).

   The Discuss/inbox tables are (being) locked to service_role, so clients can
   no longer use anon `postgres_changes` to learn about new activity. Instead,
   after every write the server emits a lightweight **Broadcast** ping on a
   per-channel / per-recipient topic. Clients keep a realtime subscription but
   listen for `broadcast` (which needs no table access — same mechanism the
   typing/presence indicators already use) and, on a ping, refetch through the
   gated read endpoints (which enforce membership). The ping carries NO row
   data, so a topic being world-subscribable leaks only "something changed",
   never message content.

   Fire-and-forget: a ping that fails to send must never break the write that
   triggered it (the refetch-on-focus / interval safety net still reconciles).
   --------------------------------------------------------------------------- */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export type BroadcastPing = { topic: string; event?: string; payload?: Record<string, unknown> };

/** Topic helpers — keep names in one place so client + server never drift. */
export const rtTopic = {
  channel: (channelId: string) => `discuss:channel:${channelId}`,
  account: (accountId: string) => `discuss:account:${accountId}`,
  inbox: (accountId: string) => `inbox:account:${accountId}`,
};

/** Emit one or more broadcast pings. Never throws — logs and returns. */
export async function emitPings(pings: BroadcastPing[]): Promise<void> {
  if (!URL || !KEY || pings.length === 0) return;
  try {
    await fetch(`${URL}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: pings.map((p) => ({
          topic: p.topic,
          event: p.event ?? "changed",
          payload: p.payload ?? {},
        })),
      }),
      // Don't let a slow realtime edge hold up the API response.
      signal: AbortSignal.timeout(2500),
    });
  } catch (e) {
    // Swallow — the client's focus/interval refetch is the safety net.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[realtime-broadcast] ping failed:", e instanceof Error ? e.message : e);
    }
  }
}

/** Ping a channel's topic + every member's account topic (so open channels
 *  refresh AND everyone's sidebar re-sorts / re-counts). The account-topic
 *  payload carries the sender + channel ids ONLY (never message content) so
 *  the notification bell can chime / skip self before the reconciling refetch
 *  lands. */
export async function pingChannelActivity(
  channelId: string,
  memberAccountIds: string[],
  authorAccountId?: string,
): Promise<void> {
  const pings: BroadcastPing[] = [{ topic: rtTopic.channel(channelId) }];
  const accountPayload = { channelId, authorId: authorAccountId ?? null };
  for (const id of new Set(memberAccountIds)) {
    if (id) pings.push({ topic: rtTopic.account(id), payload: accountPayload });
  }
  await emitPings(pings);
}
