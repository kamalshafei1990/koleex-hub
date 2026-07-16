# Platform Cache Strategy

**Phase 4 — Platform Speed Max-Out, Workstream 3.** The safe caching matrix for
the Hub and the sign-out leak fix shipped this phase.

## Data classes → caching rules

| Class | Examples | Rule |
|---|---|---|
| **Public / static** | app registry, static translations, public icons, `/_next/static/` hashed assets | Shared caching OK. Served cache-first by the SW (static only). Versioned by build hash. |
| **User/tenant-scoped stable** | permitted modules, preferences, currencies, countries, branches, payment terms | Cache with a key that includes tenant (and account where it varies). Invalidate on role/permission change (bootstrap invalidation already wired). |
| **Dynamic private** | customers, suppliers, CRM deals, quotations, finance, employees, orders | NEVER shared across users/tenants. Key MUST include tenant + account (+ view-as). Short staleTime. Cleared on sign-out. |
| **Sensitive / immediate** | credentials, sessions, permissions, balances, private documents, realtime messages | Never cached beyond the request; auth context never cached globally. |

## Surface inventory (c97b6edb)

| Surface | Key | Class | Scoped? | Cleared on logout (after fix)? |
|---|---|---|---|---|
| me-bootstrap `koleex.me-bootstrap.v1` | global | SENSITIVE (identity, permittedModules) | derived scope key | ✅ (`invalidateMeBootstrap`) |
| `useServerList` `["server-list",res,tenant,account,params]` | per tenant+account | DYNAMIC-PRIVATE | ✅ | ✅ (`queryClient.clear`) |
| products `kx_products_list_v1:<scopeKey>` | tenant+view-as | DYNAMIC | tenant | ✅ (prefix `kx_`) |
| contacts `kx_contacts_v1:<tenant>:<type>` | tenant+type | DYNAMIC-PRIVATE | tenant | ✅ (prefix `kx_`) |
| catalogs `["catalogs","list",scopeKey]` | tenant+view-as | TENANT-STABLE | ✅ | ✅ (`queryClient.clear`) |
| supplier `kx:sup:coverage` / `kx:sup:taxonomy` | (none) | mixed | ⚠️ no tenant | ✅ (prefix `kx:`) — but see follow-up |
| SA tenant override `koleex.sa.active_tenant_id` | config | — | — | ✅ (prefix `koleex.sa.`) |
| Service worker `kx-static-v2` | build hash | PUBLIC-STATIC | n/a | n/a (static only) |

## The sign-out leak fix (shipped)

**Problem:** the single long-lived `QueryClient` (`providers.tsx`) and every
`localStorage`/`sessionStorage` warm-start survived a Supabase-mode sign-out
(soft `router.replace`) — so the next session in the same tab (or a different
user on a shared device) could paint the previous user's identity, permitted
modules, and tenant data before revalidation. A hard reload (legacy path) drops
the QueryClient but NOT localStorage, so it leaked the warm-start keys too.

**Fix:** `src/lib/session-caches.ts` → `clearSessionScopedCaches()` clears
me-bootstrap, the scope-context cache, and every `kx_`/`kx:`/`koleex.sa.`
storage entry. `UserMenu.handleSignOut` now calls `queryClient.clear()` +
`clearSessionScopedCaches()` on BOTH sign-out paths before navigating.

**Preserved (intentional):** `koleex-theme`, `koleex.focus-mode`, drafts, and
document counters are per-device conveniences, not cross-tenant server data —
left untouched.

**Guarded by** `validate:platform-speed` (WS3 assertions) so a future edit can't
silently drop the clear.

## Follow-up (documented, gated — NOT shipped this phase)

1. Add a tenant discriminator to `kx:sup:coverage` / `kx:sup:taxonomy` keys so a
   same-tab tenant switch can't paint tenant A's coverage under tenant B (the
   logout clear already covers the logout boundary; this covers TenantPicker).
2. Scope the contacts warm-start by view-as so an SA entering a restricted
   view-as doesn't briefly see the full-tenant directory. (Data is already
   re-fetched; this only removes the transient stale paint.)

Both touch component-level keys and are proposed as a small follow-up, not
auto-applied. Never use a global cache for auth context or tenant data.
