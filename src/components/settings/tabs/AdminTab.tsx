"use client";

/* Settings → Admin (super-admin only). Quick links into the tools that
   already live elsewhere in the hub, plus the PLATFORM switches only the
   owner may flip (first: the QA report-issue button, hub-wide). */

import Link from "next/link";
import { useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";
import MessageSquarePlusIcon from "@/components/icons/ui/MessageSquarePlusIcon";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";
import { SwitchRow } from "@/components/settings/tabs/ui";
import { useQaReporterEnabled, setQaReporterEnabled } from "@/lib/platform-settings";

function LinkRow({ href, icon, label, hint, last }: {
  href: string; icon: React.ReactNode; label: string; hint: string; last?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-3 hover:bg-[var(--bg-surface-subtle)] transition-colors ${last ? "" : "border-b border-[var(--border-faint)]"}`}
    >
      <span className="h-8 w-8 rounded-[10px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-[var(--text-primary)]">{label}</span>
        <span className="block text-[11px] text-[var(--text-dim)]">{hint}</span>
      </span>
      <span className="text-[var(--text-faint)]">›</span>
    </Link>
  );
}

export default function AdminTab(_props: { account: AccountWithLinks }) {
  const { t } = useTranslation(settingsT);
  const qaEnabled = useQaReporterEnabled();
  const [savingQa, setSavingQa] = useState(false);
  const flipQa = async (v: boolean) => {
    if (savingQa) return;
    setSavingQa(true);
    /* setQaReporterEnabled broadcasts the new value on success, so this
       row (and every mounted trigger) follows through the shared hook;
       on failure nothing was announced and the switch simply stays put. */
    await setQaReporterEnabled(v);
    setSavingQa(false);
  };
  return (
    <div className="space-y-4">
      {/* Platform switches — these change the Hub for EVERYONE. */}
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] px-3">
        <SwitchRow
          icon={<MessageSquarePlusIcon size={15} />}
          label={t("admin.qaReporter", "Report-issue button")}
          hint={t("admin.qaReporter.hint", "Show the floating QA reporter to everyone across the Hub")}
          checked={qaEnabled === true}
          onChange={flipQa}
          last
        />
      </div>
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
        <LinkRow
          href="/super-admin/activity"
          icon={<ActivityIcon className="h-4 w-4" />}
          label={t("admin.activity")}
          hint={t("admin.activity.hint")}
        />
        <LinkRow
          href="/roles"
          icon={<ShieldIcon className="h-4 w-4" />}
          label={t("admin.roles")}
          hint={t("admin.roles.hint")}
        />
        <LinkRow
          href="/accounts"
          icon={<UsersIcon className="h-4 w-4" />}
          label={t("admin.accounts")}
          hint={t("admin.accounts.hint")}
          last
        />
      </div>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        {t("admin.footer")}
      </p>
    </div>
  );
}
