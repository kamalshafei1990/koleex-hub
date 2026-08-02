"use client";

/* ---------------------------------------------------------------------------
   StatusRibbon — small lifecycle badge for an account.

   Inspired by Odoo's Invited / Confirmed ribbon in the top-right corner of
   the user form, but redrawn with Koleex Hub design tokens so it fits the
   rest of the admin surface (no pinstripe ribbon, no bright colors).

   Renders as a pill that shows the current status and the "next" step in the
   lifecycle when applicable. Status colors map to the existing design tokens.
   --------------------------------------------------------------------------- */

import type { AccountStatus } from "@/types/supabase";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import PowerIcon from "@/components/icons/ui/PowerIcon";
import ToggleOffIcon from "@/components/icons/ui/ToggleOffIcon";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";

interface Props {
  status: AccountStatus;
}

const STATUS_META: Record<
  AccountStatus,
  {
    labelKey: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  invited: {
    labelKey: "acc.status.invited",
    icon: EnvelopeIcon,
    className: "bg-[#567FB2]/15 text-[#7FA9D6] border-[#567FB2]/40",
  },
  pending: {
    labelKey: "acc.status.pending",
    icon: ClockIcon,
    className: "bg-[#F59E0B]/12 text-[#F59E0B] border-[#F59E0B]/35",
  },
  active: {
    labelKey: "acc.status.active",
    icon: CheckCircleIcon,
    className: "bg-[#10B981]/12 text-[#10B981] border-[#10B981]/35",
  },
  inactive: {
    labelKey: "acc.status.inactive",
    icon: ToggleOffIcon,
    className: "bg-[var(--bg-inverted)]/[0.06] text-[var(--text-muted)] border-[var(--border-subtle)]",
  },
  suspended: {
    labelKey: "acc.status.suspended",
    icon: ShieldExclamationIcon,
    className: "bg-[#FF3333]/12 text-[#FF3333] border-[#FF3333]/35",
  },
};

export default function StatusRibbon({ status }: Props) {
  const { t } = useTranslation(accountsT);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {t(meta.labelKey)}
    </span>
  );
}

/** A denser variant used inside list rows — no icon, smaller padding. */
export function StatusBadge({ status }: Props) {
  const { t } = useTranslation(accountsT);
  const meta = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${meta.className}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}
