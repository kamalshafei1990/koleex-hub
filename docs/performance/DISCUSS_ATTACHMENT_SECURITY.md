# Discuss Attachment Authorization — Unit 2, Run A

Status: **Run A implemented in working copy. NOT deployed. Unit 2 NOT closed.**
Production remains `b433a8a7` (Unit 1 idempotency).

## The problem

Discuss attachments were delivered as **public Supabase Storage URLs** from the
shared `media` bucket. Consequences:

- anyone holding the URL could fetch the file forever, unauthenticated;
- a user removed from a channel kept access to everything they had seen;
- authorization was baked into the URL at write time, never re-checked.

Voice notes were partly better (private `discuss-voice` + a 1-hour signed URL)
but a signed URL is still a copyable bearer credential valid until expiry — and
the player **fell back to the public URL** when signing failed.

## The architecture

Every Discuss media object is addressed as:

    /api/files/discuss/<message-id>/<canonical-index>

The URL carries no bucket, no path, no token. The server resolves the object
itself and re-checks, **on every request** (including every Range request):

1. authenticated active account
2. message exists and is not deleted
3. message's channel belongs to the caller's tenant *(scoped in the query)*
4. caller has ACTIVE membership (`left_at IS NULL`)
5. index resolves to a real object

Any failure → uniform 404 (no existence oracle).

## Canonical media index

`metadata` carries media in two independent shapes. One ordered list:

    index 0 .. n-1  → metadata.attachments[0..n-1]   (stored order)
    index n         → metadata.voice, if present

Voice is appended **after** attachments, never index 0. Special-casing voice as
"index 0 when there are no attachments" works for today's rows but makes voice
unreachable on a message holding both, and makes index 0 ambiguous.

`src/lib/server/discuss-media.ts` is the single authority. The client no longer
computes an index at all: the server ships each item's canonical `index` in
`metadata.media`, and the UI passes it straight to discussAttachmentUrl().

### Persisted location shapes (verified against production, not assumed)

| kind | era | fields |
|---|---|---|
| attachment | legacy + current | `url` (public), `file_path` |
| voice | legacy (5 rows) | `url` (public), `duration_ms` — **no path/bucket** |
| voice | current uploader | `bucket`, `path`, `duration_ms` — **`url` empty** |

A model reading only `file_path`/`url` resolves current-era voice to nothing.
An earlier draft of this module did exactly that; it is now a regression test.

## Buckets

| bucket | visibility | use |
|---|---|---|
| `discuss-media` | private, 50MB, 13 MIME | ALL new images/documents |
| `discuss-voice` | private, 25MB, audio | ALL new voice notes |
| `media` | **public** | LEGACY READ ONLY — 6 pre-Unit-2 objects |

`media` stays public: it holds 6,694 objects for Products, Catalogs, Todos and
Visual Library. Unit 2 changes **Discuss delivery only**. It is removed from the
Discuss resolver allowlist once the six legacy objects are migrated (Run C).

## Upload policy — three layers

1. client `accept` + preflight → UX only, trivially bypassed
2. `/api/storage/upload` → **authoritative**, runs before any object is written
3. Supabase bucket `allowed_mime_types` → last resort

SVG/HTML/JS/installers are refused **at the bucket** — stronger than forcing
download at read time, since an SVG served from our origin can execute in it.

### These limits are NEW

Discuss inherited `media`'s 500MB/any-MIME settings, which was never a
deliberate Discuss policy, and the composer had **no `accept` filter**.
Production evidence: the only attachment MIME ever sent is `image/png`
(largest 464KB), so no historical upload is excluded — but exotic types that
would previously have uploaded now fail with a localized message (en/zh/ar).

## Rollback

- Code: revert the Run-A commits; production is unaffected until promoted.
- Bucket: `DELETE FROM storage.buckets WHERE id='discuss-media';` (safe while empty).
- **Never** roll back to public delivery. If an emergency arises, disable
  attachment opening rather than re-exposing public URLs.

## Verification (Run-A completion)

- `validate:discuss-attachments` — **135/135**
- `validate:discuss-idempotency` — **19/19** (Unit 1 intact)
- `tsc --noEmit` — exit 0
- `next build` — green, 491 pages
- Built Discuss chunk: contains `/api/files/discuss`; **0** occurrences of
  `storage/v1/object/public`, `api/storage/signed-url`, `supabase.co/storage`,
  or `file_path`

NOTE on the Unit-1 suite: two assertions pinned the literal
`{ ok: true, data: existing, idempotent: true }`. Unit 2 wraps the replayed row
in the serializer, so the literal changed to
`data: serializeDiscussMessageForClient(existing)`. The idempotency CONTRACT is
untouched — membership-before-insert, replay returns ok/idempotent, and returns
before `const notifyMembers` is defined — all still asserted and passing. Only
the projection of `existing` changed.

## Read sanitization — the client-safe contract (Run-A completion)

Seven paths returned rows selected with `*`, shipping `metadata.attachments[].url`
/ `.file_path` and `metadata.voice.url` to every client. The UI stopped
rendering them in Run A, but the PAYLOAD still contained them — a public URL in
a JSON response is a leak whether or not a component reads it.

`serializeDiscussMessageForClient()` (src/lib/server/discuss-serialize.ts) is
now the only way a message reaches the browser. It DELETES `metadata.attachments`
and `metadata.voice` and re-expresses them as `metadata.media`: display fields
plus a canonical index, built from an ALLOWLIST so a future storage field is
dropped by construction rather than needing a new denylist entry.

| Path / helper | Returned metadata | Now |
|---|---|---|
| `read/channelMessages` (full) | yes (`*`) | serialized |
| `read/channelMessages` (`?after`) | yes | serialized |
| `read/thread` (parent+children) | yes | serialized |
| `state/pinned` | yes | serialized |
| `state/starred` | yes | serialized |
| `mutate/sendMessage` canonical | yes | serialized |
| `mutate/sendMessage` idempotent replay | yes | serialized |
| `read/myChannels` → `last_message` | no — explicit projection | already safe |
| `read/search` | no — explicit projection | already safe |
| `reply_preview` | no — explicit projection | already safe |
| `mutate/editMessage`, `deleteMessage` | no — `{ok:true}` | N/A |
| `read/members`, `recipients` | no | N/A |
| `state/draft` | yes (`*`) | **serialized** (draft serializer) |
| `state/allDrafts` | yes (`*`) | **serialized** (draft serializer) |
| `state/draftChannels` | no — returns channel ids only | already safe |
| `mutate/saveDraft` (WRITE) | accepted raw `p.metadata` | **media keys stripped** |

Non-media metadata (mentions, products, link_preview) passes through untouched:
stripping a field the UI needs is as much a bug as leaking one it doesn't.

## Object-URL lifecycle

`src/lib/discuss-object-urls.ts` is the single owner. Ownership is
`clientMsgId → media index → object URL`. Previews are created under a composer
draft key and re-keyed (not recreated) to the clientMsgId at send, so the bubble
does not flicker at the moment of sending. Released on reconcile, discard,
conversation switch, unmount, logout/account switch. Idempotent — the key is
deleted before revoking, so a double call is a no-op.

The object URL lives ONLY in the manager. It is never written onto an attachment
record, so it cannot reach an API payload or another user.

## Drafts — no exception (Run-A finalization)

The earlier note claiming a draft exception was **wrong**, and the error is
worth recording: it asserted that stripping `file_path` "would break draft
restore". Verified against the code and production:

- `saveDraft()` is called with **body only**; metadata defaults to `{}`.
- Restore explicitly clears attachments — *"drafts currently store text only."*
- Production: **0 draft rows**, **0 rows with any metadata key**.
- `fetchAllDrafts()` has **no callers**.

So draft media has never existed. There was nothing to break, and no
draft→message media handoff, no draft object to garbage-collect, and nothing
for an opaque-reference system or a `/api/files/discuss-draft/...` route to
authorize. Building those now would be an authorization system for a feature
with no callers and no data to validate it against.

Instead drafts are made structurally incapable of carrying a storage reference,
in both directions:

- **READ** — `serializeDiscussDraftForClient()` emits an allowlist
  (`channel_id`, `body`, `updated_at`, `media[]`, optional `channel`).
  `metadata` never crosses the wire; neither does `account_id` (identity is the
  session) or the row `id` (a draft is keyed by account+channel).
- **WRITE** — `sanitizeDraftMetadataForStorage()` strips `attachments`/`voice`/
  `media` before upsert, so a crafted request cannot seed a private path into a
  draft row and read it back through any future echo.

`DiscussDraftRow` is now marked server-only; the wire type is
`DiscussDraftPublic`.

**If draft attachments are ever built**, that is when a server-owned reference
plus a first-party draft route becomes required — and
`sanitizeDraftMetadataForStorage()` is the single place that must be relaxed.

## KNOWN GAPS — Run A does not close Unit 2

1. **Authenticated fixture matrix** (Run B) not executed — no live
   200/206/404/401 evidence yet. Everything above is static + unit-level proof.
2. **Six legacy objects remain publicly reachable** (Run C).
3. **VoiceRecorder** owns its own review-before-send object URL outside the
   manager. Contained (never keyed to a message, revoked on discard/unmount),
   but not uniform; folding it into the manager is a follow-up.
5. **Failed-send previews** are released on discard because today a failed send
   removes the bubble. Unit 3 will keep it pending for retry; the release then
   moves to the discard branch only.
