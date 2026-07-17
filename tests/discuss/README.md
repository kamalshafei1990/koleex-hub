# kxperf — Discuss benchmark rig

## READ THIS FIRST: staging is Discuss-only

The staging project (`gmtjbshjsuexqayqumix`) holds **13 public tables**:

    accounts · companies · contacts · discuss_channels · discuss_drafts
    discuss_members · discuss_messages · discuss_pinned · discuss_reactions
    discuss_starred · people · roles · tenants

`products`, `product_media`, `inbox_messages`, `koleex_employees` and
`role_permissions` are **intentionally absent**. The app is the full Hub, so it
requests them and the API answers 404/500.

**Those responses are environment artifacts, not Production defects.** Never
report them as such. `tests/discuss/staging-limits.ts` classifies them; a
benchmark run fails only on an **unclassified** failure.

### What was already tried — do not repeat it

| attempt | outcome |
|---|---|
| "Reload the PostgREST schema cache" | **Irrelevant.** `to_regclass` proves the tables do not exist. `PGRST205` was accurate; there is nothing to reload. |
| "Assign a role to the fixture accounts" | **Made it worse.** `/api/discuss/recipients` went 403 "No role assigned" → **500 "Permission check failed"**, because `requireModuleAccess` needs the absent `role_permissions`. Reverted. |

**`/api/discuss/recipients` cannot be meaningfully exercised until the
authorization schema exists on staging.** Its 403 is authorization working.

Forbidden: suppressing requests in product code · placeholder tables · fake
permissions · mirroring the Production schema.

## Fixture integrity

`tests/discuss/fixture.ts` is the ONLY cleanup path. It settles, then
delete-and-recounts until the channel is provably back to exactly **5000**, and
throws if it never converges. Per-spec inline cleanup leaked probe rows three
times (5005/5013/5012) by racing in-flight sends and by treating a failed SELECT
as "nothing to clean". Do not reintroduce it.

## Commands

    npm run kxperf:guards     # 13 negative tests: the guards must REFUSE
    npm run kxperf:baseline   # measured client baseline (desktop + mobile)
    npx playwright test tests/discuss/errors.spec.ts   # 403/500 inventory

Closed diagnostics (`diagnose*.spec.ts`) are skipped unless
`KXPERF_RUN_CLOSED_DIAGNOSTICS=1`; they still carry the old leaky cleanup.

## Established by measurement (do not re-litigate)

- Rendering is **not** the bottleneck: paint 6–16ms after visible; 0 long tasks; 119 FPS.
- Virtualization is not a priority: the client paginates, DOM ~5,035 nodes.
- The 5s poll is **not** the primary delivery path; broadcast is.
- Rapid sends cause **no** contention (isolated p50 2803ms vs burst 2817ms).
- send→receive ≈ 3 Tokyo round trips; `incremental_after` p50 ~800–900ms, of
  which **auth is 53.6%** — and auth is 100% one already-parallel `Promise.all`.
