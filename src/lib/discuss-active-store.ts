"use client";

/* ---------------------------------------------------------------------------
   discuss-active-store — which Discuss conversation the user is ACTIVELY
   viewing (channel open AND the tab in the foreground).

   Published by DiscussApp; read by NotificationBell. WeChat behaviour: a
   message that arrives in the chat you're already looking at should chime but
   NOT add to the notification-bell badge — you can see it, so there's nothing
   to notify. When Discuss isn't the foreground view, this is null and every
   inbound message counts as normal.

   In-memory module singleton (one per tab); no persistence, no network.
   --------------------------------------------------------------------------- */

let activeChannelId: string | null = null;
const listeners = new Set<(id: string | null) => void>();

/** DiscussApp calls this with the open channel id when visible, null otherwise. */
export function setActiveDiscussChannel(id: string | null): void {
  if (activeChannelId === id) return;
  activeChannelId = id;
  for (const l of listeners) {
    try { l(id); } catch { /* one bad listener must not break the rest */ }
  }
}

/** The channel the user is actively viewing, or null. */
export function getActiveDiscussChannel(): string | null {
  return activeChannelId;
}

export function subscribeActiveDiscussChannel(fn: (id: string | null) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
