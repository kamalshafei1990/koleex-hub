"use client";
/* KDS ProgressBar — ELECTED PB-2 by owner 2026-08-02 (Projects style):
   surface track, solid Hub Blue fill (law §2), both rounded-full.
   The fill is a normal-flow child so it starts from inline-start —
   correct in RTL without any logical-property tricks. */
export default function ProgressBar({
  value, className = "", knob = false,
}: { value: number; className?: string; knob?: boolean }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className={`relative ${className}`}>
      <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
        <div className="h-full rounded-full bg-[#567FB2] transition-all" style={{ width: `${v * 100}%` }} />
      </div>
      {knob && (
        <span className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow -translate-x-1/2 rtl:translate-x-1/2" style={{ insetInlineStart: `${v * 100}%` }} />
      )}
    </div>
  );
}
