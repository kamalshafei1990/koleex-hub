/* ---------------------------------------------------------------------------
   marketing/message-types — private messages (Messenger and Instagram
   Direct), as the screens see them, and the ONE rule for «Needs a reply»
   and the 24-hour reply window, shared by the server's count and the screen.

   A conversation NEEDS A REPLY when the customer wrote last and nobody
   marked it «No reply needed» since. Meta lets a Page answer only within 24
   hours of the customer's last message; after that the Hub says so and the
   answer is written on the platform.
   --------------------------------------------------------------------------- */

import type { MarketingAccountView } from "@/lib/marketing/spaces";

/** Longest message the Hub sends (Instagram's limit; Messenger allows more). */
export const MESSAGE_MAX = 1000;
/** Meta's standard reply window after the customer's last message. */
export const REPLY_WINDOW_MS = 24 * 3_600_000;

/** The permissions Meta asks for reading and answering messages. */
export const MESSENGER_SCOPES = ["pages_messaging", "pages_manage_metadata"] as const;
export const INSTAGRAM_MESSAGE_SCOPES = ["instagram_manage_messages", "pages_manage_metadata"] as const;
/** An Instagram account connected with Instagram Login (the CEO's) asks for
 *  its own permission instead (lib/marketing/instagram-login). */
export const INSTAGRAM_LOGIN_MESSAGE_SCOPES = ["instagram_business_manage_messages"] as const;
export const messageScopesFor = (platform: string, scopes: readonly string[] = []): readonly string[] =>
  platform === "facebook" ? MESSENGER_SCOPES
    : platform === "instagram" ? (scopes.includes("instagram_business_basic") ? INSTAGRAM_LOGIN_MESSAGE_SCOPES : INSTAGRAM_MESSAGE_SCOPES)
    : [];

export interface MessageAttachment { kind: "image" | "video" | "file"; url: string; name: string | null }

export interface MessageView {
  id: string;
  from_us: boolean;
  text: string | null;
  attachments: MessageAttachment[];
  sent_at: string | null;
  /** Who answered from the Hub (our messages only). */
  sent_by_name: string | null;
}

export interface ConversationView {
  id: string;
  account: MarketingAccountView;
  /** avatar_url: Meta's picture of the customer (its link may have expired). */
  customer: { name: string | null; username: string | null; avatar_url: string | null };
  snippet: string | null;
  last_message_at: string | null;
  last_customer_at: string | null;
  last_from_us: boolean;
  needs_reply: boolean;
  handled_at: string | null;
  handled_by_name: string | null;
  /** The end of Meta's 24-hour reply window, counted from the customer's
   *  last message (null when they never wrote) — more than one answer may
   *  go inside it. */
  window_ends_at: string | null;
}

export type MessageFilter = "needs" | "all";
export const MESSAGE_FILTERS: readonly MessageFilter[] = ["needs", "all"];

const time = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0);

/** «Needs a reply» — see the header. */
export function conversationNeedsReply(c: { last_from_us: boolean; last_customer_at: string | null; handled_at: string | null }): boolean {
  if (c.last_from_us || !c.last_customer_at) return false;
  return !c.handled_at || time(c.handled_at) < time(c.last_customer_at);
}

/** A Page message that comes within this long of the customer's message is
 *  Meta's AUTOMATIC reply (an Instant Reply, an away message, an FAQ answer)
 *  — no person answers that fast — so it is not an answer (owner, 29/09/2026;
 *  Koleex's Page answered within 10 s in 35 of its 40 newest conversations). */
export const AUTO_REPLY_MS = 15_000;

/** The conversation's last word that COUNTS: the newest message that is not
 *  an automatic reply. A message a person sent from the Hub always counts.
 *  Oldest first in; its index out (-1: none). */
export function lastCountedIndex(messages: ReadonlyArray<{ from_us: boolean; sent_at: string | null; by_person?: boolean }>): number {
  let counted = -1;
  let customerAt = 0;
  messages.forEach((m, i) => {
    const t = time(m.sent_at);
    if (!m.from_us) { counted = i; customerAt = t; return; }
    if (!m.by_person && customerAt && t >= customerAt && t - customerAt <= AUTO_REPLY_MS) return;
    counted = i;
  });
  return counted;
}

/** The end of the 24-hour reply window (null when the customer never wrote). */
export function replyWindowEnd(lastCustomerAt: string | null): string | null {
  const t = time(lastCustomerAt);
  return t ? new Date(t + REPLY_WINDOW_MS).toISOString() : null;
}

/** Where the team answers once the window has closed: the Page's inbox in
 *  Meta Business Suite (Messenger), the account's Direct inbox (Instagram). */
export function platformInboxUrl(account: Pick<MarketingAccountView, "platform" | "external_id">): string {
  if (account.platform === "instagram") return "https://www.instagram.com/direct/inbox/";
  return account.external_id
    ? `https://business.facebook.com/latest/inbox/all?asset_id=${encodeURIComponent(account.external_id)}`
    : "https://business.facebook.com/latest/inbox/all";
}

/** Whether the Hub may answer now. */
export const canReplyNow = (lastCustomerAt: string | null, now: number = Date.now()) => {
  const t = time(lastCustomerAt);
  return t > 0 && now < t + REPLY_WINDOW_MS;
};
