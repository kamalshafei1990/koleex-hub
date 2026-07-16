# Phase 4 · Wave 2A.1 — Results

Shared server-list foundation + secure endpoint + tests + measured baseline.
The reusable, verifiable pieces are **shipped and live**; the Customers **UI
activation** is prepared but intentionally not auto-deployed (see the pilot doc).

## Commits
| # | Commit | What |
|---|---|---|
| 1 | `247c03f9` | Fix + run the Wave-1 auth-equivalence test (`.mts` ESM) → **13/13 pass** |
| 2 | `9b0f6e2b` | `server-list/{types,apply}` + `useServerList` + `useDebouncedValue` |
| 3 | `8754937c` | `GET /api/contacts?paged=1` server-list mode (opt-in, backward-compatible) |
| 6 | `9c442139` | `validate:server-list` — 28 security/normalization assertions |
| 7 | *(this)* | Docs + baseline |

All code commits verified **green** on Vercel (build + deploy). Endpoint live-
smoked anon: `paged=1` → 401 (auth-gated, incl. hostile `pageSize`/`sort`/`dir`
params → no 500); legacy mode unchanged.

## Preliminary closure — auth-equivalence
- All **13** scenarios executed; **13 passed, 0 failed**.
- Test required correction: the committed `.ts` couldn't run (tsx compiles `.ts`
  → CJS, where its top-level `await` is unsupported). Converted to `.mts` (ESM)
  run via `node --experimental-test-module-mocks --import tsx`. `cache()` does
  **not** memoize outside a request scope in the runner, so `cached == uncached`
  is asserted **directly** for every non-null scenario (strongest form).

## Tests
- `validate:auth-equivalence` — 13/13 (executed this pass, deps installed).
- `validate:server-list` — **28/28**: page-size cap; page/dir defaults; sort-field
  allowlist (injection-shaped sort → default, never echoed); filter key+value
  allowlist; query normalization + length cap with **Chinese / Arabic / English +
  NFC** preserved; pagination metadata.
- `tsc --noEmit` — clean for all new files; full Vercel build green.

## Before/after — measured DATA (SQL, 120 Koleex customers)
| Metric | Legacy | Paged page 1 |
|---|--:|--:|
| Rows on first paint | 120 | **50** (−58%) |
| Slim-projection bytes | 88,765 (all 120) | **36,836** (page of 50) |
| `SELECT *` bytes (worst case) | 13,824,880 | — |
| Search | client-side, full array | **server-side, approved columns** |
| Stale-request cancellation | none | **AbortController (hook)** |
| Cache isolation | n/a | **per account+tenant query key** |

**Not yet measured (requires an authenticated browser + the UI activation):**
initial-paint time, keystroke→settled latency, React commit duration, DOM node
count, background req/min reduction. These are captured when the UI is wired.
No percentiles are estimated.

## Acceptance criteria status
| Criterion | Status |
|---|---|
| Server-driven search | ✅ endpoint (live) |
| Server-driven pagination | ✅ endpoint (live) |
| Stale requests cancelled/ignored | ✅ hook (AbortController + TanStack) |
| Tenant + role restrictions unchanged | ✅ reuses existing gate + `sanitizeContactRows` |
| No new sensitive columns exposed | ✅ slim non-sensitive projection + sanitize |
| Account/tenant cache isolated | ✅ query-key scoped |
| Materially fewer initial rows/bytes | ✅ measured (120→50 rows; 87KB→37KB slim) |
| Customers no longer downloads full dataset **by default** | ⏳ **pending UI activation** (endpoint ready) |
| Background full-list polling removed | ⏳ **pending UI activation** (design specified) |
| UI retains current functionality | ⏳ **pending UI activation + preview verification** |
| Before/after user-facing timings documented | ⏳ pending activation |

## Rollback
Delete the `paged=1` branch (legacy path untouched); the hook/types are
unreferenced until wired. No migration/RLS/auth change.

## Recommendation
Do **not** roll out to Contacts/Suppliers yet. Next step (Wave 2A.2, on
approval): activate the Customers UI wiring in a **preview deploy**, verify all
preserved behaviors + capture real user-facing timings, then extend the same
endpoint config + hook to Suppliers and Contacts.
