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
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  pending: {
    labelKey: "acc.status.pending",
    icon: ClockIcon,
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  active: {
    labelKey: "acc.status.active",
    icon: CheckCircleIcon,
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  inactive: {
    labelKey: "acc.status.inactive",
    icon: ToggleOffIcon,
    className: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
  suspended: {
    labelKey: "acc.status.suspended",
    icon: ShieldExclamationIcon,
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
};

export default function StatusRibbon({ status }: Props) {
  const { t } = useTranslation(accountsT);
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${meta.className}`}
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
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${meta.className}`}
    >
      {t(meta.labelKey)}
    </span>
  );
}
