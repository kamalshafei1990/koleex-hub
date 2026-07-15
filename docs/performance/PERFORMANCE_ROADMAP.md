# Koleex Hub — Performance Roadmap

Derived from `PERFORMANCE_BASELINE.md` + `PERFORMANCE_BOTTLENECKS.md` + `DISCUSS_REALTIME_AUDIT.md` (Phase 1, 2026-07-15). Each phase is independently shippable and reversible; DB changes are additive migrations and **gated on owner approval**. No rewrite anywhere.

## Guiding conclusion from the audit
The database is healthy (sub-ms). The wins are: **remove serial awaits from hot paths, replace tight polling with the existing event-driven ping model, wire pagination the server already supports, and keep shrinking payloads/bundles** — plus instrumentation so every claim is measured.

| # | Phase | Contents | Risk | Gate |
|---|---|---|---|---|
| 2 | Observability | Vercel Speed Insights; lightweight server timing header (route → auth/db/total ms); Discuss send/receive lifecycle events with correlation IDs (no message bodies, no PII); P50/75/95/99 reporting; SA Performance Center spec (build later) | none (additive, privacy-safe) | auto |
| 3 | Quick wins — system | P1-1 (Discuss ack off pings/push); P1-2 (poll 5s→incremental 20–30s); NotificationBell → reuse `inbox:account` broadcast; pause home-page ticks when hidden; heartbeat consolidation | low | auto |
| 4 | Quick wins — data | Slim projections for `quotations` + `visual_assets` full-row list paths; parallelize any remaining serial fetches found by Phase 2 traces; precise TanStack invalidations | low | auto |
| 5 | Discuss state machine | P1-3 older-message pagination + scroll anchoring; ordering tie-breaker (id); failed-bubble + Retry + localStorage outbox; `client_message_id` idempotency | client parts auto | **migration gated** |
| 6 | Discuss receipts | delivered/read from member cursors; sidebar unread → grouped query/RPC when channel count grows | low | RPC gated |
| 7 | Reconnect & offline | formal connection states (connecting/connected/reconnecting/offline/degraded); cursor catch-up after reconnect; unobtrusive connection pill; multi-tab sanity | medium | auto |
| 8 | Attachments | progress, cancel, retryable uploads, thumbnail dimensions (no CLS), orphan prevention | low | auto |
| 9 | Perceived-perf polish | skeletons matched to final layout on top-5 routes; targeted prefetch; scroll restoration; stale-while-revalidate patterns already proven in Contacts/Products rolled to remaining hot apps | low | auto |
| 10 | Component splits | Contacts.tsx / DiscussApp.tsx / ProductForm.tsx dynamic-import seams, one per commit with before/after bundle + render measurements | medium | auto |
| 11 | DB hygiene batch | drop 11 duplicate indexes; `auth_rls_initplan` rewrites; consolidate permissive policies | low | **gated (all DDL)** |
| 12 | Tests | Discuss reliability suite (duplicate send, disconnect windows, reconnection, multi-tab, 10k-message scroll); authorization boundary tests; production-build smoke | none | auto |
| 13 | Budgets & standards | `docs/architecture/PERFORMANCE_STANDARDS.md`; CLAUDE.md rules (no unbounded lists, no new `select('*')` on lists, no poll where a ping topic exists, no subscription without cleanup+auth, no optimistic update without rollback, bundle budget: initial shell ≤ 2.0 MB uncompressed / flag any +10% route growth) | none | auto |

### Acceptance targets (initial — refine with Phase 2 field data)
Hub: feedback <100 ms · warm shell nav <200 ms · loading state <300 ms · INP <200 ms · LCP ≤2.5 s @P75.
Discuss: optimistic bubble <50 ms · receiver-visible <500 ms on reasonable networks (long-haul RTT reported honestly) · cached channel open <200 ms · no lost user text ever · duplicate-safe · no unauthorized delivery.

### Standing constraints (unchanged)
Tenant isolation, RLS, roles/permissions architecture, service-role-only patterns, no shared cross-user caches, no message content on broadcast payloads, Koleex AI permission boundary — all preserved by every phase above; none of the fixes touches authorization logic.
