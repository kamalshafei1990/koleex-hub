# App Loading Boundaries & Skeletons (Phase 4)

## Problem
Before this phase, only 6 routes had a `loading.tsx` (root, finance, employees,
products, product-data, products/preview). The 15 representative apps fell back
to the **generic** `app/loading.tsx` (a card grid) — a shape mismatch for
list/board/editor/chat apps — and `dynamic(ssr:false)` apps (ai, invoices) showed
a bare centered spinner. Result: blank/flashy transitions on launch.

## Fix: shared app-shaped skeletons + per-app boundaries
`src/components/ui/skeletons/AppShellSkeletons.tsx` — 5 reusable, layout-matched
skeletons: `DirectoryListSkeleton`, `BoardSkeleton`, `EditorSkeleton`,
`ConversationSkeleton`, `WorkspaceSkeleton`. All: `role=status aria-busy`, CSS
tokens, `animate-pulse motion-reduce:animate-none`, **no data fetch, no heavy
libs**, fill only the content area (the persistent shell stays), no layout shift.

Not one-skeleton-for-all: each app maps to the shape that matches it.

| App | loading.tsx | Skeleton |
|---|---|---|
| customers, suppliers, contacts, accounts, catalogs, inbox | ✅ new | DirectoryListSkeleton |
| quotations, invoices | ✅ new | EditorSkeleton |
| crm | ✅ new | BoardSkeleton |
| discuss, ai | ✅ new | ConversationSkeleton |
| settings, sales, purchase, inventory | ✅ new | WorkspaceSkeleton |
| products, product-data, finance, employees | ✅ pre-existing | app-specific / global |

Total: **21** `loading.tsx` (6 prior + 15 new). Verified by
`validate:app-launch` (every representative app asserted present).

## Why this eliminates blank flash
On navigation, Next streams the segment's `loading.tsx` immediately while the RSC
+ page component resolve. Because the boundary lives inside the root layout, the
header/sidebar never disappear and an app-shaped structure paints in < ~200 ms
instead of white. On warm (cached) navigation Next skips the boundary → instant.

## Requirements met
Match final layout · render fast · no heavy libs · no data fetch · no
interaction-blocking animation · reduced-motion respected · accessible · no
layout shift · never covers the shell.

## Rollback
Delete the added `loading.tsx` files (per app) and/or the skeletons module —
routes revert to the generic global boundary. Fully additive.
