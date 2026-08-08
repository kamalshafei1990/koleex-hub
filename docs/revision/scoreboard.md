# System Revision — Scoreboard

Program: `docs/revision/system-revision-plan.md` · Started 2026-08-08
Lenses: B1 code health · B2 data/API · B3 frontend perf · B4 integrations · F1 UI/UX · F2 mobile
Status legend: ⬜ pending · 🔍 reviewed · 🛠 fixing · ✅ done · ➖ n/a

## Phase 0 — Baseline (measured 2026-08-08, local **production** server + owner session, prod DB)

Per-screen numbers on open (after ~9s settle). `API*` excludes the localhost-only
DevReload build-stamp poller (unthrottled at measurement time — fixed same day,
see SYS-1). `JS KB` = transferred bytes of fresh chunk fetches that run (0 = all
chunks came from browser cache; the file COUNT stays comparable).

| Screen | Requests | API* | JS files | JS KB | RSC prefetch | Images | Duplicate APIs seen |
|---|---|---|---|---|---|---|---|
| /home | 143 | 18 | 38 | 712 | 31 | 28 | me/bootstrap ×2 · inbox/feed ×3 · version ×2 · heartbeat ×3 |
| /discuss | 110 | 19 | 31 | 177 | 11 | 31 | discuss/read ×5 · me/bootstrap ×3 · inbox/feed ×3 · visual-bindings ×2 |
| /todo | 119 | 21 | 30 | 24 | 16 | 33 | todos/assignees ×4 · todos ×2 · todo-labels ×2 · me/work ×2 |
| /calendar | 103 | 19 | 29 | (cache) | 10 | 28 | me/bootstrap ×4 · inbox/feed ×3 · accounts ×2 · visual-bindings ×2 |
| /customers | 148 | 25 | 47 | **2,711** | 22 | 34 | contacts/avatars ×8 · accounts ×2 · activity/track ×2 |
| /products | 137 | 21 | 43 | 254 | 17 | 37 | me/bootstrap ×4 · fx/cny-usd ×2 · visual-bindings ×2 |
| /quotations | 118 | 12 | 37 | (cache) | 22 | 28 | inbox/feed ×3 |
| /product-data | 173 | 19 | 46 | (cache) | 32 | 58 | classification-icons ×2 · taxonomy/all ×2 · me/bootstrap ×2 |

## Systemic findings (cross-app — fix once, benefits everything)

| ID | Sev | Finding | Status |
|---|---|---|---|
| SYS-1 | P2 | DevReload (localhost-only) ticked on every pointermove unthrottled → 11-24 junk API calls/visit, polluted all localhost measurements | ✅ fixed 2026-08-08 (3s throttle) |
| SYS-2 | P1 | Duplicate same-screen API calls everywhere (bootstrap ×2-4, inbox/feed ×3, discuss/read ×5, assignees ×4, avatars ×8…) — request coalescing (client-cache cachedGet) exists but many call sites bypass it. On a ~1s/request network each dup is a full second of user time | 🛠 pass 1 ✅ 2026-08-08: discuss.ts bootstrap → shared me-bootstrap; todos/assignees+todo-labels+me/work+taxonomy/all → cachedGet; avatars CHUNK 30→120. Measured: /home 18→14, /todo 21→14, /customers avatars ×8→×2. Remaining ×2s (bootstrap, visual-bindings, contacts) pattern-match module duplication → folded into SYS-4. discuss/read ×5 = invalidation churn → Discuss app session |
| SYS-3 | P1 | /customers pulls 2.7 MB of route JS chunks (47 files) on first visit — heaviest screen measured | ✅ 2026-08-08: country-state-city's 8.2 MB city dataset (2.26 MB gzip) was welded onto the route (Turbopack doesn't tree-shake index re-exports; needed a deep lib/country import + form-gated lazy State/City). Cold open now ~0.45 MB (−83%); dataset loads on demand at form open. Details: apps/customers-sys3.md |
| SYS-4 | P2→P1 | ROOT CAUSE FOUND 2026-08-08: Turbopack DUPLICATES small modules across chunks (visual-bindings code present in 3 chunk files) → module-level singleton caches split into independent copies → parallel duplicate fetches (vb ×2 @15ms apart, proven by timestamps). FIX: anchor singletons on globalThis — applied to visual-bindings + client-cache; verified vb ×2→×1. me-bootstrap single-copy today (left untouched — auth-critical, own session if it ever duplicates). RSC `_rsc`-variant prefetch churn = Next prefetch TTL behavior, accepted for now | 🛠 core fixed |
| SYS-5 | P2 | 28-58 images per screen (cached in this run) — cold-load behavior, sizing and placeholders to verify per wave | ⬜ |

## Apps × lenses

| # | Wave | App | Route | B1 | B2 | B3 | B4 | F1 | F2 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | W1 | Home | / + /home | ✅ | ✅ | ✅ | 🔍 | ✅ | ✅ |
| 2 | W1 | Discuss | /discuss | ⬜ | ✅ | ⬜ | ⬜ | ⬜ | ⬜ |
| 3 | W1 | To-do | /todo | 🔍 | ✅ | 🔍 | 🔍 | ✅ | ✅ |
| 4 | W1 | Calendar | /calendar | 🔍 | ✅ | 🔍 | 🔍 | ✅ | ✅ |
| 5 | W1 | Notes | /notes | 🔍 | ✅ | ✅ | 🔍 | ✅ | ✅ |
| 6 | W1 | Mail (Inbox) | /inbox | 🔍 | ✅ | 🔍 | 🔍 | ✅ | ✅ |
| 7 | W2 | Customers | /customers | 🔍 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 8 | W2 | Quotations | /quotations | 🔍 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 9 | W2 | Products | /products | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 10 | W2 | Product Data | /product-data | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 11 | W2 | CRM | /crm | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 12 | W2 | Invoices | /invoices | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 13 | W3 | Suppliers | /suppliers | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 14 | W3 | Contacts | /contacts | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 15 | W3 | Inventory | /inventory | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 16 | W3 | Purchases | /purchase | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 17 | W3 | Landed Cost | /landed-cost | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 18 | W3 | Catalogs | /catalogs | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 19 | W4 | Employees | /employees | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 20 | W4 | HR | /hr | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 21 | W4 | Planning | /planning | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 22 | W4 | Projects | /projects | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 23 | W5 | Finance | /finance | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 24 | W5 | Expenses | /expenses | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 25 | W5 | Price Calculator | /price-calculator | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 26 | W5 | Commercial Policy | /commercial-policy | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 27 | W6 | Knowledge | /knowledge | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 28 | W6 | Documents | /documents | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 29 | W6 | Database | /database | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 30 | W6 | Website | /website | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 31 | W6 | Markets | /markets | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 32 | W6 | Translator | /translator | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 33 | W6 | Sales | /sales | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 34 | W7 | AI | /ai | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 35 | W7 | Accounts | /accounts | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 36 | W7 | Roles & Permissions | /roles | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 37 | W7 | Settings | /settings | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 38 | W7 | Activity Monitor | /super-admin/activity | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 39 | W7 | Issue Reports | /issues | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 40 | W7 | Download Center | /software-center | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| 41 | W7 | Management | /management | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| — | — | Marketing / Marketing Cards / Events / Dashboard | — | ➖ | ➖ | ➖ | ➖ | ➖ | ➖ (registry `active:false`) |

## Session-2 measurements (post SYS-2/SYS-4, 2026-08-08)

| Screen | API calls (was) | Duplicates now |
|---|---|---|
| /home | **14** (18) | none — heartbeat/badge polling cadence only |
| /todo | **14** (21) | todos ×2 (app's own double-load — To-do session item) |
| /discuss | **15** (19) | none of the old ones — myChannels ×5→×1, bootstrap ×3→×1, visual-bindings ×2→×1; channelMessages ×4 = the open thread's live-refresh loop (owner-settled reliability design, keep) |
| /customers | 19 over 35s | avatars ×8→×2; remaining ×2s were module-dup (fixed via globalThis anchors) — re-measure in the Customers session |

`/` launcher B1 verdict: **clean** — memoized cards, intent/idle prefetch tiers,
visibility-aware timers, mobile resilience already in place from prior perf
waves. No changes made; don't re-tune it without new evidence.

### Measurement doctrine (updated session 4)
An API URL appearing twice is NOT automatically a duplicate: HTTP
stale-while-revalidate produces a `deliveryType:"cache"` hit (~1ms) plus a
background revalidation (initiator "other"). Count only
`deliveryType!=="cache"` entries; discriminate remaining repeats by timestamp
(parallel = real dup, spaced = polling cadence).

## Severity scale
- **P0** broken / wrong data shown / crash
- **P1** slow path a user feels daily (dup requests, MB-scale chunks, unpaginated lists)
- **P2** polish / hygiene / minor waste

## Per-app reports
Filed as `docs/revision/apps/<app>.md` as each app completes.
