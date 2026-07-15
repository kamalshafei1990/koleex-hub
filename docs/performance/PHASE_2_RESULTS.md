# Phase 2 — Observability & Instrumentation: Results

**Completed:** 2026-07-15 · Commits: `624f1684` (Speed Insights) · `103e3f96` (kx-perf core) · `311e356e` (Discuss + realtime instrumentation) · docs commit (this file)

## What shipped
1. **Vercel Speed Insights** — real-user Core Web Vitals with per-route P75, via the official `@vercel/speed-insights` (v2.0.0, zero deps) mounted in the root layout. *(Web Analytics / audience tracking was deliberately NOT added — Phase 2 is performance-only; it can be added later if wanted.)*
2. **kx-perf client core** — one shared utility (`src/lib/perf/client.ts`) all features reuse; cold/warm navigation, long tasks, online/offline/reconnect, batched privacy-safe shipping.
3. **Discuss lifecycle instrumentation** — sender press→optimistic→ack→reconcile (+ failures), receiver ping→fetch→visible, fallback-poll frequency.
4. **Realtime connection instrumentation** — join time, reconnects, error states, live channel gauge, cleanup — inside the existing shared subscription helper (no new subscriptions created).
5. **Server stage timing** — `discuss.mutate sendMessage` and `discuss.read myChannels/channelMessages` emit per-stage `[kx-server-timing]` logs and standard `Server-Timing` response headers.
6. **Dev-only performance panel** — floating panel in development builds over the same metric stream; zero bytes in production.
7. **Docs** — `OBSERVABILITY_ARCHITECTURE.md`, `METRIC_DICTIONARY.md`, this results file.

## Validation performed
- **Build/type-check:** Vercel production builds green for all Phase 2 commits (`next build` runs the TypeScript compiler; CI is the build oracle for this repo).
- **Deployed-artifact checks (live prod):** `/api/perf/ingest` returns **401 for unauthenticated callers** (auth gate verified); production HTML contains the Speed Insights loader; **`PerfPanel` code is absent from production chunks** (NODE_ENV gate verified by grepping deployed JS); app shell + login load normally after each deploy.
- **Bundle impact:** initial login-shell payload re-measured from deployed chunks before vs after (see numbers in the completion report; within noise + a few KB for perf core, no route-level regression).
- **Privacy:** double-layer whitelist (client + ingest) reviewed; server timing logs contain stage names/durations/counts only; realtime metrics carry topic families, never ids; no message-content code path exists into any log.
- **No duplicate subscriptions:** instrumentation hooks ride inside the existing ref-counted `subscribeBroadcast`; the `rt.channels` gauge exists precisely to prove channel count stays bounded.
- **Not run (environment limits, documented):** local lint/unit tests (repo folder TCC-blocked for the agent; no test suite currently in repo targets Discuss), authenticated two-client Discuss smoke test (credential policy) — the instrumentation itself now provides the data that Phase 12's automated tests will assert against.

## Known measurement limitations
- Cross-device sender→receiver latency is composed from single-clock segments until the Phase 12 two-client test.
- Speed Insights percentiles begin populating only after the owner enables the feature in the Vercel dashboard and real users browse.
- Log-based percentiles (P50/75/95/99) require filtering the `[kx-metric]` / `[kx-server-timing]` lines in Vercel Logs; the values are raw samples so any percentile can be computed.

## Manual step required (owner)
**Vercel → project `koleex-hub` → Speed Insights tab → Enable.** Repository-side work is complete; without this click the dashboard stays empty (the app is unaffected).

## Baseline note
Phase 1 numbers in `PERFORMANCE_BASELINE.md` remain the official "before". Phase 3 changes must quote: `discuss.send.ack_ms`, `discuss.poll.tick` rate, `discuss.recv.visible_ms`, `[kx-server-timing] rt_dispatch/push_dispatch`, and Speed Insights INP/LCP as their before/after evidence.
