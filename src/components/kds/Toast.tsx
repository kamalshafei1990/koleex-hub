"use client";

/* KDS Toast — ELECTED TS-2 by owner 2026-08-02 (Inbox style):
   semantic tinted glass, bottom-center. Render when `message` is set;
   the caller owns the timeout. */

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
  if (!message) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-6 start-1/2 -translate-x-1/2 rtl:translate-x-1/2 z-[250] px-4 py-2.5 rounded-xl border shadow-lg text-[12.5px] font-semibold flex items-center gap-2 ${KIND[kind]}`}
    >
      {message}
    </div>
  );
}
