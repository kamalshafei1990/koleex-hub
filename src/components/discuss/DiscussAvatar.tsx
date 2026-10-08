"use client";

/* ---------------------------------------------------------------------------
   DiscussAvatar — the one avatar every Discuss surface draws (conversation
   list, message list, thread pane, pickers). Grayscale gradient + initials
   fallback (monochrome-first brand), photo routed through fpAvatar so a
   160px first-party variant is fetched instead of the full-size original
   from *.supabase.co (slow / unreachable from mainland China).
   --------------------------------------------------------------------------- */

import { fpAvatar } from "@/lib/cdn";
import { initialsOf } from "@/lib/discuss/initials";

/* Eight neutral steps (light → dark) give just enough separation between
   adjacent rows without introducing any hue. */
const AVATAR_GRADIENTS = [
  "from-neutral-400 to-neutral-500",
  "from-neutral-500 to-neutral-600",
  "from-neutral-600 to-neutral-700",
  "from-neutral-300 to-neutral-500",
  "from-neutral-500 to-neutral-700",
  "from-neutral-400 to-neutral-600",
  "from-neutral-600 to-neutral-800",
  "from-neutral-300 to-neutral-600",
];

export function avatarGradientFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
}

export function DiscussAvatar({
  name,
  url,
  size = 36,
  icon,
  ring = false,
}: {
  name: string;
  url?: string | null;
  size?: number;
  icon?: React.ReactNode;
  ring?: boolean;
}) {
  const classes = `relative shrink-0 rounded-full overflow-hidden bg-gradient-to-br ${avatarGradientFor(name)} flex items-center justify-center text-white font-semibold ${ring ? "ring-2 ring-[var(--border-focus)]" : ""}`;
  const style = {
    width: size,
    height: size,
    fontSize: Math.max(10, Math.round(size * 0.36)),
  } as React.CSSProperties;
  if (url) {
    return (
      <div className={classes} style={style} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fpAvatar(url)}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className={classes} style={style} aria-hidden>
      {icon ?? initialsOf(name)}
    </div>
  );
}
