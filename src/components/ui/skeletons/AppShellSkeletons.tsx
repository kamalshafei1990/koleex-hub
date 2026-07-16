/* ---------------------------------------------------------------------------
   AppShellSkeletons — shared, app-shaped route loading skeletons.
   (Phase 4 — Home & App Launch Performance)

   One small set of layout-matched skeletons so a route-level loading.tsx can
   show an app-shaped structure INSTANTLY on navigation (inside the persistent
   Hub shell — header/sidebar stay put) instead of a blank screen or a generic
   card grid. Rules: no data fetching, no heavy libraries, CSS-token colors,
   reduced-motion-safe (animate-none under prefers-reduced-motion), announced
   as a busy region, and NEVER covers the shell (fills only the content area).

   Pick the shape that matches the destination app; do not force one skeleton
   on every app (a directory list ≠ a board ≠ an editor ≠ a chat).
   --------------------------------------------------------------------------- */

const PULSE = "animate-pulse motion-reduce:animate-none";
const bar = "rounded bg-[var(--bg-surface-active)]";
const block = "rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]";

function Shell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={`w-full min-h-[60vh] p-4 sm:p-6 ${PULSE}`}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

function Header({ withActions = true }: { withActions?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`h-8 w-8 ${bar}`} />
        <div className={`h-7 w-40 ${bar}`} />
      </div>
      {withActions && <div className={`h-9 w-28 ${bar}`} />}
    </div>
  );
}

/** Directory / list & table apps: Customers, Suppliers, Contacts, Accounts,
    Invoices, Catalogs, Inbox. Summary cards + search bar + table rows. */
export function DirectoryListSkeleton({ label = "Loading…", rows = 10 }: { label?: string; rows?: number }) {
  return (
    <Shell label={label}>
      <Header />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-16 ${block}`} />)}
      </div>
      <div className={`h-10 w-full ${bar} mb-3`} />
      <div className={`${block} overflow-hidden`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-subtle)] last:border-0">
            <div className={`h-4 w-4 ${bar}`} />
            <div className={`h-4 flex-1 max-w-[36%] ${bar}`} />
            <div className={`h-4 w-24 ${bar} hidden sm:block`} />
            <div className={`h-4 w-20 ${bar} hidden md:block`} />
            <div className={`h-6 w-16 ${bar} ml-auto`} />
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Kanban / pipeline board: CRM. A row of columns each with stacked cards. */
export function BoardSkeleton({ label = "Loading…", columns = 4 }: { label?: string; columns?: number }) {
  return (
    <Shell label={label}>
      <Header />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: columns }).map((_, c) => (
          <div key={c} className="flex-1 min-w-[220px]">
            <div className={`h-6 w-28 ${bar} mb-3`} />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-24 ${block}`} />)}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/** Document / editor apps: Quotations, Invoices doc. Toolbar + a paper canvas
    with a side rail. */
export function EditorSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <Shell label={label}>
      <Header />
      <div className="flex gap-4">
        <div className="flex-1 space-y-3">
          <div className={`h-10 w-full ${bar}`} />
          <div className={`${block} h-[60vh]`} />
        </div>
        <div className="w-64 hidden lg:block space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-20 ${block}`} />)}
        </div>
      </div>
    </Shell>
  );
}

/** Conversation apps: Discuss, Koleex AI. Channel rail + message stream. */
export function ConversationSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <Shell label={label}>
      <div className="flex gap-4 h-[70vh]">
        <div className="w-60 hidden md:block space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className={`h-9 ${bar}`} />)}
        </div>
        <div className="flex-1 flex flex-col">
          <div className={`h-12 ${bar} mb-4`} />
          <div className="flex-1 space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`flex gap-3 ${i % 2 ? "flex-row-reverse" : ""}`}>
                <div className={`h-8 w-8 rounded-full bg-[var(--bg-surface-active)]`} />
                <div className={`h-16 w-2/3 ${block}`} />
              </div>
            ))}
          </div>
          <div className={`h-12 w-full ${bar} mt-4`} />
        </div>
      </div>
    </Shell>
  );
}

/** Dashboard / workspace apps: Settings, Sales, Purchase, Inventory. Header +
    KPI/section cards + a wide panel. */
export function WorkspaceSkeleton({ label = "Loading…" }: { label?: string }) {
  return (
    <Shell label={label}>
      <Header />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-24 ${block}`} />)}
      </div>
      <div className={`${block} h-[42vh]`} />
    </Shell>
  );
}
