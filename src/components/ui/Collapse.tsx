"use client";

/* ---------------------------------------------------------------------------
   Collapse — the accordion body that unfolds instead of snapping (owner-
   approved motion system, 2026-08-21). Drop-in replacement for the
   `{open && <div>…</div>}` pattern:

     <Collapse open={open}>…body…</Collapse>

   Uses the grid-template-rows 0fr↔1fr trick (the one sanctioned layout
   animation — an accordion's job IS to move the content below it) and
   usePresence so the close leg plays before unmount. The body stays
   UNMOUNTED while closed, so heavy section editors cost nothing shut.
   --------------------------------------------------------------------------- */

import { usePresence } from "@/components/kds/usePresence";

export default function Collapse({
  open,
  children,
  className = "",
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { mounted, closing } = usePresence(open, 240);
  if (!mounted) return null;
  return (
    <div className={`kx-collapse ${closing ? "kx-collapse-closing" : ""}`}>
      <div className={className}>{children}</div>
    </div>
  );
}
