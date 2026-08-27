"use client";

/* ---------------------------------------------------------------------------
   UserActivityDrawer — Super Admin per-user detail.

   Profile · active sessions (with force-logout) · recent activity timeline ·
   device/IP history · login history · failed logins. Reads
   GET /api/super-admin/user/[id]; force-logout POSTs to the revoke route.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PowerIcon from "@/components/icons/ui/PowerIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import { eventLabel } from "@/lib/activity/modules";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

interface AccountInfo {
  account_id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  role: string | null;
  avatar_url: string | null;
}
interface Detail {
  account: AccountInfo | null;
  sessions: Array<{
    session_id: string;
    status: string;
    current_route: string | null;
    current_module: string | null;
    device_type: string | null;
    browser: string | null;
    os: string | null;
    ip: string | null;
    country: string | null;
    started_at: string;
    last_seen_at: string;
  }>;
  day: string;
  day_events: Array<{
    id: string;
    event_type: string;
    title: string | null;
    module: string | null;
    route: string | null;
    severity: string;
    created_at: string;
  }>;
  usage: { today_s: number; last7_s: number; last30_s: number };
  devices: Array<Record<string, unknown>>;
  login_history: Array<Record<string, unknown>>;
  failed_logins: Array<Record<string, unknown>>;
}

function fmt(ts: unknown): string {
  if (typeof ts !== "string") return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

const dot: Record<string, string> = {
  online: "bg-[#00CC66]",
  idle: "bg-[#FFCC00]",
  offline: "bg-[var(--text-ghost)]",
};

function shiftDay(day: string, delta: number): string {
  return new Date(new Date(`${day}T00:00:00Z`).getTime() + delta * 86400_000).toISOString().slice(0, 10);
}
/* Day/Month/Year — the house date rule. */
function dmyLabel(day: string): string {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}
function fmtDur(seconds: number): string {
  if (!seconds) return "0m";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = seconds / 3600;
  return `${h >= 10 ? Math.round(h) : h.toFixed(1)}h`;
}

type JourneyRow =
  | { kind: "segment"; time: string; label: string; duration: string | null }
  | { kind: "event"; time: string; label: string; severity: string };

/* Fold a day's raw events (ascending) into a readable journey:
   consecutive page views inside one module become a single "Quotations —
   35m" segment; a gap longer than 15 minutes closes the segment (idle);
   everything that is not a routine page view — logins, session ends,
   warnings — interrupts as its own row. Pure derivation over data the
   monitor already collects: no new tracking, no schema change. */
function buildJourney(events: Detail["day_events"]): JourneyRow[] {
  const GAP_MS = 15 * 60 * 1000;
  const out: JourneyRow[] = [];
  /* 24-hour, fixed width — "01:23 PM" wrapped the narrow time gutter onto
     two lines and made every row twice as tall. */
  const hhmm = (ts: string) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  const durTxt = (ms: number) => {
    const m = Math.round(ms / 60000);
    if (m < 1) return null;
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  };

  let seg: { module: string; start: string; last: string } | null = null;
  const flush = () => {
    if (!seg) return;
    const ms = new Date(seg.last).getTime() - new Date(seg.start).getTime();
    out.push({ kind: "segment", time: hhmm(seg.start), label: seg.module, duration: durTxt(ms) });
    seg = null;
  };

  for (const e of events) {
    /* session_end fires on every tab close and idle timeout — ten "Left the
       app" rows per afternoon, drowning the journey exactly the way raw page
       views drowned the feed. The segments already end where the person
       stopped; the row adds nothing. */
    if (e.event_type === "session_end") continue;
    if (e.event_type === "page_view") {
      const mod = e.module || e.route || "App";
      if (seg && seg.module === mod && new Date(e.created_at).getTime() - new Date(seg.last).getTime() < GAP_MS) {
        seg.last = e.created_at;
        continue;
      }
      flush();
      seg = { module: mod, start: e.created_at, last: e.created_at };
      continue;
    }
    flush();
    out.push({ kind: "event", time: hhmm(e.created_at), label: eventLabel(e) || e.event_type, severity: e.severity });
  }
  flush();
  return out;
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-dim)]">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function UserActivityDrawer({
  accountId,
  onClose,
  onChanged,
}: {
  accountId: string;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  /* Which (UTC) day's journey is shown — same day convention as usage_daily,
     so the hour chips and the journey can never disagree about "today". */
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/super-admin/user/${accountId}?day=${day}`, { credentials: "include" });
      if (res.ok) setDetail((await res.json()) as Detail);
    } finally {
      setLoading(false);
    }
  }, [accountId, day]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const forceLogout = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await fetch("/api/super-admin/session/revoke", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      await load();
      onChanged?.();
    } finally {
      setRevoking(null);
    }
  };

  const acc = detail?.account;

  return (
    <div className="kx-below-header fixed inset-x-0 bottom-0 top-14 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-full max-w-[480px] bg-[var(--bg-secondary)] border-s border-[var(--border-subtle)] shadow-[-12px_0_40px_rgba(0,0,0,0.45)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)] truncate">
              {acc?.name || acc?.username || "User"}
            </h2>
            <p className="text-[12px] text-[var(--text-dim)] truncate">
              {acc?.email || "—"}{acc?.role ? ` · ${acc.role}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><SpinnerIcon className="h-6 w-6 text-[var(--text-dim)]" /></div>
        ) : !detail ? (
          <div className="flex-1 flex items-center justify-center text-[12px] text-[var(--text-ghost)]">Couldn’t load this user.</div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Active sessions */}
            <Section title="Sessions" icon={<MonitorIcon className="h-3.5 w-3.5" />}>
              {detail.sessions.length === 0 ? (
                <p className="text-[12px] text-[var(--text-ghost)]">No sessions recorded.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.sessions.map((s) => (
                    <li key={s.session_id} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary)] capitalize">
                          <span className={`h-2 w-2 rounded-full ${dot[s.status] ?? dot.offline}`} />
                          {s.status}
                        </span>
                        {s.status !== "offline" && (
                          <button
                            type="button"
                            onClick={() => forceLogout(s.session_id)}
                            disabled={revoking === s.session_id}
                            className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg border border-[#FF3333]/30 text-[#FF6B6B] text-[11px] font-semibold hover:bg-[#FF3333]/10 disabled:opacity-50"
                          >
                            {revoking === s.session_id ? <SpinnerIcon className="h-3 w-3" /> : <PowerIcon className="h-3 w-3" />}
                            Force logout
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 text-[11.5px] text-[var(--text-dim)]">
                        {s.browser || "?"} on {s.os || "?"} · {s.device_type || "?"}
                        {s.country ? ` · ${s.country}` : ""}{s.ip ? ` · ${s.ip}` : ""}
                      </div>
                      <div className="text-[10.5px] text-[var(--text-ghost)]">
                        {s.current_module || "—"}{s.current_route ? ` · ${s.current_route}` : ""} · last seen {fmt(s.last_seen_at)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* The person's DAY, as a journey — the owner's question is
                "what is he doing / what did he do", and fifty raw page-view
                rows do not answer it. Same events, read as a story: page
                views merge into "35m in Quotations" segments; logins,
                warnings and anything non-routine stay as their own marked
                rows inside the flow. */}
            <Section title="Journey" icon={<ActivityIcon className="h-3.5 w-3.5" />}>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDay(shiftDay(day, -1))}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                    aria-label="Previous day"
                  >‹</button>
                  <span className="text-[11.5px] font-medium tabular-nums text-[var(--text-secondary)]">{dmyLabel(day)}</span>
                  <button
                    type="button"
                    onClick={() => setDay(shiftDay(day, 1))}
                    disabled={day >= new Date().toISOString().slice(0, 10)}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] disabled:opacity-30"
                    aria-label="Next day"
                  >›</button>
                </div>
                <div className="flex items-center gap-1.5 text-[10.5px] text-[var(--text-dim)]">
                  <span className="rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5">Today {fmtDur(detail.usage.today_s)}</span>
                  <span className="rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5">7d {fmtDur(detail.usage.last7_s)}</span>
                  <span className="rounded-md border border-[var(--border-subtle)] px-1.5 py-0.5">30d {fmtDur(detail.usage.last30_s)}</span>
                </div>
              </div>
              {buildJourney(detail.day_events).length === 0 ? (
                <p className="text-[12px] text-[var(--text-ghost)]">No activity on this day.</p>
              ) : (
                <ul className="space-y-1">
                  {buildJourney(detail.day_events).map((seg, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[12px]">
                      <span className="w-[38px] shrink-0 text-[10.5px] tabular-nums text-[var(--text-ghost)] pt-0.5">{seg.time}</span>
                      {seg.kind === "segment" ? (
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-ghost)] shrink-0" />
                          <span className="text-[var(--text-primary)] truncate">{seg.label}</span>
                          {seg.duration && <span className="text-[10.5px] text-[var(--text-dim)] shrink-0">{seg.duration}</span>}
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${seg.severity === "critical" ? "bg-[#FF3333]" : seg.severity === "warning" ? "bg-[#FFCC00]" : "bg-[#7FA9D6]"}`} />
                          <span className={`truncate ${seg.severity === "critical" ? "text-[#FF6B6B]" : seg.severity === "warning" ? "text-[#FFCC00]" : "text-[var(--text-secondary)]"}`}>{seg.label}</span>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Devices */}
            <Section title="Devices" icon={<GlobeIcon className="h-3.5 w-3.5" />}>
              {detail.devices.length === 0 ? (
                <p className="text-[12px] text-[var(--text-ghost)]">No devices recorded.</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.devices.map((d, i) => (
                    <li key={i} className="text-[11.5px] text-[var(--text-secondary)] flex items-center justify-between gap-2">
                      <span className="truncate">
                        {String(d.browser ?? "?")} on {String(d.os ?? "?")}
                        {d.last_country ? ` · ${String(d.last_country)}` : ""}{d.last_ip ? ` · ${String(d.last_ip)}` : ""}
                        {d.is_blocked ? " · 🚫 blocked" : d.is_trusted ? " · trusted" : ""}
                      </span>
                      <span className="text-[10.5px] text-[var(--text-ghost)] shrink-0">{fmt(d.last_seen_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Login history */}
            <Section title="Login history" icon={<MonitorIcon className="h-3.5 w-3.5" />}>
              {detail.login_history.length === 0 ? (
                <p className="text-[12px] text-[var(--text-ghost)]">No login history.</p>
              ) : (
                <ul className="space-y-1">
                  {detail.login_history.map((h, i) => (
                    <li key={i} className="text-[11.5px] text-[var(--text-secondary)] flex items-center justify-between gap-2">
                      <span className="truncate">{String(h.event_type ?? "—")}{h.ip_address ? ` · ${String(h.ip_address)}` : ""}</span>
                      <span className="text-[10.5px] text-[var(--text-ghost)] shrink-0">{fmt(h.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Failed logins */}
            <Section title="Failed logins" icon={<ShieldExclamationIcon className="h-3.5 w-3.5" />}>
              {detail.failed_logins.length === 0 ? (
                <p className="text-[12px] text-[var(--text-ghost)]">No failed login attempts.</p>
              ) : (
                <ul className="space-y-1">
                  {detail.failed_logins.map((f, i) => (
                    <li key={i} className="text-[11.5px] flex items-center justify-between gap-2">
                      <span className="truncate text-[#FF6B6B]">
                        {String(f.outcome ?? "failure")}{f.reason ? ` · ${String(f.reason)}` : ""}{f.ip_address ? ` · ${String(f.ip_address)}` : ""}
                      </span>
                      <span className="text-[10.5px] text-[var(--text-ghost)] shrink-0">{fmt(f.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
