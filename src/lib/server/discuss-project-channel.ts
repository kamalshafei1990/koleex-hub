import "server-only";

/* ---------------------------------------------------------------------------
   discuss-project-channel — one Discuss group chat per project.

   Owned by the Projects app (the Discuss engineer does not touch this file).
   Mirrors the column set that POST /api/discuss/mutate `createChannel`
   writes (kind, name, description, color, created_by, tenant_id) plus
   `linked_project_id` (supabase/migrations/20260926_projects_additions.sql),
   and the membership shape it writes (channel_id, account_id, role
   admin|member). Membership revival mirrors that route's ensureMembers:
   a soft-left member (left_at set) is brought back instead of duplicated.
   Removal mirrors that route's removeMember (soft-leave + promoteIfNoAdmin).

   Everything runs with the service-role client; callers MUST have already
   passed the Projects access gate. Tenant is always the caller's.
   --------------------------------------------------------------------------- */

import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings, rtTopic } from "@/lib/server/realtime-broadcast";

const CHANNELS = "discuss_channels";
const MEMBERS = "discuss_members";

export type ProjectChannelResult =
  | { ok: true; channelId: string; created: boolean }
  | { ok: false; error: string; code?: "not_migrated" };

function missingColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42703" || err.code === "PGRST204" || /linked_project_id/.test(err.message ?? "");
}

/** The live channel linked to a project, or null. `undefined` when the
 *  linked_project_id column does not exist yet (migration pending). */
export async function findProjectChannel(tenantId: string, projectId: string): Promise<string | null | undefined> {
  const { data, error } = await supabaseServer
    .from(CHANNELS)
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("linked_project_id", projectId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (missingColumn(error)) return undefined;
    console.error("[discuss-project-channel] find:", error.message);
    return null;
  }
  return (data as { id: string } | null)?.id ?? null;
}

/** Add (or revive) accounts as members of a channel. Returns an error
 *  message or null. Same semantics as the Discuss route's ensureMembers. */
async function ensureMembers(channelId: string, accountIds: string[]): Promise<string | null> {
  const ids = [...new Set(accountIds)];
  if (ids.length === 0) return null;
  const { data: rows, error: selErr } = await supabaseServer
    .from(MEMBERS)
    .select("account_id, left_at")
    .eq("channel_id", channelId)
    .in("account_id", ids);
  if (selErr) return selErr.message;
  const known = new Map(((rows ?? []) as { account_id: string; left_at: string | null }[]).map((r) => [r.account_id, r.left_at]));
  const toInsert = ids.filter((id) => !known.has(id));
  const toRevive = ids.filter((id) => known.has(id) && known.get(id) !== null);
  if (toInsert.length) {
    const { error } = await supabaseServer
      .from(MEMBERS)
      .insert(toInsert.map((id) => ({ channel_id: channelId, account_id: id, role: "member" })));
    if (error && error.code !== "23505") return error.message;
  }
  if (toRevive.length) {
    const { error } = await supabaseServer
      .from(MEMBERS)
      .update({ left_at: null, hidden_at: null })
      .eq("channel_id", channelId)
      .in("account_id", toRevive);
    if (error) return error.message;
  }
  return null;
}

/** Find-or-create the project's chat and make sure `callerId` + `memberIds`
 *  belong to it. The unique partial index on linked_project_id closes the
 *  double-click race: a losing insert (23505) re-reads the winner. */
export async function openProjectChannel(opts: {
  tenantId: string;
  projectId: string;
  projectName: string;
  projectColor: string | null;
  callerId: string;
  memberIds: string[];
}): Promise<ProjectChannelResult> {
  const { tenantId, projectId, callerId } = opts;
  const everyone = [...new Set([callerId, ...opts.memberIds])];

  const existing = await findProjectChannel(tenantId, projectId);
  if (existing === undefined) return { ok: false, error: "Project chat is not available yet.", code: "not_migrated" };

  if (existing) {
    const err = await ensureMembers(existing, everyone);
    if (err) return { ok: false, error: err };
    await emitPings(everyone.map((id) => ({ topic: rtTopic.account(id) })));
    return { ok: true, channelId: existing, created: false };
  }

  const { data: channel, error } = await supabaseServer
    .from(CHANNELS)
    .insert({
      kind: "group",
      name: opts.projectName.slice(0, 120),
      description: null,
      icon: null,
      color: opts.projectColor?.slice(0, 32) ?? null,
      created_by: callerId,
      tenant_id: tenantId,
      linked_project_id: projectId,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      /* Someone else created it a moment ago — join theirs. */
      const winner = await findProjectChannel(tenantId, projectId);
      if (winner) {
        const e2 = await ensureMembers(winner, everyone);
        if (e2) return { ok: false, error: e2 };
        return { ok: true, channelId: winner, created: false };
      }
    }
    if (missingColumn(error)) return { ok: false, error: "Project chat is not available yet.", code: "not_migrated" };
    return { ok: false, error: error.message };
  }

  const channelId = (channel as { id: string }).id;
  const { error: memErr } = await supabaseServer.from(MEMBERS).insert(
    everyone.map((id) => ({ channel_id: channelId, account_id: id, role: id === callerId ? "admin" : "member" })),
  );
  if (memErr) {
    /* A channel nobody belongs to is invisible — undo it (as Discuss does). */
    await supabaseServer.from(CHANNELS).delete().eq("id", channelId);
    return { ok: false, error: memErr.message };
  }
  await emitPings(everyone.map((id) => ({ topic: rtTopic.account(id) })));
  return { ok: true, channelId, created: true };
}

/** New project members join the project's chat, if one exists. Never
 *  throws; a missing channel / column is a no-op. */
export async function addAccountsToProjectChannel(tenantId: string, projectId: string, accountIds: string[]): Promise<void> {
  if (accountIds.length === 0) return;
  try {
    const channelId = await findProjectChannel(tenantId, projectId);
    if (!channelId) return;
    const err = await ensureMembers(channelId, accountIds);
    if (err) {
      console.error("[discuss-project-channel] add members:", err);
      return;
    }
    await emitPings(accountIds.map((id) => ({ topic: rtTopic.account(id) })));
  } catch (e) {
    console.error("[discuss-project-channel] add members:", e);
  }
}

/** If the channel has active members but no active admin, promote the
 *  longest-standing member — same rule as the Discuss route's
 *  promoteIfNoAdmin (the last admin leaving must not orphan the chat).
 *  Best-effort. */
async function promoteIfNoAdmin(channelId: string): Promise<void> {
  try {
    const { data: rows } = await supabaseServer
      .from(MEMBERS)
      .select("id, role, joined_at")
      .eq("channel_id", channelId)
      .is("left_at", null)
      .order("joined_at", { ascending: true });
    const active = (rows ?? []) as { id: string; role: string }[];
    if (active.length === 0 || active.some((r) => r.role === "admin")) return;
    await supabaseServer.from(MEMBERS).update({ role: "admin" }).eq("id", active[0].id);
  } catch { /* best-effort */ }
}

/** A member removed from the project leaves the project's chat, if one
 *  exists. Mirrors Discuss `removeMember`: the row is soft-left (left_at
 *  stamped, pin / unread cleared) — never deleted — so re-adding the
 *  person to the project revives it via ensureMembers. If that leaves no
 *  admin, the longest-standing member is promoted. Never throws; a missing
 *  channel / column is a no-op. */
export async function removeAccountFromProjectChannel(tenantId: string, projectId: string, accountId: string): Promise<void> {
  try {
    const channelId = await findProjectChannel(tenantId, projectId);
    if (!channelId) return;
    const { data: target } = await supabaseServer
      .from(MEMBERS)
      .select("id, role")
      .eq("channel_id", channelId)
      .eq("account_id", accountId)
      .is("left_at", null)
      .maybeSingle();
    if (!target) return;
    const { error } = await supabaseServer
      .from(MEMBERS)
      .update({ left_at: new Date().toISOString(), pinned_at: null, marked_unread: false })
      .eq("id", (target as { id: string }).id);
    if (error) {
      console.error("[discuss-project-channel] remove member:", error.message);
      return;
    }
    await promoteIfNoAdmin(channelId);
    /* Bump updated_at so SSE clients (which watch it) refresh the roster. */
    await supabaseServer.from(CHANNELS).update({ updated_at: new Date().toISOString() }).eq("id", channelId);
    const { data: rest } = await supabaseServer
      .from(MEMBERS)
      .select("account_id")
      .eq("channel_id", channelId)
      .is("left_at", null);
    await emitPings([
      { topic: rtTopic.channel(channelId) },
      { topic: rtTopic.account(accountId) },
      ...((rest ?? []) as { account_id: string }[]).map((r) => ({ topic: rtTopic.account(r.account_id) })),
    ]);
  } catch (e) {
    console.error("[discuss-project-channel] remove member:", e);
  }
}
