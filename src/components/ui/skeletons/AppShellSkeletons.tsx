/* ---------------------------------------------------------------------------
   AppShellSkeletons — shared route loading surfaces.
   (Phase 4 — Home & App Launch Performance; Loading language v2 2026-08-08)

   Loading language v2 (owner pick, motion sample "B — logo breath"): every
   route-level loading.tsx shows the SAME brand moment — the KOLEEX hub
   lockup breathing over a clean surface with a light sweep underline
   (globals: .kx-brand-load). The five shape-specific exports remain so the
   ~30 loading.tsx call sites and their labels keep compiling — they all
   render the shared brand loader now; their old layout params are accepted
   and ignored. Rules unchanged: no data fetching, CSS-only animation,
   reduced-motion-safe (app-wide neutralizer), announced as a busy region,
   fills only the content area (header/sidebar stay).
   --------------------------------------------------------------------------- */

import BrandLoading from "@/components/ui/BrandLoading";

function Shell({ label }: { label: string }) {
  return <BrandLoading label={label} />;
}

/** Directory / list & table apps: Customers, Suppliers, Contacts, Accounts,
    Invoices, Catalogs, Inbox. */
export function DirectoryListSkeleton({ label = "Loading…" }: { label?: string; rows?: number }) {
  return <Shell label={label} />;
}

/** Kanban / pipeline board: CRM. */
export function BoardSkeleton({ label = "Loading…" }: { label?: string; columns?: number }) {
  return <Shell label={label} />;
}

/** Document / editor apps: Quotations, Invoices doc. */
export function EditorSkeleton({ label = "Loading…" }: { label?: string }) {
  return <Shell label={label} />;
}

/** Conversation apps: Discuss, Koleex AI. */
export function ConversationSkeleton({ label = "Loading…" }: { label?: string }) {
  return <Shell label={label} />;
}

/** Dashboard / workspace apps: Settings, Sales, Purchase, Inventory. */
export function WorkspaceSkeleton({ label = "Loading…" }: { label?: string }) {
  return <Shell label={label} />;
}
