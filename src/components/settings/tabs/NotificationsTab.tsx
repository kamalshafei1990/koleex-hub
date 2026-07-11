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
