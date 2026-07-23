"use client";

/* Settings → Notification preferences. Channels + per-activity toggles,
   persisted in accounts.preferences.notifications (jsonb, no migration).
   Instant-apply, iOS-style. The device/push management stays on the
   dedicated /settings/notifications page. */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { AccountWithLinks } from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import type { NotificationPrefs } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import { SettingsCard, SwitchRow } from "./ui";
import { isPushSupported, isIosNeedsInstall, permissionState, subscribeToPush, unsubscribeCurrent } from "@/lib/push-client";
import type { QuietHoursPref } from "@/lib/access-control";
import { inQuietHours } from "@/lib/notification-activity";
import { fetchMyChannels, setChannelMuted } from "@/lib/discuss";
import { useCurrentAccount } from "@/lib/identity";
import type { DiscussChannelWithState } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";
import { useMeBootstrap } from "@/lib/me-bootstrap";

type ActivityKey = keyof Omit<NotificationPrefs, "email" | "in_app" | "quiet_hours">;

const ACTIVITIES: { key: ActivityKey; tKey: string }[] = [
  { key: "mentions", tKey: "act.mentions" },
  { key: "approvals", tKey: "act.approvals" },
  { key: "assignments", tKey: "act.assignments" },
  { key: "tasks_due", tKey: "act.tasksDue" },
  { key: "quotation_activity", tKey: "act.quotation" },
  { key: "low_stock", tKey: "act.lowStock" },
  { key: "qa_reports", tKey: "act.qa" },
  { key: "price_fx", tKey: "act.priceFx" },
];

function PushEnableCard() {
  const { t } = useTranslation(settingsT);
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
    if (r.ok) { setSubscribed(true); setMsg({ kind: "ok", text: t("notif.push.enabled") }); }
    else setMsg({ kind: "err", text: r.error || t("notif.push.error") });
    setBusy(false);
  }
  async function disable() {
    setBusy(true); setMsg(null);
    await unsubscribeCurrent();
    setSubscribed(false);
    setMsg({ kind: "ok", text: t("notif.push.disabled") });
    setBusy(false);
  }

  return (
    <SettingsCard title={t("notif.push.title")} subtitle={t("notif.push.sub")}>
      {needsInstall && (
        <div className="rounded-xl border border-[#FFCC00]/30 bg-[#FFCC00]/[0.06] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--text-secondary)] mb-3">
          <strong className="text-[var(--text-primary)]">{t("notif.push.iosLabel")}</strong> {t("notif.push.iosHint")}
        </div>
      )}
      <div className="flex items-center justify-between gap-4 py-1">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-[var(--text-primary)]">{subscribed ? t("notif.push.on") : t("notif.push.off")}</p>
          <p className="text-[11px] text-[var(--text-dim)] mt-0.5">
            {!supported
              ? (needsInstall ? t("notif.push.needsInstall") : t("notif.push.unsupported"))
              : subscribed ? t("notif.push.onHint") : t("notif.push.offHint")}
          </p>
        </div>
        {subscribed ? (
          <button type="button" onClick={disable} disabled={busy} className="h-9 px-4 rounded-xl border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] disabled:opacity-50 shrink-0">
            {busy ? "…" : t("notif.push.turnOff")}
          </button>
        ) : (
          <button type="button" onClick={enable} disabled={busy || !supported} className="h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90 disabled:opacity-50 shrink-0">
            {busy ? t("notif.push.enabling") : t("notif.push.enable")}
          </button>
        )}
      </div>
      {msg && <p className={`text-[11.5px] mt-2 ${msg.kind === "ok" ? "text-[var(--text-secondary)]" : "text-[#FF3333]"}`}>{msg.text}</p>}
    </SettingsCard>
  );
}

/* ── Quiet hours ─────────────────────────────────────────────────────────
   A daily local-time window during which push and chimes stay silent. The
   IANA zone is snapshotted from THIS browser on every save so the server
   can evaluate the recipient's clock; badge counts still update. */
function QuietHoursCard({ value, onChange }: {
  value: QuietHoursPref;
  onChange: (next: QuietHoursPref) => void;
}) {
  const { t } = useTranslation(settingsT);
  const active = inQuietHours(value);
  const patch = (next: Partial<QuietHoursPref>) =>
    onChange({
      ...value,
      ...next,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  return (
    <SettingsCard title={t("notif.quiet")} subtitle={t("notif.quiet.sub")}>
      <SwitchRow
        label={t("notif.quiet.enable")}
        hint={active && value.enabled ? t("notif.quiet.activeNow") : t("notif.quiet.enable.hint")}
        checked={value.enabled}
        onChange={(v) => patch({ enabled: v })}
        last={!value.enabled}
      />
      {value.enabled && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-secondary)]">
            {t("notif.quiet.from")}
            <input
              type="time"
              value={value.start}
              onChange={(e) => patch({ start: e.target.value || "22:00" })}
              className="h-8 px-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-secondary)]">
            {t("notif.quiet.to")}
            <input
              type="time"
              value={value.end}
              onChange={(e) => patch({ end: e.target.value || "08:00" })}
              className="h-8 px-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--border-focus)]"
            />
          </label>
          <p className="w-full text-[11px] text-[var(--text-faint)]">{t("notif.quiet.crossMidnight")}</p>
        </div>
      )}
    </SettingsCard>
  );
}

/* ── Muted conversations ─────────────────────────────────────────────────
   Surfaces every Discuss conversation the user muted (right-click → Mute in
   the sidebar) so a forgotten mute is one click away from here — before
   this, the ONLY way to find them was scanning the sidebar one by one. */
function MutedConversationsCard() {
  const { t } = useTranslation(settingsT);
  const { account } = useCurrentAccount();
  const [channels, setChannels] = useState<DiscussChannelWithState[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!account?.id) return;
    fetchMyChannels(account.id)
      .then((rows) => { if (!cancelled) setChannels(rows.filter((c) => c.muted)); })
      .catch(() => { if (!cancelled) setChannels([]); });
    return () => { cancelled = true; };
  }, [account?.id]);

  async function unmute(id: string) {
    if (!account?.id) return;
    setBusyId(id);
    const ok = await setChannelMuted(id, account.id, false);
    if (ok) setChannels((prev) => (prev ?? []).filter((c) => c.id !== id));
    setBusyId(null);
  }

  const label = (c: DiscussChannelWithState) =>
    c.name?.trim() || c.other?.full_name || c.other?.username || c.linked_contact?.display_name || t("notif.muted.dm");

  return (
    <SettingsCard title={t("notif.muted")} subtitle={t("notif.muted.sub")}>
      {channels === null ? (
        <div className="flex justify-center py-4"><SpinnerIcon size={14} className="animate-spin text-[var(--text-dim)]" /></div>
      ) : channels.length === 0 ? (
        <p className="py-2 text-[12px] text-[var(--text-faint)]">{t("notif.muted.none")}</p>
      ) : channels.map((c, i) => (
        <div key={c.id} className={`flex items-center justify-between gap-3 py-2.5 ${i === channels.length - 1 ? "" : "border-b border-[var(--border-faint)]"}`}>
          <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-primary)]">{label(c)}</span>
          <button
            type="button"
            disabled={busyId === c.id}
            onClick={() => void unmute(c.id)}
            className="shrink-0 h-7 px-2.5 rounded-lg border border-[var(--border-subtle)] text-[11.5px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
          >
            {busyId === c.id ? "…" : t("notif.muted.unmute")}
          </button>
        </div>
      ))}
    </SettingsCard>
  );
}

export default function NotificationsTab({ account, onChanged }: {
  account: AccountWithLinks; onChanged: () => void;
}) {
  const { t } = useTranslation(settingsT);
  const { data: boot } = useMeBootstrap();
  const [n, setN] = useState<NotificationPrefs>(() => withDefaults(account.preferences).notifications as NotificationPrefs);
  /* What we last wrote — same stale-snapshot guard as DisplayTab/RegionTab.
     Without it the post-save account refresh could arrive carrying the
     PRE-save bag, visibly flipping a just-toggled switch back; a user (or a
     fast double-click) then "corrects" the phantom revert and unknowingly
     re-saves the OLD value. Verified live before the fix: UI said Approvals
     ON while the DB kept false. */
  const savedRef = useRef<string | null>(null);

  /* Re-sync when the account refreshes so this tab reflects saves from
     elsewhere and merges onto fresh values. */
  useEffect(() => {
    const incoming = withDefaults(account.preferences).notifications as NotificationPrefs;
    const json = JSON.stringify(incoming);
    if (savedRef.current !== null) {
      if (json !== savedRef.current) return;   // still stale — keep the local edit
      savedRef.current = null;                 // caught up; resume normal syncing
    }
    setN(incoming);
  }, [account.preferences]);

  function patch(next: Partial<NotificationPrefs>) {
    const merged = { ...n, ...next };
    savedRef.current = JSON.stringify(merged);
    setN(merged);
    // Persist ONLY the notifications slice; the server merges it onto the rest.
    void updateAccountPreferences(account.id, { notifications: merged }).then((ok) => { if (ok) onChanged(); });
  }

  return (
    <div className="space-y-4">
      <PushEnableCard />
      <SettingsCard title={t("notif.channels")} subtitle={t("notif.channels.sub")}>
        <SwitchRow label={t("notif.email")} hint={t("notif.email.hint")} checked={n.email} onChange={(v) => patch({ email: v })} />
        <SwitchRow label={t("notif.inApp")} hint={t("notif.inApp.hint")} checked={n.in_app} onChange={(v) => patch({ in_app: v })} last />
      </SettingsCard>

      <SettingsCard title={t("sounds.byActivity")} subtitle={t("notif.byActivity.sub")}>
        {ACTIVITIES.map((a, i) => (
          <SwitchRow
            key={a.key}
            label={t(a.tKey)}
            hint={t(`${a.tKey}.hint`)}
            checked={n[a.key] ?? true}
            onChange={(v) => patch({ [a.key]: v } as Partial<NotificationPrefs>)}
            last={i === ACTIVITIES.length - 1}
          />
        ))}
      </SettingsCard>

      <QuietHoursCard
        value={n.quiet_hours ?? { enabled: false, start: "22:00", end: "08:00" }}
        onChange={(qh) => patch({ quiet_hours: qh })}
      />

      <MutedConversationsCard />

      {/* Device management page is Super-Admin-only — don't link regular
          users into a lock screen. */}
      {!!boot?.isSuperAdmin && (
        <Link
          href="/settings/notifications"
          className="flex items-center justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-4 py-3 text-[13px] text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-colors"
        >
          <span>{t("notif.managePush")}</span>
          <span className="text-[var(--text-faint)]">›</span>
        </Link>
      )}
    </div>
  );
}
