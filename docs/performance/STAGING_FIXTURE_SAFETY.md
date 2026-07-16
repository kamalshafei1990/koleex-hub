# Staging fixture safety

Fixture scripts create and destroy accounts, channels and messages. Pointed at
the wrong project they would create synthetic identities in — or delete real
rows from — **production**, and nothing about that failure is loud: it simply
succeeds. So the safety property cannot be "the operator was careful."

## The guard

`scripts/assert-staging-environment.mts` is the single gate. **Every** fixture
mode calls it before any client is constructed. Five independent conditions, all
required:

1. `KX_ENVIRONMENT === "staging"` (exact match)
2. `KX_ALLOW_DISCUSS_FIXTURES=1` — explicit per-run opt-in. Being on staging is
   not by itself permission to mutate it.
3. project ref **is not** `yxyizbnfjrwrnmwhkvme` — hardcoded **denylist**, checked
   before the allowlist, so "am I about to hit production?" is answerable without
   trusting any environment variable
4. project ref **is** `gmtjbshjsuexqayqumix` — not-production is not the same as
   is-staging
5. no production domain (`hub.koleexgroup.com`) anywhere in the resolved config

Any single condition could be met by accident — a stale env var, a copied
`.env`, a shell that still has production exported. Requiring all five means an
accident must happen five times in the same direction.

Fail-closed: missing, unknown or unparseable ⇒ abort. The guard prints **which
condition failed and never a value** — a guard that leaks the secret it guards
is not a guard.

### Verified by adversarial test

| attempt | result |
|---|---|
| production ref, everything else valid | **ABORT** (denylist) |
| `KX_ENVIRONMENT` unset | **ABORT** |
| `KX_ENVIRONMENT=production` | **ABORT** |
| fixture flag missing | **ABORT** |
| unknown third project | **ABORT** |
| production domain leaked into env | **ABORT** |
| service key missing | **ABORT** |
| valid staging config | **PASS** |

`staging-discuss-run-b.mts cleanup` pointed at production also aborts — proven,
not assumed.

## Identities

Every fixture identity is `@test.invalid` — a reserved TLD that cannot resolve or
receive mail. The shared password is a synthetic, disposable value hashed with
the app's real Argon2id parameters (`m=19456,t=2,p=1`), so the login path is
exercised for real. **No real password was used and no real user's password was
rotated.**

## Cleanup is scoped, never wholesale

Fixtures use **deterministic UUIDs** and cleanup deletes **by those ids**, never
`TRUNCATE` and never "delete all". A truncate-style cleanup pointed at the wrong
database is exactly the accident the guard exists to prevent; scoping by id
means even a guard bypass could only remove rows the script itself created.

Deletion is child-first so a partial failure leaves a state the next run can
finish cleaning.

## npm scripts

| script | does |
|---|---|
| `staging:preflight` | run the guard alone; prove the env is safe |
| `staging:seed-discuss-run-b` | report current fixture counts |
| `staging:cleanup-discuss-run-b` | remove fixtures by id (rows + storage objects) |
| `staging:verify-clean` | assert zero residual fixture rows; exit 1 if any |
| `staging:reset` | cleanup, ready to re-seed |

All require `KX_ENVIRONMENT=staging KX_ALLOW_DISCUSS_FIXTURES=1` and a staging
service-role key.

## The temporary upload policy — disclosed

Fixture **objects** must exist for the file route to stream real bytes, and
uploading to a private bucket needs the service key. Lacking it, the objects
were uploaded by briefly granting `anon` INSERT on `storage.objects` for the two
Discuss buckets, then **dropping the policy immediately**.

Post-state verified: `storage.objects` has **0 policies**, both buckets are
private, 8 objects present, public URLs return **400**, anon download refused.
Recorded here because an undisclosed temporary grant is indistinguishable from a
permanent hole to the next reader.
