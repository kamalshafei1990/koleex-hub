/* ---------------------------------------------------------------------------
   validate:discuss-attachments — Discuss Stabilization Unit 2 (Run A).

   Locks in the attachment-authorization architecture so a later change cannot
   quietly reopen public delivery. Two kinds of check:

     · BEHAVIOUR — runs the real canonical media model against fixture
       metadata (every persisted shape, incl. the both-shapes case that has no
       production rows yet). These are the ones that catch actual bugs.
     · STATIC    — greps source for patterns that must not come back.

   NOTE on static checks: assertions are written against real CODE shapes
   (assignments, JSX props), never bare mentions of a word, because this file
   and the modules it guards DISCUSS the forbidden patterns in comments. An
   earlier iteration of a sibling validator failed exactly that way — the
   guard tripped on its own explanatory prose.
   --------------------------------------------------------------------------- */

import { readFileSync } from "node:fs";
import { discussMediaList, sanitizeDiscussMedia } from "../src/lib/server/discuss-media";
import {
  serializeDiscussMessageForClient,
  serializeDiscussMessagesForClient,
  serializeDiscussDraftForClient,
  sanitizeDraftMetadataForStorage,
} from "../src/lib/server/discuss-serialize";
import { discussVoiceIndex, discussAttachmentUrl, isCanonicalMessageId } from "../src/lib/discuss-attachments";
import { checkDiscussUpload, DISCUSS_MEDIA_MAX_BYTES } from "../src/lib/discuss-upload-policy";

let pass = 0;
const failures: string[] = [];
function check(name: string, cond: boolean) {
  if (cond) pass++;
  else failures.push(name);
}

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const resolver = read("src/app/api/files/[...ref]/route.ts");
const uploadRoute = read("src/app/api/storage/upload/route.ts");
const discussLib = read("src/lib/discuss.ts");
const app = read("src/components/discuss/DiscussApp.tsx");
const voice = read("src/components/discuss/VoiceRecorder.tsx");
const sw = read("public/sw.js");
const readRoute = read("src/app/api/discuss/read/route.ts");
const stateRoute = read("src/app/api/discuss/state/route.ts");
const mutateRoute = read("src/app/api/discuss/mutate/route.ts");
const objectUrls = read("src/lib/discuss-object-urls.ts");

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"; // fixture host for legacy-URL parsing
const HOST = "https://example.supabase.co";
const PUB = (b: string, p: string) => `${HOST}/storage/v1/object/public/${b}/${p}`;

/* ── 1. CANONICAL INDEX MODEL ──────────────────────────────────────────── */

// attachments-only
const attOnly = { attachments: [{ name: "a.png", file_path: "x/a.png", size: 1, type: "image/png" }] };
check("index: attachment-only → 1 item at 0", discussMediaList(attOnly).length === 1);
check("index: attachment-only kind", discussMediaList(attOnly)[0].kind === "attachment");

// voice-only, CURRENT uploader shape (bucket+path, NO url)
const voiceNew = { voice: { bucket: "discuss-voice", path: "v.webm", duration_ms: 1200, waveform: [] } };
const vn = discussMediaList(voiceNew);
check("index: voice-only (bucket+path) → index 0", vn.length === 1 && vn[0].kind === "voice");
check("index: voice-only resolves private bucket", vn[0].bucket === "discuss-voice");
check("index: voice-only resolves path", vn[0].path === "v.webm");
/* REGRESSION: the first draft of the model read `file_path`/`duration` on
   voice — fields voice has never had. Current-era voice resolved to an empty
   path (silently unplayable) and duration was dropped. */
check("index: voice duration_ms is carried", vn[0].duration_ms === 1200);

// voice-only, LEGACY shape (public url only, no path/bucket)
const voiceLegacy = { voice: { url: PUB("media", "leg.webm"), duration_ms: 900, waveform: [] } };
const vl = discussMediaList(voiceLegacy);
check("index: legacy voice url → media bucket", vl[0].bucket === "media");
check("index: legacy voice url → object path", vl[0].path === "leg.webm");

// BOTH shapes — no production rows today; the case the model exists for.
const both = {
  attachments: [
    { name: "a.png", file_path: "a.png", size: 1, type: "image/png" },
    { name: "b.pdf", file_path: "b.pdf", size: 2, type: "application/pdf" },
  ],
  voice: { bucket: "discuss-voice", path: "v.webm", duration_ms: 5, waveform: [] },
};
const bl = discussMediaList(both);
check("index: both → 3 items", bl.length === 3);
check("index: both → attachments keep 0..n-1", bl[0].path === "a.png" && bl[1].path === "b.pdf");
check("index: both → voice appended LAST (index n)", bl[2].kind === "voice" && bl[2].path === "v.webm");
check("index: client voice index === attachments.length", discussVoiceIndex(both) === 2);
check("index: client/server voice index agree", bl[discussVoiceIndex(both)].kind === "voice");
check("index: voice index with no attachments is 0", discussVoiceIndex(voiceNew) === 0);

// malformed / hostile
check("index: malformed metadata → []", discussMediaList({ attachments: "nope" }).length === 0);
check("index: null metadata → []", discussMediaList(null).length === 0);
check("index: undefined metadata → []", discussMediaList(undefined).length === 0);
check(
  "index: traversal path is refused (empty path ⇒ 404)",
  discussMediaList({ attachments: [{ file_path: "../../etc/passwd", name: "x", size: 0, type: "" }] })[0].path === "",
);
check(
  "index: foreign-host url is refused",
  discussMediaList({ voice: { url: "https://evil.example.com/storage/v1/object/public/media/x.webm", duration_ms: 0, waveform: [] } })[0].path === "",
);
check(
  "index: non-Discuss bucket in url is refused",
  discussMediaList({ voice: { url: PUB("product-images", "x.webm"), duration_ms: 0, waveform: [] } })[0].path === "",
);
/* An unresolvable item must NOT be dropped — dropping it would shift every
   later index and make the resolver serve the wrong object. */
const withBad = { attachments: [{ file_path: "", name: "bad", size: 0, type: "" }, { file_path: "ok.png", name: "ok", size: 1, type: "image/png" }] };
check("index: unresolvable item keeps its slot (no index shift)", discussMediaList(withBad)[1].path === "ok.png");

/* ── 2. SANITIZER ──────────────────────────────────────────────────────── */
const san = sanitizeDiscussMedia(both);
const sanKeys = new Set(san.flatMap((m) => Object.keys(m)));
check("sanitize: never emits url", !sanKeys.has("url"));
check("sanitize: never emits file_path", !sanKeys.has("file_path"));
check("sanitize: never emits path", !sanKeys.has("path"));
check("sanitize: never emits bucket", !sanKeys.has("bucket"));
check("sanitize: emits canonical index", san[2].index === 2);
check("sanitize: shares ordering with resolver", san[2].kind === "voice");
check(
  "sanitize: legacy public url never leaks through",
  !JSON.stringify(sanitizeDiscussMedia(voiceLegacy)).includes("supabase.co"),
);

/* ── 3. URL BUILDER ────────────────────────────────────────────────────── */
const ID = "123e4567-e89b-12d3-a456-426614174000";
check("url: canonical id accepted", isCanonicalMessageId(ID));
check("url: temp id rejected", !isCanonicalMessageId("temp_abc"));
check("url: pending message → null (never a public url)", discussAttachmentUrl("temp_abc", 0) === null);
check("url: negative index → null", discussAttachmentUrl(ID, -1) === null);
check("url: non-integer index → null", discussAttachmentUrl(ID, 1.5) === null);
check("url: first-party shape", discussAttachmentUrl(ID, 2) === `/api/files/discuss/${ID}/2`);
check("url: download variant", discussAttachmentUrl(ID, 0, { download: true }) === `/api/files/discuss/${ID}/0?download=1`);

/* ── 4. UPLOAD POLICY ──────────────────────────────────────────────────── */
check("policy: png accepted", checkDiscussUpload("discuss-media", { size: 10, type: "image/png" }).ok);
check("policy: pdf accepted", checkDiscussUpload("discuss-media", { size: 10, type: "application/pdf" }).ok);
check("policy: svg REFUSED (executes in our origin)", !checkDiscussUpload("discuss-media", { size: 10, type: "image/svg+xml" }).ok);
check("policy: html REFUSED", !checkDiscussUpload("discuss-media", { size: 10, type: "text/html" }).ok);
check("policy: unknown type REFUSED", !checkDiscussUpload("discuss-media", { size: 10, type: "application/x-msdownload" }).ok);
check("policy: empty type REFUSED", !checkDiscussUpload("discuss-media", { size: 10, type: "" }).ok);
check("policy: oversize REFUSED", !checkDiscussUpload("discuss-media", { size: DISCUSS_MEDIA_MAX_BYTES + 1, type: "image/png" }).ok);
check("policy: mime with charset normalized", checkDiscussUpload("discuss-media", { size: 1, type: "text/csv; charset=utf-8" }).ok);
check("policy: audio rejected on media bucket", !checkDiscussUpload("discuss-media", { size: 1, type: "audio/webm" }).ok);
check("policy: audio accepted on voice bucket", checkDiscussUpload("discuss-voice", { size: 1, type: "audio/webm" }).ok);
check("policy: iOS audio/mp4 accepted", checkDiscussUpload("discuss-voice", { size: 1, type: "audio/mp4" }).ok);
check("policy: image rejected on voice bucket", !checkDiscussUpload("discuss-voice", { size: 1, type: "image/png" }).ok);

/* ── 5. RESOLVER (static) ──────────────────────────────────────────────── */
check("resolver: discuss allowlist includes private buckets",
  /discuss:\s*\["discuss-media",\s*"discuss-voice",\s*"media"\]/.test(resolver));
check("resolver: bucket comes from normalized metadata, not a literal",
  /return \{ bucket: src\.bucket, path: src\.path/.test(resolver));
check("resolver: no hardcoded media bucket for discuss",
  !/return \{ bucket: "media", path, filename: src\.name \}/.test(resolver));
check("resolver: tenant-scoped query", /discuss_channels!inner\(tenant_id\)/.test(resolver));
check("resolver: tenant eq filter", /\.eq\("discuss_channels\.tenant_id", auth\.tenant_id\)/.test(resolver));
check("resolver: active membership required", /\.is\("left_at", null\)/.test(resolver));
check("resolver: deleted message denied", /msg\.deleted_at/.test(resolver));
check("resolver: empty path fails closed", /!src\.path/.test(resolver));
check("resolver: private cache header", /"Cache-Control",\s*"private, max-age=0, must-revalidate"/.test(resolver));
check("resolver: nosniff", /"X-Content-Type-Options",\s*"nosniff"/.test(resolver));
check("resolver: no redirect to storage", !/NextResponse\.redirect/.test(resolver));
check("resolver: forwards Range", /upstreamHeaders\.Range = range/.test(resolver));
check("resolver: no message id in telemetry", !/kx-file.*\$\{id\}/.test(resolver));
check("resolver: uses shared canonical model", /discussMediaList\(msg\.metadata\)/.test(resolver));

/* ── 6. UPLOAD ROUTE (static) ──────────────────────────────────────────── */
check("upload: discuss-media allowed", /"discuss-media",\s*\/\/ private/.test(uploadRoute));
check("upload: server-side policy enforced", /checkDiscussUpload\(bucket, \{ size: file\.size/.test(uploadRoute));
check("upload: rejects before storing", uploadRoute.indexOf("checkDiscussUpload") < uploadRoute.indexOf(".upload(path, file"));
check("upload: private buckets get no public url", /PRIVATE_BUCKETS\.has\(bucket\)/.test(uploadRoute));

/* ── 7. CLIENT SURFACES (static) ───────────────────────────────────────── */
check("client: no getPublicUrl in Discuss", !/getPublicUrl\(/.test(discussLib) && !/getPublicUrl\(/.test(app));
check("client: attachment upload targets private bucket",
  /uploadToStorage\("discuss-media"/.test(discussLib));
check("client: voice upload targets private bucket",
  /uploadToStorage\("discuss-voice"/.test(discussLib));
check("client: no public media bucket constant", !/const BUCKET = "media"/.test(discussLib));
check("client: attachment persists no url", !/url: result\.data\.publicUrl/.test(discussLib));
check("client: voice persists no url field", !/^\s*url: "",$/m.test(discussLib));
check("client: no signed-url fetch in playback", !/fetch\("\/api\/storage\/signed-url"/.test(voice));
check("client: voice bubble takes first-party src", /src: string \| null/.test(voice));
check("client: voice bubble not given url/bucket/path props", !/url=\{meta\.voice\.url\}/.test(app));
check("client: image src via first-party builder", /discussAttachmentUrl\(messageId, index\)/.test(app));
check("client: accept filter present", /accept=\{DISCUSS_ACCEPT_ATTR\}/.test(app));
check("client: rejection surfaced to user", /upload\.rejectedType/.test(app));

/* ── 8. SERVICE WORKER ─────────────────────────────────────────────────── */
check("sw: excludes /api/ from caching", /\/api\//.test(sw));

/* ── 9. SERIALIZER (behaviour) ─────────────────────────────────────────── */
const row = {
  id: "m1", body: "hi", kind: "image", author_account_id: "a1",
  reply_to_message_id: null, edited_at: null, deleted_at: null,
  created_at: "2026-01-01T00:00:00Z", client_msg_id: "c1",
  reactions: [{ emoji: "x" }], reply_preview: null, thread: null,
  metadata: {
    attachments: [{ name: "a.png", file_path: "a.png", size: 1, type: "image/png", url: PUB("media", "a.png") }],
    voice: { bucket: "discuss-voice", path: "v.webm", duration_ms: 7, waveform: [1, 2] },
    mentions: [{ account_id: "z" }],
    products: [{ id: "p1" }],
    link_preview: { url: "https://example.com", title: "t" },
  },
};
const ser = serializeDiscussMessageForClient(row);
const serJson = JSON.stringify(ser);
check("serializer: raw attachments key removed", !("attachments" in ser.metadata));
check("serializer: raw voice key removed", !("voice" in ser.metadata));
check("serializer: no file_path anywhere in payload", !serJson.includes("file_path"));
check("serializer: no storage host anywhere in payload", !serJson.includes("supabase.co"));
check("serializer: no bucket name anywhere in payload", !serJson.includes("discuss-voice"));
check("serializer: emits media array", Array.isArray(ser.metadata.media));
check("serializer: media count = attachments + voice", ser.metadata.media.length === 2);
check("serializer: voice appended after attachments", ser.metadata.media[1].kind === "voice");
check("serializer: voice keeps duration", ser.metadata.media[1].duration_ms === 7);
check("serializer: voice keeps waveform (display-only)", Array.isArray(ser.metadata.media[1].waveform));
/* Stripping a field the UI needs is as much a bug as leaking one it does not. */
check("serializer: preserves mentions", Array.isArray(ser.metadata.mentions));
check("serializer: preserves products", Array.isArray(ser.metadata.products));
check("serializer: preserves link_preview", !!ser.metadata.link_preview);
check("serializer: preserves message identity", ser.id === "m1" && ser.client_msg_id === "c1");
check("serializer: preserves joins", Array.isArray(ser.reactions) && ser.kind === "image");
check("serializer: preserves ordering fields", ser.created_at === "2026-01-01T00:00:00Z");
check("serializer: null metadata → empty media", serializeDiscussMessageForClient({ metadata: null }).metadata.media.length === 0);
check("serializer: list preserves order",
  serializeDiscussMessagesForClient([{ id: "1", metadata: {} }, { id: "2", metadata: {} }]).map((r) => r.id).join() === "1,2");

/* ── 10. EVERY MESSAGE PATH SANITIZES (static) ─────────────────────────── */
check("route: read imports serializer", /serializeDiscussMessageForClient/.test(readRoute));
check("route: read has no unserialized AUTHOR_SELECT map",
  (readRoute.match(/serializeDiscussMessageForClient\(/g) ?? []).length >= 3);
check("route: state pinned+starred serialize",
  (stateRoute.match(/serializeDiscussMessageForClient\(/g) ?? []).length >= 2);
check("route: mutate canonical send serializes", /data: serializeDiscussMessageForClient\(data\)/.test(mutateRoute));
check("route: mutate idempotent replay serializes",
  /data: serializeDiscussMessageForClient\(existing\), idempotent: true/.test(mutateRoute));

/* ── 11. CLIENT CONTRACT (static) ──────────────────────────────────────── */
check("client: reads metadata.media", /Array\.isArray\(meta\.media\) \? meta\.media : \[\]/.test(app));
check("client: no legacy attachments render", !/meta\.attachments\.map/.test(app));
check("client: no legacy voice field read", !/meta\.voice\.duration_ms/.test(app));
check("client: voice uses server-provided index", /discussAttachmentUrl\(msg\.id, voiceMedia\.index\)/.test(app));
check("client: attachment uses server-provided index", /index=\{m\.index\}/.test(app));

/* ── 12. OBJECT URL LIFECYCLE ──────────────────────────────────────────── */
check("objecturl: single owner module exists", /const owned = new Map/.test(objectUrls));
/* Scope: MESSAGE-ATTACHMENT previews. DiscussApp must never touch the URL API
   directly — the manager owns every attachment preview.
   VoiceRecorder is deliberately excluded: its object URL is the RECORDER's own
   review-before-send playback of a blob that has not become a message yet. It
   never leaves the component, is not keyed to a message, and is revoked on
   discard/unmount there. Asserting on it here would conflate two different
   lifetimes; a follow-up may fold it into the manager for uniformity. */
check("objecturl: DiscussApp never calls createObjectURL directly",
  !/URL\.createObjectURL/.test(app));
check("objecturl: DiscussApp never calls revokeObjectURL directly",
  !/URL\.revokeObjectURL/.test(app));
check("objecturl: recorder-local preview still revokes its own blob",
  /URL\.revokeObjectURL\(previewUrl\)/.test(voice));
check("objecturl: released on reconcile", /releasePreviewUrls\(clientMsgId\);/.test(app));
check("objecturl: released on conversation switch", /releaseAllPreviewUrls\(\);\n    setSelectedChannelId/.test(app));
check("objecturl: released on unmount/logout", /useEffect\(\(\) => releaseAllPreviewUrls, \[\]\)/.test(app));
check("objecturl: never persisted into an attachment record", !/local_preview_url:/.test(app));
check("objecturl: blob detector present", /startsWith\("blob:"\)/.test(objectUrls));

/* ── 13. DRAFTS — no storage reference in either direction ─────────────── */
/* Audited: drafts store TEXT ONLY (saveDraft sends body; restore clears
   attachments; production has 0 draft rows and 0 metadata keys). These
   assertions lock that in so a future draft-attachment feature cannot quietly
   reintroduce a path — it must go through a server-owned reference instead. */
const draftRow = {
  id: "d1",
  account_id: "acct-1",
  channel_id: "ch-1",
  body: "hello",
  updated_at: "2026-01-01T00:00:00Z",
  metadata: {
    attachments: [{ name: "a.png", file_path: "secret/a.png", size: 1, type: "image/png", url: PUB("media", "a.png") }],
    voice: { bucket: "discuss-voice", path: "secret/v.webm", duration_ms: 3, waveform: [] },
  },
};
const sd = serializeDiscussDraftForClient(draftRow);
const sdJson = JSON.stringify(sd);
check("draft: no metadata key on the wire", !("metadata" in sd));
check("draft: no file_path on the wire", !sdJson.includes("file_path") && !sdJson.includes("secret/"));
check("draft: no bucket on the wire", !sdJson.includes("discuss-voice"));
check("draft: no storage host on the wire", !sdJson.includes("supabase.co"));
check("draft: no account_id on the wire (identity is the session)", !("account_id" in sd));
check("draft: keeps body", sd.body === "hello");
check("draft: keeps channel_id", sd.channel_id === "ch-1");
check("draft: emits media descriptors only (canonical index, no location)",
  Array.isArray(sd.media) && sd.media.every((m) => !("path" in m) && !("url" in m)));
check("draft: channel join passes through when present",
  serializeDiscussDraftForClient({ ...draftRow, channel: { id: "ch-1" } }).channel !== undefined);

/* WRITE side: a crafted request must not be able to seed a path into a draft. */
const seeded = sanitizeDraftMetadataForStorage({
  attachments: [{ file_path: "evil/a.png" }],
  voice: { path: "evil/v.webm" },
  media: [{ index: 0 }],
  mentions: [{ account_id: "z" }],
});
check("draft write: attachments stripped before persist", !("attachments" in seeded));
check("draft write: voice stripped before persist", !("voice" in seeded));
check("draft write: media stripped before persist", !("media" in seeded));
check("draft write: non-media draft state preserved", Array.isArray(seeded.mentions));
check("draft write: non-object metadata → {}", Object.keys(sanitizeDraftMetadataForStorage("nope")).length === 0);
check("draft write: null metadata → {}", Object.keys(sanitizeDraftMetadataForStorage(null)).length === 0);

/* Routes wired. */
check("route: state/draft serializes", /serializeDiscussDraftForClient\(data\)/.test(stateRoute));
check("route: allDrafts serializes", /serializeDiscussDraftsForClient\(rows\)/.test(stateRoute));
check("route: saveDraft strips media before persist",
  /metadata: sanitizeDraftMetadataForStorage\(p\.metadata\) as Json/.test(mutateRoute));
/* Scoped to the saveDraft block: the MESSAGE insert legitimately persists
   `p.metadata` (a message DOES carry media, resolved to private paths). Only a
   DRAFT must never store one, so assert on that block alone. */
{
  const saveDraftBlock = mutateRoute.slice(
    mutateRoute.indexOf('case "saveDraft"'),
    mutateRoute.indexOf('case "clearDraft"'),
  );
  check("route: saveDraft block does not persist raw client metadata",
    saveDraftBlock.length > 0 && !/metadata: \(p\.metadata as Json\)/.test(saveDraftBlock));
  check("route: saveDraft block strips media before persist",
    /sanitizeDraftMetadataForStorage\(p\.metadata\)/.test(saveDraftBlock));
}

/* ── REPORT ────────────────────────────────────────────────────────────── */
console.log(`\nvalidate:discuss-attachments — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log("All Discuss attachment-authorization assertions hold.\n");
