"use client";

/* ---------------------------------------------------------------------------
   useDiscussNotifications — desktop toast + chime for an inbound Discuss
   message in a channel the user is not looking at.

     · The chime is the shared engine's "message" category (Settings →
       Sounds owns the tone, volume, master switch and do-not-disturb), so
       Discuss and the bell answer to the same switches.
     · The desktop toast uses the browser Notification API and only shows
       while the tab is hidden — a visible tab already shows the message.
     · Per-channel `muted` and `notification_pref` ("all" | "mentions" |
       "none") are honoured here so the caller does not have to filter.

   The hook used to also expose sound / desktop / DND setters and a
   permission prompt; no screen ever rendered them (Settings → Sounds took
   that job), so the surface is now just `notify`.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSoundPrefs, playAppSound, subscribeSoundPrefs } from "@/lib/notificationSound";

export interface NotifyInput {
  /** Title of the desktop toast — usually "#channel" */
  title: string;
  /** Body of the toast — short trimmed message preview */
  body: string;
  /** Icon URL (avatar or channel icon). Optional. */
  icon?: string;
  /** Channel id that raised this event — becomes the Notification tag
   *  so rapid-fire messages in the same channel collapse into one toast
   *  instead of stacking up. */
  channelId: string;
  /** Click handler: called when the user clicks the desktop toast.
   *  Typically focuses the tab and navigates to the channel. */
  onClick?: () => void;
}

export interface DiscussNotificationApi {
  /** Fire a notification — the hook decides whether to play the chime,
   *  raise the toast, or stay silent based on the shared sound prefs and
   *  the per-channel `muted` / `notification_pref` passed in. */
  notify: (
    input: NotifyInput,
    channelPrefs: {
      muted: boolean;
      pref: "all" | "mentions" | "none";
      /** True if this specific message mentions the current user. */
      mentionsMe: boolean;
    },
  ) => void;
}

export function useDiscussNotifications(): DiscussNotificationApi {
  /* DND comes from the SHARED sound engine (Settings → Sounds), so the one
     switch silences Discuss and the bell alike. */
  const [dndEnabled, setDndEnabled] = useState(() => getSoundPrefs().dnd);
  useEffect(() => subscribeSoundPrefs((p) => setDndEnabled(p.dnd)), []);

  const notify = useCallback<DiscussNotificationApi["notify"]>(
    (input, channelPrefs) => {
      /* Global DND wins over everything else. */
      if (dndEnabled) return;
      if (channelPrefs.muted) return;

      /* Per-channel filter: "mentions" bails unless THIS message mentions
         the user; "none" bails unconditionally. */
      if (channelPrefs.pref === "none") return;
      if (channelPrefs.pref === "mentions" && !channelPrefs.mentionsMe) return;

      /* Sound first — the engine applies master/enabled gates, tone and
         volume. */
      playAppSound("message");

      /* Desktop toast: needs a granted permission and a hidden tab. */
      if (
        typeof window === "undefined" ||
        typeof Notification === "undefined" ||
        Notification.permission !== "granted" ||
        document.visibilityState === "visible"
      ) return;
      try {
        const notif = new Notification(input.title, {
          body: input.body,
          icon: input.icon,
          tag: `discuss:${input.channelId}`,
          silent: true, // we play our own chime
        });
        if (input.onClick) {
          notif.onclick = (ev) => {
            ev.preventDefault();
            try {
              window.focus();
            } catch {
              /* Some browsers reject window.focus — ignore. */
            }
            input.onClick?.();
            notif.close();
          };
        }
      } catch {
        /* Notification constructor throws on iOS Safari < 16 — ignore. */
      }
    },
    [dndEnabled],
  );

  return useMemo(() => ({ notify }), [notify]);
}
