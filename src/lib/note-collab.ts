"use client";

/* ---------------------------------------------------------------------------
   useNoteCollab — realtime collaboration for a SHARED note. Over a single
   Supabase Realtime channel (`note:<id>`):

     1. Presence — who else is in this note right now (viewing / editing).
     2. Content broadcast — when a collaborator saves, peers receive the new
        title + body and apply it live (no refresh).

   Unlike the quotation collab (which only sends a "saved" ping), notes carry
   the full document in the broadcast so the other side updates instantly.
   Payloads are small (a note's TipTap JSON), so this is fine.

   Degrades silently to "no realtime" when the browser client / env is
   unavailable, when the note isn't a persisted UUID, or when collaboration is
   disabled (a private, unshared note).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export type CollabStatus = "viewing" | "editing";

export interface NotePeer {
  id: string;
  name: string;
  status: CollabStatus;
  at: string;
}

export interface NoteUpdate {
  by: string;
  title?: string;
  body_json?: unknown;
  at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function useNoteCollab(opts: {
  noteId: string | null | undefined;
  me: { id: string; name: string } | null;
  status: CollabStatus;
  enabled: boolean;
  onRemoteUpdate: (u: NoteUpdate) => void;
}): {
  peers: NotePeer[];
  broadcastUpdate: (u: { title?: string; body_json?: unknown }) => void;
} {
  const { noteId, me, status, enabled, onRemoteUpdate } = opts;
  const [peers, setPeers] = useState<NotePeer[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<CollabStatus>(status);
  statusRef.current = status;

  // Keep the latest callback without re-subscribing the channel.
  const onRemoteRef = useRef(onRemoteUpdate);
  useEffect(() => { onRemoteRef.current = onRemoteUpdate; }, [onRemoteUpdate]);

  const active = enabled && !!noteId && UUID_RE.test(noteId || "") && !!me;

  useEffect(() => {
    if (!active || !me) {
      setPeers([]);
      return;
    }
    const supa = getBrowserSupabase();
    if (!supa) return;

    const channel = supa.channel(`note:${noteId}`, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;

    const syncPeers = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
      const out: NotePeer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === me.id) continue;
        const m = metas[metas.length - 1] || {};
        out.push({
          id: key,
          name: typeof m.name === "string" ? m.name : "Someone",
          status: m.status === "editing" ? "editing" : "viewing",
          at: typeof m.at === "string" ? m.at : new Date().toISOString(),
        });
      }
      setPeers(out);
    };

    channel
      .on("presence", { event: "sync" }, syncPeers)
      .on("presence", { event: "join" }, syncPeers)
      .on("presence", { event: "leave" }, syncPeers)
      .on("broadcast", { event: "update" }, ({ payload }) => {
        const p = payload as Partial<NoteUpdate>;
        if (!p || p.by === me.id) return; // ignore our own echo
        onRemoteRef.current({
          by: String(p.by ?? ""),
          title: typeof p.title === "string" ? p.title : undefined,
          body_json: "body_json" in (p as object) ? p.body_json : undefined,
          at: typeof p.at === "string" ? p.at : new Date().toISOString(),
        });
      })
      .subscribe((s) => {
        if (s === "SUBSCRIBED") {
          channel.track({ name: me.name, status: statusRef.current, at: new Date().toISOString() });
        }
      });

    return () => {
      channelRef.current = null;
      try { supa.removeChannel(channel); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, noteId, me?.id]);

  // Re-track presence on viewing↔editing change without re-subscribing.
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !me) return;
    try { ch.track({ name: me.name, status, at: new Date().toISOString() }); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const broadcastUpdate = useCallback(
    (u: { title?: string; body_json?: unknown }) => {
      const ch = channelRef.current;
      if (!ch || !me) return;
      try {
        ch.send({
          type: "broadcast",
          event: "update",
          payload: { by: me.id, title: u.title, body_json: u.body_json, at: new Date().toISOString() } satisfies NoteUpdate,
        });
      } catch { /* ignore */ }
    },
    [me],
  );

  return { peers, broadcastUpdate };
}
