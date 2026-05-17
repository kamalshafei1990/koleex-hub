"use client";

/* ---------------------------------------------------------------------------
   MobileActionBar — sticky-bottom action strip for mobile screens.

   Renders a translucent bar pinned to the viewport bottom on screens
   smaller than `sm`. Each action is rendered as a vertical icon + label
   pill. Hidden on ≥ sm so desktop chrome stays unchanged.

   Usage:
     <MobileActionBar actions={[
       { label: "Create", href: "/create", icon: "plus" },
       { label: "Ops",    href: "/operations", icon: "signal-stream" },
       …
     ]} />
   --------------------------------------------------------------------------- */

import Link from "next/link";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface MobileAction {
  label: string;
  icon: RrIconName;
  href?: string;
  onClick?: () => void;
  tone?: "neutral" | "primary";
}

export default function MobileActionBar({ actions }: { actions: MobileAction[] }) {
  return (
    <nav
      role="navigation"
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around gap-1 border-t border-white/[0.06] bg-[var(--bg-primary)]/95 px-2 py-1.5 backdrop-blur sm:hidden"
    >
      {actions.map((a) => {
        const cls = `flex flex-1 flex-col items-center gap-0.5 rounded-md py-1.5 text-[10.5px] ${
          a.tone === "primary"
            ? "text-emerald-200"
            : "text-gray-300 hover:text-gray-100"
        }`;
        const inner = (
          <>
            <RrIcon name={a.icon} size={14} />
            <span className="leading-none">{a.label}</span>
          </>
        );
        if (a.href) return <Link key={a.label} href={a.href} className={cls}>{inner}</Link>;
        return <button key={a.label} type="button" onClick={a.onClick} className={cls}>{inner}</button>;
      })}
    </nav>
  );
}
