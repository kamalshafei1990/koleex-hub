# System Timing Coverage (SW-1)

| Coverage | Op(s) | How |
|---|---|---|
| **Fully instrumented** | `auth.resolve` (session/viewas/db + status) | in `getServerAuth` → **every authenticated request, all ~475 authed routes automatically** |
| **Fully instrumented** | `me.bootstrap` (auth/db) | shell's single composed load |
| **Fully instrumented** | `discuss.mutate` + `discuss.mutate.post_ack`, `discuss.read` | Phase 2/3 |
| **Fully instrumented** | `files.stream` | Phase 3 R3 |
| **Wrapper available (opt-in)** | any route | `timedRoute("app.op", handler)` adds Server-Timing header + sampled log with one line |
| **Not yet deep-instrumented** | individual list/search/mutation routes (customers.list, crm.board, quotations.list, finance.statement, …) | covered at the auth layer today; add `timedRoute`/`stageTimer` per family as Wave-2 targets them — deliberately NOT bulk-editing 475 files |
| **Excluded (reason)** | static/asset routes, `/api/perf/ingest`, `/api/version`, cron | no user-facing latency / would be self-referential |

**Design decision:** the mandate forbids manually editing hundreds of routes when a shared abstraction suffices. The auth-layer instrumentation + the reusable `timedRoute` wrapper satisfy "meaningful coverage across major route families" — `auth.resolve` already reports the universal prefix cost for *every* app, and deep per-route stages are added on demand where the scorecard directs (Wave 2).
