"use client";

/* ---------------------------------------------------------------------------
   useQuotationCollab — lightweight realtime collaboration for the Quotation
   editor. Two capabilities, both over a single Supabase Realtime channel
   (`quotation:<id>`):

     1. Presence — who else is viewing/editing this quotation right now.
     2. Save broadcast — when a user saves, peers get a "just updated" notice.

   This is NOT live typing / CRDT. It carries no document content. The hard
   data-loss guarantee lives in the server optimistic-lock (version) check;
   this layer only improves awareness so users rarely hit a conflict at all.

   Degrades silently to "no realtime" when the browser supabase client or env
   is unavailable, or when the quotation has not been persisted yet (no UUID).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getBrowserSupabase } from "@/lib/supabase-browser";

export type CollabStatus = "viewing" | "editing";

export interface CollabPeer {
  id: string;
  name: string;
  status: CollabStatus;
  at: string; // ISO last-active
}

export interface SaveNotice {
  by: string; // account id
  byName: string;
  version: number;
  at: string; // ISO
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* True when two peer lists describe the same people in the same state — used
   to skip redundant re-renders on presence heartbeats. Compares who's present
   (id) + display name + status; deliberately ignores the `at` timestamp, which
   changes every heartbeat and would otherwise force a constant re-render. */
function peersMeaningfullyEqual(a: CollabPeer[], b: CollabPeer[]): boolean {
  if (a.length !== b.length) return false;
  const sig = (p: CollabPeer) => `${p.id}|${p.status}|${p.name}`;
  const seen = new Set(a.map(sig));
  for (const p of b) if (!seen.has(sig(p))) return false;
  return true;
}

export function useQuotationCollab(opts: {
  quotationId: string | null | undefined;
  me: { id: string; name: string } | null;
  status: CollabStatus;
}): {
  peers: CollabPeer[];
  saveNotice: SaveNotice | null;
  announceSaved: (version: number) => void;
  clearNotice: () => void;
} {
  const { quotationId, me, status } = opts;
  const [peers, setPeers] = useState<CollabPeer[]>([]);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const statusRef = useRef<CollabStatus>(status);
  statusRef.current = status;

  const active = !!quotationId && UUID_RE.test(quotationId || "") && !!me;

  // Join / leave the channel for this quotation. Keyed only on the id + me.id
  // so changing viewing↔editing does NOT tear down the channel (handled below).
  useEffect(() => {
    if (!active || !me) return;
    const supa = getBrowserSupabase();
    if (!supa) return;

    const channel = supa.channel(`quotation:${quotationId}`, {
      config: { presence: { key: me.id } },
    });
    channelRef.current = channel;

    const syncPeers = () => {
      const state = channel.presenceState() as Record<string, Array<Record<string, unknown>>>;
      const out: CollabPeer[] = [];
      for (const [key, metas] of Object.entries(state)) {
        if (key === me.id) continue; // exclude self
        const m = metas[metas.length - 1] || {};
        out.push({
          id: key,
          name: typeof m.name === "string" ? m.name : "Someone",
          status: m.status === "editing" ? "editing" : "viewing",
          at: typeof m.at === "string" ? m.at : new Date().toISOString(),
        });
      }
      /* Presence "sync" fires on every heartbeat, and each peer's `at` bumps
         each time — so a naive setPeers(out) would hand back a new array on
         every tick and re-render the (very heavy) quotation editor + A4 preview
         constantly, which starves route transitions (Back / the Koleex logo
         feel unresponsive). Only update when the meaningful peer set actually
         changes (who's present + their status). The `at` timestamp is presence
         noise and intentionally excluded from the comparison. */
      setPeers((prev) => (peersMeaningfullyEqual(prev, out) ? prev : out));
    };

    channel
      .on("presence", { event: "sync" }, syncPeers)
      .on("presence", { event: "join" }, syncPeers)
      .on("presence", { event: "leave" }, syncPeers)
      .on("broadcast", { event: "saved" }, ({ payload }) => {
        const p = payload as Partial<SaveNotice>;
        if (!p || p.by === me.id) return; // ignore our own save echo
        setSaveNotice({
          by: String(p.by ?? ""),
          byName: String(p.byName ?? "Another user"),
          version: typeof p.version === "number" ? p.version : 0,
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
  }, [active, quotationId, me?.id]);

  // Re-track presence when viewing↔editing changes, without re-subscribing.
  useEffect(() => {
    const ch = channelRef.current;
    if (!ch || !me) return;
    try { ch.track({ name: me.name, status, at: new Date().toISOString() }); } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const announceSaved = useCallback((version: number) => {
    const ch = channelRef.current;
    if (!ch || !me) return;
    try {
      ch.send({
        type: "broadcast",
        event: "saved",
        payload: { by: me.id, byName: me.name, version, at: new Date().toISOString() } satisfies SaveNotice,
      });
    } catch { /* ignore */ }
  }, [me]);

  const clearNotice = useCallback(() => setSaveNotice(null), []);

  return { peers, saveNotice, announceSaved, clearNotice };
}
