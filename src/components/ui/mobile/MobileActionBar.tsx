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
import { useEffect, useRef } from "react";
import RrIcon, { type RrIconName } from "@/components/ui/RrIcon";

export interface MobileAction {
  label: string;
  icon: RrIconName;
  href?: string;
  onClick?: () => void;
  tone?: "neutral" | "primary";
}

export default function MobileActionBar({ actions }: { actions: MobileAction[] }) {
  const ref = useRef<HTMLElement | null>(null);

  /* Publish this bar's height as --kx-actionbar-h so anything else pinned to
     the bottom can sit ABOVE it instead of on top of it. The update capsule
     was covering the whole bar — owner screenshot, 2026-08-09.

     Measured, not hardcoded, and cleared on unmount, because this bar is
     opt-in per screen: a constant offset would push the capsule up on every
     screen that has no bar. `sm:hidden` also means the element is
     display:none on desktop, where it measures 0 on its own — so the
     breakpoint needs no separate handling. */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => root.style.setProperty("--kx-actionbar-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--kx-actionbar-h");
    };
  }, []);

  return (
    <nav
      ref={ref}
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
