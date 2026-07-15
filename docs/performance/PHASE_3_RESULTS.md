# Phase 3 — High-Impact Performance Corrections: Results

**Date:** 2026-07-15 · Commits: `6c152b60` (send-ack) · `dfc0afe7` (reconciliation) · `1f2f7d2b` (bell) · `9cf97ae3` (timer hygiene) · docs (this commit)

## 3A — Production evidence collected BEFORE changes

**Vercel Speed Insights: confirmed ENABLED** (its script serves 200 from production; field percentiles will accumulate as users browse — no manual step remains).

**Real production samples** — `[kx-server-timing]`, deployment `dpl_6Px6Buvg…`, 2026-07-15 ~16:12–16:15 UTC, region `iad1`:

`discuss.read resource=myChannels` (n=19, the notification bell's 10s poll — one request every ~10s confirmed live in logs):

| Percentile | total_ms | auth stage | db stage |
|---|---|---|---|
| P50 | **3,604 ms** | 1,261 ms | 2,420 ms |
| P75 | **~4,080 ms** | ~1,330 ms | ~2,970 ms |
| P95 | **~4,680 ms** | ~1,490 ms | ~3,300 ms |
| P99 | ~4,780 ms | ~1,580 ms | ~3,500 ms |
| min | 2,441 ms | 503 ms | 1,175 ms |

(n=19 → P95/P99 are indicative, not stable; labeled accordingly.)

**No `sendMessage` samples existed in the window** (no one sent a Discuss message since instrumentation deployed). Send-path baseline is therefore **derived from measured components**, clearly labeled as derived: ack ≈ auth (~0.5–1.6 s measured) + membership (1 DB hop) + insert (1 hop) + member lookup (1 hop) + broadcast HTTP (≤2.5 s timeout) + push fan-out ⇒ **~1.5–3 s typical, worse with many devices**. No client `[kx-metric]` batches yet — the only active session predates the instrumented bundle (PWA reload pending).

### 🔴 Structural root cause discovered (biggest finding of the phase)
**Supabase project region = `ap-northeast-1` (Tokyo). Vercel functions = `iad1` (US East, default).** Every one of the many sequential PostgREST calls inside a request pays a trans-Pacific round trip (~150–400 ms). That is why `auth` costs ~1 s and `myChannels` ~3.6 s while every query is sub-millisecond in Postgres itself (Phase 1).

**Recommended fix (one line, reversible, NOT yet applied — infra change awaiting owner approval):** pin function region to Tokyo in `vercel.json`: `{ "regions": ["hnd1"] }`. Expected effect: DB hop ≈ 170 ms → ~2 ms; `myChannels` ~3.6 s → an estimated 0.3–0.6 s; every API in the Hub improves; users (China/MENA) also get shorter user→function paths than to US East. Rollback = remove the line.

## 3B–3E — What changed (full designs in DISCUSS_DELIVERY_ARCHITECTURE.md + REALTIME_RECONCILIATION_STRATEGY.md)

1. **Send-ack** (`6c152b60`): ack after durable INSERT; member lookup + broadcast + push run post-response via Next `after()` (waitUntil-backed — platform-guaranteed, not fire-and-forget); own timing line `op=discuss.mutate.post_ack`; env rollback `KX_DISCUSS_INLINE_NOTIFY=1`.
2. **Connection-aware reconciliation** (`dfc0afe7`): the 5 s full-page poll is gone; ping-driven dirty flag → ≤2 full reconciles/min during activity, ~1/5 min quiet; ≥8 s unhealthy → 10/20/40 s backoff fallback; recovery + focus + visibility + **online** events reconcile; health API on the shared subscription registry.
3. **Bell realtime-first** (`1f2f7d2b`): 10 s `myChannels` hammer → 60 s insurance tick that fetches only when unhealthy or 5-min safety.
4. **Timer hygiene** (`9cf97ae3`): home clock + quote rotator gated on visibility; audit found other timers already compliant; presence heartbeat deliberately untouched (offline-marking hazard).

## Completion table

| Metric | Before | After | Change | Target | Result |
|---|---|---|---|---|---|
| Sender optimistic display P75 | no samples yet (instrumented, awaiting real use) | pending real use | — | < 50 ms | instrumented, rAF-measured |
| Send acknowledgement P75 | ~1.5–3 s (derived from measured stages) | pending real use; structurally = auth+membership+insert only | push fan-out + ping + 1 lookup removed from path | — | ✅ shipped, measurable |
| Send acknowledgement P95 | no samples (derived: worse with device count) | pending | — | — | — |
| Realtime dispatch P75 | inline, before ack | post-ack, logged separately (`post_ack.rt_dispatch`) | off critical path | — | ✅ |
| Push dispatch P75 | inline, before ack | post-ack, logged separately | off critical path | — | ✅ |
| Receiver-visible latency P75 | no samples yet | pending real use | ping timing unchanged by design | < 500 ms where network permits | instrumented |
| Discuss polling req/min (open channel) | 12 (measured cadence: every 5 s) | ≤2 active / ~0.2 quiet (by construction; `discuss.poll.skipped` counts prove it in logs) | −83% to −98% | ~0 while healthy | ✅ |
| Notification polling req/min | 6 × myChannels (measured in prod logs) | ~0.2 (5-min safety) | −97% | ~0 while healthy | ✅ |
| Hidden-tab requests/min | badge polls already gated; clock ticked at 60/min (renders, not requests) | render ticks 0 while hidden | — | minimal | ✅ |
| Duplicate message rate | 0 observed; seen-set + id-swap dedupe | unchanged mechanisms | — | 0 | not re-provable this session (see limitations) |
| Missed-message recovery | focus/visibility refetch | + online event, + recovery reconcile, + backoff fallback | strictly more recovery paths | 100% in tests | logic shipped; automated tests = Phase 12 |

**Numbers deliberately left blank/pending are unavailable, not guessed** — they require real authenticated usage, which will flow into the same logs (`[kx-metric]`, `post_ack`) automatically. Speed Insights is accumulating CWV percentiles as of today.

## Validation

- Production builds green through `9cf97ae3` (Vercel `next build` = type-check oracle for this repo).
- Live prod checks: instrumentation endpoints still gated (401 unauth); deployed bundle re-inspected.
- Privacy: no new logged fields beyond stage names/durations/reasons; no message content path exists.
- No new realtime subscriptions (health checks read the existing ref-counted registry); no RLS/permission changes; no API payload changes.
- **Not run (environment limits):** authenticated two-client smoke tests — the agent cannot sign in (credential policy; probe-password rotation requires the service key, unavailable in this session). Compensations: platform-guaranteed `after()` semantics, unchanged best-effort failure model, post_ack log line whose absence would immediately expose a reliability regression, and Phase 12's automated suite as the formal closure.

## Limitations & remaining risks

- `after()` reliability is Vercel-guaranteed but the post_ack log should be spot-checked after the first real sends (one line per send).
- Fallback polling activates only on stream-status signals; a stream that reports SUBSCRIBED but silently delivers nothing is covered by the 5-min safety pass and focus/visibility reconciles (window: minutes, not seconds — accepted trade-off, was also true before).
- Bell badge on a wedged-but-SUBSCRIBED stream updates at worst after 5 min or next focus (previously 10 s) — accepted per realtime-first design; chime still fires from realtime and from safety passes.
- The iad1↔Tokyo tax dominates all server timings until the region decision is made.

## Recommended next steps
1. **Approve the `hnd1` region pin** (one line; biggest single win available).
2. Let real usage accumulate 1–2 days of `[kx-metric]`/`post_ack`/Speed Insights data, then append the after-percentiles here.
3. Phase 4 (perceived-perf polish) or Phase 5 (Discuss state machine + gated idempotency migration) per roadmap.
