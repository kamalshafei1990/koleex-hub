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
import { Mail, CheckCircle2, Power, PowerOff, ShieldAlert, Clock } from "lucide-react";

interface Props {
  status: AccountStatus;
}

const STATUS_META: Record<
  AccountStatus,
  {
    label: string;
    icon: React.ElementType;
    className: string;
  }
> = {
  invited: {
    label: "Invited",
    icon: Mail,
    className: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  },
  pending: {
    label: "Pending",
    icon: Clock,
    className: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  active: {
    label: "Active",
    icon: CheckCircle2,
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  inactive: {
    label: "Inactive",
    icon: PowerOff,
    className: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  },
  suspended: {
    label: "Suspended",
    icon: ShieldAlert,
    className: "bg-red-500/15 text-red-300 border-red-500/30",
  },
};

export default function StatusRibbon({ status }: Props) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold uppercase tracking-wider ${meta.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

/** A denser variant used inside list rows — no icon, smaller padding. */
export function StatusBadge({ status }: Props) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${meta.className}`}
    >
      {meta.label}
    </span>
  );
}
