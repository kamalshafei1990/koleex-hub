# Persistent Shell Audit (Phase 4)

## Verdict: the shell is already persistent — no remount problem.
Provider tree (root layout → routed page), all mounted in the **root layout** so
only `{children}` swaps on navigation:

```
RootLayout (server, app/layout.tsx)
 └ Providers (QueryClientProvider — single client via useState) ── persistent
    └ RootShell → AuthGate → SidebarProvider → ShellContent → QAInspectorProvider
        ├ MainHeader ── persistent
        ├ Sidebar ── persistent
        ├ #main-scroll-container → {children}  ← only this swaps
        └ ActivityTracker / PerfVitals / SW / trackers ── persistent
 ├ DialogHost / SmartCreateDrawer / SpeedInsights ── persistent
```

- **No `key={pathname}`** anywhere on a shell/layout wrapper → no forced remount.
- **Single TanStack QueryClient** (created once) → the cache survives navigation
  (warm data reuse); logout/account-switch drop it as designed.
- **Theme / i18n / bootstrap** are module singletons + `localStorage` + `window`
  events (no per-route provider) → no remount risk.
- Sidebar + MainHeader render inside `ShellContent` → persistent.

## Bootstrap (`/api/me/bootstrap`)
Deduped **by design**: `me-bootstrap.ts` shares one in-flight promise + 60 s
cache + localStorage warm-start, so the 16 `useMeBootstrap()` call sites resolve
to a single fetch. **Fix applied:** `RootShell` imported `useMeBootstrap` but
never called it (dead import) — the first fetch depended on child mount order.
`ShellContent` now calls `useMeBootstrap()` once to prime it deterministically at
the top of the authenticated shell (no extra request — same shared promise).

## Measured (code-level, this environment)
| Signal | Result |
|---|---|
| shell remount on nav | none (no key/remount; `usePathname` causes re-render only) |
| bootstrap calls / navigation | 0 extra (shared promise; primed once) |
| provider remounts | none |
| sidebar / header remounts | none |
| duplicate session/account requests | none found |

## Residual (documented, not changed — low value / higher risk)
- `usePathname()` in `ShellContent` re-renders the shell subtree on each nav
  (render cost, not remount; children are lightweight). Could be isolated into a
  pathname-only child in a later pass.
- `ScrollToTopOnRouteChange` runs sync + rAF + two `setTimeout`s per nav — minor;
  left as-is to avoid scroll-behavior regressions.

Real per-nav render counts / commit durations require an authenticated React
Profiler session (owner/CI), not reachable from the build env.
