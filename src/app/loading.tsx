/**
 * Global route-transition skeleton.
 *
 * Rendered by Next.js (Suspense boundary) while a route segment that lacks its
 * own loading.tsx is fetched/compiled. Gives instant visual feedback when
 * opening an app from the launcher, instead of a frozen previous page.
 * Brand-monochrome; lives inside RootShell so the sidebar/header stay put.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 pt-6 md:pt-8 animate-pulse">
        {/* Header row */}
        <div className="flex items-center gap-3 mb-6">
          <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)]" />
          <div className="h-6 w-48 rounded-lg bg-[var(--bg-surface)]" />
        </div>
        {/* Search / control bar */}
        <div className="h-12 w-full rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] mb-6" />
        {/* Card grid placeholder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-2xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)]"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
