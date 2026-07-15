"use client";

/* Settings → Notification preferences. Channels + per-activity toggles,
   persisted in accounts.preferences.notifications (jsonb, no migration).
   Instant-apply, iOS-style. The device/push management stays on the
   dedicated /settings/notifications page. */

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type { NotificationPrefs } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import { SettingsCard, SwitchRow } from "./ui";
import { isPushSupported, isIosNeedsInstall, permissionState, subscribeToPush, unsubscribeCurrent } from "@/lib/push-client";

type ActivityKey = keyof Omit<NotificationPrefs, "email" | "in_app">;

const ACTIVITIES: { key: ActivityKey; label: string; hint: string }[] = [
  { key: "mentions", label: "Mentions and replies", hint: "When someone @mentions or replies to you." },
  { key: "approvals", label: "Approvals", hint: "Items waiting on your approval and decisions." },
  { key: "assignments", label: "Assignments", hint: "Tasks and records assigned to you." },
  { key: "tasks_due", label: "Task reminders", hint: "Upcoming and overdue tasks." },
  { key: "quotation_activity", label: "Quotation activity", hint: "Quote views, edits, and status changes." },
  { key: "low_stock", label: "Low stock", hint: "Inventory dropping below its reorder point." },
  { key: "qa_reports", label: "QA reports", hint: "New issue reports and status updates." },
  { key: "price_fx", label: "Price and FX changes", hint: "Rate refreshes and price adjustments." },
];

function PushEnableCard() {
  const [supported, setSupported] = useState(false);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    setSupported(isPushSupported());
    setNeedsInstall(isIosNeedsInstall());
    void (async () => {
      try {
        if ("serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const sub = await reg.pushManager.getSubscription();
          setSubscribed(!!sub && permissionState() === "granted");
        }
      } catch { /* ignore */ }
    })();
  }, []);

  async function enable() {
    setBusy(true); setMsg(null);
    const r = await subscribeToPush();
    if (r.ok) { setSubscribed(true); setMsg({ kind: "ok", text: "This device will now receive push notifications." }); }
    else setMsg({ kind: "err", text: r.error || "Couldn\u2019t enable notifications." });
    setBusy(false);
  }
  async function disable() {
    setBusy(true); setMsg(null);
    await unsubscribeCurrent();
    setSubscribed(false);
    setMsg({ kind: "ok", text: "Push turned off on this device." });
    setBusy(false);
  }

  return (
    <SettingsCard title="Push on this device" subtitle="Get alerts on your phone or desktop \u2014 even when the hub is closed.">
      {needsInstall && (
        <div className="rounded-xl border border-[#FFCC00]/30 bg-[#FFCC00]/[0.06] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--text-secondary)] mb-3">
          <strong className="text-[var(--text-primary)]">On iPhone / iPad:</strong> in Safari tap the Share icon, choose <strong>Add to Home Screen</strong>, then open Koleex from that new icon and return here to turn notifications on.
        </div>
      )}
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">{subscribed ? "Notifications are on" : "Notifications are off"}</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
            {!supported
              ? (needsInstall ? "Add Koleex to your Home Screen first (see above)." : "This browser can\u2019t receive push notifications.")
              : subscribed ? "You\u2019ll get a banner for messages, mentions, and alerts." : "Turn on to receive alerts on this device."}
          </p>
        </div>
        {subscribed ? (
          <button type="button" onClick={disable} disabled={busy} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-50 shrink-0">
            {busy ? "\u2026" : "Turn off"}
          </button>
        ) : (
          <button type="button" onClick={enable} disabled={busy || !supported} className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 shrink-0">
            {busy ? "Enabling\u2026" : "Enable"}
          </button>
        )}
      </div>
      {msg && <p className={`text-[11.5px] mt-2 ${msg.kind === "ok" ? "text-[var(--text-secondary)]" : "text-[#FF3333]"}`}>{msg.text}</p>}
    </SettingsCard>
  );
}

export default function NotificationsTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const [n, setN] = useState<NotificationPrefs>(() => withDefaults(account.preferences).notifications as NotificationPrefs);

  /* Re-sync when the account refreshes so this tab reflects saves from
     elsewhere and merges onto fresh values. */
  useEffect(() => {
    setN(withDefaults(account.preferences).notifications as NotificationPrefs);
  }, [account.preferences]);

  function patch(next: Partial<NotificationPrefs>) {
    const merged = { ...n, ...next };
    setN(merged);
    // Persist ONLY the notifications slice; the server merges it onto the rest.
    void updateAccountPreferences(account.id, { notifications: merged }).then((ok) => { if (ok) onChanged(); });
  }

  return (
    <div className="space-y-4">
      <PushEnableCard />
      <SettingsCard title="Channels" subtitle="Where notifications reach you.">
        <SwitchRow label="Email" hint="Send activity to your login email." checked={n.email} onChange={(v) => patch({ email: v })} />
        <SwitchRow label="In-app" hint="Show a bell indicator inside the hub." checked={n.in_app} onChange={(v) => patch({ in_app: v })} last />
      </SettingsCard>

      <SettingsCard title="By activity" subtitle="Silence event types you don't need.">
        {ACTIVITIES.map((a, i) => (
          <SwitchRow
            key={a.key}
            label={a.label}
            hint={a.hint}
            checked={n[a.key] ?? true}
            onChange={(v) => patch({ [a.key]: v } as Partial<NotificationPrefs>)}
            last={i === ACTIVITIES.length - 1}
          />
        ))}
      </SettingsCard>

      <Link
        href="/settings/notifications"
        className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-[13px] text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors"
      >
        <span>Manage push devices and alerts</span>
        <span className="text-[var(--text-faint)]">›</span>
      </Link>
    </div>
  );
}
