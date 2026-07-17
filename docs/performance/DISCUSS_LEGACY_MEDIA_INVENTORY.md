# Discuss legacy media — authoritative inventory (Run C, Step 1)

Recomputed from Production on the promoted commit. **Supersedes every earlier
count.** No message ids, filenames, URLs or object paths appear here.

## Method

Not a text search. Items were expanded from `metadata->'attachments'` (with
ordinality for the canonical index) and `metadata->'voice'`, then resolved by
mirroring `src/lib/server/discuss-media.ts` `locate()` exactly:

- attachment → `locate(undefined, file_path, url, "discuss-media")`
- voice → `locate(bucket, path, url, "discuss-voice")`

`locate()` prefers an explicit path over the url, and — because the attachment
call passes `undefined` for bucket — an attachment with a `file_path` **always**
resolves to `discuss-media`, never to `media`. Only a url-only item falls through
to `fromStorageUrl()` and lands on whatever bucket the url names.

Object existence was checked against `storage.objects` for both the url-named
object and the resolved object.

### Why the earlier counts were wrong

An earlier pass reported **6**, a later one **7**. The 7 came from
`metadata::text LIKE '%'||o.name||'%'`, which matches any object whose name is a
substring of another object's name, or of unrelated metadata. It over-counted.
The authoritative figure is **6**, computed structurally.

## Result — 6 legacy media items

| kind | count | shape | resolves to | source object exists | resolved object exists |
|---|---:|---|---|---|---|
| attachment | **1** | `url` + `file_path` | `discuss-media` | yes (in `media`) | **no** |
| voice | **5** | `url` only | `media` | yes | yes |

- 6 items, **6 distinct source objects** — no duplicate references.
- All 6 source objects exist in the public `media` bucket.
- None sits on a deleted message.
- None belongs to a non-Discuss module (all reached from `discuss_messages`).
- The attachment is `image/png`, 464,400 bytes — within `discuss-media` policy
  (50 MB, `image/png` allowed).
- The 5 voice items carry no `type`/`size` in metadata (legacy shape); the
  resolver defaults them, and they are within `discuss-voice` policy.
- All 5 voice items sit in a single channel; the 1 attachment is in a different
  channel.

## The finding that matters

**The one legacy attachment is already broken in Production**, independent of
Run C.

It carries a `file_path` written when uploads still targeted the public `media`
bucket. Post-Unit-2, `locate()` resolves that `file_path` against
**`discuss-media`** — where the object does not exist (`discuss-media` holds 0
objects). So `/api/files/discuss/<id>/0` returns **404** for it today.

The object itself is still publicly reachable at its old `media` URL. So the
current state for this item is the worst of both: **unreachable through the
authorized route, still reachable by anyone holding the public URL.**

Run C fixes both at once — copy the bytes to `discuss-media`, repoint
`file_path`, drop the `url`, then delete the public source.

The 5 voice items resolve to `media` and work today. They are the reason `media`
remains in the Discuss resolver allowlist. That allowlist entry can only be
removed after these 5 are migrated.

## Gate result

No stop condition was hit:

- no malformed metadata reference;
- no missing source object;
- no ambiguous/duplicate object reference;
- nothing belonging to a non-Discuss feature;
- nothing rejected by the destination MIME/size policy.

Run C Step 1 is **complete and green**. Steps 3–6 are blocked on a credential —
see [DISCUSS_LEGACY_MEDIA_MIGRATION.md](./DISCUSS_LEGACY_MEDIA_MIGRATION.md).
