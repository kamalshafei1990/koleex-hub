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
| attachment | current | `file_path` (private bucket) |
| voice | current uploader | `bucket`, `path`, `duration_ms` — **`url` empty** |
| ~~attachment / voice~~ | ~~legacy~~ | ~~`url` (public `media`)~~ — **no rows remain** (Run C) |

A model reading only `file_path`/`url` resolves current-era voice to nothing.
An earlier draft of this module did exactly that; it is now a regression test.

## Buckets — Discuss is private-only (Unit 3)

| bucket | visibility | use |
|---|---|---|
| `discuss-media` | private, 50MB, 13 MIME | ALL images/documents |
| `discuss-voice` | private, 25MB, audio | ALL voice notes |
| `media` | **public** | **NOT a Discuss bucket** — other modules only |

Unit 2 routed Discuss through an authorized route while tolerating six legacy
objects in public `media`. Run C migrated those six and deleted the public
originals (6694 → 6688 objects, exactly six removed). **Unit 3 removed `media`
from the Discuss allowlist**, so Discuss can no longer serve a byte from a
public bucket by any path: the allowlist gates both the resolver and
`fromStorageUrl()`, so even a legacy `url` pointing into `media` is now
rejected. The item stays *listed* (index stability is the contract) but resolves
to an empty path, which the route serves as a uniform 404 — fail closed, not
fail public.

`media` itself is untouched and still public: it holds ~6,688 objects for
Products, Catalogs, Visual Library, Notes, Suppliers, Employees and Quotations,
and `CATEGORY_BUCKETS.catalog` still maps to it. Unit 3 removed Discuss's claim
on the bucket, not the bucket. Deleting `media` outright would break Catalogs —
that over-correction is itself a regression test.

That the bucket remains public, 500MB, with no MIME restrictions is a real
posture question for those seven modules. It is **out of scope** for Discuss and
needs its own audit.

## Ongoing verification — a pre-promotion gate, not CI

`npm run audit:discuss-media-hygiene` is read-only and checks the DATA, not the
code: metadata is data, so a restored backup or a hand-edited row can reintroduce
a public URL with no code change and no test noticing.

It is deliberately **not** wired into CI. It can only tell the truth against
**production**, which needs `SUPABASE_SERVICE_ROLE_KEY` — and parking a
production service-role key in CI secrets would create exactly the persistent,
widely-readable credential that Run C was structured to avoid. Pointing it at
staging instead would pass while proving nothing about production: a green check
that verifies the wrong database is worse than no check, because it is believed.

So it runs as a **pre-promotion gate**: before promoting any Discuss change to
Production, run it locally against production with a short-lived credential and
require exit 0. Expected output today: 6 messages, 6 media items, clean on all
8 rules.

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

1. ~~**Authenticated fixture matrix** (Run B) not executed~~ — **Run B EXECUTED
   AND PASSED** against a live Preview pointed at the Discuss-scoped staging
   project. Live 200/206/404/401 evidence, Range re-authorization, and the
   client-safe payload contract are all demonstrated with real HTTP. Fixtures
   removed afterwards with zero residue verified directly against the database.
   See [DISCUSS_RUN_B_RESULTS.md](./DISCUSS_RUN_B_RESULTS.md).
2. **Six legacy objects remain publicly reachable** (Run C).
3. **VoiceRecorder** owns its own review-before-send object URL outside the
   manager. Contained (never keyed to a message, revoked on discard/unmount),
   but not uniform; folding it into the manager is a follow-up.
5. **Failed-send previews** are released on discard because today a failed send
   removes the bubble. Unit 3 will keep it pending for retry; the release then
   moves to the discard branch only.
