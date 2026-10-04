import "server-only";

/* ---------------------------------------------------------------------------
   marketing/meta-messages — a Page's private messages on Messenger and on
   its Instagram account (the Messenger Platform, Graph API v26.0, checked
   29/09/2026):

   · read: me/conversations?platform=messenger|instagram with the Page key
     ("me" is the Page, so an Instagram account needs no Page id of its
     own), each conversation with its 20 newest messages — all Meta shows.
     Newest conversations come first, so reading stops at the first one not
     updated since the last read.
   · send: me/messages with messaging_type RESPONSE — inside the 24 hours
     after the customer's last message.
   Meta asks for pages_messaging (Instagram: instagram_manage_messages) and
   pages_manage_metadata. Until Meta's review grants Advanced Access, only
   people with a role on the app appear. The key travels in the
   Authorization header (metaGet / metaPost).
   --------------------------------------------------------------------------- */

import { MetaError, metaGet, metaGraphUrl, metaPost } from "@/lib/server/marketing/meta";
import type { MessageAttachment } from "@/lib/marketing/message-types";

export type MessagePlatform = "messenger" | "instagram";

export interface RemoteMessage {
  external_id: string;
  from_us: boolean;
  text: string | null;
  attachments: MessageAttachment[];
  sent_at: string | null;
}

export interface RemoteConversation {
  external_id: string;
  updated_at: string | null;
  customer: { external_id: string | null; name: string | null; username: string | null };
  /** Oldest first. */
  messages: RemoteMessage[];
}

type Paging = { paging?: { cursors?: { after?: string }; next?: string } };
const nextCursor = (b: Paging): string | null => (b.paging?.next ? b.paging.cursors?.after ?? null : null);

type GraphAttachment = { mime_type?: string; name?: string; file_url?: string; image_data?: { url?: string; preview_url?: string }; video_data?: { url?: string; preview_url?: string } };
type GraphParty = { id?: string; name?: string; username?: string; email?: string };
type GraphMessage = { id: string; created_time?: string; message?: string; from?: GraphParty; attachments?: { data?: GraphAttachment[] } };
type GraphConversation = { id: string; updated_time?: string; participants?: { data?: GraphParty[] }; messages?: { data?: GraphMessage[] } };

const FIELDS = "id,updated_time,participants,messages.limit(20){id,created_time,message,from,attachments{mime_type,name,file_url,image_data{url,preview_url},video_data{url,preview_url}}}";
/** Pages of conversations read per run (25 each). */
const PAGES_MAX = 4;
/** Meta's updated_time has whole seconds: the minute before the last read's
 *  newest is read again, so a conversation updated in the same second is
 *  never skipped (saving it twice changes nothing). */
const OVERLAP_MS = 60_000;

function attachmentsOf(m: GraphMessage): MessageAttachment[] {
  const out: MessageAttachment[] = [];
  for (const a of m.attachments?.data ?? []) {
    if (a.image_data?.url) out.push({ kind: "image", url: a.image_data.preview_url || a.image_data.url, name: a.name ?? null });
    else if (a.video_data?.url) out.push({ kind: "video", url: a.video_data.preview_url || a.video_data.url, name: a.name ?? null });
    else if (a.file_url) out.push({ kind: "file", url: a.file_url, name: a.name ?? null });
  }
  return out.slice(0, 10);
}

/** Conversations updated since `since` (all of them without it; the minute
 *  before it again), newest first. `ownId`: the Page's id (Messenger) or the
 *  Instagram account's — whoever is not us is the customer. */
export async function pageConversations(token: string, platform: MessagePlatform, ownId: string, since: string | null): Promise<RemoteConversation[]> {
  const out: RemoteConversation[] = [];
  const from = since ? (Date.parse(since) || 0) - OVERLAP_MS : 0;
  let after: string | null = null;
  for (let page = 0; page < PAGES_MAX; page++) {
    const params: Record<string, string> = { platform, fields: FIELDS, limit: "25" };
    if (after) params.after = after;
    const b = await metaGet<{ data?: GraphConversation[] } & Paging>(metaGraphUrl("me/conversations", params), token);
    let older = false;
    for (const c of b.data ?? []) {
      if (from > 0 && c.updated_time && Date.parse(c.updated_time) < from) { older = true; break; }
      const other = (c.participants?.data ?? []).find((p) => p.id && p.id !== ownId) ?? null;
      const messages = (c.messages?.data ?? []).map((m): RemoteMessage => ({
        external_id: m.id,
        from_us: !!m.from?.id && m.from.id === ownId,
        text: m.message?.trim() ? m.message : null,
        attachments: attachmentsOf(m),
        sent_at: m.created_time ?? null,
      })).reverse();
      out.push({
        external_id: c.id,
        updated_at: c.updated_time ?? null,
        customer: { external_id: other?.id ?? null, name: other?.name ?? null, username: other?.username ?? null },
        messages,
      });
    }
    after = nextCursor(b);
    if (older || !after) break;
  }
  return out;
}

/** A customer's picture — the profile API of a Messenger PSID or an
 *  Instagram IGSID, with the Page key. Meta's links expire; null when Meta
 *  shares none. */
export async function customerPicture(token: string, customerId: string): Promise<string | null> {
  const b = await metaGet<{ profile_pic?: string }>(metaGraphUrl(customerId, { fields: "profile_pic" }), token);
  return typeof b.profile_pic === "string" && b.profile_pic.startsWith("https://") ? b.profile_pic : null;
}

/** Answer a customer; Meta's id of the message sent. */
export async function sendMessage(token: string, recipientId: string, text: string): Promise<string> {
  const body = await metaPost<{ message_id?: string }>(metaGraphUrl("me/messages"), token, {
    recipient: JSON.stringify({ id: recipientId }),
    messaging_type: "RESPONSE",
    message: JSON.stringify({ text }),
  });
  if (!body.message_id) throw new MetaError("The platform did not confirm the message.", null);
  return body.message_id;
}

/** Meta's "outside the 24-hour window" refusal (code 10, subcode 2018278). */
export const isWindowClosed = (e: unknown) =>
  e instanceof MetaError && (e.code === 10 || e.code === 100) && /outside of (the )?allowed window|2018278|24 ?hour/i.test(e.message);

/** Meta's "not allowed yet" refusal: the app has no Advanced Access to
 *  message this person (before Meta's review), or a permission is missing. */
export const isNotAllowedYet = (e: unknown) =>
  e instanceof MetaError && (e.code === 10 || e.code === 200 || e.code === 230 || e.code === 3) && !isWindowClosed(e);
