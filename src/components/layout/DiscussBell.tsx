"use client";

/* ---------------------------------------------------------------------------
   DiscussBell — tiny header-mounted bell that surfaces the total unread
   Discuss count.

   What it does:
     · On mount, does one cheap `fetchMyChannels` call to seed the count.
     · Subscribes to the global Discuss realtime stream via
       `subscribeToMyChannels` — every inbound message that isn't from
       the current user increments the badge in-place (no extra round
       trip).
     · Re-fetches silently whenever a `discuss_channels` row is added or
       updated (someone added us to a new channel) or whenever the
       "discuss:read" window event fires (Discuss app just marked a
       channel as read, so our global count needs to drop).
     · Clicking the bell navigates to /discuss.

   Why a dedicated hook and not a shared context: MainHeader mounts once
   per app session, so a local `useState` + one subscription is cheaper
   than wiring a context. If we ever want other places to see the same
   number we can lift it into a `DiscussUnreadContext` without changing
   this component's public shape.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useCurrentAccount } from "@/lib/identity";
import { fetchMyChannels, subscribeToMyChannels } from "@/lib/discuss";
import {
  playNotificationSound,
  primeNotificationSound,
} from "@/lib/notificationSound";

interface Props {
  dk: boolean;
}

export default function DiscussBell({ dk }: Props) {
  const { account } = useCurrentAccount();
  const accountId = account?.id ?? null;
  const [unread, setUnread] = useState(0);

  /* Stable ref so the realtime subscribe effect doesn't tear down when
     `account` object reference flaps on profile updates. */
  const accountIdRef = useRef<string | null>(accountId);
  useEffect(() => {
    accountIdRef.current = accountId;
  }, [accountId]);

  /* One-shot seed of the count from the DB. Swallow errors — the bell
     is non-critical UI and a 500ms slow-path is fine on first paint. */
  const recount = useCallback(async () => {
    const aid = accountIdRef.current;
    if (!aid) {
      setUnread(0);
      return;
    }
    try {
      const rows = await fetchMyChannels(aid);
      const total = rows.reduce(
        (acc, row) => acc + (row.unread_count ?? 0),
        0,
      );
      setUnread(total);
    } catch {
      /* Leave prior value in place. */
    }
  }, []);

  useEffect(() => {
    void recount();
  }, [accountId, recount]);

  /* Prime the notification-sound AudioContext on mount so the first
     user click anywhere unlocks it. After that, playNotificationSound()
     called from a realtime callback works without further gestures. */
  useEffect(() => {
    primeNotificationSound();
  }, []);

  /* Subscribe once the account is known. Inbound messages that aren't
     from us bump the badge. Channel list changes trigger a silent
     refetch. */
  useEffect(() => {
    if (!accountId) return;
    return subscribeToMyChannels({
      onMessageInsert: (msg) => {
        const myId = accountIdRef.current;
        if (!myId) return;
        if (msg.author_account_id === myId) return;
        setUnread((n) => n + 1);
        /* Play the chime everywhere except on the Discuss page itself —
           when the user is actively chatting the visible UI update is
           enough, and a sound on every keystroke would be obnoxious. */
        if (typeof window !== "undefined") {
          const onDiscuss =
            window.location.pathname === "/discuss" ||
            window.location.pathname.startsWith("/discuss/");
          if (!onDiscuss) {
            playNotificationSound();
          }
        }
      },
      onChannelChange: () => {
        void recount();
      },
    });
  }, [accountId, recount]);

  /* Listen for the custom "discuss:unread-changed" event that
     DiscussApp can dispatch when it marks a channel as read. Lets us
     decrement the global counter without a round-trip. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    function onReadAll() {
      void recount();
    }
    window.addEventListener("discuss:unread-changed", onReadAll);
    /* Refresh whenever the tab regains focus so a long idle session
       resynchronises quickly on return. Cheap: one refetch. */
    window.addEventListener("focus", onReadAll);
    return () => {
      window.removeEventListener("discuss:unread-changed", onReadAll);
      window.removeEventListener("focus", onReadAll);
    };
  }, [recount]);

  const label = unread > 99 ? "99+" : String(unread);
  const showBadge = unread > 0;

  return (
    <Link
      href="/discuss"
      aria-label={
        showBadge ? `Discuss (${unread} unread)` : "Discuss"
      }
      className={`relative flex items-center justify-center w-7 h-7 md:w-9 md:h-9 rounded-md md:rounded-lg border transition-all ${
        dk
          ? "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
          : "border-black/[0.08] bg-black/[0.03] text-black/55 hover:text-black hover:bg-black/[0.06]"
      }`}
    >
      <Bell size={15} className="md:w-4 md:h-4" />
      {showBadge && (
        <span
          className="absolute -top-1 -end-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-primary)]"
          aria-hidden
        >
          {label}
        </span>
      )}
    </Link>
  );
}
