"use client";

/* Client access to /api/platform-settings — reads ride the /api/shell batch
   (SHELL_SECTION maps the URL), so screens normally pay no extra request.
   `null` = not known yet; render NOTHING in that state (standing rule:
   never paint an unknown value), not a guess that flickers. */

import { useEffect, useState } from "react";
import { cachedGet, invalidateCachedGet } from "@/lib/client-cache";

interface PlatformSettings {
  settings?: { qa_reporter_enabled?: boolean };
}

export function useQaReporterEnabled(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    cachedGet<PlatformSettings>("/api/platform-settings")
      .then((d) => {
        if (alive) setOn(d?.settings?.qa_reporter_enabled !== false);
      })
      .catch(() => {
        /* Can't read the flag → keep today's behaviour (button exists). */
        if (alive) setOn(true);
      });
    const onFlip = (e: Event) => {
      const v = (e as CustomEvent<boolean>).detail;
      if (alive && typeof v === "boolean") setOn(v);
    };
    window.addEventListener("kx:qa-reporter-flag", onFlip);
    return () => {
      alive = false;
      window.removeEventListener("kx:qa-reporter-flag", onFlip);
    };
  }, []);
  return on;
}

/** SA-only write; resolves true on success. Broadcasts so every mounted
 *  consumer (floating button, AI bars) follows without a reload. */
export async function setQaReporterEnabled(value: boolean): Promise<boolean> {
  try {
    const res = await fetch("/api/platform-settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "qa_reporter_enabled", value }),
    });
    if (!res.ok) return false;
    invalidateCachedGet("/api/platform-settings");
    window.dispatchEvent(new CustomEvent("kx:qa-reporter-flag", { detail: value }));
    return true;
  } catch {
    return false;
  }
}
