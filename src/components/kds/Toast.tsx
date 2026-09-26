"use client";

/* KDS Toast — ELECTED TS-2 by owner 2026-08-02 (Inbox style):
   semantic tinted glass, bottom-center. Render when `message` is set;
   the caller owns the timeout.

   Motion (owner-approved motion system, 2026-08-21): rises in on the expo
   curve, falls away on the exit curve when the message clears. The entrance
   lives on an INNER node — the outer keeps the centering translate, which a
   transform keyframe would clobber. */

import { useState } from "react";
import { usePresence } from "./usePresence";

const KIND = {
  success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-300",
  error: "bg-red-500/15 border-red-500/30 text-red-300",
  info: "bg-[#567FB2]/15 border-[#567FB2]/30 text-[#7FA9D6]",
} as const;

export default function Toast({
  message,
  kind = "success",
}: {
  message: React.ReactNode;
  kind?: keyof typeof KIND;
}) {
  /* `!= null` not truthiness — a caller clearing to "" or 0 must still be
     treated as "nothing to show", and the presence flag has to agree with
     the fallback below or the pill renders blank while it exits. */
  const has = message != null && message !== "";
  const { mounted, closing } = usePresence(has, 220);
  /* Keep the last message text so the pill doesn't blank while it exits. */
  const [last, setLast] = useState<React.ReactNode>(message);
  if (has && message !== last) setLast(message);
  if (!mounted) return null;
  return (
    <div className="fixed bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[250]">
      <div
        role="status"
        className={`kx-toast-in ${closing ? "kx-toast-out" : ""} px-4 py-2.5 rounded-xl border shadow-lg text-[12.5px] font-semibold flex items-center gap-2 ${KIND[kind]}`}
      >
        {has ? message : last}
      </div>
    </div>
  );
}
