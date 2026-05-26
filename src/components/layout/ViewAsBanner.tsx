"use client";

/* ---------------------------------------------------------------------------
   ViewAsBanner — persistent banner shown when a super admin is "viewing
   as" another user. Always visible at the top of the app. Only way to
   dismiss is the "Exit view-as" button (which POSTs to the exit endpoint
   and reloads).

   No close-X. The banner is intentionally hard to dismiss accidentally
   because the SA needs to know they're impersonating before they click
   anything else.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import { useMeBootstrap } from "@/lib/me-bootstrap";

export default function ViewAsBanner() {
  const { data: bootstrap } = useMeBootstrap();
  const [busy, setBusy] = useState(false);
  const viewingAs = bootstrap?.viewingAs;
  if (!viewingAs) return null;

  async function handleExit() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth/view-as/exit", {
        method: "POST",
        credentials: "include",
      });
      window.location.reload();
    } catch {
      setBusy(false);
    }
  }

  const isRole = viewingAs.kind === "role";
  const label = isRole
    ? viewingAs.targetRoleName || "a role"
    : viewingAs.targetDisplayName || viewingAs.targetUsername || "another user";
  const subtext = isRole
    ? "— read-only. Permission checks evaluate as this role only (no account overrides)."
    : "— read-only. All permission checks evaluate as this user.";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 top-14 z-[120] flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/20 px-4 py-2 text-[12.5px] backdrop-blur"
    >
      <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-500" aria-hidden />
      <span className="text-amber-900 dark:text-amber-100">
        <strong className="font-semibold">
          Viewing as {label}
          {isRole ? " (role)" : ""}
        </strong>
        <span className="ml-2 opacity-80 hidden sm:inline">{subtext}</span>
      </span>
      <button
        type="button"
        onClick={handleExit}
        disabled={busy}
        className="ml-1 inline-flex items-center rounded-md border border-amber-700/40 bg-amber-700 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-sm hover:bg-amber-800 disabled:opacity-50"
      >
        {busy ? "Exiting…" : "Exit view-as"}
      </button>
    </div>
  );
}
