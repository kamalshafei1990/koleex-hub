import "server-only";

/* ---------------------------------------------------------------------------
   marketing/comment-waiting — the bell's part of saving comments (owner,
   02/10/2026): a thread whose newest comment is a customer's waits for a
   reply, and the team hears ONCE per thread while it waits — the comments'
   version of the messages' notified_at pattern.

   Every path that saves comments (the Feed's sync, the ad scan) calls
   commentWatch BEFORE its upsert and runs the returned closure AFTER it.
   The closure never throws: anything it cannot do is logged and left for
   the next save.

     · A NEW comment from the account itself, under a thread the team was
       told about, ends the wait (the thread was answered ON THE PLATFORM).
     · A NEW comment from anyone else, in a thread nobody was told about
       yet, tells the team — once (a conditional claim on the thread's first
       comment), unless the thread is hidden or was marked «No reply needed»
       after that comment's time.
     · The first import stays silent: nothing is said until the account's
       first comment refresh has run (sync_state.comments_at).
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import type { AccountForSync } from "@/lib/server/marketing/accounts";
import type { RemoteComment } from "@/lib/server/marketing/meta-feed";
import { later, notifyCommentWaiting, settleComment } from "@/lib/server/marketing/notify";

const time = (s: string | null | undefined) => (s ? Date.parse(s) || 0 : 0);

/** Watch a batch of comments about to be saved: which of them the Hub
 *  already has is read now; the closure, run after the upsert, rings the
 *  bell for the new ones that need it. Social Marketing's space only. */
export async function commentWatch(a: AccountForSync, comments: RemoteComment[]): Promise<() => Promise<void>> {
  const noop = async () => {};
  const list = [...new Map(comments.map((c) => [c.external_id, c])).values()];
  if (!list.length || a.space !== "company") return noop;
  const { data: existing, error } = await supabaseServer.from("marketing_comments")
    .select("external_id").eq("account_id", a.id).in("external_id", list.map((c) => c.external_id)).limit(list.length);
  if (error) throw new Error(`marketing comments: ${error.message}`);
  const known = new Set(((existing ?? []) as Array<{ external_id: string }>).map((r) => r.external_id));

  return async () => {
    try {
      const fresh = list.filter((c) => !known.has(c.external_id));
      if (!fresh.length) return;
      /* The thread is its first comment's external id (one level on both
         platforms). */
      const rootOf = (c: RemoteComment) => c.parent_external_id ?? c.external_id;
      const exts = [...new Set([...fresh.map((c) => c.external_id), ...fresh.map(rootOf)])];
      type Row = { id: string; external_id: string; hidden: boolean; handled_at: string | null; notified_at: string | null };
      const { data: rows, error: rErr } = await supabaseServer.from("marketing_comments")
        .select("id, external_id, hidden, handled_at, notified_at")
        .eq("account_id", a.id).in("external_id", exts).limit(exts.length * 2);
      if (rErr) throw new Error(`marketing comments: ${rErr.message}`);
      const byExt = new Map(((rows ?? []) as Row[]).map((r) => [r.external_id, r]));

      /* Our own new reply under a thread the team was told about: the wait
         is over — answered on the platform. */
      for (const c of fresh) {
        if (!c.is_ours || !c.parent_external_id) continue;
        const root = byExt.get(c.parent_external_id);
        if (!root?.notified_at) continue;
        const { error: uErr } = await supabaseServer.from("marketing_comments")
          .update({ notified_at: null }).eq("id", root.id).not("notified_at", "is", null);
        if (uErr) console.warn(`[marketing/comment-waiting] ${a.id}: reset: ${uErr.message}`);
        const rootId = root.id;
        later(() => settleComment(rootId));
      }

      /* The first import stays silent until the account's first comment
         refresh ran. */
      if (typeof a.sync_state.comments_at !== "string") return;
      const now = new Date().toISOString();
      for (const c of fresh) {
        if (c.is_ours || c.hidden) continue;
        const root = byExt.get(rootOf(c));
        const trigger = byExt.get(c.external_id);
        if (!root || !trigger || root.hidden || root.notified_at) continue;
        if (root.handled_at && time(root.handled_at) >= time(c.commented_at)) continue;
        /* Claimed first: two saves at the same instant ring once. */
        const { data: claimed, error: cErr } = await supabaseServer.from("marketing_comments")
          .update({ notified_at: now }).eq("id", root.id).is("notified_at", null).select("id");
        if (cErr) throw new Error(`marketing comments: ${cErr.message}`);
        if (!claimed?.length) continue;
        root.notified_at = now; /* one ring per thread per batch */
        const rootId = root.id;
        const triggerId = trigger.id;
        later(() => notifyCommentWaiting(a.tenant_id, rootId, triggerId));
      }
    } catch (e) {
      console.warn(`[marketing/comment-waiting] ${a.platform} ${a.id}: left for the next save: ${e instanceof Error ? e.message : e}`);
    }
  };
}
