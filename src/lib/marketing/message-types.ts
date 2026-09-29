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
export const messageScopesFor = (platform: string): readonly string[] =>
  platform === "facebook" ? MESSENGER_SCOPES : platform === "instagram" ? INSTAGRAM_MESSAGE_SCOPES : [];

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
  customer: { name: string | null; username: string | null };
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

/** The end of the 24-hour reply window (null when the customer never wrote). */
export function replyWindowEnd(lastCustomerAt: string | null): string | null {
  const t = time(lastCustomerAt);
  return t ? new Date(t + REPLY_WINDOW_MS).toISOString() : null;
}

/** Whether the Hub may answer now. */
export const canReplyNow = (lastCustomerAt: string | null, now: number = Date.now()) => {
  const t = time(lastCustomerAt);
  return t > 0 && now < t + REPLY_WINDOW_MS;
};
