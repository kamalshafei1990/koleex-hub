"use client";

import { useState } from "react";
import { fpAvatar } from "@/lib/cdn";
import type { TodoAssigneeInfo } from "@/types/supabase";
import { initials } from "./todo-ui";

type Person = Pick<TodoAssigneeInfo, "avatar_url" | "full_name" | "username">;

/* Photo with an initials fallback. The failure remembers WHICH src failed
   and is derived at render, so a new avatar_url is automatically "not
   failed" — no reset effect. */
export default function MiniAvatar({ info, size = 28, ring = false }: { info: Person; size?: number; ring?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc !== null && failedSrc === info.avatar_url;
  const ringCls = ring ? "ring-2 ring-[var(--bg-secondary)]" : "";
  return info.avatar_url && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={fpAvatar(info.avatar_url)} alt="" loading="lazy" decoding="async"
      className={`rounded-full object-cover shrink-0 ${ringCls}`}
      style={{ width: size, height: size }} onError={() => setFailedSrc(info.avatar_url)} />
  ) : (
    <span aria-hidden
      className={`rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] inline-flex items-center justify-center text-[var(--text-dim)] shrink-0 font-bold ${ringCls}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>
      {initials(info.full_name, info.username)}
    </span>
  );
}
