/* ---------------------------------------------------------------------------
   notification-mute-client — "Stop notifications about this", from the
   browser: mute a notification's topic (the bell, the center), list and
   unmute (Settings → Notifications). Fetch only, on purpose: Settings reads
   it, and nothing the bell's chunk holds may ride along (validate:budgets §L
   — a shared import splits the bell into several files).
   --------------------------------------------------------------------------- */

export interface NotificationMute {
  id: string;
  app: string | null;
  /** Its name in the reader's language (rendered by the server). */
  name: string;
  created_at: string;
}

async function call(method: "GET" | "POST", url: string, body?: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url, {
      method,
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return res.ok ? j ?? {} : null;
  } catch {
    return null;
  }
}

/** Mute the topic of one of your notifications. */
export async function muteTopic(inboxId: string): Promise<boolean> {
  return !!(await call("POST", "/api/inbox/mute", { id: inboxId }));
}

export async function unmuteTopic(muteId: string): Promise<boolean> {
  return !!(await call("POST", "/api/inbox/mute", { unmute: muteId }));
}

/** Your muted topics, newest first, named in `lang` — null when the read failed. */
export async function fetchMutes(lang: string): Promise<NotificationMute[] | null> {
  const j = await call("GET", `/api/inbox/mute?lang=${encodeURIComponent(lang)}`);
  return j ? ((j.data as NotificationMute[] | undefined) ?? []) : null;
}
