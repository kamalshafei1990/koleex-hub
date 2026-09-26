/* ---------------------------------------------------------------------------
   todo-realtime — the To-do list's live-update socket, on its own.

   It is the only To-do code that needs the Supabase browser client, and that
   client (supabase-js + its realtime socket, ~190 KB of script) used to ride
   in todo-admin — so every To-do screen paid for it before the first task
   could paint. The list is imported from here lazily, after it has rendered:
   live updates are an extra (from mainland China the socket to supabase.co
   often cannot connect at all), the list works on its own refreshes.

   Listens for the server's BROADCAST ping on the tenant's `todos` topic and
   refetches through the gated route.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";

export function subscribeToTodos(
  tenantId: string,
  onChanged: () => void,
  debounceMs = 400,
): () => void {
  let timer: number | null = null;
  /* Live updates are an extra, never a requirement: if the realtime client
     can't be built (missing env, blocked socket) the list still works on its
     own refreshes, so a failure here must not take the page down with it. */
  let channel: ReturnType<typeof supabase.channel>;
  try {
    channel = supabase
      .channel(`todos:tenant:${tenantId}`)
      .on("broadcast", { event: "changed" }, () => {
        if (timer !== null) return;
        timer = window.setTimeout(() => { timer = null; onChanged(); }, debounceMs);
      })
      .subscribe();
  } catch (e) {
    console.error("[Todos] realtime unavailable:", e);
    return () => {};
  }
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    void supabase.removeChannel(channel);
  };
}
