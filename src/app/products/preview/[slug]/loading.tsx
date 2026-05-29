/**
 * Calm skeleton for the public product page RSC fetch.
 * Uses Hub tokens only — no hardcoded colors.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="border-b border-[var(--border-subtle)]">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-4">
          <div className="h-4 w-28 rounded bg-[var(--bg-surface-subtle)] animate-pulse" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {/* Media */}
          <div className="aspect-square w-full rounded-2xl bg-[var(--bg-surface-subtle)] animate-pulse" />
          {/* Identity */}
          <div className="space-y-4">
            <div className="h-3 w-24 rounded bg-[var(--bg-surface-subtle)] animate-pulse" />
            <div className="h-8 w-3/4 rounded bg-[var(--bg-surface-subtle)] animate-pulse" />
            <div className="h-4 w-1/2 rounded bg-[var(--bg-surface-subtle)] animate-pulse" />
            <div className="grid grid-cols-2 gap-3 pt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-20 rounded-xl bg-[var(--bg-surface-subtle)] animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 space-y-4">
          <div className="h-3 w-32 rounded bg-[var(--bg-surface-subtle)] animate-pulse" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-24 rounded-xl bg-[var(--bg-surface-subtle)] animate-pulse"
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
