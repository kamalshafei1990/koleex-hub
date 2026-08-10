"use client";

/* ---------------------------------------------------------------------------
   NotificationBellGate — the bell at rest, without the bell's code.

   WHY THIS EXISTS (measured 2026-08-09). NotificationBell is 1105 lines and
   pulls the inbox + discuss + supabase data layer. It is already loaded with
   next/dynamic — but it MOUNTS on every page immediately, so its chunk is a
   boot chunk in practice: on a cold /home, 22 chunks / 1582 KB all arrive
   inside the first 800 ms, and the Supabase client alone is 184 KB of that.
   `dynamic()` defers nothing when the component renders straight away.

   At rest the bell is an icon and a number. That is all this renders. The
   panel — list, mark-read, realtime, chimes, push — loads on the first click,
   which is the only moment any of it is needed.

   THE COUNT STAYS CORRECT. The heavy module was not computing anything: its
   two counts come from `/api/inbox/feed?resource=badges` and
   `/api/discuss/read?resource=myChannels`. Those are plain GETs, so this
   calls them directly through the shared client cache — same numbers, same
   requests, none of the code. cachedGet also means the real bell reuses these
   responses instead of re-fetching when it finally mounts.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import BellIcon from "@/components/icons/ui/BellIcon";
import { cachedGet } from "@/lib/client-cache";

/* Loaded ONLY once the user opens it. `loading` renders nothing: the gate's
   own button stays on screen underneath until the real one takes over, so the
   header never flickers or shifts. */
const NotificationBell = dynamic(() => import("./NotificationBell"), {
  ssr: false,
  loading: () => null,
});

interface Badges { data?: { unread?: number } }
interface Channels { data?: { unread_count?: number }[] }

export default function NotificationBellGate({ dk }: { dk: boolean }) {
  const [opened, setOpened] = useState(false);
  const [count, setCount] = useState(0);

  /* Poll the two counts while the panel is closed. Once it is open the real
     bell owns the numbers (and its own realtime), so this steps aside rather
     than fighting it for the same endpoints. */
  useEffect(() => {
    if (opened) return;
    let alive = true;
    const read = async () => {
      try {
        const [inbox, channels] = await Promise.all([
          cachedGet<Badges>("/api/inbox/feed?resource=badges", 15_000).catch(() => null),
          cachedGet<Channels>("/api/discuss/read?resource=myChannels", 15_000).catch(() => null),
        ]);
        if (!alive) return;
        const unreadInbox = inbox?.data?.unread ?? 0;
        const unreadDiscuss = (channels?.data ?? []).reduce((n, c) => n + (c?.unread_count ?? 0), 0);
        setCount(unreadInbox + unreadDiscuss);
      } catch { /* a missing badge is not worth an error state */ }
    };
    void read();
    const iv = window.setInterval(() => {
      if (document.visibilityState === "visible") void read();
    }, 60_000);
    return () => { alive = false; window.clearInterval(iv); };
  }, [opened]);

  /* Handed over: the real bell renders its own button AND its panel, so the
     stub must disappear or there would be two bells. */
  if (opened) return <NotificationBell dk={dk} defaultOpen />;

  return (
    <button
      type="button"
      aria-label="Notifications"
      aria-haspopup="menu"
      aria-expanded={false}
      /* pointerenter: start the download the moment the cursor arrives, so the
         panel is usually already there by the time the click lands. */
      onPointerEnter={() => { void import("./NotificationBell"); }}
      onClick={() => setOpened(true)}
      className={`relative flex items-center justify-center w-8 h-8 md:w-9 md:h-9 rounded-lg border transition-all ${
        dk
          ? "kx-hover-glow border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white hover:bg-white/[0.06]"
          : "kx-hover-glow border-black/[0.08] bg-black/[0.03] text-black/55 hover:text-black hover:bg-black/[0.06]"
      }`}
    >
      <BellIcon size={15} className="md:w-4 md:h-4" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -end-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center ring-2 ring-[var(--bg-primary)]"
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
