# Auth Dependency Graph & Equivalence Proof (Phase 4 · SW-3)

**Scope:** the universal authentication prefix that runs on every authenticated
request — `getServerAuth()` in `src/lib/server/auth.ts` — and the SW-3 change
that memoizes it request-locally. This document is the honest finding + the
before/after equivalence argument the Wave-1 mandate requires.

---

## 1. The dependency graph (what auth actually costs per request)

```
requireAuth() / requireModuleAccess() / requireModuleAction()
   └─ getServerAuth()                         ← the universal prefix
        ├─ getSessionAccountId()   cookie + HMAC verify      … NO DB
        ├─ getViewAsAccountId()    cookie + HMAC verify      … NO DB   (SA-only)
        ├─ getViewAsRoleId()       cookie + HMAC verify      … NO DB   (SA-only)
        └─ Promise.all([                                     … ONE DB round trip
             accounts (+ joined role),           ← always
             koleex_employees.department,         ← always
             accounts (real session, SA check),   ← only when view-as active
             roles (target role flags),           ← only when role-mode view-as
           ])
```

Verified by source inspection (`src/lib/server/session.ts`): the three cookie
readers use **only** `node:crypto` `createHmac` + `next/headers` `cookies()` —
there is no `supabaseServer` import and no `.from(...)` query in that module.
The single DB batch is the `accounts`/`koleex_employees` load, already
parallelised (a prior fix collapsed a sequential second round trip).

**Honest finding:** the auth prefix was *already flat*. Session and view-as
resolution are DB-free; the account context is a single parallel batch. There
was **no redundant round trip to remove** — the SW-3 premise ("flatten the auth
prefix") was largely already satisfied before Wave 1. Fabricating a
round-trip reduction would have been dishonest, so none is claimed.

### Per-request resolution count

`requireModuleAccess` / `requireModuleAction` take the already-resolved `auth`
object **as a parameter** — they never re-invoke `getServerAuth`. A typical
route resolves auth exactly **once**. The files that reference `requireAuth`
3–4 times are single route modules exporting separate `GET`/`POST`/`PATCH`/
`DELETE` handlers — only one handler runs per request. So the common path was
already one resolve = one DB round trip.

---

## 2. The SW-3 change

```ts
// before
export async function getServerAuth(): Promise<ServerAuthContext | null> { …body… }

// after
async function resolveServerAuth(): Promise<ServerAuthContext | null> { …same body… }
export const getServerAuth = cache(resolveServerAuth);   // React request-scoped memo
```

`resolveServerAuth` is the **byte-identical** prior body. `cache()` (React 19)
memoizes the result **for the lifetime of a single server request** — a fresh
cache per request, never shared across requests or users. Any request that
happens to resolve auth twice (a route handler plus a shared helper that also
reads auth) now shares one resolution + one DB batch instead of two.

In the common single-resolve path the measured delta is **~0**. The value is a
guarantee against accidental double-resolution and a small win for the few
paths that call a shared auth-reading helper — not a claimed speedup.

---

## 3. Equivalence proof (before ≡ after, all roles)

### 3.1 By construction

1. **Same function body.** `resolveServerAuth` is the unchanged prior
   `getServerAuth`. No branch, query, flag, or return field was altered.
2. **Same inputs.** Auth is a pure function of the request cookies. Cookies are
   immutable within a request (`cookies()` returns the same store). `cache()`
   keys on the (empty) argument list, so within one request the memoized value
   is the value the un-memoized function would have returned.
3. **Request isolation.** `cache()` state lives in React's per-request store
   and is discarded when the request ends. Two different users' requests can
   never see each other's cached context. No cross-request/cross-user leakage.
4. **Therefore** the resolved `ServerAuthContext` is identical for every role —
   SA, admin, restricted employee, customer, disabled, view-as (account mode),
   view-as (role mode), cross-tenant — because each is determined solely by the
   same cookies through the same code.

### 3.2 Verified invariant — no stale identity

Memoization would only be unsafe if a request **mutated** its session/view-as
cookie and then **re-read** auth expecting the new identity. All five cookie
mutators were inspected:

| Route | Order | Re-reads auth after mutation? |
|---|---|---|
| `auth/signin` | sets session cookie only (no prior resolve) | No |
| `auth/signout` | clears session + view-as | No (no resolve at all) |
| `auth/view-as` (enter) | `requireAuth()` **then** `setViewAsCookie()` | No |
| `auth/view-as/role` | `requireAuth()` **then** `setViewAsRoleCookie()` | No |
| `auth/view-as/exit` | `requireAuth()` **then** `clearViewAsCookie()` | No |

Every route resolves auth **before** touching the cookie and never re-resolves
afterwards, so the memoized value is always the correct pre-mutation identity —
which is exactly what each route validates against (e.g. "is the real session a
SA?"). No route can observe a stale context.

### 3.3 Live post-deploy verification (no credentials required)

Run against production (`hub.koleexgroup.com`) after the SW-3 deploy:

| Check | Expected | Observed |
|---|---|---|
| `GET /api/me/bootstrap` — no cookie | 401 (anon path → null) | **401** `{"error":"Not signed in"}` |
| `GET /api/customers` — no cookie | 401 | **401** |
| `GET /api/products?view=list` — no cookie | 401 | **401** |
| `GET /api/me/bootstrap` — forged/garbage session cookie | 401, **not 500** (HMAC rejects) | **401** |
| `GET /api/files/catalog/<bogus>` — no cookie | 401 (auth-gated) | **401** |

The memoized `getServerAuth` still returns `null` for anon and for tampered
cookies (HMAC verify rejects → no 500), confirming the auth gate is intact
post-deploy.

### 3.4 What was NOT done, and why

An authenticated multi-role HTTP diff (sign in as each probe role, capture the
resolved context before and after) was **not** run: the probe fixtures
(`p0b_admin`, `p0b_customer`) store **bcrypt** password hashes, so no plaintext
credential is recoverable to drive the sign-in flow, and resetting fixture
passwords to run the diff would add risk for no additional assurance beyond the
by-construction proof above. Per the mandate, no such results are estimated or
fabricated. The equivalence rests on §3.1 (construction) + §3.2 (verified
invariant) + §3.3 (live anon/forged-cookie checks).

---

## 4. Reversibility

Single-line revert, no other file touched:

```ts
export const getServerAuth = resolveServerAuth;   // drop the cache() wrapper
```

Commit: `perf(sw-3): request-local memoization of getServerAuth (React cache)`.
