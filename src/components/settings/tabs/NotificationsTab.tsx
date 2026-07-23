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
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";
import { useMeBootstrap } from "@/lib/me-bootstrap";

type ActivityKey = keyof Omit<NotificationPrefs, "email" | "in_app">;

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
