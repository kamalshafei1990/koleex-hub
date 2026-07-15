# Phase 4 — System-Wide Performance Optimization · Wave 1 Results

**Mandate:** implement SW-1 … SW-5 in a controlled order, each independently
measured, independently reversible, preserving auth / permissions / tenant
isolation / UX / business behaviour. Separate reviewable commits. Stop after
Wave 1. **This document reports only what was measured; unavailable numbers are
marked as such — never estimated.**

Baseline measurement commit (approved): `af3db75f`.

---

## 1. What shipped (commit map)

| # | Commit | Item | Change |
|---|---|---|---|
| 1 | `4c4b712d` | SW-1 | Sampling + `timedRoute` in `perf.ts`; instrument `getServerAuth` (`auth.resolve`) |
| 2 | `0d4af2d9` | SW-1 | Instrument `me.bootstrap` |
| 3 | `d31692b9` | SW-2 | Adaptive heartbeat cadence in `ActivityTracker` |
| 4 | *(this doc)* | SW-5 | i18n loading — **audited, correction deferred** (§5) |
| 5 | `bcb1677d` | SW-4 | Code-split CRM board |
| 6 | `a7fe282d` | SW-4 | Code-split Discuss app |
| 7 | `0579df7c` | SW-4 | Code-split ProductForm (4 route bundles → shared lazy chunk) |
| 8 | `c7a88b5a` | SW-3 | Request-local memoization of `getServerAuth` (React `cache`) |
| 9 | *(this doc + `AUTH_DEPENDENCY_GRAPH.md`)* | SW-3 | Auth dependency graph + equivalence proof |
| 10 | *(this doc)* | — | Wave-1 results |

All code commits verified **green** on Vercel (build + deploy `success`).

---

## 2. Before / after

Legend: **Measured** = observed value; **Method** = how; **Unavailable** =
could not be measured under Wave-1 constraints (stated, not estimated).

| Metric | Before | After | Method / note |
|---|---|---|---|
| **Instrumented server coverage** | Discuss ops only (`discuss.mutate/read/…`) | + **universal `auth.resolve`** (every authed request) + `me.bootstrap` | SW-1. One shared abstraction (`getServerAuth`) instead of editing 475 routes. |
| **`auth.resolve` live emission** | none | session ~0.3–2.4 ms · viewas ~0 ms · db ~21–120 ms | Observed in Vercel logs post-deploy. Confirms session/view-as are DB-free; db = single `accounts` batch. |
| **Log volume from universal op** | n/a | sampled 1-in-4 + always-on for slow(≥800 ms)/error/denial | SW-1 sampling; deterministic counter, no `Math.random`. |
| **Background heartbeat — active/visible** | 1 / 30 s (2/min) | 1 / 30 s (2/min) — unchanged | SW-2. Presence accuracy + ≤30 s revocation preserved. |
| **Background heartbeat — idle OR hidden** | 1 / 30 s (2/min) | 1 / 120 s (0.5/min) — **4× fewer** | SW-2. Immediate catch-up ping on return-to-visible retained. |
| **Background presence DB writes/hr — idle tab** | ~120 / hr | ~30 / hr — **4× fewer** | Derived from cadence (one presence upsert per beat). |
| **CRM initial route JS** | eager `CRM.tsx` (**157,732 B** source) on `/crm` first paint | deferred to lazy chunk; route ships skeleton + loader | SW-4. Source bytes are the proxy (see §4 on why exact bundle KB is unavailable). |
| **Discuss initial route JS** | eager `DiscussApp.tsx` (**164,945 B** source) on `/discuss` | deferred to lazy chunk | SW-4. |
| **ProductForm initial route JS** | eager `ProductForm.tsx` (**303,429 B** source) on **4** routes | deferred to one shared lazy chunk across all 4 | SW-4. |
| **Active-locale dictionary bytes (client)** | all 3 locales inline — e.g. finance **292,902 B**, contacts **227,765 B**, accounts **116,683 B** | **unchanged** — correction deferred (§5) | SW-5. ~⅔ of each loaded dict is the 2 inactive locales. Splitting requires a data-shape + i18n-runtime refactor (hydration/flash risk) → not a safe reversible Wave-1 commit. |
| **Auth DB round trips / request** | 1 (already flat) | 1 — unchanged; memoization dedupes any accidental 2nd resolve to the same 1 | SW-3. See `AUTH_DEPENDENCY_GRAPH.md`. No round-trip existed to remove. |
| **Auth context equivalence (all roles)** | baseline | **identical** (by construction + verified invariant + live anon/forged checks) | SW-3 §3. |
| **Auth P50 / P95 (isolated)** | not separately sampled pre-Wave-1 | **Unavailable as rigorous percentiles** — `auth.resolve` now emits raw samples; percentiles require exporting/aggregating Vercel logs over a real traffic window | Honest gap; the instrument now exists to compute it. |
| **Common API P50 / P95** | — | **Unavailable** — not separately sampled; `timedRoute` is available to instrument specific hot routes when prioritised | Honest gap. |

---

## 3. Security / correctness preservation

- **SW-1** logs only code-authored stage names + coarse status tags (ok / anon /
  no_account / inactive / error). No ids, emails, tokens, or row data. Errors
  and denials are never sampled away.
- **SW-2** preserves the `revoked` force-logout signal (immediate ping on
  return-to-visible) and never marks a user false-offline.
- **SW-4** uses `ssr:false` only on client-only interactive shells (board / chat
  / editor) — nothing meaningful to SSR, so no hydration mismatch. Props are
  forwarded verbatim; route state, deep links, error boundaries, and data
  fetching are unchanged. Skeleton prevents blank-flash.
- **SW-3** is request-scoped memoization of an unchanged function body; identical
  inputs → identical output; discarded per request; verified no auth route
  re-reads auth after mutating its cookie. Full proof in
  `AUTH_DEPENDENCY_GRAPH.md`.

A cross-tenant regression check (the R3 tenant-scoped file route) still returns
`401`/`404` for anon/foreign requests post-deploy — no isolation regression.

---

## 4. Why some numbers are proxies, stated honestly

- **Exact per-route bundle KB is unavailable.** Next 16 no longer emits the
  legacy build-manifest at the URL the prior tooling scraped (documented in the
  Phase-4 bundle report). Component **source bytes** are used as a directional
  proxy for "weight moved off the initial route bundle." The *direction* is
  certain (these components are now in separately-loaded chunks); the precise
  gzipped-KB delta is not claimed.
- **Auth/API percentiles** need a traffic window + log aggregation, which is an
  observability export task, not a Wave-1 code change. SW-1 built the
  instrument; computing the percentiles is downstream.

---

## 5. SW-5 finding — audited, correction deferred (honest)

**Audit result:** translation dictionaries are shaped `{ key: { en, zh, ar } }`
— **all three locales inlined per key in one module** (`financeT`, `contactsT`,
…), statically imported into `"use client"` components. Consequence: a
Finance-route client downloads all three languages (**292,902 B** for finance
alone; contacts 227,765 B; accounts 116,683 B) regardless of active locale —
roughly **two-thirds** of each loaded dictionary is the inactive locales.

**Mitigating fact:** the dictionaries are already **feature-scoped** — finance.ts
only loads on Finance routes, contacts.ts only on Contacts routes, etc. There is
no single global dictionary shipped to every page. So the waste is bounded to
"inactive locales of the current feature," not "all locales of all features."

**Why no Wave-1 correction:** shipping only the active locale requires
restructuring the data shape (per-locale files/objects), changing the i18n
runtime to load a locale asynchronously, and re-verifying every consumer for
hydration mismatch and translation-flash across en/zh/ar (incl. RTL). That is a
cross-cutting refactor of a shared subsystem with real correctness risk — it is
**not** an independently-reversible, low-risk Wave-1 shared fix. Per the
mandate's "where beneficial" + "avoid hydration mismatch / visible flashes /
keep isolated and reversible," it is deferred rather than half-implemented.

**Recommended follow-up (its own gated effort):** split each dictionary into
per-locale chunks keyed by active locale, loaded via dynamic import behind a
synchronous-`t()`-preserving provider (hydrate active locale server-side to
avoid flash), with a per-feature rollout starting at the largest dictionaries
(finance → contacts → accounts). Expected saving ≈ the inactive-locale share
(~⅔) of each feature's dictionary bytes on that feature's routes.

---

## 6. Reversibility

Every code change is a single isolated commit revertable on its own: SW-4 =
repoint imports back to the eager component; SW-3 = alias `getServerAuth` to
`resolveServerAuth`; SW-2 = restore the fixed 30 s interval; SW-1 = remove the
`stageTimer` calls / sampling. No migrations, no schema, no RLS, no auth-contract
changes were made in Wave 1.

---

## 7. Wave 1 status: **COMPLETE.** Wave 2 not started (awaiting explicit approval).
