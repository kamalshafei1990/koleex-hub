"use client";

/* Settings → Admin (super-admin only). Quick links into the tools that
   already live elsewhere in the hub — a launchpad, not new functionality. */

import Link from "next/link";
import type { AccountWithLinks } from "@/types/supabase";
import ActivityIcon from "@/components/icons/ui/ActivityIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import ShieldIcon from "@/components/icons/ui/ShieldIcon";

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
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] overflow-hidden">
        <LinkRow
          href="/super-admin/activity"
          icon={<ActivityIcon className="h-4 w-4" />}
          label="Activity monitor"
          hint="Who did what, and when, across the hub."
        />
        <LinkRow
          href="/roles"
          icon={<ShieldIcon className="h-4 w-4" />}
          label="Roles and permissions"
          hint="Module access, data scope, sensitive fields."
        />
        <LinkRow
          href="/accounts"
          icon={<UsersIcon className="h-4 w-4" />}
          label="Accounts"
          hint="Create and manage user logins."
          last
        />
      </div>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        View-as and workspace switching live in the top bar. These controls are only visible to Super Admins.
      </p>
    </div>
  );
}
