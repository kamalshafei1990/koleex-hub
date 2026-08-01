"use client";
/* KDS ProgressBar — Hub Blue fill on a hairline track (law §2). */
export default function ProgressBar({
  value, className = "", knob = false,
}: { value: number; className?: string; knob?: boolean }) {
  const v = Math.min(1, Math.max(0, value));
  return (
    <div className={`relative h-1.5 rounded-full bg-[var(--bg-inverted)]/[0.08] overflow-visible ${className}`}>
      <div className="absolute inset-y-0 start-0 rounded-full bg-gradient-to-r from-[#567FB2] to-[#7FA9D6]" style={{ width: `${v * 100}%` }} />
      {knob && (
        <span className="absolute top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-white shadow -translate-x-1/2" style={{ insetInlineStart: `${v * 100}%` }} />
      )}
    </div>
  );
}
