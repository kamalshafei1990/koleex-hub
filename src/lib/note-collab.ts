"use client";

/* ---------------------------------------------------------------------------
   useNoteCollab — realtime collaboration for a SHARED note. Over a single
   Supabase Realtime channel (`note:<id>`):

     1. Presence — who else is in this note right now (viewing / editing).
     2. Change pings — after a collaborator's save LANDS, peers receive a
        content-free ping and re-fetch the note through the authorized API.
        A ping with `body: true` (sent by the server after a single-editor
        body save was merged into the Yjs state) tells LIVE peers to pull
        and merge the stored state — the change never rode the socket.
     3. Live co-editing (when a NoteYjsSession is passed) — Yjs updates and
        awareness ride broadcast event "y" on this same channel, END-TO-END
        ENCRYPTED with a per-note key from the authorized collab endpoint
        (see src/lib/notes-yjs.ts), so no readable note text ever travels
        over the realtime socket.

   Presence is keyed per TAB (a random client id), not per account: the same
   person with the note open in two tabs is two peers, so the tabs sync with
   each other and neither mistakes the other's ping for its own echo.

   Callers enable it only for notes that are actually shared (a private note
   opens no channel). Degrades silently to "no realtime" when the browser
   client / env is unavailable or the note id is not a persisted UUID.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase-browser";
import type { NoteYjsSession } from "@/lib/notes-yjs";

export type CollabStatus = "viewing" | "editing";

export interface NotePeer {
  /** Per-tab client id. */
  id: string;
  accountId: string | null;
  /** Display name, or null when the peer did not announce one. */
  name: string | null;
  status: CollabStatus;
  at: string;
}

/* A change PING carries NO note content — just "someone saved, go refetch". */
export interface NoteUpdate {
  by: string;
  at: string;
  /** The body changed outside the live session (single-editor save). */
  body?: boolean;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One id per browser tab, for the life of the page. */
let tabClientId: string | null = null;
export function getTabClientId(): string {
  if (!tabClientId) {
    try { tabClientId = crypto.randomUUID(); } catch { tabClientId = `c${Date.now()}${Math.random().toString(36).slice(2)}`; }
  }
  return tabClientId;
}

export function useNoteCollab(opts: {
  noteId: string | null | undefined;
  me: { id: string; name: string } | null;
  status: CollabStatus;
  enabled: boolean;
  onRemoteUpdate: (u: NoteUpdate) => void;
  /** Live co-editing session for this note (shared notes only). */
  yjs?: NoteYjsSession | null;
  /** The channel (re)subscribed — `first` is false after a reconnect. */
  onSubscribed?: (first: boolean) => void;
}): {
  peers: NotePeer[];
  broadcastUpdate: (opts?: { body?: boolean }) => void;
} {
  const { noteId, me, status, enabled, onRemoteUpdate, yjs = null, onSubscribed } = opts;
  const [peers, setPeers] = useState<NotePeer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<CollabStatus>(status);
  useEffect(() => { statusRef.current = status; }, [status]);
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);

  // Keep the latest callback without re-subscribing the channel.
  const onRemoteRef = useRef(onRemoteUpdate);
  useEffect(() => { onRemoteRef.current = onRemoteUpdate; }, [onRemoteUpdate]);
  const onSubscribedRef = useRef(onSubscribed);
  useEffect(() => { onSubscribedRef.current = onSubscribed; }, [onSubscribed]);

  /* The Yjs session can change (joined after the channel, rebuilt on a key
     refresh) without re-subscribing the channel. */
  const yjsRef = useRef<NoteYjsSession | null>(yjs);
  const subscribedRef = useRef(false);
  const sendY = useCallback((payload: Record<string, unknown>) => {
    const ch = channelRef.current;
    if (!ch) return;
    try { void ch.send({ type: "broadcast", event: "y", payload }); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    yjsRef.current = yjs;
    if (yjs && subscribedRef.current) yjs.attach(sendY);
    return () => { yjs?.detach(); };
  }, [yjs, sendY]);

  const active = enabled && !!noteId && UUID_RE.test(noteId || "") && !!me;
  const meId = me?.id ?? null;

  useEffect(() => {
    if (!active || !meId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on disable
      setPeers([]);
      return;
    }
    const supa = getBrowserSupabase();
    if (!supa) return;
    const clientId = getTabClientId();
    let subscribedOnce = false;

    const channel = supa.channel(`note:${noteId}`, {
      config: { presence: { key: clientId } },
    });
    channelRef.current = channel;

    const payload = () => ({
      name: meRef.current?.name ?? null,
      account_id: meRef.current?.id ?? null,
      status: statusRef.current,
      at: new Date().toISOString(),
    });

    const syncPeers = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
      const out: NotePeer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === clientId) continue;
        const m = metas[metas.length - 1] || {};
        out.push({
          id: key,
          accountId: typeof m.account_id === "string" ? m.account_id : null,
          name: typeof m.name === "string" && m.name.trim() ? m.name : null,
          status: m.status === "editing" ? "editing" : "viewing",
          at: typeof m.at === "string" ? m.at : new Date().toISOString(),
        });
      }
      setPeers(out);
    };

    channel
      .on("presence", { event: "sync" }, syncPeers)
      .on("presence", { event: "join" }, syncPeers)
      .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        syncPeers();
        yjsRef.current?.peerLeft(key);
      })
      .on("broadcast", { event: "ping" }, ({ payload: p }) => {
        const u = p as Partial<NoteUpdate>;
        if (!u || u.by === clientId) return; // ignore our own tab's echo
        onRemoteRef.current({
          by: String(u.by ?? ""),
          at: typeof u.at === "string" ? u.at : new Date().toISOString(),
          ...(u.body === true ? { body: true } : {}),
        });
      })
      .on("broadcast", { event: "y" }, ({ payload: p }) => {
        void yjsRef.current?.receive(p);
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          subscribedRef.current = true;
          void channel.track(payload());
          // (Re)connected: sync the live document with whoever is here.
          yjsRef.current?.attach(sendY);
          const first = !subscribedOnce;
          subscribedOnce = true;
          onSubscribedRef.current?.(first);
        } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") {
          subscribedRef.current = false;
          yjsRef.current?.detach();
        }
      });

    return () => {
      subscribedRef.current = false;
      yjsRef.current?.detach();
      channelRef.current = null;
      try { supa.removeChannel(channel); } catch { /* ignore */ }
    };
  }, [active, noteId, meId, sendY]);

  // Re-track presence on viewing↔editing change without re-subscribing.
  useEffect(() => {
    const ch = channelRef.current;
    const m = meRef.current;
    if (!ch || !m) return;
    try {
      void ch.track({ name: m.name, account_id: m.id, status, at: new Date().toISOString() });
    } catch { /* ignore */ }
  }, [status]);

  const broadcastUpdate = useCallback((o?: { body?: boolean }) => {
    const ch = channelRef.current;
    if (!ch) return;
    try {
      void ch.send({
        type: "broadcast",
        event: "ping",
        payload: {
          by: getTabClientId(),
          at: new Date().toISOString(),
          ...(o?.body ? { body: true } : {}),
        } satisfies NoteUpdate,
      });
    } catch { /* ignore */ }
  }, []);

  return { peers, broadcastUpdate };
}
