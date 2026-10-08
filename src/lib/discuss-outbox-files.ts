"use client";

/* ---------------------------------------------------------------------------
   discuss-outbox-files — the BYTES of failed sends whose files never finished
   uploading, kept in IndexedDB so a reload does not lose them.

   The outbox itself (discuss-outbox.ts) lives in localStorage and can only
   hold text: an attachment / voice clip that never reached Storage used to be
   dropped from the entry ("add it again"). Now its bytes are written here and
   the restored bubble rebuilds its blob preview from them, and Retry uploads
   them before sending.

   Rules:
     · Same database + object store as idb-cache.ts ("koleex-cache" / "kv"),
       with keys under `kx:discuss:outbox-file:` — the `kx:` prefix is inside
       the sign-out wipe (session-caches.ts → clearScopedIdbCaches), so one
       account's unsent file never survives into another session. No
       localStorage fallback: bytes never go to localStorage.
     · Per account, keyed by client_msg_id + canonical media index:
         kx:discuss:outbox-file:<accountId>:<clientMsgId>:<index>  → bytes
         kx:discuss:outbox-meta:<accountId>:<clientMsgId>:<index>  → {size, savedAt}
       The small meta row lets the size cap be enforced without reading bytes.
     · Caps: one file ≤ the Discuss POLICY maximum of its kind
       (discussUploadMaxBytes: voice 25MB, attachment 50MB — the same limit
       checkDiscussUpload enforces), all files ≤ ~50MB. Not the 4MB
       transport limit: Retry uploads through uploadToStorage, which sends
       anything above that straight to Storage (signed upload). A file over
       either cap is simply not kept — the bubble falls back to "add it
       again" after a reload.
     · Purged with the outbox's 7-day TTL, when the send is sent / deleted /
       refused (removeDiscussOutbox), for entries no longer in the outbox, and
       on sign-out.
     · Every call is wrapped: IndexedDB missing, blocked, full or aborted just
       means "not durable" (false / null), never an exception.
   --------------------------------------------------------------------------- */

import { discussUploadMaxBytes } from "@/lib/discuss-upload-policy";

const DB_NAME = "koleex-cache";
const STORE = "kv";
const FILE_PREFIX = "kx:discuss:outbox-file:";
const META_PREFIX = "kx:discuss:outbox-meta:";
/** Total bytes kept across every account on this device. */
export const DISCUSS_OUTBOX_FILES_MAX_TOTAL = 50 * 1024 * 1024;
/** One file — the Discuss policy maximum of its kind (single source:
 *  discussUploadMaxBytes in discuss-upload-policy.ts). */
export function discussOutboxFileMaxBytes(kind: "attachment" | "voice"): number {
  return discussUploadMaxBytes(kind === "voice" ? "discuss-voice" : "discuss-media");
}
/** Same as DISCUSS_OUTBOX_TTL_MS (kept local to avoid an import cycle). */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type DiscussOutboxFile = {
  /** Canonical media index the file occupies (attachments 0..n-1, voice n). */
  index: number;
  blob: Blob;
};

/** A file handed to putDiscussOutboxFiles — its kind picks the size cap. */
export type DiscussOutboxFileInput = DiscussOutboxFile & { kind: "attachment" | "voice" };

type FileRow = { bytes: ArrayBuffer; type: string };
type MetaRow = { size: number; savedAt: number };

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      if (typeof indexedDB === "undefined") {
        resolve(null);
        return;
      }
      /* No version: open whatever idb-cache.ts created. If the database does
         not exist yet it is created at v1 with the same store. */
      const req = indexedDB.open(DB_NAME);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        } catch {
          /* resolved as unavailable below */
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          try { db.close(); } catch { /* ignore */ }
          resolve(null);
          return;
        }
        /* Let a future idb-cache upgrade through instead of blocking it. */
        db.onversionchange = () => {
          try { db.close(); } catch { /* ignore */ }
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
      /* Some private modes neither resolve nor error. */
      setTimeout(() => resolve(null), 2000);
    } catch {
      resolve(null);
    }
  });
  dbPromise.then((db) => {
    if (!db) dbPromise = null;
  }).catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Run `work` in one transaction; resolves true when it COMMITTED. */
function runTx(mode: IDBTransactionMode, work: (store: IDBObjectStore) => void): Promise<boolean> {
  return openDb()
    .then(
      (db) =>
        new Promise<boolean>((resolve) => {
          if (!db) {
            resolve(false);
            return;
          }
          try {
            const t = db.transaction(STORE, mode);
            t.oncomplete = () => resolve(true);
            t.onerror = () => resolve(false);
            t.onabort = () => resolve(false);
            work(t.objectStore(STORE));
          } catch {
            resolve(false);
          }
        }),
    )
    .catch(() => false);
}

function prefixRange(prefix: string): IDBKeyRange {
  return IDBKeyRange.bound(prefix, `${prefix}￿`);
}

function fileKey(accountId: string, clientMsgId: string, index: number): string {
  return `${FILE_PREFIX}${accountId}:${clientMsgId}:${index}`;
}
function metaKey(accountId: string, clientMsgId: string, index: number): string {
  return `${META_PREFIX}${accountId}:${clientMsgId}:${index}`;
}

/** Every meta row under `prefix` (small values only — never the bytes). */
async function readMeta(prefix: string): Promise<Array<{ key: string; meta: MetaRow }> | null> {
  const out: Array<{ key: string; meta: MetaRow }> = [];
  const ok = await runTx("readonly", (store) => {
    const req = store.openCursor(prefixRange(prefix));
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return;
      const v = cur.value as Partial<MetaRow> | null;
      if (typeof cur.key === "string" && v && typeof v.size === "number" && typeof v.savedAt === "number") {
        out.push({ key: cur.key, meta: { size: v.size, savedAt: v.savedAt } });
      }
      cur.continue();
    };
  });
  return ok ? out : null;
}

function fileKeyOfMeta(metaKeyStr: string): string {
  return FILE_PREFIX + metaKeyStr.slice(META_PREFIX.length);
}

/** True when IndexedDB can be used at all in this browser. */
export async function discussOutboxFilesAvailable(): Promise<boolean> {
  try {
    return (await openDb()) !== null;
  } catch {
    return false;
  }
}

/**
 * Keep the bytes of `files` for a failed send. Resolves true only when EVERY
 * file is stored (all-or-nothing, one transaction); false when IndexedDB is
 * unavailable or a cap would be exceeded.
 */
export async function putDiscussOutboxFiles(
  accountId: string,
  clientMsgId: string,
  files: DiscussOutboxFileInput[],
): Promise<boolean> {
  try {
    if (!accountId || !clientMsgId || files.length === 0) return false;
    if (files.some((f) => !f.blob || f.blob.size > discussOutboxFileMaxBytes(f.kind))) return false;
    const incoming = files.reduce((n, f) => n + f.blob.size, 0);
    if (incoming > DISCUSS_OUTBOX_FILES_MAX_TOTAL) return false;

    /* Expired rows do not count against the cap — drop them first. */
    const all = await readMeta(META_PREFIX);
    if (all === null) return false;
    const now = Date.now();
    const expired = all.filter((r) => now - r.meta.savedAt >= TTL_MS);
    const mine = `${META_PREFIX}${accountId}:${clientMsgId}:`;
    const used = all
      .filter((r) => now - r.meta.savedAt < TTL_MS && !r.key.startsWith(mine))
      .reduce((n, r) => n + r.meta.size, 0);
    if (used + incoming > DISCUSS_OUTBOX_FILES_MAX_TOTAL) {
      if (expired.length > 0) await deleteKeys(expired.map((r) => r.key));
      return false;
    }

    /* Read bytes BEFORE opening the write transaction — an await inside it
       would let the transaction auto-commit early. */
    const rows: Array<{ index: number; row: FileRow; size: number }> = [];
    for (const f of files) {
      rows.push({ index: f.index, row: { bytes: await f.blob.arrayBuffer(), type: f.blob.type || "" }, size: f.blob.size });
    }
    return await runTx("readwrite", (store) => {
      for (const r of expired) {
        store.delete(r.key);
        store.delete(fileKeyOfMeta(r.key));
      }
      for (const r of rows) {
        store.put(r.row, fileKey(accountId, clientMsgId, r.index));
        store.put({ size: r.size, savedAt: now } satisfies MetaRow, metaKey(accountId, clientMsgId, r.index));
      }
    });
  } catch {
    return false;
  }
}

/**
 * The stored files of one send. `null` = IndexedDB unavailable; otherwise the
 * files found (possibly fewer than were saved — callers compare indexes).
 */
export async function getDiscussOutboxFiles(
  accountId: string,
  clientMsgId: string,
): Promise<DiscussOutboxFile[] | null> {
  try {
    if (!accountId || !clientMsgId) return [];
    const prefix = `${FILE_PREFIX}${accountId}:${clientMsgId}:`;
    const metaPrefix = `${META_PREFIX}${accountId}:${clientMsgId}:`;
    const found: DiscussOutboxFile[] = [];
    const fresh = new Set<number>();
    const now = Date.now();
    const ok = await runTx("readonly", (store) => {
      const mReq = store.openCursor(prefixRange(metaPrefix));
      mReq.onsuccess = () => {
        const cur = mReq.result;
        if (!cur) return;
        const v = cur.value as Partial<MetaRow> | null;
        const idx = Number(String(cur.key).slice(metaPrefix.length));
        if (v && typeof v.savedAt === "number" && now - v.savedAt < TTL_MS && Number.isInteger(idx)) fresh.add(idx);
        cur.continue();
      };
      const fReq = store.openCursor(prefixRange(prefix));
      fReq.onsuccess = () => {
        const cur = fReq.result;
        if (!cur) return;
        const v = cur.value as Partial<FileRow> | null;
        const idx = Number(String(cur.key).slice(prefix.length));
        if (v && v.bytes instanceof ArrayBuffer && Number.isInteger(idx)) {
          found.push({ index: idx, blob: new Blob([v.bytes], { type: typeof v.type === "string" ? v.type : "" }) });
        }
        cur.continue();
      };
    });
    if (!ok) return null;
    return found.filter((f) => fresh.has(f.index)).sort((a, b) => a.index - b.index);
  } catch {
    return null;
  }
}

async function deleteKeys(keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await runTx("readwrite", (store) => {
    for (const k of keys) {
      store.delete(k);
      if (k.startsWith(META_PREFIX)) store.delete(fileKeyOfMeta(k));
    }
  });
}

/** Forget the stored files of these sends (sent, deleted, refused). */
export async function deleteDiscussOutboxFiles(accountId: string, clientMsgIds: Iterable<string>): Promise<void> {
  try {
    if (!accountId) return;
    const ids = Array.from(clientMsgIds).filter(Boolean);
    if (ids.length === 0) return;
    await runTx("readwrite", (store) => {
      for (const id of ids) {
        store.delete(prefixRange(`${FILE_PREFIX}${accountId}:${id}:`));
        store.delete(prefixRange(`${META_PREFIX}${accountId}:${id}:`));
      }
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Drop everything of `accountId` that is past the TTL or whose send is no
 * longer in the outbox (`liveClientMsgIds`), plus expired rows of any
 * account. Best-effort; call when Discuss opens.
 */
export async function pruneDiscussOutboxFiles(
  accountId: string,
  liveClientMsgIds: Iterable<string>,
): Promise<void> {
  try {
    const live = new Set(liveClientMsgIds);
    const all = await readMeta(META_PREFIX);
    if (!all) return;
    const now = Date.now();
    const mine = accountId ? `${META_PREFIX}${accountId}:` : null;
    const doomed = all
      .filter((r) => {
        if (now - r.meta.savedAt >= TTL_MS) return true;
        if (!mine || !r.key.startsWith(mine)) return false;
        const clientMsgId = r.key.slice(mine.length).split(":")[0];
        return !live.has(clientMsgId);
      })
      .map((r) => r.key);
    /* Bytes whose meta row is gone (an interrupted write) are orphans too. */
    const orphanFiles: string[] = [];
    if (mine) {
      const metaSet = new Set(all.map((r) => fileKeyOfMeta(r.key)));
      await runTx("readonly", (store) => {
        const req = store.openKeyCursor(prefixRange(`${FILE_PREFIX}${accountId}:`));
        req.onsuccess = () => {
          const cur = req.result;
          if (!cur) return;
          if (typeof cur.key === "string" && !metaSet.has(cur.key)) orphanFiles.push(cur.key);
          cur.continue();
        };
      });
    }
    await deleteKeys([...doomed, ...orphanFiles]);
  } catch {
    /* best-effort */
  }
}
