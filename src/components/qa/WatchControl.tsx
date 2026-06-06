"use client";

/* ---------------------------------------------------------------------------
   WatchControl — follow/unfollow an issue (Phase 5).

   Shared by the admin console and the reporter view:
     • showWatchers=true  → Watch button + count + watcher avatars (admin)
     • showWatchers=false → Watch button + count only (reporter; identities
       are never sent to non-admins by the API anyway)

   Optimistic toggle, reconciled from the server response. No polling.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { qaT } from "@/lib/translations/qa";
import type { QaWatcher } from "@/lib/qa/types";

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export default function WatchControl({ issueId, showWatchers = false }: { issueId: string; showWatchers?: boolean }) {
  const { t } = useTranslation(qaT);
  const [count, setCount] = useState(0);
  const [watching, setWatching] = useState(false);
  const [watchers, setWatchers] = useState<QaWatcher[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/qa/${issueId}/watchers`, { credentials: "include", cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        setCount(j.count ?? 0);
        setWatching(!!j.is_watching);
        setWatchers(j.watchers ?? []);
      } else {
        // Don't present "Watch / 0" as authoritative when the load failed.
        setErr(humanizeError(j.error ?? `HTTP ${res.status}`));
      }
    } catch {
      setErr(t("qa.watch.loadErr", "Couldn't load watch state."));
    } finally { setLoading(false); }
  }, [issueId, t]);
  useEffect(() => { void load(); }, [load]);

  async function toggle() {
    if (busy) return;
    setBusy(true); setErr(null);
    const next = !watching;
    // Optimistic.
    setWatching(next);
    setCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await fetch(`/api/qa/${issueId}/watch`, { method: next ? "POST" : "DELETE", credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeError(j.error ?? `HTTP ${res.status}`));
      setWatching(!!j.is_watching);
      if (typeof j.count === "number") setCount(j.count);
      if (showWatchers) void load(); // refresh avatar list after a change
    } catch (e) {
      // Revert on failure.
      setWatching(!next);
      setCount((c) => Math.max(0, c + (next ? -1 : 1)));
      setErr(e instanceof Error ? e.message : t("qa.watch.updateErr", "Couldn't update."));
    } finally { setBusy(false); }
  }

  const shown = watchers.slice(0, 5);
  const extra = Math.max(0, count - shown.length);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || loading}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50 ${
          watching
            ? "border-[var(--accent)] bg-[var(--bg-surface)] text-[var(--text-secondary)]"
            : "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent)]"
        }`}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill={watching ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        {watching ? t("qa.watch.watching", "Watching") : t("qa.watch.watch", "Watch")}
      </button>

      <span className="text-[12px] text-[var(--text-dim)] tabular-nums">
        {loading ? "…" : `${count} ${count === 1 ? t("qa.watch.one", "watcher") : t("qa.watch.many", "watchers")}`}
      </span>

      {showWatchers && shown.length > 0 && (
        <div className="flex items-center -space-x-1.5">
          {shown.map((w) => (
            <span
              key={w.account_id}
              title={w.name}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-[var(--bg-secondary)] bg-[var(--bg-surface-active)] text-[8px] font-bold text-[var(--text-secondary)]"
            >
              {initials(w.name)}
            </span>
          ))}
          {extra > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full border border-[var(--bg-secondary)] bg-[var(--bg-surface)] px-1 text-[8px] font-bold text-[var(--text-dim)]">
              +{extra}
            </span>
          )}
        </div>
      )}

      {err && <span className="text-[11px] text-rose-500 dark:text-rose-300">{err}</span>}
    </div>
  );
}
