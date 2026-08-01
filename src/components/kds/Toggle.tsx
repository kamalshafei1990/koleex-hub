"use client";
/* KDS Toggle — emerald ON, white knob, always (standing owner rule). */
export default function Toggle({
  checked, onChange, disabled = false, label, className = "",
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; className?: string }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label}
      disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors duration-200 disabled:opacity-40 ${checked ? "bg-emerald-500" : "bg-[var(--bg-inverted)]/[0.18]"} ${className}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[inset-inline-start] duration-200 ${checked ? "start-[22px]" : "start-0.5"}`} />
    </button>
  );
}
