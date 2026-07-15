# System Timing Architecture (SW-1, Phase 4 Wave 1)

## Goal
Make every major API route + workflow measurable with negligible overhead and zero sensitive logging.

## Two-tier coverage (no editing hundreds of routes)
1. **Universal auth prefix** — `getServerAuth()` is instrumented as `op=auth.resolve` (stages `session` / `viewas` / `db`, coarse `status` tag). Because *every* authenticated request runs it, this gives **platform-wide auth timing for free**, with no per-route edits.
2. **Opt-in deep timing** — `stageTimer(op)` (existing) + a new `timedRoute(op, handler)` wrapper in `src/lib/server/perf.ts`. Route families that want stage-level detail add one line; they get a `Server-Timing` response header (visible in DevTools) + a sampled structured log.

## Sampling (overhead control)
`stageTimer.done()` now logs **only when it carries signal**:
- always if `total_ms ≥ KX_TIMING_SLOW_MS` (default 800) — every slow request;
- always if the outcome tag looks like an error/denial (status ≥ 400, `error`, `denied`, `unauth`, `forbidden`, `401/403`) — **security failures are never sampled away**;
- otherwise 1-in-`KX_TIMING_SAMPLE_N` (default 4) via a deterministic per-process counter (no `Math.random`).

This keeps `auth.resolve` (every request) from flooding logs while preserving P50 visibility, all slow requests, and all denials. No per-request metric fetch — pure structured `console.warn` log (Vercel-filterable) + response header.

## Privacy
Stage names + `status`/`action`/count tags are **code-authored constants only**. Never logged: bodies, passwords, tokens, cookies, auth headers, names, emails, phones, addresses, message content, search terms, file contents, or raw record ids. Dynamic routes are represented by the normalized op name (`customers.list`), never the URL.

## Overhead (measured design)
Per instrumented call: a few `performance.now()` + at most one `JSON.stringify` that only runs when `shouldLog` passes (~25% + slow/errors). Sub-0.1 ms; the `stringify` is skipped entirely on sampled-out calls. Build green; no behavior change (commit `4c4b712d`).

## Rollback
Remove the `stageTimer` calls (auth.ts / route files) or set `KX_TIMING_SAMPLE_N` very high to quiet logs. `timedRoute` is opt-in; unused = zero effect.
