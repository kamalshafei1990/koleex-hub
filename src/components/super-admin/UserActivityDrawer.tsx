"use client";

/* ---------------------------------------------------------------------------
   UserActivityDrawer — Super Admin per-user detail.

   Profile · active sessions (with force-logout) · recent activity timeline ·
   device/IP history · login history · failed logins. Reads
   GET /api/super-admin/user/[id]; force-logout POSTs to the revoke route.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PowerIcon from "@/components/icons/ui/PowerIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";

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
  recent_activity: Array<{
    id: string;
    event_type: string;
    title: string | null;
    module: string | null;
    route: string | null;
    severity: string;
    created_at: string;
  }>;
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

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/super-admin/user/${accountId}`, { credentials: "include" });
      if (res.ok) setDetail((await res.json()) as Detail);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

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
    <div className="fixed inset-0 z-[70] flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
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
          <div className="flex-1 flex items-center justify-center"><SpinnerIcon className="h-6 w-6 animate-spin text-[var(--text-dim)]" /></div>
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
                            {revoking === s.session_id ? <SpinnerIcon className="h-3 w-3 animate-spin" /> : <PowerIcon className="h-3 w-3" />}
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

            {/* Recent activity timeline */}
            <Section title="Recent activity" icon={<ActivityIcon className="h-3.5 w-3.5" />}>
              {detail.recent_activity.length === 0 ? (
                <p className="text-[12px] text-[var(--text-ghost)]">No activity yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {detail.recent_activity.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 text-[12px]">
                      <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${a.severity === "critical" ? "bg-[#FF3333]" : a.severity === "warning" ? "bg-[#FFCC00]" : "bg-[var(--text-ghost)]"}`} />
                      <div className="flex-1 min-w-0">
                        <span className="text-[var(--text-primary)]">{a.title || a.event_type}</span>
                        <span className="text-[var(--text-dim)]"> · {a.module || a.route || "—"}</span>
                      </div>
                      <span className="text-[10.5px] text-[var(--text-ghost)] shrink-0">{fmt(a.created_at)}</span>
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
