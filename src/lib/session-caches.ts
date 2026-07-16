"use client";

/* ---------------------------------------------------------------------------
   session-caches — wipe tenant/account-scoped client caches on sign-out.
   (Phase 4 — Platform Speed Max-Out, Workstream 3: safe cache strategy)

   The Hub keeps warm-start caches in localStorage/sessionStorage (products,
   contacts, customers/suppliers directories, supplier coverage/taxonomy, the
   me-bootstrap identity payload, the SA tenant override) plus a single
   long-lived TanStack QueryClient. On a Supabase-mode sign-out the app did a
   SOFT navigation (router.replace) — so none of that was cleared and the next
   session (or a different user on a shared device) could paint the previous
   user's tenant data before revalidation. A hard reload discards the
   QueryClient but NOT localStorage, so the legacy path leaked the warm-start
   keys too.

   This helper clears every tenant/account-scoped store on logout. It does NOT
   touch display preferences (koleex-theme), drafts, or document counters —
   those are per-device conveniences, not cross-tenant server data. Callers must
   ALSO clear the TanStack QueryClient (queryClient.clear()); it can't be reached
   from a plain module. Fully reversible: delete this file and its call sites.
   --------------------------------------------------------------------------- */

import { invalidateMeBootstrap } from "@/lib/me-bootstrap";
import { clearScopeContextCache } from "@/lib/scope";

/* Prefixes of keys that hold tenant/account-scoped server data or the SA tenant
   override. `kx_*` + `kx:*` = all warm-start data caches (products, contacts,
   customers/suppliers lists+views, supplier coverage/taxonomy, taxo, compare);
   `koleex.sa.` = the super-admin active-tenant override. me-bootstrap and the
   scope cache are cleared via their own helpers below. */
const SCOPED_PREFIXES = ["kx_", "kx:", "koleex.sa."];

function clearByPrefix(store: Storage): void {
  try {
    const doomed: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const k = store.key(i);
      if (k && SCOPED_PREFIXES.some((p) => k.startsWith(p))) doomed.push(k);
    }
    for (const k of doomed) {
      try { store.removeItem(k); } catch { /* ignore */ }
    }
  } catch { /* storage unavailable (private mode / quota) */ }
}

/** Clear every tenant/account-scoped client cache. Call on sign-out (and on
    account/tenant/view-as switch where a session boundary is crossed). Pair
    with `queryClient.clear()` at the call site to also drop in-memory query
    data. Best-effort and idempotent. */
export function clearSessionScopedCaches(): void {
  try { invalidateMeBootstrap(); } catch { /* ignore */ }
  try { clearScopeContextCache(); } catch { /* ignore */ }
  if (typeof window === "undefined") return;
  clearByPrefix(window.localStorage);
  clearByPrefix(window.sessionStorage);
}
