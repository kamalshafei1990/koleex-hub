/* The Hub's back control — the "← Hub" chip every app wears — as a class
   string in a module with NO imports.

   It lives here, not in PageHeader.tsx, so a screen that does not render
   PageHeader can wear the same chip without importing PageHeader: that
   module pulls APP_REGISTRY and the whole navigation map, and a detail route
   that imported one class string from it would ship all of that. Measured
   reason: /reports/[id] sits at ~650 of a 657 KB budget and has no other path
   to PageHeader. PageHeader re-exports this, so existing imports keep working.

   Standalone (outside PageHeader), put it in a flex row — the chip is `flex`,
   not `inline-flex`, so on its own in a block it stretches full width. */
export const BACK_CHROME =
  "kx-ph-chrome flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-[var(--text-dim)] transition-all duration-200 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] sm:h-10 sm:rounded-xl sm:px-3 sm:hover:-translate-y-0.5";
