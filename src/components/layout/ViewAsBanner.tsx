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
import { useRouter } from "next/navigation";
import { useMeBootstrap, retryMeBootstrap } from "@/lib/me-bootstrap";
import { invalidateViewAsLists } from "./ViewAsPicker";

export default function ViewAsBanner() {
  const router = useRouter();
  const { data: bootstrap } = useMeBootstrap();
  const [busy, setBusy] = useState(false);
  const viewingAs = bootstrap?.viewingAs;
  if (!viewingAs) return null;

  async function handleExit() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/view-as/exit", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        /* Fall back to a hard reload only if the soft path failed —
           otherwise the user could end up stuck mid-state. */
        window.location.reload();
        return;
      }
      /* Soft exit: bust the bootstrap cache + retry with `no-store` so
         listeners (banner, picker, sidebar) update in place, then
         router.refresh() updates any RSC. Also drop the picker's
         lists cache so re-opening it after exit shows fresh data
         (the user just changed identities — what they could see
         before may differ now). */
      invalidateViewAsLists();
      await retryMeBootstrap();
      router.refresh();
    } catch {
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }

  const isRole = viewingAs.kind === "role";
  const label = isRole
    ? viewingAs.targetRoleName || "a role"
    : viewingAs.targetDisplayName || viewingAs.targetUsername || "another user";
  const subtext = isRole
    ? "Read-only. Permission checks evaluate as this role only (no account overrides)."
    : "Read-only. All permission checks evaluate as this user.";

  return (
    /* Compact floating pill — centered near the top, auto width, so it reads as
       a reminder of who you're viewing as without covering the page behind it.
       Not edge-to-edge; pointer-events only on the pill itself. */
    <div className="pointer-events-none fixed inset-x-0 top-16 z-[120] flex justify-center px-3">
      <div
        role="status"
        aria-live="polite"
        title={subtext}
        className="pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full border border-amber-500/50 bg-amber-500/95 py-1 pl-3 pr-1 text-[12px] shadow-lg shadow-black/20 backdrop-blur"
      >
        <span className="flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-900/80" aria-hidden />
        <span className="truncate font-semibold text-amber-950">
          Viewing as {label}{isRole ? " · role" : ""}
        </span>
        <button
          type="button"
          onClick={handleExit}
          disabled={busy}
          className="ml-1 inline-flex shrink-0 items-center rounded-full bg-amber-900 px-2.5 py-1 text-[11px] font-semibold text-amber-50 hover:bg-amber-950 disabled:opacity-50"
        >
          {busy ? "Exiting…" : "Exit"}
        </button>
      </div>
    </div>
  );
}
