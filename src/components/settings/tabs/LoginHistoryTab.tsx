"use client";

/* Settings → Login history. Recent sign-in attempts for the current
   account, from GET /api/me/login-history (reads login_attempts). */

import { useEffect, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { withDefaults } from "@/lib/access-control";
import type { DisplayPrefs } from "@/lib/access-control";
import { formatDatePref, formatTimePref } from "@/lib/display-prefs";

interface Attempt {
  ip_address: string;
  user_agent: string | null;
  outcome: "success" | "failure" | "blocked" | "disabled" | "unknown_user";
  created_at: string;
}

function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser =
    /Edg\//.test(ua) ? "Edge" :
    /Chrome\//.test(ua) ? "Chrome" :
    /Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "Browser";
  const os =
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "macOS" :
    /iPhone|iPad|iOS/.test(ua) ? "iOS" :
    /Android/.test(ua) ? "Android" :
    /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

const OUTCOME: Record<Attempt["outcome"], { label: string; color: string }> = {
  success:      { label: "Success",       color: "#00CC66" },
  failure:      { label: "Failed",        color: "#FF6B6B" },
  blocked:      { label: "Blocked",       color: "#FFCC00" },
  disabled:     { label: "Disabled",      color: "#FF6B6B" },
  unknown_user: { label: "Unknown user",  color: "var(--text-faint)" },
};

/* Respect the user's Language & region date/time format (from Settings). */
function fmt(ts: string, disp: DisplayPrefs): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${formatDatePref(d, disp.date_format)} · ${formatTimePref(d, disp.time_format)}`;
}

export default function LoginHistoryTab({ account }: { account: AccountWithLinks }) {
  const disp = withDefaults(account.preferences).display as DisplayPrefs;
  const [rows, setRows] = useState<Attempt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/me/login-history", { credentials: "include" });
        if (!res.ok) throw new Error(`(${res.status})`);
        const json = (await res.json()) as { attempts: Attempt[] };
        if (alive) setRows(json.attempts);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Could not load login history");
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
        <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Recent sign-ins</h2>
        <p className="text-[12px] text-[var(--text-dim)] mt-0.5 mb-4">
          The last 25 attempts on your account. Something you don&apos;t recognize? Change your password in the Password tab.
        </p>

        {rows === null && !error && (
          <div className="flex items-center gap-2 text-[12px] text-[var(--text-dim)] py-4">
            <SpinnerIcon className="h-4 w-4 animate-spin" /> Loading…
          </div>
        )}
        {error && <p className="text-[12px] text-[#FF6B6B] py-2">Couldn&apos;t load history {error}</p>}
        {rows && rows.length === 0 && (
          <p className="text-[12px] text-[var(--text-faint)] py-2">No sign-in activity recorded yet.</p>
        )}

        {rows && rows.length > 0 && (
          <ul className="divide-y divide-[var(--border-faint)]">
            {rows.map((a, i) => {
              const oc = OUTCOME[a.outcome] ?? OUTCOME.unknown_user;
              return (
                <li key={i} className="flex items-center gap-3 py-2.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: oc.color }} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] text-[var(--text-primary)] truncate">
                      {deviceLabel(a.user_agent)} <span className="text-[var(--text-faint)]">· {a.ip_address}</span>
                    </div>
                    <div className="text-[11px] text-[var(--text-dim)]">{fmt(a.created_at, disp)}</div>
                  </div>
                  <span className="text-[11px] font-medium shrink-0" style={{ color: oc.color }}>{oc.label}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        Change your password in the Password tab. Two-factor and remote sign-out are managed by your administrator.
      </p>
    </div>
  );
}
