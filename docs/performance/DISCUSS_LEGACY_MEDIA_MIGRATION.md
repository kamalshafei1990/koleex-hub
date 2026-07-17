# Discuss legacy media migration (Run C) — procedure and status

Status: **Step 1 complete. Steps 2–7 BLOCKED on the Production service-role key.**
Nothing in Production was modified. Unit 2 is **not** closed.

Inventory: [DISCUSS_LEGACY_MEDIA_INVENTORY.md](./DISCUSS_LEGACY_MEDIA_INVENTORY.md)
— **6** legacy items (1 attachment + 5 voice), 6 distinct source objects.

## The blocker

Every write path into Production's **private** Discuss buckets requires the
`service_role` key:

| path | why it is unavailable |
|---|---|
| Storage upload API (`POST /storage/v1/object/...`) | private bucket write ⇒ `service_role` |
| Storage server-side copy (`POST /storage/v1/object/copy`) | same |
| `createSignedUploadUrl` | issuing the signature ⇒ `service_role` |
| app route `/api/storage/upload` | works, but needs a real Production login; no Production credentials exist here and creating one is out of scope |
| SQL via MCP | can update `discuss_messages.metadata`, but **cannot move object bytes**; `storage.protect_delete()` also blocks `DELETE FROM storage.objects` |

Production `SUPABASE_SERVICE_ROLE_KEY` is marked **Sensitive** in Vercel — `vercel
env pull --environment=production` returns it as an **empty string**, by design.
No Supabase PAT exists on this machine (`~/.supabase` holds only telemetry; no
keychain entry; no env var), and no browser session is connected.

### The shortcut that was refused

Granting `anon` a temporary INSERT policy on Production `storage.objects` would
have unblocked the copy — the same trick used to seed fixtures on staging.

**It was not done, and must not be.** On staging the anon key guards an empty
throwaway project. In Production the anon key is *published in the client
bundle*, so such a policy would let anyone on the internet write into the private
Discuss buckets for the duration of the window. That is a strictly larger hole
than the one Run C exists to close.

## Procedure (ready to execute once the key is supplied)

Copy first, delete last. One object at a time. No step proceeds on assumption.

1. **Manifest** — local, uncommitted, at `.local/runc-manifest.json` (gitignored).
   Deterministic migration id per item; source identity; destination identity;
   expected byte length; MIME; verification status; metadata status; deletion
   status. Real Production paths and message ids live **only** in this local file
   and are never committed.
2. **Copy** — read the source from `media` (public, so readable without a key),
   compute byte length + SHA-256, upload to `discuss-media` (image/document) or
   `discuss-voice` (voice) under a **randomized** path. Never overwrite an
   existing destination.
3. **Verify** — fetch the destination back through admin access; require exact
   byte-length and checksum equality. On any mismatch: stop that object, leave
   metadata untouched, leave the public source in place.
4. **Metadata** — only after byte verification. Re-read the row and write with
   optimistic concurrency so a concurrent edit cannot be clobbered. Set the
   canonical private shape; remove the legacy `url`; preserve filename, MIME,
   size, kind, duration, waveform and canonical index order. Do not touch body,
   author, timestamps, reactions, reply or delivery state.
5. **Authorize** — against Production with controlled sessions: member 200;
   Range 206; non-member 404; removed member 404; cross-tenant 404;
   unauthenticated 401; correct MIME/disposition/`private` cache headers; bytes
   identical to the original.
6. **Revoke** — only then delete that one exact source object from `media`. Never
   by prefix, never by query. Verify the old public URL stops serving and the
   first-party route still works. If deletion fails, keep the private copy and
   report the duplicated state — no broad cleanup.
7. **Audit** — re-run the inventory; expect **0** Discuss-referenced objects in
   `media`; then `media` can leave the Discuss resolver allowlist (a separate,
   Preview-first code change).

### Ordering note

The 5 voice items currently **work** (they resolve to `media`). Migrating them
carries real regression risk and must follow the copy→verify→metadata→authorize
sequence exactly.

The 1 attachment is **already 404** (see the inventory). Migrating it can only
improve matters — but it must still be byte-verified before its public source is
deleted, because that source is the only surviving copy.

## Rollback

Per object, from the local manifest: restore the previous metadata JSON verbatim
(captured before the update); the private copy may remain (it is unreachable
without a metadata reference and harmless). Restore the public source only if
genuinely required and byte-verified. Never a broad rollback — unrelated `media`
objects belonging to Products, Catalogs, Todos and Visual Library must not be
touched under any circumstances.

## What shipped in this run

`scripts/audit-discuss-media-hygiene.mts` (`npm run audit:discuss-media-hygiene`)
— a **read-only** audit, safe against Production, that detects public Supabase
URLs, signed URLs, foreign hosts, legacy `url` fields, missing private paths,
objects still in `media`, ambiguous canonical indexes and duplicate source
objects. Exits 1 on any violation.

It was **proved to fire**: run against 4 deliberately-violating staging rows it
reported 15 violations across all 7 rules and exited 1; against clean data it
exits 0. An audit that has only ever seen clean data is not evidence.
