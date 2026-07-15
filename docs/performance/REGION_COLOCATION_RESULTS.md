# Region Colocation Results — Vercel functions → Tokyo (hnd1)

**Shipped:** 2026-07-15 · commit `43ec03b5` (one line in `vercel.json`: `"regions": ["hnd1"]`, crons preserved) · **Rollback:** remove the key, push (2-minute redeploy).

## Verified after deploy (production evidence)

1. **Functions execute in hnd1** — every `[kx-server-timing]` log line on the new deployment (`dpl_GvNfzYTb…`) carries `"region":"hnd1"`.
2. **Server→database latency (Path A), same endpoint, same live client, real production logs:**

| `discuss.read myChannels` | Before (iad1, n=19) | After (hnd1, n=10) | Improvement |
|---|---|---|---|
| total | **P50 3,604 ms** (2,441–4,787) | **147–296 ms, typical ≈170 ms** | **~20×** |
| auth stage | P50 1,261 ms | 47–149 ms | ~15–20× |
| db stage | P50 2,420 ms | 95–147 ms | ~20× |

3. **Unauthenticated signin probe** (bogus credentials; exercises function→DB lookups; measured from the same owner machine minutes apart): median ≈2.4 s → ≈0.6 s.
4. **Authentication works** post-change (the live client's authenticated myChannels requests return 200 with correct channel counts); **after() post-ack work** unaffected (mechanism is region-agnostic; `post_ack` lines will confirm on first real send); **no error-rate increase** in runtime logs; no routing loop (single fixed region).
5. **Edge-served workloads that do not move (documented):** static assets/HTML continue to serve from Vercel's global edge network (unchanged, and proven fast from mainland China — see CHINA_CONNECTIVITY_TEST_RESULTS.md); there is no `middleware.ts` in this app.
6. RLS/permissions untouched (config-only change).

## Path A vs Path B (kept separate by design)
- **Path A (function→DB): FIXED** — hops are now intra-Tokyo (~1–5 ms each instead of ~150–400 ms).
- **Path B (China user→platform): measured independently** — the region pin does not by itself prove Path B; see the China test results. Conveniently, hnd1 also *shortens* Path B's API leg for mainland users (China→Tokyo ≈ 30–80 ms vs China→US-East ≈ 200 ms+), which compounds with Path A: a China user's API call is now CN→hnd1 (~50 ms) + a few local DB hops, instead of CN→iad1 (~200 ms) + trans-Pacific DB hops.
