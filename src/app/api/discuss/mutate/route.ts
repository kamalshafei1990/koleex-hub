import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/discuss/mutate — single authenticated entry point for EVERY
   Discuss write.

   Why this exists
   ---------------
   The Discuss client historically wrote to the discuss_* tables directly
   from the browser using the public anon Supabase key. Because realtime
   (postgres_changes) needs the anon role to retain SELECT, the tables were
   left wide open ("Allow all for public"), which also exposed INSERT/UPDATE/
   DELETE to anyone holding the (public) anon key — they could post as anyone,
   edit, or delete any message in any channel/tenant.

   This route makes Discuss consistent with every other Hub app: all writes go
   through the server, authenticated by the koleex_session cookie, executed
   with the service-role client (which bypasses RLS). Identity is ALWAYS taken
   from the session — client-supplied author/account ids are ignored — and
   channel-scoped actions are gated on real membership. The companion RLS
   migration removes anon write access while keeping anon SELECT so realtime
   keeps delivering.
   --------------------------------------------------------------------------- */

import { NextResponse, after } from "next/server";
import { requireAuth, requireModuleAction, type ModuleAction } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import {
  serializeDiscussMessageForClient,
  sanitizeDraftMetadataForStorage,
} from "@/lib/server/discuss-serialize";
import {
  DISCUSS_BODY_MAX,
  filterTenantAccounts,
  isClientKind,
  sanitizeMessageMetadataForStorage,
} from "@/lib/server/discuss-validate";
import { emitPings, pingChannelActivity, rtTopic } from "@/lib/server/realtime-broadcast";
import { sendPushToAccounts } from "@/lib/server/web-push";
import { stageTimer } from "@/lib/server/perf";

const CHANNELS = "discuss_channels";
const MEMBERS = "discuss_members";
const MESSAGES = "discuss_messages";
const REACTIONS = "discuss_reactions";
const PINNED = "discuss_pinned";
const STARRED = "discuss_starred";
const DRAFTS = "discuss_drafts";

type Json = Record<string, unknown>;

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/* Module permission each action needs (Roles & Permissions → Discuss).
   · view   — per-user state only: read cursor, my pin/hide/mute, my drafts,
              my bookmarks. A read-only role can still manage its own list.
   · create — anything that adds content or people: messages, reactions,
              channels, DMs, customer chats, members — and correcting or
              removing one's OWN message (whoever may send may take it back;
              editMessage is author-only, deleteMessage re-checks below).
   · edit   — changing shared content: channel settings, pinning to a
              channel, removing a member or changing a member's role
              (each also requires channel-admin, checked in the action).
   · delete — removing SOMEONE ELSE's message (channel-admin moderation);
              checked inside deleteMessage once the author is known. */
const ACTION_PERMISSION: Record<string, ModuleAction> = {
  directChannel: "create",
  createChannel: "create",
  createCustomerChannel: "create",
  addMembers: "create",
  sendMessage: "create",
  toggleReaction: "create",
  updateChannel: "edit",
  archiveChannel: "edit",
  removeMember: "edit",
  setMemberRole: "edit",
  editMessage: "create",
  deleteMessage: "create",
  pinMessage: "edit",
  unpinMessage: "edit",
  leaveChannel: "view",
  markRead: "view",
  markAllRead: "view",
  setChannelPinned: "view",
  setChannelHidden: "view",
  markChannelUnread: "view",
  deleteConversation: "view",
  toggleStar: "view",
  saveDraft: "view",
  clearDraft: "view",
  setNotificationPref: "view",
  setChannelMuted: "view",
};

const NOTIFICATION_PREFS = new Set(["all", "mentions", "none"]);
const MEMBER_ROLES = new Set(["admin", "member"]);
/* client_msg_id is a uuid column: anything else would 500 the insert. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  const timing = stageTimer("discuss.mutate"); /* kx-perf: stage breakdown for hot ops */
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  timing.mark("auth");

  /* Identity is the session account — never the client payload. */
  const me = auth.account_id;
  const isSA = auth.is_super_admin === true;
  const tenantId = auth.tenant_id ?? null;

  let body: { action?: string; payload?: Json };
  try {
    body = (await req.json()) as { action?: string; payload?: Json };
  } catch {
    return bad("Invalid JSON body");
  }
  const action = body.action;
  const p = (body.payload ?? {}) as Json;
  if (!action) return bad("Missing action");
  const needed = ACTION_PERMISSION[action];
  if (!needed) return bad(`Unknown action: ${action}`);
  timing.mark("parse");

  /* --- membership helpers (service-role; bypasses RLS) ----------------- */
  const isMember = async (channelId: string): Promise<boolean> => {
    if (isSA) return true;
    const { data } = await supabaseServer
      .from(MEMBERS)
      .select("id")
      .eq("channel_id", channelId)
      .eq("account_id", me)
      .is("left_at", null)
      .maybeSingle();
    return !!data;
  };

  const isChannelAdmin = async (channelId: string): Promise<boolean> => {
    if (isSA) return true;
    const { data } = await supabaseServer
      .from(MEMBERS)
      .select("role")
      .eq("channel_id", channelId)
      .eq("account_id", me)
      .is("left_at", null)
      .maybeSingle();
    return (data as { role?: string } | null)?.role === "admin";
  };

  /* Resolve the message a message-id-scoped write targets. */
  const loadMessage = async (
    messageId: string,
  ): Promise<{ channel_id: string; author_account_id: string | null; deleted_at: string | null } | null> => {
    const { data } = await supabaseServer
      .from(MESSAGES)
      .select("channel_id, author_account_id, deleted_at")
      .eq("id", messageId)
      .maybeSingle();
    return (data as { channel_id: string; author_account_id: string | null; deleted_at: string | null } | null) ?? null;
  };

  /* Active member account ids of a channel — recipients of a broadcast ping. */
  const channelMemberIds = async (channelId: string): Promise<string[]> => {
    const { data } = await supabaseServer
      .from(MEMBERS)
      .select("account_id")
      .eq("channel_id", channelId)
      .is("left_at", null);
    return ((data ?? []) as Array<{ account_id: string }>).map((r) => r.account_id);
  };

  /* Bump the channel's updated_at (the BEFORE UPDATE trigger stamps now()).
     The first-party SSE stream watches updated_at to tell open clients that
     an edit / delete / reaction / pin happened — the Supabase broadcast ping
     never reaches users behind the mainland-China block. Best-effort. */
  const touchChannel = async (channelId: string) => {
    try {
      await supabaseServer
        .from(CHANNELS)
        .update({ updated_at: new Date().toISOString() })
        .eq("id", channelId);
    } catch { /* stream freshness is best-effort */ }
  };

  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

  /* Module permission. sendMessage overlaps it with the membership read
     below (hot path); every other action checks it up front. */
  const permission =
    action === "sendMessage"
      ? requireModuleAction(auth, "Discuss", needed).catch(() =>
          NextResponse.json({ ok: false, error: "Permission check failed" }, { status: 500 }),
        )
      : null;
  if (!permission) {
    const denied = await requireModuleAction(auth, "Discuss", needed);
    if (denied) return denied;
  }

  try {
    switch (action) {
      /* ---- Channels -------------------------------------------------- */
      case "directChannel": {
        const otherId = str(p.otherId);
        if (!otherId) return bad("otherId required");
        if (otherId === me) return bad("Cannot message yourself");
        /* The other party must be an active internal account in MY tenant —
           the same population the recipients picker offers. */
        const allowed = await filterTenantAccounts([otherId], tenantId);
        if (allowed.length === 0) return bad("Recipient not found", 404);
        const { data, error } = await supabaseServer.rpc(
          "find_or_create_direct_channel",
          { p_account_a: me, p_account_b: otherId },
        );
        if (error) return bad(error.message, 500);
        /* Re-opening a DM I previously deleted/hid must bring it back into my
           list — clear my soft-leave and hidden flags for this channel. */
        const resurfacedId =
          typeof data === "string"
            ? data
            : ((data as { id?: string } | null)?.id ?? null);
        if (resurfacedId) {
          const { data: revived } = await supabaseServer
            .from(MEMBERS)
            .update({ left_at: null, hidden_at: null })
            .eq("channel_id", resurfacedId)
            .eq("account_id", me)
            .not("left_at", "is", null)
            .select("id");
          /* Clearing a hide alone is not a roster change; only a rejoin is. */
          await supabaseServer
            .from(MEMBERS)
            .update({ hidden_at: null })
            .eq("channel_id", resurfacedId)
            .eq("account_id", me)
            .not("hidden_at", "is", null);
          if ((revived ?? []).length > 0) await touchChannel(resurfacedId);
        }
        return NextResponse.json({ ok: true, data });
      }

      case "createChannel": {
        const kind = str(p.kind);
        const name = str(p.name)?.trim().slice(0, 120) ?? null;
        if (!kind || !name) return bad("kind and name required");
        /* Clients create groups and channels only. DMs go through
           directChannel, customer chats through createCustomerChannel. */
        if (kind !== "group" && kind !== "channel") return bad("Invalid channel kind");
        const memberIds = (await filterTenantAccounts(p.memberIds, tenantId)).filter((id) => id !== me);
        const { data: channel, error } = await supabaseServer
          .from(CHANNELS)
          .insert({
            kind,
            name,
            description: str(p.description)?.slice(0, 1000) ?? null,
            icon: str(p.icon)?.slice(0, 64) ?? null,
            color: str(p.color)?.slice(0, 32) ?? null,
            created_by: me,
            tenant_id: tenantId,
          })
          .select("*")
          .single();
        if (error) return bad(error.message, 500);
        const channelId = (channel as { id: string }).id;
        const rows = [me, ...memberIds].map((accountId) => ({
          channel_id: channelId,
          account_id: accountId,
          role: accountId === me ? "admin" : "member",
        }));
        const { error: memErr } = await supabaseServer.from(MEMBERS).insert(rows);
        if (memErr) {
          /* A channel nobody belongs to is invisible and unusable — undo it
             rather than report success. */
          await supabaseServer.from(CHANNELS).delete().eq("id", channelId);
          return bad(memErr.message, 500);
        }
        await emitPings([me, ...memberIds].map((id) => ({ topic: rtTopic.account(id) })));
        return NextResponse.json({ ok: true, data: channel });
      }

      case "createCustomerChannel": {
        /* Replaces the browser-side call to the SECURITY DEFINER RPC
           find_or_create_customer_channel, which trusted a client-supplied
           creator id, was executable by `anon`, and created channels with no
           tenant (so their media never resolved). Identity + tenant come from
           the session; the contact must belong to the caller's tenant. */
        const contactId = str(p.contactId);
        if (!contactId) return bad("contactId required");
        let cq = supabaseServer
          .from("contacts")
          .select("id, display_name, full_name, first_name, last_name, company")
          .eq("id", contactId);
        cq = tenantId ? cq.eq("tenant_id", tenantId) : cq.is("tenant_id", null);
        const { data: contact, error: cErr } = await cq.maybeSingle();
        if (cErr) return bad(cErr.message, 500);
        if (!contact) return bad("Contact not found", 404);
        const c = contact as { display_name: string | null; full_name: string | null; first_name: string | null; last_name: string | null; company: string | null };
        const displayName =
          (c.display_name || c.full_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "Customer").slice(0, 120);

        let fq = supabaseServer
          .from(CHANNELS)
          .select("id")
          .eq("kind", "customer")
          .eq("linked_contact_id", contactId)
          .is("archived_at", null)
          .order("created_at", { ascending: true })
          .limit(1);
        fq = tenantId ? fq.eq("tenant_id", tenantId) : fq.is("tenant_id", null);
        const { data: existing, error: fErr } = await fq.maybeSingle();
        if (fErr) return bad(fErr.message, 500);

        let channelId = (existing as { id: string } | null)?.id ?? null;
        const extra = (await filterTenantAccounts(p.memberIds, tenantId)).filter((id) => id !== me);
        if (!channelId) {
          const { data: created, error: insErr } = await supabaseServer
            .from(CHANNELS)
            .insert({
              kind: "customer",
              name: displayName,
              linked_contact_id: contactId,
              created_by: me,
              tenant_id: tenantId,
            })
            .select("id")
            .single();
          if (insErr) return bad(insErr.message, 500);
          channelId = (created as { id: string }).id;
          const { error: memErr } = await supabaseServer.from(MEMBERS).insert(
            [me, ...extra].map((id) => ({ channel_id: channelId, account_id: id, role: id === me ? "admin" : "member" })),
          );
          if (memErr) {
            await supabaseServer.from(CHANNELS).delete().eq("id", channelId);
            return bad(memErr.message, 500);
          }
        } else {
          /* Existing conversation for this customer: join it (or rejoin it)
             so opening it actually shows the thread. */
          const revive = await ensureMembers(channelId, [me, ...extra]);
          if (revive.error) return bad(revive.error, 500);
          /* Someone joined / rejoined: open clients' rosters must follow. */
          if (revive.changed) await touchChannel(channelId);
        }
        await emitPings([me, ...extra].map((id) => ({ topic: rtTopic.account(id) })));
        return NextResponse.json({ ok: true, data: channelId });
      }

      case "updateChannel": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        /* Renaming / re-describing a shared channel is an admin action. */
        if (!(await isChannelAdmin(channelId))) return bad("Admins only", 403);
        const patch = (p.patch ?? {}) as Json;
        const clean: Json = {};
        for (const [k, max] of [["name", 120], ["description", 1000], ["icon", 64], ["color", 32]] as const) {
          if (k in patch) clean[k] = typeof patch[k] === "string" ? (patch[k] as string).slice(0, max) : null;
        }
        if (Object.keys(clean).length === 0) return bad("Nothing to update");
        if ("name" in clean) {
          const name = typeof clean.name === "string" ? clean.name.trim() : "";
          if (!name) return bad("Name required");
          clean.name = name;
        }
        const { data: target } = await supabaseServer.from(CHANNELS).select("kind").eq("id", channelId).maybeSingle();
        if (!target) return bad("Channel not found", 404);
        if ((target as { kind: string }).kind === "direct") return bad("Direct messages cannot be renamed", 400);
        const { error } = await supabaseServer.from(CHANNELS).update(clean).eq("id", channelId);
        if (error) return bad(error.message, 500);
        await emitPings([{ topic: rtTopic.channel(channelId) }, ...(await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) }))]);
        return NextResponse.json({ ok: true });
      }

      case "archiveChannel": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        if (!(await isChannelAdmin(channelId))) return bad("Admins only", 403);
        const { data: target } = await supabaseServer.from(CHANNELS).select("kind").eq("id", channelId).maybeSingle();
        if (!target) return bad("Channel not found", 404);
        if ((target as { kind: string }).kind === "direct") return bad("Direct messages cannot be archived", 400);
        const { error } = await supabaseServer
          .from(CHANNELS)
          .update({ archived_at: new Date().toISOString() })
          .eq("id", channelId);
        if (error) return bad(error.message, 500);
        await emitPings((await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) })));
        return NextResponse.json({ ok: true });
      }

      case "addMembers": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        const { data: ch } = await supabaseServer.from(CHANNELS).select("kind").eq("id", channelId).maybeSingle();
        if (!ch) return bad("Channel not found", 404);
        if ((ch as { kind: string }).kind === "direct") return bad("Cannot add members to a direct message", 400);
        const accountIds = await filterTenantAccounts(p.accountIds, tenantId);
        if (accountIds.length === 0) return NextResponse.json({ ok: true, data: 0 });
        const { error: err } = await ensureMembers(channelId, accountIds);
        if (err) return bad(err, 500);
        /* SSE-only clients (no broadcast from the mainland) learn about the
           membership change from the channel touch — see the stream's `meta`
           change events. */
        await touchChannel(channelId);
        await emitPings([
          { topic: rtTopic.channel(channelId) },
          ...(await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) })),
        ]);
        return NextResponse.json({ ok: true, data: accountIds.length });
      }

      case "leaveChannel": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { data: mine } = await supabaseServer
          .from(MEMBERS)
          .select("role")
          .eq("channel_id", channelId)
          .eq("account_id", me)
          .is("left_at", null)
          .maybeSingle();
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ left_at: new Date().toISOString(), pinned_at: null, marked_unread: false })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        /* The last admin walking out would leave a channel nobody can rename,
           archive or moderate: hand the role to the longest-standing member. */
        if ((mine as { role?: string } | null)?.role === "admin") {
          await promoteIfNoAdmin(channelId);
        }
        await touchChannel(channelId);
        await emitPings([
          { topic: rtTopic.account(me) },
          { topic: rtTopic.channel(channelId) },
          ...(await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) })),
        ]);
        return NextResponse.json({ ok: true });
      }

      case "removeMember": {
        const channelId = str(p.channelId);
        const accountId = str(p.accountId);
        if (!channelId || !accountId) return bad("channelId and accountId required");
        if (accountId === me) return bad("Use leaveChannel to leave", 400);
        if (!(await isChannelAdmin(channelId))) return bad("Admins only", 403);
        const { data: ch } = await supabaseServer.from(CHANNELS).select("kind").eq("id", channelId).maybeSingle();
        if (!ch) return bad("Channel not found", 404);
        if ((ch as { kind: string }).kind === "direct") return bad("Cannot remove members from a direct message", 400);
        const { data: target } = await supabaseServer
          .from(MEMBERS)
          .select("id")
          .eq("channel_id", channelId)
          .eq("account_id", accountId)
          .is("left_at", null)
          .maybeSingle();
        if (!target) return bad("Not a member of this channel", 404);
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ left_at: new Date().toISOString(), pinned_at: null, marked_unread: false })
          .eq("id", (target as { id: string }).id);
        if (error) return bad(error.message, 500);
        /* A super-admin (not a member) may remove the only admin. */
        await promoteIfNoAdmin(channelId);
        await touchChannel(channelId);
        await emitPings([
          { topic: rtTopic.channel(channelId) },
          { topic: rtTopic.account(accountId) },
          ...(await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) })),
        ]);
        return NextResponse.json({ ok: true });
      }

      case "setMemberRole": {
        const channelId = str(p.channelId);
        const accountId = str(p.accountId);
        const role = str(p.role);
        if (!channelId || !accountId || !role) return bad("channelId, accountId and role required");
        if (!MEMBER_ROLES.has(role)) return bad("Invalid role");
        if (!(await isChannelAdmin(channelId))) return bad("Admins only", 403);
        const { data: ch } = await supabaseServer.from(CHANNELS).select("kind").eq("id", channelId).maybeSingle();
        if (!ch) return bad("Channel not found", 404);
        if ((ch as { kind: string }).kind === "direct") return bad("Direct messages have no roles", 400);
        const { data: rows } = await supabaseServer
          .from(MEMBERS)
          .select("id, account_id, role")
          .eq("channel_id", channelId)
          .is("left_at", null);
        const active = (rows ?? []) as Array<{ id: string; account_id: string; role: string }>;
        const target = active.find((r) => r.account_id === accountId);
        if (!target) return bad("Not a member of this channel", 404);
        if (target.role === role) return NextResponse.json({ ok: true });
        /* Never demote the last admin — the channel would be unmanageable. */
        if (role !== "admin" && target.role === "admin" && active.filter((r) => r.role === "admin").length <= 1) {
          return bad("A channel needs at least one admin", 409);
        }
        const { error } = await supabaseServer.from(MEMBERS).update({ role }).eq("id", target.id);
        if (error) return bad(error.message, 500);
        await touchChannel(channelId);
        await emitPings([{ topic: rtTopic.channel(channelId) }]);
        return NextResponse.json({ ok: true });
      }

      case "markRead": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        /* Reading a conversation also clears a manual "mark as unread" flag —
           otherwise the dot would linger after the user opened it. */
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ last_read_at: new Date().toISOString(), marked_unread: false })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "markAllRead": {
        /* Every conversation I am in, in one statement. Per-user state only,
           so no membership gate beyond "my own rows". */
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ last_read_at: new Date().toISOString(), marked_unread: false })
          .eq("account_id", me)
          .is("left_at", null);
        if (error) return bad(error.message, 500);
        await emitPings([{ topic: rtTopic.account(me) }]);
        return NextResponse.json({ ok: true });
      }

      /* ---- Per-user conversation state (WeChat-style) ------------------ */
      case "setChannelPinned": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ pinned_at: p.pinned === true ? new Date().toISOString() : null })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "setChannelHidden": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        /* Hide = remove from MY list until a newer message arrives. Also
           un-pin (a hidden chat shouldn't hold a pinned slot). */
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ hidden_at: new Date().toISOString(), pinned_at: null })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "markChannelUnread": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ marked_unread: true })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "deleteConversation": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        /* Delete = remove this conversation from MY list only. Message history
           is preserved server-side (never hard-deleted) for audit and for the
           other participants. Implemented as a soft-leave; the conversation
           re-surfaces if I open a new DM with the same person (see
           directChannel, which clears left_at/hidden_at). */
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ left_at: new Date().toISOString(), pinned_at: null, marked_unread: false })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        /* A soft-leave changes the active roster the others see. */
        await touchChannel(channelId);
        await emitPings([{ topic: rtTopic.account(me) }]);
        return NextResponse.json({ ok: true });
      }

      /* ---- Messages -------------------------------------------------- */
      case "sendMessage": {
        const channelId = str(p.channelId);
        const text = typeof p.body === "string" ? p.body : "";
        if (!channelId) return bad("channelId required");
        /* Only user-authored kinds. `system` rows are server-generated. */
        const kind = p.kind === undefined || p.kind === null ? "text" : p.kind;
        if (!isClientKind(kind)) return bad("Invalid message kind");
        if (text.length > DISCUSS_BODY_MAX) return bad(`Message is too long (max ${DISCUSS_BODY_MAX} characters)`, 413);
        /* Membership is checked BEFORE any read or write — including before an
           idempotent replay can return an existing row. A non-member (or a
           cross-tenant caller) can never reach the conflict path below. */
        const [denied, member] = await Promise.all([permission, isMember(channelId)]);
        if (denied) return denied;
        if (!member) return bad("Not a member of this channel", 403);
        timing.mark("membership");

        const verdict = sanitizeMessageMetadataForStorage(p.metadata, tenantId);
        if (!verdict.ok) return bad(verdict.error);
        const metadata = verdict.metadata;
        if (!text.trim() && Object.keys(metadata).length === 0) return bad("Empty message");

        /* A reply must quote a message in the SAME channel — otherwise a
           member of channel A could plant a reply that surfaces (and leaks
           the preview of) a message from channel B. */
        const replyTo = str(p.replyToMessageId);
        if (replyTo) {
          const target = await loadMessage(replyTo);
          if (!target || target.channel_id !== channelId) return bad("Reply target not found in this channel");
        }

        /* ------------------------------------------------------------------
           Idempotency (Discuss stabilization, Phase 3).
           The client generates one UUID per logical send and REUSES it for
           every retry of that same pending message. A partial unique index —
           discuss_messages (channel_id, client_msg_id) WHERE client_msg_id
           IS NOT NULL — makes a duplicate insert impossible at the database,
           so "send timed out but actually committed" + retry is safe.
           NULL is allowed and unconstrained, so legacy rows and any client
           that omits the key keep working exactly as before. */
        const rawClientMsgId = str(p.clientMsgId);
        const clientMsgId = rawClientMsgId && UUID_RE.test(rawClientMsgId) ? rawClientMsgId : null;
        const { data, error } = await supabaseServer
          .from(MESSAGES)
          .insert({
            channel_id: channelId,
            author_account_id: me,
            body: text,
            kind,
            reply_to_message_id: replyTo,
            metadata,
            client_msg_id: clientMsgId,
          })
          .select("*")
          .single();

        /* 23505 = unique_violation → this exact send already committed (the
           first attempt won; this is a retry). That is SUCCESS, not an error:
           return the canonical row so the sender reconciles onto the one true
           message. Critically we do NOT re-run notifyMembers() — the winning
           insert already pinged realtime and sent push, so a replay must not
           chime, badge, or push a second time. */
        if (error) {
          if (error.code === "23505" && clientMsgId) {
            const { data: existing } = await supabaseServer
              .from(MESSAGES)
              .select("*")
              .eq("channel_id", channelId)
              .eq("client_msg_id", clientMsgId)
              .single();
            /* The key is only ever MY retry: a row with the same key by
               someone else is not my message and must not be handed back. */
            if (existing && (existing as { author_account_id: string | null }).author_account_id !== me) {
              return bad("Duplicate message id", 409);
            }
            if (existing) {
              timing.mark("idempotent_replay");
              const { header } = timing.done({ action: "sendMessage" });
              return NextResponse.json(
                { ok: true, data: serializeDiscussMessageForClient(existing), idempotent: true },
                { headers: { "Server-Timing": header } },
              );
            }
          }
          return bad(error.message, 500);
        }
        timing.mark("db_insert");
        const messageId = (data as { id: string }).id;
        /* ------------------------------------------------------------------
           Phase 3B — acknowledge as soon as the message is DURABLE.
           Member lookup + realtime ping + web-push run AFTER the response via
           Next's after() (backed by waitUntil on Vercel). Rollback without
           redeploy: set env KX_DISCUSS_INLINE_NOTIFY=1 to restore the
           previous inline behavior. */
        const mentioned = new Set(
          ((metadata.mentions ?? []) as Array<{ account_id: string }>).map((m) => m.account_id),
        );
        const notifyMembers = async () => {
          const post = stageTimer("discuss.mutate.post_ack");
          try {
            /* One read for both jobs: every active member (realtime ping)
               and their per-channel notification settings (push filter). */
            const { data: memberRows } = await supabaseServer
              .from(MEMBERS)
              .select("account_id, muted, notification_pref")
              .eq("channel_id", channelId)
              .is("left_at", null);
            const rows = (memberRows ?? []) as Array<{ account_id: string; muted: boolean | null; notification_pref: string | null }>;
            const memberIds = rows.map((r) => r.account_id);
            post.mark("member_lookup");
            await pingChannelActivity(channelId, memberIds, me);
            post.mark("rt_dispatch");
            try {
              /* Push honours the recipient's own choices for THIS channel:
                 muted → nothing; "none" → nothing; "mentions" → only when
                 this message @-mentions them. */
              const recipients = rows
                .filter((r) => r.account_id !== me)
                .filter((r) => !r.muted)
                .filter((r) => {
                  const pref = r.notification_pref ?? "all";
                  if (pref === "none") return false;
                  if (pref === "mentions") return mentioned.has(r.account_id);
                  return true;
                })
                .map((r) => r.account_id);
              if (recipients.length) {
                const preview = text.trim().replace(/\s+/g, " ").slice(0, 140);
                /* Language-neutral fallbacks: the push is rendered on the
                   recipient's device, whose language the server does not
                   know. A glyph reads the same in en / zh / ar. */
                const glyph = kind === "image" ? "📷" : kind === "file" ? "📎" : kind === "voice" ? "🎤" : "💬";
                await sendPushToAccounts(
                  recipients,
                  {
                    title: auth.username || "Koleex",
                    body: preview || glyph,
                    url: `/discuss?channel=${encodeURIComponent(channelId)}&msg=${encodeURIComponent(messageId)}`,
                    tag: `discuss:${channelId}`,
                    kind: "discuss_message",
                  },
                  { actorAccountId: me },
                );
              }
            } catch { /* push is best-effort */ }
            post.mark("push_dispatch");
          } catch { /* notifications must never fail the send */ }
          finally { post.done({ action: "sendMessage" }); }
        };
        if (process.env.KX_DISCUSS_INLINE_NOTIFY === "1") {
          await notifyMembers();
        } else {
          after(notifyMembers);
        }
        const { header } = timing.done({ action: "sendMessage" });
        return NextResponse.json(
          { ok: true, data: serializeDiscussMessageForClient(data) },
          { headers: { "Server-Timing": header } },
        );
      }

      case "editMessage": {
        const id = str(p.id);
        if (!id) return bad("id required");
        const text = typeof p.body === "string" ? p.body : "";
        if (!text.trim()) return bad("Message body required");
        if (text.length > DISCUSS_BODY_MAX) return bad(`Message is too long (max ${DISCUSS_BODY_MAX} characters)`, 413);
        const msg = await loadMessage(id);
        if (!msg) return bad("Message not found", 404);
        if (msg.deleted_at) return bad("This message was deleted", 409);
        /* Authors edit their own words — nobody else, not even an admin. */
        if (msg.author_account_id !== me) return bad("You can only edit your own messages", 403);
        if (!(await isMember(msg.channel_id))) return bad("Not a member of this channel", 403);
        /* BODY ONLY. Metadata is never accepted on edit: it holds the
           message's attachments, voice note, mentions and products, and the
           old handler overwrote it with whatever the editor sent — `{}` — so
           editing a caption silently deleted the photo it captioned. */
        const { error } = await supabaseServer
          .from(MESSAGES)
          .update({ body: text, edited_at: new Date().toISOString() })
          .eq("id", id)
          .is("deleted_at", null);
        if (error) return bad(error.message, 500);
        await touchChannel(msg.channel_id);
        await emitPings([{ topic: rtTopic.channel(msg.channel_id) }]);
        return NextResponse.json({ ok: true });
      }

      case "deleteMessage": {
        const id = str(p.id);
        if (!id) return bad("id required");
        const msg = await loadMessage(id);
        if (!msg) return bad("Message not found", 404);
        if (msg.deleted_at) return NextResponse.json({ ok: true });
        const own = msg.author_account_id === me;
        if (!own) {
          /* Removing someone else's message is moderation: channel admin AND
             the Discuss delete permission. */
          if (!(isSA || (await isChannelAdmin(msg.channel_id)))) return bad("Not allowed to delete this message", 403);
          const denied = await requireModuleAction(auth, "Discuss", "delete");
          if (denied) return denied;
        } else if (!(await isMember(msg.channel_id))) {
          return bad("Not a member of this channel", 403);
        }
        const { error } = await supabaseServer
          .from(MESSAGES)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) return bad(error.message, 500);
        await touchChannel(msg.channel_id);
        await pingChannelActivity(msg.channel_id, await channelMemberIds(msg.channel_id));
        return NextResponse.json({ ok: true });
      }

      /* ---- Reactions ------------------------------------------------- */
      case "toggleReaction": {
        const messageId = str(p.messageId);
        const emoji = str(p.emoji);
        if (!messageId || !emoji) return bad("messageId and emoji required");
        /* A reaction is a single emoji (possibly multi-codepoint, e.g. a
           skin-tone / ZWJ sequence). Cap length so a malformed client can't
           stuff arbitrarily large strings into the reactions table. */
        if (emoji.length > 16) return bad("Invalid emoji");
        const msg = await loadMessage(messageId);
        if (!msg || msg.deleted_at) return bad("Message not found", 404);
        if (!(await isMember(msg.channel_id))) return bad("Not a member of this channel", 403);
        const { data: existing } = await supabaseServer
          .from(REACTIONS)
          .select("id")
          .eq("message_id", messageId)
          .eq("account_id", me)
          .eq("emoji", emoji)
          .maybeSingle();
        if (existing) {
          const { error: delErr } = await supabaseServer.from(REACTIONS).delete().eq("id", (existing as { id: string }).id);
          if (delErr) return bad(delErr.message, 500);
          await touchChannel(msg.channel_id);
          await emitPings([{ topic: rtTopic.channel(msg.channel_id) }]);
          return NextResponse.json({ ok: true, data: false });
        }
        const { error } = await supabaseServer
          .from(REACTIONS)
          .insert({ message_id: messageId, account_id: me, emoji });
        if (error) return bad(error.message, 500);
        await touchChannel(msg.channel_id);
        await emitPings([{ topic: rtTopic.channel(msg.channel_id) }]);
        return NextResponse.json({ ok: true, data: true });
      }

      /* ---- Pinned + Starred ----------------------------------------- */
      case "pinMessage": {
        const channelId = str(p.channelId);
        const messageId = str(p.messageId);
        if (!channelId || !messageId) return bad("channelId and messageId required");
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        /* The message must live in the channel it is pinned to — otherwise a
           member could pin (and so expose via the pinned list) a message from
           a channel they are not in. */
        const msg = await loadMessage(messageId);
        if (!msg || msg.channel_id !== channelId || msg.deleted_at) return bad("Message not found in this channel", 404);
        const { error } = await supabaseServer
          .from(PINNED)
          .insert({ channel_id: channelId, message_id: messageId, pinned_by: me });
        if (error && error.code !== "23505" && !/duplicate/i.test(error.message)) return bad(error.message, 500);
        await touchChannel(channelId);
        await emitPings([{ topic: rtTopic.channel(channelId) }]);
        return NextResponse.json({ ok: true });
      }

      case "unpinMessage": {
        const channelId = str(p.channelId);
        const messageId = str(p.messageId);
        if (!channelId || !messageId) return bad("channelId and messageId required");
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        const { error } = await supabaseServer
          .from(PINNED)
          .delete()
          .eq("channel_id", channelId)
          .eq("message_id", messageId);
        if (error) return bad(error.message, 500);
        await touchChannel(channelId);
        await emitPings([{ topic: rtTopic.channel(channelId) }]);
        return NextResponse.json({ ok: true });
      }

      case "toggleStar": {
        const messageId = str(p.messageId);
        if (!messageId) return bad("messageId required");
        const msg = await loadMessage(messageId);
        if (!msg || msg.deleted_at) return bad("Message not found", 404);
        if (!(await isMember(msg.channel_id))) return bad("Not a member of this channel", 403);
        const { data: existing, error: selErr } = await supabaseServer
          .from(STARRED)
          .select("id")
          .eq("account_id", me)
          .eq("message_id", messageId)
          .maybeSingle();
        if (selErr) return bad(selErr.message, 500);
        if (existing) {
          const { error } = await supabaseServer.from(STARRED).delete().eq("id", (existing as { id: string }).id);
          if (error) return bad(error.message, 500);
          return NextResponse.json({ ok: true, data: false });
        }
        const { error } = await supabaseServer.from(STARRED).insert({ account_id: me, message_id: messageId });
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true, data: true });
      }

      /* ---- Drafts ---------------------------------------------------- */
      case "saveDraft": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const draftBody = typeof p.body === "string" ? p.body : "";
        if (draftBody.length > DISCUSS_BODY_MAX) return bad("Draft is too long", 413);
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        const { error } = await supabaseServer.from(DRAFTS).upsert(
          {
            account_id: me,
            channel_id: channelId,
            body: draftBody,
            /* Drafts must never carry a storage reference. Media keys are
               stripped here so a crafted request cannot seed a private path
               into a draft row and read it back through any future echo. */
            metadata: sanitizeDraftMetadataForStorage(p.metadata) as Json,
          },
          { onConflict: "account_id,channel_id" },
        );
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "clearDraft": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { error } = await supabaseServer
          .from(DRAFTS)
          .delete()
          .eq("account_id", me)
          .eq("channel_id", channelId);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      /* ---- Notification prefs --------------------------------------- */
      case "setNotificationPref": {
        const channelId = str(p.channelId);
        const pref = str(p.pref);
        if (!channelId || !pref) return bad("channelId and pref required");
        if (!NOTIFICATION_PREFS.has(pref)) return bad("Invalid notification preference");
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ notification_pref: pref })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      case "setChannelMuted": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ muted: p.muted === true })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      default:
        return bad(`Unknown action: ${action}`);
    }
  } catch (e) {
    console.error("[api/discuss/mutate]", action, e);
    return bad(e instanceof Error ? e.message : "Server error", 500);
  }
}

/** Make every account in `accountIds` an ACTIVE member of `channelId`.
 *  New accounts are inserted as members; accounts that previously left are
 *  revived (left_at / hidden_at cleared) WITHOUT touching their role — an
 *  upsert would have demoted a returning admin to member. Returns an error
 *  message (or null) and whether the active member set changed — callers
 *  touch the channel only then, so a no-op re-open does not make every open
 *  client reload its roster. UNIQUE(channel_id, account_id) makes a
 *  concurrent duplicate insert a no-op (23505), not a failure. */
async function ensureMembers(
  channelId: string,
  accountIds: string[],
): Promise<{ error: string | null; changed: boolean }> {
  const ids = Array.from(new Set(accountIds));
  if (ids.length === 0) return { error: null, changed: false };
  const { data: rows, error: selErr } = await supabaseServer
    .from(MEMBERS)
    .select("account_id, left_at")
    .eq("channel_id", channelId)
    .in("account_id", ids);
  if (selErr) return { error: selErr.message, changed: false };
  const known = new Map(((rows ?? []) as Array<{ account_id: string; left_at: string | null }>).map((r) => [r.account_id, r.left_at]));
  const toInsert = ids.filter((id) => !known.has(id));
  const toRevive = ids.filter((id) => known.has(id) && known.get(id) !== null);
  if (toInsert.length) {
    const { error } = await supabaseServer
      .from(MEMBERS)
      .insert(toInsert.map((id) => ({ channel_id: channelId, account_id: id, role: "member" })));
    if (error && error.code !== "23505") return { error: error.message, changed: false };
  }
  if (toRevive.length) {
    const { error } = await supabaseServer
      .from(MEMBERS)
      .update({ left_at: null, hidden_at: null })
      .eq("channel_id", channelId)
      .in("account_id", toRevive);
    if (error) return { error: error.message, changed: toInsert.length > 0 };
  }
  return { error: null, changed: toInsert.length > 0 || toRevive.length > 0 };
}

/** If a group/channel has active members but no active admin, promote the
 *  longest-standing member. Best-effort: a failure leaves the channel as it
 *  was (the leave itself already succeeded). */
async function promoteIfNoAdmin(channelId: string): Promise<void> {
  try {
    const { data: ch } = await supabaseServer.from(CHANNELS).select("kind").eq("id", channelId).maybeSingle();
    if (!ch || (ch as { kind: string }).kind === "direct") return;
    const { data: rows } = await supabaseServer
      .from(MEMBERS)
      .select("id, role, joined_at")
      .eq("channel_id", channelId)
      .is("left_at", null)
      .order("joined_at", { ascending: true });
    const active = (rows ?? []) as Array<{ id: string; role: string }>;
    if (active.length === 0 || active.some((r) => r.role === "admin")) return;
    await supabaseServer.from(MEMBERS).update({ role: "admin" }).eq("id", active[0].id);
  } catch { /* best-effort */ }
}
