"use client";

/* ---------------------------------------------------------------------------
   notes-yjs — the browser half of real-time co-editing for SHARED notes.

   A NoteYjsSession owns one Y.Doc + Awareness for one note and speaks a tiny
   protocol over the note's existing Supabase Realtime channel (the one
   useNoteCollab opens for presence), broadcast event "y":

     update  (0)  a local change, batched every ~80 ms            [MAC'd]
     sync1   (1)  "here is my state vector" (+ ask: send me yours)
     sync2   (2)  the diff the other side is missing                [MAC'd]
     aware   (3)  awareness (caret / selection / name / colour)

   Join: the doc starts from the SERVER's state (GET /collab), then a sync1
   (ask) pulls whatever live peers have that the server has not saved yet,
   and answers them with what they lack. A periodic sync1 heals any lost
   broadcast. Persistence is NOT here — the editor's save pipeline sends the
   full state to PATCH /api/notes/[id], where it is merged.

   SECURITY. Broadcast channels are not access-checked, so every payload is
   AES-GCM encrypted with the note key from the authorized collab endpoint;
   content messages (update/sync2) also carry an HMAC with the WRITE key,
   which only the owner + editors hold, and writers drop any content message
   whose MAC does not verify — a view-only member cannot inject edits. A
   message under a different key id (someone was added/removed) triggers a
   throttled key refresh.
   --------------------------------------------------------------------------- */

import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { NOTES_YJS_FIELD } from "@/lib/notes-schema";
import {
  applyRescues,
  caretIntoRestored,
  caretSnapshot,
  collapseRestored,
  findRescues,
  locateCursor,
  otherSideOf,
  type CaretSnapshot,
  type Rescue,
  type RescueCursor,
} from "@/lib/notes-yjs-rescue";

export interface CollabKeys {
  k: string;
  w: string | null;
  e: string;
}

export interface CollabUser {
  name: string;
  color: string;
  accountId: string;
}

type SendFn = (payload: Record<string, unknown>) => void;

const T_UPDATE = 0;
const T_SYNC1 = 1;
const T_SYNC2 = 2;
const T_AWARE = 3;

const ORIGIN_REMOTE = "notes-remote";
const CHUNK = 100_000; // base64 chars per broadcast message
const UPDATE_BATCH_MS = 80;
const AWARE_BATCH_MS = 150;
const RESYNC_MS = 45_000;

/* ── base64 <-> bytes ──────────────────────────────────────────────────── */

export function toB64(u: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000)));
  }
  return btoa(s);
}
export function fromB64(b: string): Uint8Array {
  const s = atob(b);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/* ── Colours for collaborators (Hub palette, readable on light + dark) ─── */

const PEER_COLORS = ["#567FB2", "#E5484D", "#0FA968", "#E8A33D", "#9B7BE0", "#D6409F", "#12A594", "#F76B15"];

export function peerColor(seed: string | null | undefined): string {
  const s = seed || "?";
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PEER_COLORS[h % PEER_COLORS.length];
}

/* ── Session ───────────────────────────────────────────────────────────── */

export class NoteYjsSession {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly noteId: string;
  /** Per-tab id — the `f` (from) of every message. */
  private readonly me: string;
  private keys: CollabKeys;
  private aesKey: Promise<CryptoKey> | null = null;
  private macKey: Promise<CryptoKey> | null = null;
  private send: SendFn | null = null;
  private pendingUpdates: Uint8Array[] = [];
  private updateTimer: ReturnType<typeof setTimeout> | null = null;
  private awareTimer: ReturnType<typeof setTimeout> | null = null;
  private awareDirty = new Set<number>();
  private resyncTimer: ReturnType<typeof setInterval> | null = null;
  private chunks = new Map<string, { parts: string[]; got: number; at: number }>();
  /** Which awareness client ids each peer TAB has announced — so a tab that
   *  leaves presence (closed, crashed, offline) loses its caret at once
   *  instead of after the 30 s awareness timeout. */
  private tabClients = new Map<string, Set<number>>();
  private destroyed = false;
  /** Called when a peer uses a different key id (membership changed). */
  onStaleKey: (() => void) | null = null;
  /** The editor's caret as a Yjs relative position (set by the editor), so
   *  a rescue can put the caret back into the re-inserted block. */
  caret: { read: () => Y.RelativePosition | null; write: (rp: Y.RelativePosition) => void } | null = null;
  /** What the last applyServerState did beyond plain merging. */
  lastPull: { rescued: number; joined: number; collapsed: number } = { rescued: 0, joined: 0, collapsed: 0 };

  constructor(opts: { noteId: string; state: string; keys: CollabKeys; tabId: string }) {
    this.noteId = opts.noteId;
    this.me = opts.tabId;
    this.keys = opts.keys;
    this.doc = new Y.Doc();
    // The server's state goes in BEFORE any editor binds, so the editor never
    // writes an initial empty paragraph of its own into the shared doc.
    try { Y.applyUpdate(this.doc, fromB64(opts.state), ORIGIN_REMOTE); } catch { /* corrupt → empty; server rejects bad merges */ }
    this.awareness = new Awareness(this.doc);
    this.importKeys();

    this.doc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);
  }

  get canWrite(): boolean {
    return !!this.keys.w;
  }

  /** Full state for persistence (base64). */
  encodeState(): string {
    return toB64(Y.encodeStateAsUpdate(this.doc));
  }

  setKeys(keys: CollabKeys) {
    if (keys.e === this.keys.e && keys.k === this.keys.k) return;
    this.keys = keys;
    this.importKeys();
    // New key epoch: re-sync so nothing sent under the old key is missed.
    this.sendSync1(true, null);
  }

  /** Merge a server state (a body ping, a reconnect, a key refresh).
   *  Returns how many blocks were kept because we were typing in them
   *  when the server state deleted them. */
  applyServerState(stateB64: string): number {
    this.lastPull = { rescued: 0, joined: 0, collapsed: 0 };
    try {
      const update = fromB64(stateB64);
      // A single-editor save may have DELETED a block this tab is typing
      // in (unsaved, so the server never saw that typing): copy those
      // blocks first and re-insert them after the merge — an edit wins
      // over a delete. Only our own typing counts, so two tabs never both
      // rescue the same block. The re-insert is a LOCAL change: it reaches
      // peers over the socket and the caller persists it.
      //
      // A block the server state JOINED into its neighbour (Backspace at
      // its start) is not re-inserted: only our new characters are grafted
      // into the joined block. A block someone already re-inserted (same
      // origin marker) only gets our new characters; racing copies of one
      // origin are collapsed afterwards. The caret follows the rescue.
      let rescues: Rescue[] = [];
      let cursor: RescueCursor | null = null;
      let snap: CaretSnapshot | null = null;
      const srv = new Y.Doc();
      try {
        Y.applyUpdate(srv, update);
        rescues = findRescues(this.doc, NOTES_YJS_FIELD, otherSideOf(srv), this.doc.clientID);
        let caret: Y.RelativePosition | null = null;
        try { caret = this.caret?.read() ?? null; } catch { caret = null; }
        cursor = locateCursor(this.doc, rescues, caret);
        // Also: the server may already have re-inserted the block we are in
        // (from our own save) — the pulled state then deletes our copy.
        snap = cursor ? null : caretSnapshot(this.doc, caret);
      } finally {
        srv.destroy();
      }
      Y.applyUpdate(this.doc, update, ORIGIN_REMOTE);
      const n = rescues.length ? applyRescues(this.doc, NOTES_YJS_FIELD, rescues, cursor) : 0;
      const collapsed = collapseRestored(this.doc, NOTES_YJS_FIELD);
      this.lastPull = { rescued: n, joined: rescues.filter((r) => r.kind === "graft").length, collapsed };
      const moved = cursor?.result ?? caretIntoRestored(this.doc, NOTES_YJS_FIELD, snap);
      if (moved) {
        try { this.caret?.write(moved); } catch { /* the editor went away */ }
      }
      return n;
    } catch {
      return 0;
    }
  }

  /** The channel is subscribed: start talking. Idempotent. */
  attach(send: SendFn) {
    if (this.destroyed) return;
    this.send = send;
    this.sendSync1(true, null);
    this.queueAwareness([this.doc.clientID]);
    if (!this.resyncTimer) {
      this.resyncTimer = setInterval(() => this.sendSync1(true, null), RESYNC_MS);
    }
  }

  detach() {
    this.send = null;
    if (this.resyncTimer) { clearInterval(this.resyncTimer); this.resyncTimer = null; }
  }

  destroy() {
    if (this.destroyed) return;
    // Tell peers our caret is gone while we can still send.
    try { removeAwarenessStates(this.awareness, [this.doc.clientID], "local"); } catch { /* ignore */ }
    this.flushAwareness();
    this.flushUpdates();
    this.destroyed = true;
    this.detach();
    if (this.updateTimer) clearTimeout(this.updateTimer);
    if (this.awareTimer) clearTimeout(this.awareTimer);
    this.doc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
    this.doc.destroy();
  }

  /** A peer tab left the channel's presence: drop its carets. */
  peerLeft(tabId: string) {
    const ids = this.tabClients.get(tabId);
    if (!ids || this.destroyed) return;
    this.tabClients.delete(tabId);
    try { removeAwarenessStates(this.awareness, Array.from(ids), ORIGIN_REMOTE); } catch { /* ignore */ }
  }

  /* ── outgoing ── */

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === ORIGIN_REMOTE || this.destroyed) return;
    this.pendingUpdates.push(update);
    if (!this.updateTimer) {
      this.updateTimer = setTimeout(() => { this.updateTimer = null; this.flushUpdates(); }, UPDATE_BATCH_MS);
    }
  };

  private flushUpdates() {
    if (!this.pendingUpdates.length || !this.send || !this.keys.w) {
      // Viewers never broadcast content; unattached updates are recovered
      // by the sync exchange on (re)attach.
      if (!this.keys.w) this.pendingUpdates = [];
      return;
    }
    const merged = Y.mergeUpdates(this.pendingUpdates);
    this.pendingUpdates = [];
    void this.emit(T_UPDATE, 0, merged, null);
  }

  private onAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    if (origin === ORIGIN_REMOTE) return;
    this.queueAwareness([...added, ...updated, ...removed]);
  };

  private queueAwareness(clients: number[]) {
    for (const c of clients) this.awareDirty.add(c);
    if (!this.awareTimer) {
      this.awareTimer = setTimeout(() => { this.awareTimer = null; this.flushAwareness(); }, AWARE_BATCH_MS);
    }
  }

  private flushAwareness() {
    if (!this.awareDirty.size || !this.send) return;
    const clients = Array.from(this.awareDirty);
    this.awareDirty.clear();
    try {
      void this.emit(T_AWARE, 0, encodeAwarenessUpdate(this.awareness, clients), null);
    } catch { /* ignore */ }
  }

  private sendSync1(ask: boolean, to: string | null) {
    if (!this.send || this.destroyed) return;
    void this.emit(T_SYNC1, ask ? 1 : 0, Y.encodeStateVector(this.doc), to);
  }

  /* ── incoming ── */

  async receive(payload: unknown) {
    if (this.destroyed || !payload || typeof payload !== "object") return;
    const env = payload as { f?: string; t?: string | null; e?: string; id?: string; i?: number; n?: number; c?: string; iv?: string; m?: string };
    if (!env.f || env.f === this.me) return;
    if (env.t && env.t !== this.me) return;
    if (env.e !== this.keys.e) { this.onStaleKey?.(); return; }

    let c = env.c ?? "";
    if (typeof env.n === "number" && env.n > 1) {
      const whole = this.reassemble(env);
      if (whole === null) return;
      c = whole;
    }
    let plain: Uint8Array;
    try {
      const key = await this.aesKey;
      if (!key || !env.iv) return;
      const iv = fromB64(env.iv);
      const ct = fromB64(c);
      if (this.keys.w && env.m !== undefined) {
        // Verify before decrypting anything that claims to be content.
        const ok = await this.verify(iv, ct, env.m);
        if (!ok) return;
      }
      plain = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, ct as BufferSource));
    } catch {
      this.onStaleKey?.();
      return;
    }
    if (plain.length < 2 || this.destroyed) return;
    const type = plain[0];
    const flag = plain[1];
    const body = plain.subarray(2);

    if ((type === T_UPDATE || type === T_SYNC2) && this.keys.w && env.m === undefined) return; // unsigned content
    try {
      switch (type) {
        case T_UPDATE:
        case T_SYNC2:
          Y.applyUpdate(this.doc, body, ORIGIN_REMOTE);
          break;
        case T_SYNC1: {
          // Answer with what they lack (writers only — a viewer's copy is
          // never a source of content), and ask back once.
          if (this.keys.w) {
            const diff = Y.encodeStateAsUpdate(this.doc, body);
            if (diff.length > 2) void this.emit(T_SYNC2, 0, diff, env.f);
          }
          if (flag === 1) {
            this.sendSync1(false, env.f);
            this.queueAwareness([this.doc.clientID]);
          }
          break;
        }
        case T_AWARE: {
          const seen: number[] = [];
          const track = ({ added, updated }: { added: number[]; updated: number[] }) => { seen.push(...added, ...updated); };
          this.awareness.on("update", track);
          try { applyAwarenessUpdate(this.awareness, body, ORIGIN_REMOTE); } finally { this.awareness.off("update", track); }
          const mine = this.tabClients.get(env.f) ?? new Set<number>();
          for (const id of seen) if (id !== this.doc.clientID) mine.add(id);
          if (mine.size) this.tabClients.set(env.f, mine);
          break;
        }
      }
    } catch { /* malformed — ignore */ }
  }

  private reassemble(env: { f?: string; id?: string; i?: number; n?: number; c?: string }): string | null {
    const key = `${env.f}:${env.id}`;
    const now = Date.now();
    for (const [k, v] of this.chunks) if (now - v.at > 30_000) this.chunks.delete(k);
    const n = Math.min(env.n ?? 1, 500);
    const i = env.i ?? 0;
    let entry = this.chunks.get(key);
    if (!entry) { entry = { parts: new Array(n).fill(""), got: 0, at: now }; this.chunks.set(key, entry); }
    if (i < 0 || i >= n || entry.parts[i]) return null;
    entry.parts[i] = env.c ?? "";
    entry.got += 1;
    if (entry.got < n) return null;
    this.chunks.delete(key);
    return entry.parts.join("");
  }

  /* ── crypto ── */

  private importKeys() {
    const k = this.keys;
    this.aesKey = crypto.subtle.importKey("raw", fromB64(k.k) as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    this.macKey = k.w
      ? crypto.subtle.importKey("raw", fromB64(k.w) as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
      : null;
    // Unhandled rejections would surface as console noise; errors are
    // handled where the keys are awaited.
    this.aesKey.catch(() => {});
    this.macKey?.catch(() => {});
  }

  private async verify(iv: Uint8Array, ct: Uint8Array, mac: string): Promise<boolean> {
    const mk = await this.macKey;
    if (!mk || !mac) return false;
    const data = new Uint8Array(iv.length + ct.length);
    data.set(iv, 0);
    data.set(ct, iv.length);
    return crypto.subtle.verify("HMAC", mk, fromB64(mac) as BufferSource, data as BufferSource);
  }

  private async emit(type: number, flag: number, body: Uint8Array, to: string | null) {
    const send = this.send;
    if (!send) return;
    try {
      const key = await this.aesKey;
      if (!key) return;
      const plain = new Uint8Array(body.length + 2);
      plain[0] = type;
      plain[1] = flag;
      plain.set(body, 2);
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, plain as BufferSource));
      let m: string | undefined;
      if (type === T_UPDATE || type === T_SYNC2) {
        const mk = await this.macKey;
        if (!mk) return; // only writers author content
        const data = new Uint8Array(iv.length + ct.length);
        data.set(iv, 0);
        data.set(ct, iv.length);
        m = toB64(new Uint8Array(await crypto.subtle.sign("HMAC", mk, data as BufferSource)));
      }
      const c = toB64(ct);
      const base = { f: this.me, t: to, e: this.keys.e, iv: toB64(iv), ...(m !== undefined ? { m } : {}) };
      if (c.length <= CHUNK) {
        send({ ...base, c });
        return;
      }
      const id = Math.random().toString(36).slice(2, 10);
      const n = Math.ceil(c.length / CHUNK);
      for (let i = 0; i < n; i++) send({ ...base, id, i, n, c: c.slice(i * CHUNK, (i + 1) * CHUNK) });
    } catch { /* crypto unavailable — the periodic sync + server merge still converge */ }
  }
}

/* ── Fetch the session material ────────────────────────────────────────── */

export type CollabJoin =
  | { available: false }
  | { available: true; role: "owner" | "editor" | "viewer"; state: string; keys: CollabKeys };

export async function fetchCollabJoin(noteId: string): Promise<CollabJoin | null> {
  try {
    const res = await fetch(`/api/notes/${noteId}/collab`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as CollabJoin;
  } catch {
    return null;
  }
}
