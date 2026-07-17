# Discuss legacy media migration (Run C) — procedure and status

Status: **Tooling ready. NOT executed. Awaiting explicit go.**
No production object or metadata has been touched. Unit 2 is **not** closed.

Inventory: [DISCUSS_LEGACY_MEDIA_INVENTORY.md](./DISCUSS_LEGACY_MEDIA_INVENTORY.md)
— **6** legacy items (1 attachment + 5 voice), 6 distinct source objects.

## Credential model — local process environment only

The production service-role key is read from **`KX_RUN_C_PRODUCTION_SERVICE_KEY`
in the process environment, and nowhere else**. Not `.env`, not `.env.local`,
not Vercel, not GitHub Secrets, not a keychain, and not argv (argv is visible to
`ps`). Run C is a local one-shot migration; it needs no deployed runtime
credential, and adding one would only widen the blast radius.

The script validates **only that the variable exists and is non-empty**. It
never prints the key, nor any substring, prefix, suffix, length, or fingerprint
of it — a length is still information about a secret, and there is no
operational reason to emit one.

### Why a scrubber, not just discipline

Our own `console.log` is easy to audit. The real risk is a **third-party**
error: a failing `fetch` or a supabase-js error can carry request headers — and
therefore the key — inside a message or a stack.

So every byte printed goes through `scrub()`, and `console.log/error/warn/info`
are **wrapped at startup** so an accidental raw print cannot bypass it.
`uncaughtException` and `unhandledRejection` are scrubbed too. Beyond the exact
key, `scrub()` also masks anything shaped like `sb_secret_…` or a JWT, so a
secret echoed back by an API — one that is not ours — is caught as well.

`npm run runc:self-test` proves it, using a **throwaway** value: it forces the
secret through a plain string, an `Error` (message *and* stack), a nested
object, an array, a URL query, and the wrapped console, and fails if any case
survives. Never run it with the real key — if redaction were broken, that is
exactly how you would leak it.

### An earlier attempt, and why it was rejected

The key was first added to Vercel as `KX_RUN_C_PRODUCTION_SERVICE_KEY`, intended
Preview-only and branch-scoped. It landed as **`Preview, Production`** with no
branch restriction, and it was **Sensitive** — so it was simultaneously:

- **more exposed than intended** — a production service key present in every
  Preview environment (including branches deliberately pointed at staging) and
  in Production, defeating the very isolation Unit 2 established; and
- **unusable** — Sensitive variables pull back empty, so a local script cannot
  read them.

It was removed rather than re-scoped. Nothing persistent replaced it.

## Guards — all required

| # | guard | when |
|---|---|---|
| 1 | `KX_RUN_C_PRODUCTION_SERVICE_KEY` present and non-empty | before any client exists |
| 2 | `KX_RUN_C_APPROVED=true` (exact) | before any client exists |
| 3 | target ref is exactly `yxyizbnfjrwrnmwhkvme` | before any client exists |
| 4 | manifest holds exactly **6** items | `migrate` |
| 5 | every source path + content hash matches the manifest | per object, at `migrate` |
| 6 | `KX_RUN_C_EXECUTE=true` (exact) | **immediately before the first mutation** |

Guard 6 is separate on purpose: every read-only check runs first, and planning
can never slide into migrating.

**Note the inversion.** Everywhere else in this repo the production ref is a
hardcoded **denylist**. Here Production is the intended target, so it is an
**allowlist** and anything else aborts. That asymmetry is why this script is
separate from the staging tooling rather than a flag on it — the two have
opposite safety postures and must never share a code path.

Verified: with no credential, with a credential but no approval, with
`KX_RUN_C_APPROVED=yes` instead of `true`, and with an empty credential, the
script aborts **before constructing a client** — so a failed guard never touches
Production.

## Procedure

Copy first, delete last, one object at a time.

**`npm run runc:plan`** — read-only. Recomputes the inventory from Production by
mirroring `discuss-media.ts` `locate()`; requires exactly 6 items and 6 distinct
sources; downloads each source (the `media` bucket is public, so this needs no
key) and computes byte length + SHA-256 **from the bytes actually downloaded**,
never from metadata — metadata is the field we distrust. Writes the local
manifest and prints a sanitized plan (ref, count, buckets, sizes, MIME, hashes).
Mutates nothing.

**`npm run runc:migrate`** — re-derives the inventory and requires it to match
the manifest exactly (a message edited since `plan` stops the run; no
dynamically discovered object is ever migrated). Then per object:

1. re-read source, re-verify length + checksum against the manifest;
2. upload to `discuss-media` / `discuss-voice` with `upsert:false` — an existing
   destination is never overwritten — under a **randomized** path, so a leaked
   historical URL cannot be replayed against the private bucket;
3. **download the destination back** and compare bytes — not "the API returned
   ok";
4. only then metadata: re-read the row and update with an optimistic guard on
   the value read, so a concurrent edit cannot be clobbered. Sets the private
   shape, drops the legacy `url`, preserves filename/MIME/size/kind/duration/
   waveform and canonical index order, and touches nothing else on the row.

Any mismatch aborts that object with the source untouched and no metadata
written. There is **no automatic resume** after a partial failure.

Source deletion and the authorization matrix are gated behind the operator
harness and run only after the above passes.

## Rollback

Per object, from `.local/runc-manifest.json`: `previous_metadata` holds the row's
exact metadata from before the update. Restore it verbatim. The private copy may
remain — it is unreachable without a metadata reference and harmless. Restore the
public source only if genuinely required and byte-verified.

Never a broad rollback. Unrelated `media` objects belonging to Products,
Catalogs, Todos and Visual Library must not be touched under any circumstances —
the script only ever addresses the 6 exact paths in the manifest, and never
deletes by prefix or query.

## Artifacts

| path | committed? | contains |
|---|---|---|
| `.local/runc-manifest.json` | **no** (gitignored) | real paths + message ids, previous metadata, per-step status. Never a credential. |
| `.local/runc-report.txt` | **no** (gitignored) | credential-free audit of every operation |
| this doc + the inventory | yes | no ids, paths, URLs, filenames or customer data |

## After execution

`npm run runc:prove-clean` verifies a child process cannot see the credential.
It exits 1 while the variable is still exported, and prints the exact cleanup
command for the current shell:

```
unset KX_RUN_C_PRODUCTION_SERVICE_KEY
```

Nothing else needs revoking, because nothing was persisted anywhere.
