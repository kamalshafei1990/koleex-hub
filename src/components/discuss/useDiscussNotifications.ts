"use client";

/* ---------------------------------------------------------------------------
   useDiscussNotifications — desktop notifications + sound hook for Discuss.

   What this hook does:
     · Wraps the browser Notification API so pages can raise desktop
       toasts when a new message arrives in a channel the user isn't
       currently looking at.
     · Plays a short bleep sound via Web Audio on the same triggers.
     · Respects three global toggles (persisted to localStorage so the
       preference survives reloads):
         - `sound`   — play/suppress the sound
         - `desktop` — raise/suppress desktop notifications
         - `dnd`     — global "Do Not Disturb"; when on, both sound and
                       desktop notifications are forced off regardless of
                       the individual toggles
     · Respects the per-channel `muted` flag and the
       `notification_pref` enum ("all" | "mentions" | "none") so muted
       channels stay quiet without the caller having to filter.

   Why Web Audio instead of <audio>:
     · No external asset to ship — we synthesize a two-tone chime on the
       fly with an OscillatorNode. Keeps bundle small and avoids CORS
       headaches on SSR.
     · Plays inline on the first user gesture (Chrome's autoplay policy),
       which means the very first inbound message after page load might
       play silently until the user clicks once. That's expected and
       matches Slack's behavior.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const LS_KEY_SOUND = "discuss:pref:sound";
const LS_KEY_DESKTOP = "discuss:pref:desktop";
const LS_KEY_DND = "discuss:pref:dnd";

type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

export interface NotifyInput {
  /** Title of the desktop toast — usually "New message in #channel" */
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

export interface DiscussNotificationState {
  /** Current browser permission state. `unsupported` = window/Notification
   *  is unavailable (SSR or old browser). */
  permission: NotificationPermissionState;
  /** Is sound enabled in user prefs? */
  soundEnabled: boolean;
  /** Is desktop toast enabled in user prefs? */
  desktopEnabled: boolean;
  /** Is global DND on? */
  dndEnabled: boolean;
}

export interface DiscussNotificationApi extends DiscussNotificationState {
  /** Request Notification.permission from the browser. Must be called
   *  from a user gesture handler (button click) for Chrome. */
  requestDesktopPermission: () => Promise<NotificationPermissionState>;
  /** Toggle the global sound pref. */
  setSoundEnabled: (on: boolean) => void;
  /** Toggle the global desktop-toast pref. */
  setDesktopEnabled: (on: boolean) => void;
  /** Toggle the global DND pref. */
  setDndEnabled: (on: boolean) => void;
  /** Fire a notification — the hook will internally decide whether to
   *  play the sound, raise the toast, or stay silent based on user
   *  prefs + the per-channel `muted` / `notification_pref` passed in. */
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

/** Read a boolean pref from localStorage with a default fallback. */
function readBoolPref(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === "1") return true;
    if (v === "0") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function writeBoolPref(key: string, value: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    /* Quota or privacy mode — silently ignore. */
  }
}

export function useDiscussNotifications(): DiscussNotificationApi {
  const [permission, setPermission] = useState<NotificationPermissionState>(
    "default",
  );
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() =>
    readBoolPref(LS_KEY_SOUND, true),
  );
  const [desktopEnabled, setDesktopEnabledState] = useState<boolean>(() =>
    readBoolPref(LS_KEY_DESKTOP, true),
  );
  const [dndEnabled, setDndEnabledState] = useState<boolean>(() =>
    readBoolPref(LS_KEY_DND, false),
  );

  /* Shared AudioContext — created lazily on the first notify() so we
     respect Chrome's autoplay policy (AudioContext must be constructed
     from a user gesture, but once constructed it can play forever). */
  const audioCtxRef = useRef<AudioContext | null>(null);

  /* Read the current browser permission on mount. We avoid doing this
     on SSR because Notification is undefined there. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof Notification === "undefined") {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as NotificationPermissionState);
  }, []);

  const setSoundEnabled = useCallback((on: boolean) => {
    setSoundEnabledState(on);
    writeBoolPref(LS_KEY_SOUND, on);
  }, []);

  const setDesktopEnabled = useCallback((on: boolean) => {
    setDesktopEnabledState(on);
    writeBoolPref(LS_KEY_DESKTOP, on);
  }, []);

  const setDndEnabled = useCallback((on: boolean) => {
    setDndEnabledState(on);
    writeBoolPref(LS_KEY_DND, on);
  }, []);

  const requestDesktopPermission = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      return "unsupported" as const;
    }
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result as NotificationPermissionState;
    } catch {
      return "denied" as const;
    }
  }, []);

  /** Synthesize a short two-tone "bloop" chime. Cheap, no assets. */
  const playChime = useCallback(() => {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new Ctor();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        void ctx.resume();
      }
      const now = ctx.currentTime;
      /* Two notes: 880 Hz → 1320 Hz over 180ms with a soft envelope. */
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);
    } catch {
      /* Autoplay blocked, user denied audio, whatever — stay silent. */
    }
  }, []);

  const notify = useCallback<DiscussNotificationApi["notify"]>(
    (input, channelPrefs) => {
      /* Global DND wins over everything else. */
      if (dndEnabled) return;
      if (channelPrefs.muted) return;

      /* Per-channel filter: if the user set this channel to "mentions"
         only, bail unless THIS message actually mentions them. "none"
         bails unconditionally. */
      if (channelPrefs.pref === "none") return;
      if (channelPrefs.pref === "mentions" && !channelPrefs.mentionsMe) return;

      /* Sound first — cheapest and most noticeable. */
      if (soundEnabled) playChime();

      /* Desktop toast requires explicit permission. */
      if (
        desktopEnabled &&
        permission === "granted" &&
        typeof window !== "undefined" &&
        typeof Notification !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
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
      }
    },
    [dndEnabled, soundEnabled, desktopEnabled, permission, playChime],
  );

  return useMemo(
    () => ({
      permission,
      soundEnabled,
      desktopEnabled,
      dndEnabled,
      requestDesktopPermission,
      setSoundEnabled,
      setDesktopEnabled,
      setDndEnabled,
      notify,
    }),
    [
      permission,
      soundEnabled,
      desktopEnabled,
      dndEnabled,
      requestDesktopPermission,
      setSoundEnabled,
      setDesktopEnabled,
      setDndEnabled,
      notify,
    ],
  );
}
