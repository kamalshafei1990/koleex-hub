# W4 · Employees + HR + Planning + Projects — six-lens pass

**Measured** 2026-08-13 on `next start -p 3001` (prod bundles) + owner session + prod DB,
`performance.getEntriesByType('resource')`, counting only `deliveryType !== "cache"`
and excluding the localhost-only `/api/dev/build-stamp` poller.

## Baselines

| screen | API calls before | after | duplicates before | after |
|---|---|---|---|---|
| `/employees` | 5 | 5 | none | none |
| `/hr` | 10 | 10 | *(see below — not duplicates)* | — |
| `/planning` | 10 | **8** | items·resources·roles·leaves **each ×2** | **none** |
| `/projects` | 10 | **8** | `projects/tags ×2` | **none** |

## B1 — a P0 crash, found by lint and confirmed in the browser

`react-hooks/rules-of-hooks` flagged `useConfirm` as *called conditionally* twice in
`ProjectsApp.tsx`. Both `ProjectFormModal` and `TaskFormModal` had:

```tsx
if (!open) return null;
…
const { askConfirm, confirmDialog } = useConfirm();   // ← below the early return
```

Both are mounted **permanently** by their parents with `open` passed as a prop, so
opening one grows the hook count between renders. **Verified live, not inferred:**
clicking "New project" on a prod build threw

> `Uncaught Error: Minified React error #310` — *Rendered more hooks than during the
> previous render*

…the modal did not open, and **the whole /projects screen was replaced by "This page
couldn't load"**. Creating a project from that screen was impossible.

Fixed by hoisting the hook above the early return in both modals. Re-verified on a
fresh prod build: modal opens, `errorCount: 0`.

**Then swept the entire Hub for the same pattern** — `eslint --rule
'{"react-hooks/rules-of-hooks":"error"}'` over `src/**`: **zero remaining violations**.
ProjectsApp was the only site.

### The same trap tried to bite again, five minutes later

Fixing `Date.now()`-during-render (below) by wrapping it in `useMemo` + `useRef`
re-created the exact defect — the file has an early return above that line too, and
lint caught it immediately. Rewritten as a module-scope `PAGE_OPENED_AT` constant
instead. **A hook is not a free refactor tool; check for an early return first.**

### Other B1 fixes

- **`Cannot create components during render` ×3** — `SectionLabel` was declared
  *inside* `EmployeeSkillsSection`, so it was a new component type on every render and
  React unmounted/remounted its subtree each time. It closes over nothing; hoisted to
  module scope. That file is now lint-clean.
- **`Cannot call impure function during render`** — `employees/[id]` computed tenure in
  an IIFE calling `Date.now()`, under a comment claiming it was "computed once". It
  re-ran on every render. Now a module-scope timestamp; tenure is in months, so a
  per-page-load clock is exact.

**eslint across the four apps: 21 errors → 16**, and every one of the survivors is the
single `setState`-synchronously-within-an-effect rule. The crash-class and
purity-class errors are all gone.

## B2 — two "duplicates" that were real, one that was not

### `/api/hr/data ×5` is NOT a duplicate — and nearly got "fixed"

The path count says five identical calls. The resource-timing API cannot see a **POST
body**, and `/api/hr/data` is HR's single query gateway: every read is one POST with a
different `{table, select, filters}` payload.

Patched `window.fetch` and captured the bodies: **5 calls, 5 distinct payloads**
(`hr_leave_requests` ×3, `hr_documents` ×2), **zero identical pairs**. The gateway is
working exactly as designed.

> This is W3's lesson in a new costume. There it was the **query string** that made
> four reads look like two duplicates; here it is the **POST body**. **A path count is
> not a duplicate count — prove it with what actually varies.**

Filed, not fixed: those five could become one batched request. That is a change to the
gateway contract, so it is an opportunity with a number attached, not a revision edit.

### `/planning` loaded everything twice — genuinely

All four opening reads fired **twice, 1–3 ms apart** (`items` · `resources` · `roles` ·
`leaves`), the slowest pair costing 779 ms each. Confirmed on a **prod** build, so it is
not React StrictMode.

Diagnosis was pushed as far as it honestly went:
- **Not a remount** — a `MutationObserver` over a soft-nav return showed Planning's
  node added once, never removed-and-re-added.
- **Not the deps** — `weekStart`/`weekEnd` are `useMemo`s over an `anchor` held in
  state, and `setAnchor` appears only in three event handlers.
- **Not the initial load** — a soft-nav (no page load) reproduced it identically.
- **Not a second call site** — the only caller of all four together is `reload()`.

So the effect ran twice with a `reload` that reads as stable. **I could not identify
the root cause from the code, and I am not claiming one.** What is fixed is the cost,
in the request layer — the same treatment SYS-2 uses everywhere else.

### The fix, and why TTL 0 is not a cache

Both `lib/planning.ts` (4 reads) and `lib/projects.ts` (3 reads) now go through
`cachedGet(url, 0)`. That looks like caching with the cache turned off, and it is
deliberate: `cachedGet` returns an **already-in-flight promise before it ever consults
the TTL**, so TTL 0 buys request *coalescing* with **no stale-data risk at all** — which
matters here, because W3 just proved how a cached list serves the pre-write state.
Writes are untouched.

**Measured after: `/planning` 10 → 8 calls (planning reads 8 → 4), `/projects` 10 → 8,
zero duplicates on either.**

### Also seen, not fixed

`/api/version ×2`, 1 ms apart, on both screens — from `UpdateWatcher`. At 9 ms and
14 ms it is not worth a code change; noted so the next pass does not re-discover it.

## B3 — no warm-start on any of the four

None of `/employees`, `/hr`, `/planning`, `/projects` has a `kx_*` snapshot mirror, and
none uses `cachedGet` outside what this pass added. The standing W3+ deliverable is
*not* met here. `/employees` and `/hr` are cheap enough to survive it (5 and 10 calls,
no dups); `/planning` and `/projects` would benefit. **Filed, not silently skipped.**

## B4 — no browser DB access anywhere

All four apps: **zero `supabase.from(`**. Every read and write already goes through the
authenticated routes. HR's `/api/hr/data` service-role gateway is the strongest version
of this pattern in the Hub.

## F1 — dead English, and a dictionary running ahead of the screen

### The finding that mattered most was NOT a translation

`AdminAuth` takes `title` and `subtitle` as **required** props. It renders **neither** —
the gate moved to a tab-contextual heading (`t("welcome")` / `t("join.title")` from
`signInT`) and the props were never removed. `AuthGate` then forwards the same dead pair
one hop further.

**19 pages were passing hardcoded English into props nothing reads.** A quick F1 sweep
would have "fixed" this by adding 19 × 2 keys in three languages — **114 translated
strings for text that does not exist on screen.** Removed instead: both interfaces, both
signatures, and all 19 call sites.

### TaskExtras.tsx — 367 lines, six exported panels, zero `t()`

The same shape as W3's landed-cost print report. 17 strings, in three waves again:
`>text<`, then `placeholder=`, then **`<Empty text="…">`** — a prop carrying visible copy,
invisible to every text scan (five hid there), and one last `<span>` literal that matched
none of the three patterns. All six panels now take the hook; `relTime()` took a
hardcoded `"en"` locale and now follows `lang`.

### Employees — the dictionary was already ahead

36 English strings sat in props (`title=`, `emptyHint=`, `errorLabel=`, `hint=`).
**21 of 28 distinct texts already had en/zh/ar keys that nothing used** — `act.crm`,
`act.crm.empty`, `p.visaNo` and so on were written and never wired. Added the 7 genuinely
missing keys, wired all 28 (34 replacements across two files).

`EMP-001` left alone deliberately — a sample code, not a word.

### BrandLoading

`label` defaulted to a hardcoded `"Loading…"` rendered into `sr-only`, and four
`loading.tsx` pages passed **that same default explicitly**. The default is now
translated via a new shared `ui.loading` key in `commonT`; an explicit label still wins;
the four redundant props are gone.

### HR needed nothing

**472 `t()` calls and zero bare strings** — the cleanest app in the programme on this
lens. No F1 change was warranted and none was made.

## F2 — mobile, measured at 360×780

| route | scrollWidth | horizontal bleed | h1 truncated |
|---|---|---|---|
| `/employees` | 360 | no | no |
| `/hr` | 360 | no | no |
| `/planning` | 360 | no | no |
| `/projects` | 360 | no | no |

All four clean. No F2 change was warranted and none was made.

## Gates

`npm run build` exit 0 · `tsc --noEmit` **0 errors project-wide** · `validate:budgets`
**56 passed, 0 failed** · `rules-of-hooks` across `src/**` **0 violations**.
