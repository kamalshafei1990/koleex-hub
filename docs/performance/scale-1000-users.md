# Scaling Koleex Hub to 1,000 concurrent users

**Written 2026-08-12.** Every "now" figure here was measured against production
on that date, not estimated. Re-measure before trusting any of it later.

---

## 1. Where we actually are

| | Measured now | Target | Factor |
|---|---|---|---|
| Products | 121 | 10,000 | ×82 |
| Contacts | 275 | 10,000 | ×36 |
| Accounts | 9 | 1,000 concurrent | ×111 |
| Database size | 120 MB | ~2 GB projected | ×17 |
| Catalog PDFs | — | 500 | Storage, not DB |

**The number that decides everything:**

```
max_connections   = 60          ← smallest Supabase tier (Micro)
shared_buffers    = 256 MB
connections in use= 31          ← with NINE accounts
```

Half the connection ceiling is already consumed by nine people. Data volume is
not the problem; **concurrency is**.

### What breaks first, in order

1. **The database.** ~130 screen-open requests/sec at 1,000 users, each
   fanning out to several queries → 300–500 queries/sec against 2 shared vCPU
   and 1 GB RAM. The tier handles a fraction of that.
2. **Presence heartbeats.** 1,000 users × one beat / 30s = **33 writes per
   second, permanently, with nobody doing any work**. This alone can saturate
   the current instance.
3. **Vercel is not the bottleneck** — it autoscales. It just delivers load to
   the bottleneck faster.
4. **Storage (photos, 500 PDFs) is fine.** It scales independently. That is a
   cost line, not a performance line.

---

## 2. The question that matters: does building for 1,000 slow us down at 9?

Not uniformly. Every item below is tagged with its effect on **today's**
experience, because some of this genuinely costs us now to pay off later.

### ✅ Category A — better now AND at scale (no trade-off)

Do these regardless of whether 1,000 users ever happens.

| Work | Effect today |
|---|---|
| Fewer requests per screen open | Already shipped: Product Data went 10 calls / 4078 ms → 4 calls / 1542 ms |
| Memoising reference payloads | `catalog-refs` 3174 ms → 43 ms; `visual-bindings` server work 213 ms → ~0 |
| Indexes on the columns we filter and sort by | Faster now, essential later |
| Slim list projections (don't select blobs) | Less to download on every device |
| Upgrading the database tier | Strictly faster now; costs money, changes nothing else |

### ⚠️ Category B — costs us today, required at scale

These are real trade-offs. Each needs an explicit decision.

| Work | What it costs today |
|---|---|
| **Batching/spacing heartbeats** | Presence and "who's online" become less live — a user shows as active a bit later |
| **List virtualization** | More complex code; on a 275-row list it is not faster, just steadier. It only pays at thousands of rows |
| **Read replicas** | Replication lag: a record you just saved can take a moment to appear in a list read from a replica |
| **Longer cache TTLs** | Data can be seconds stale. We already hit this: the Discuss channel read had to stay on the endpoint after the first load so mark-read still updates instantly |
| **Pagination instead of load-everything** | The user clicks "more" instead of scrolling one long list |
| **Rate limiting** | Protects everyone from one runaway client, but that client is sometimes a real person doing real work |

**The honest summary:** Category A is pure gain. Category B trades a little
immediacy for the ability to survive load. At 9 users we do not need Category B
— which is exactly why it should be built *deliberately*, with the cost stated,
not smuggled in as "optimisation".

### ❌ What would be wrong to do now

- Sharding, microservices, or a queue system. At this size they add failure
  modes and no speed.
- Rewriting working screens "for scale" before there is data to justify it.
- Caching so aggressively that the owner stops trusting what he sees. Trust in
  the numbers is worth more than milliseconds.

---

## 3. The plan, in order

### Phase 0 — Instrument before changing (1 day)

Nothing here is guesswork-driven. We already have `perf_samples` collecting
real device timings; extend it with **server-side** numbers: queries/sec,
connection count, slowest statements. Without this, Phase 2 is blind.

*Effect today: none. Cost: small.*

### Phase 1 — Category A sweep (ongoing, partly done)

1. ✅ Screen-open request count (done 2026-08-11/12: 10 → 4)
2. ✅ Reference-data memoisation (`visual-bindings`, `catalog-refs`)
3. ⬜ **Audit every query that reads a whole table.** Two found and fixed so
   far; there will be more. This is the single highest-value remaining item.
4. ⬜ **Index review** against the actual filter/sort columns of each list.
5. ⬜ **Contacts list virtualization** — currently renders all 268 rows. At
   10,000 the browser dies before the server does.

*Effect today: faster. No downside.*

### Phase 2 — Infrastructure (owner decision, costs money)

6. ⬜ **Upgrade the database tier.** The jump from Micro is not incremental —
   RAM, vCPU and `max_connections` all multiply. This is the single biggest
   lever and nothing else in this document substitutes for it.
7. ⬜ **Confirm connection pooling** (Supavisor, transaction mode) is what the
   app actually goes through, so 1,000 clients never map to 1,000 sessions.
8. ⬜ **Read replicas near the users.** The server is in Tokyo; the team is
   spread across countries. This is also the single biggest latency win for
   anyone outside Asia.

*Effect today: faster (6), neutral (7), slightly staler reads (8).*

### Phase 3 — Category B, only once Phase 0 shows we need it

9. ⬜ Heartbeat batching / adaptive cadence by user count
10. ⬜ Pagination on any list that can exceed a few hundred rows
11. ⬜ Rate limiting per account
12. ⬜ Longer, smarter cache TTLs with explicit invalidation

*Effect today: measurable cost. Do not start before Phase 0 justifies each one.*

### Phase 4 — Load testing

13. ⬜ Simulate 100 → 500 → 1,000 users against a **staging copy**, never
    production. Find the real ceiling instead of arguing about it.

---

## 4. What I will not do without an explicit decision

Per the standing rule, these are owner calls:

- Any database tier change (billing)
- Read replicas (billing + architecture)
- Anything touching production schema, RLS, or auth
- Any change that makes data staler than it is today

---

## 5. What it costs

Published rates, read 2026-08-12. Re-check before committing — they move.

**Correction to §1:** `max_connections = 60` is the *direct* limit. Micro also
provides **200 pooler connections**, and the app goes through the pooler. The
ceiling is wider than "60" suggests — still nowhere near 1,000.

### Where we are

| | Plan | Monthly |
|---|---|---|
| Supabase | Pro + Micro compute | ~$25 (Pro includes $10 compute credit) |
| Vercel | Pro, per member | $20 / member |

### Supabase compute — the one lever that matters

| Size | RAM | CPU | Pooler conns | $/mo |
|---|---|---|---|---|
| **Micro** (current) | 1 GB | 2-core | 200 | $10 |
| Small | 2 GB | 2-core | 400 | $15 |
| **Medium** ← recommended next | 4 GB | 2-core | 600 | $60 |
| Large | 8 GB | 2-core | 800 | $110 |
| **XL** ← floor for 1,000 users | 16 GB | 4-core | 1,000 | $210 |
| 2XL | 32 GB | 8-core | 1,500 | $410 |

Storage is not a cost problem: ~2 GB of database against 8 GB included, and
the photos + 500 PDFs live in file storage, inside the Pro allowance.

### Projected bill at 1,000 concurrent users

Invocation estimate: 1,000 users × ~50 screen opens/day × 5 requests ≈ 7.5M/mo
— **plus ~29M/mo of presence heartbeats alone**, which is why heartbeat
batching (Phase 3, item 9) is a cost item and not only a load item.

| | Monthly |
|---|---|
| Supabase Pro + XL compute | ~$225 |
| Vercel Pro (3 members) + usage | ~$150 |
| **Total** | **~$375** |

On 2XL instead of XL: ~$575. Egress stays inside the included 1 TB at this
usage; heavy PDF traffic would change that.

### The number worth acting on now

Micro → **Medium is +$50/month** and buys 4× the RAM and 3× the pooler
connections. That is not a 1,000-user answer — it is what makes the system
comfortable *today* and carries it into the hundreds. It is the cheapest
meaningful thing on this page.

## 6. The one-line answer

**Building for 1,000 does not slow down 9 — if the work is sequenced.**
Phase 1 makes today faster. Phase 2 makes today faster and tomorrow possible.
Phase 3 is the only part that costs us anything today, and it should not start
until Phase 0's numbers prove it is needed.
