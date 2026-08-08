# App Revision — To-do (/todo)

Session 3 · 2026-08-08

## Found & fixed
| Lens | Finding | Fix |
|---|---|---|
| B2 | **Every open fetched the full task list TWICE**: `loadAll` depended on `scopeCtx`, which starts null and resolves a beat later — the effect refired and re-ran the whole Promise.all. The API path ignores ctx anyway (server does Type-C scoping; ctx only feeds the legacy fallback). The dependency also made the realtime effect resubscribe. | scopeCtx moved to a ref; `loadAll` keeps one identity → one initial load, one realtime subscription. Verified: `/api/todos` ×2 → **×1**; screen opens with **14 API calls, zero real duplicates** (baseline 21). |
| B2 (session 2) | assignees ×4, labels ×2, me/work ×2 | already fixed via cachedGet in SYS-2 pass 1 |

## Reviewed clean
- B1: 2,313-line page scanned — no TODO/FIXME/console.log leftovers, optimistic
  toggle with approval-loop client mirror matches the server rules, deep-link
  `?task=` handled with strip-after-open. File is big but cohesive; split only
  if it starts churning (build OOM memory says giant files unsplit — accepted).
- B4: inbox "New task" deep-links open the task; assignment fan-out + approval
  notifications verified live earlier today (AI work-tools E2E).
- F1: stat cards use functional status colors (allowed); KDS patterns in place.
- F2: 375px — stats 2-col, chip rows scroll horizontally, list + actions usable.

## Left open
- B3 cold-load JS profile (baseline own-chunk transfer was tiny: 24 KB).
- Board view deep pass (list view was this session's focus).
