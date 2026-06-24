"use client";

/* Settings → Notifications — Super Admin mobile push management.

   Enable push on this device, see permission status, manage registered
   devices, send a test, tune alert preferences, and review recent deliveries.
   Super-Admin only (normal users never see push controls). */

import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import { useMeBootstrap } from "@/lib/me-bootstrap";
import BellIcon from "@/components/icons/ui/BellIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import TriangleWarningIcon from "@/components/icons/ui/TriangleWarningIcon";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import LockIcon from "@/components/icons/ui/LockIcon";
import AlertPreferencesModal from "@/components/super-admin/AlertPreferencesModal";
import {
  isPushSupported,
  isIosNeedsInstall,
  permissionState,
  subscribeToPush,
  unsubscribeCurrent,
} from "@/lib/push-client";

interface Device {
  id: string;
  device_name: string | null;
  browser: string | null;
  os: string | null;
  created_at: string;
  last_used_at: string | null;
}
interface HistoryRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  channel: string;
  status: string;
  created_at: string;
}

function fmt(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function NotificationsSettingsPage() {
  const { data: boot, loading: bootLoading } = useMeBootstrap();
  const isSA = !!boot?.isSuperAdmin;

  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    setSupported(isPushSupported());
    setNeedsInstall(isIosNeedsInstall());
    setPerm(permissionState());
  }, []);

  const loadDevices = useCallback(async () => {
    const res = await fetch("/api/push/devices", { credentials: "include" });
    if (res.ok) setDevices(((await res.json()) as { devices: Device[] }).devices);
  }, []);
  const loadHistory = useCallback(async () => {
    const res = await fetch("/api/push/history", { credentials: "include" });
    if (res.ok) setHistory(((await res.json()) as { history: HistoryRow[] }).history);
  }, []);

  useEffect(() => {
    if (!isSA) return;
    void loadDevices();
    void loadHistory();
  }, [isSA, loadDevices, loadHistory]);

  const enable = async () => {
    setBusy(true);
    setMsg(null);
    const r = await subscribeToPush();
    setPerm(permissionState());
    if (r.ok) {
      setMsg({ kind: "ok", text: "This device is now registered for notifications." });
      await loadDevices();
    } else {
      setMsg({ kind: "err", text: r.error || "Couldn’t enable notifications." });
    }
    setBusy(false);
  };

  const sendTest = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/push/test", { method: "POST", credentials: "include" });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; sent?: number; error?: string };
    setMsg(
      j.ok
        ? { kind: "ok", text: `Test sent to ${j.sent} device(s). Check your lock screen.` }
        : { kind: "err", text: j.error || "No active devices — enable notifications first." },
    );
    await loadHistory();
    setBusy(false);
  };

  const removeDevice = async (id: string) => {
    await fetch("/api/push/devices", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await loadDevices();
    await unsubscribeCurrent().catch(() => {});
  };

  if (bootLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <SpinnerIcon className="h-6 w-6 animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }
  if (!isSA) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-center">
        <LockIcon className="h-10 w-10 text-[var(--text-ghost)]" />
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">Super Admin only</h2>
        <p className="text-[13px] text-[var(--text-dim)] max-w-sm">Mobile push notifications are restricted to Super Administrators.</p>
      </div>
    );
  }

  const card = "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 md:p-5";
  const btnPrimary =
    "h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2";
  const btnGhost =
    "h-10 px-4 rounded-xl border border-[var(--border-subtle)] text-[13px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-50 inline-flex items-center gap-2";

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        title="Notifications"
        subtitle="Mobile push on your iPhone, iPad, and desktop"
        icon={<BellIcon className="h-5 w-5" />}
        backHref="/settings"
      />

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 space-y-5 max-w-2xl w-full mx-auto">
        {/* iOS install hint */}
        {needsInstall && (
          <div className="rounded-2xl border border-[#FFCC00]/30 bg-[#FFCC00]/[0.06] p-4 text-[12.5px] text-[var(--text-secondary)]">
            <strong className="text-[var(--text-primary)]">iPhone / iPad:</strong> add Koleex Hub to your
            Home Screen first — tap the <strong>Share</strong> icon in Safari → <strong>Add to Home Screen</strong>,
            then open the app from that icon and return here to enable notifications. (iOS only delivers push to
            installed apps.)
          </div>
        )}

        {/* Status + enable */}
        <div className={card}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-semibold text-[var(--text-primary)]">Push on this device</h3>
              <p className="text-[12px] text-[var(--text-dim)] mt-0.5">
                Permission:{" "}
                <span className="font-medium text-[var(--text-secondary)]">
                  {perm === "granted" ? "Granted" : perm === "denied" ? "Blocked" : perm === "unsupported" ? "Unsupported" : "Not set"}
                </span>
                {!supported && perm !== "granted" ? " · not available on this device" : ""}
              </p>
            </div>
            {perm === "granted" ? (
              <CheckCircleIcon className="h-6 w-6 text-[#00CC66] shrink-0" />
            ) : (
              <BellIcon className="h-6 w-6 text-[var(--text-ghost)] shrink-0" />
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={enable} disabled={busy || (!supported && perm !== "granted")} className={btnPrimary}>
              {busy ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <BellIcon className="h-4 w-4" />}
              Enable Mobile Notifications
            </button>
            <button onClick={sendTest} disabled={busy} className={btnGhost}>
              Send Test Notification
            </button>
            <button onClick={() => setPrefsOpen(true)} className={btnGhost}>
              <LockIcon className="h-4 w-4" /> Alert preferences
            </button>
          </div>

          {msg && (
            <div
              className={`mt-3 flex items-center gap-2 text-[12.5px] ${msg.kind === "ok" ? "text-[#00CC66]" : "text-[#FF6B6B]"}`}
            >
              {msg.kind === "ok" ? <CheckCircleIcon className="h-4 w-4" /> : <TriangleWarningIcon className="h-4 w-4" />}
              {msg.text}
            </div>
          )}

          {perm === "denied" && (
            <p className="mt-2 text-[11.5px] text-[var(--text-dim)]">
              Notifications are blocked in your device settings. Enable them for Koleex Hub in iOS Settings →
              Notifications (or the site settings) and try again.
            </p>
          )}
        </div>

        {/* Devices */}
        <div className={card}>
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Your devices</h3>
          {devices.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-ghost)]">No devices registered yet. Tap “Enable Mobile Notifications” above.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {devices.map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-2.5">
                  <MonitorIcon className="h-4 w-4 text-[var(--text-dim)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[var(--text-primary)] truncate">
                      {d.device_name || `${d.browser ?? "?"} on ${d.os ?? "?"}`}
                    </div>
                    <div className="text-[11px] text-[var(--text-ghost)]">Added {fmt(d.created_at)} · last used {fmt(d.last_used_at)}</div>
                  </div>
                  <button
                    onClick={() => removeDevice(d.id)}
                    className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:bg-[#FF3333]/10 hover:text-[#FF6B6B]"
                    aria-label="Remove device"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* History */}
        <div className={card}>
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3">Recent notifications</h3>
          {history.length === 0 ? (
            <p className="text-[12.5px] text-[var(--text-ghost)]">Nothing sent yet.</p>
          ) : (
            <ul className="divide-y divide-[var(--border-subtle)]">
              {history.map((h) => (
                <li key={h.id} className="flex items-start gap-2 py-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${h.status === "sent" ? "bg-[#00CC66]" : h.status === "failed" ? "bg-[#FF3333]" : "bg-[var(--text-ghost)]"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] text-[var(--text-primary)] truncate">{h.body || h.title}</div>
                    <div className="text-[10.5px] text-[var(--text-ghost)]">{h.channel} · {h.status} · {fmt(h.created_at)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {prefsOpen && <AlertPreferencesModal onClose={() => setPrefsOpen(false)} />}
    </div>
  );
}
