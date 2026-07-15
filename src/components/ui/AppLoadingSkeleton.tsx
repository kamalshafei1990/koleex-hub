"use client";

/* Layout-matched loading skeleton for dynamically-imported heavy app shells
   (SW-4, Phase 4). Fills the content area with a calm, brand-neutral pulse so
   a code-split component never flashes a blank screen. Accessible: announced
   as a busy region. Deliberately generic — one skeleton for form/board/chat. */
export default function AppLoadingSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="w-full h-full min-h-[60vh] p-4 sm:p-6 animate-pulse"
    >
      <span className="sr-only">{label}</span>
      <div className="h-9 w-48 rounded-lg bg-[var(--bg-surface-active)] mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]" />
        ))}
      </div>
    </div>
  );
}
