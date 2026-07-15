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

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { emitPings, pingChannelActivity, rtTopic } from "@/lib/server/realtime-broadcast";
import { sendPushToAccounts } from "@/lib/server/web-push";

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

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  /* Identity is the session account — never the client payload. */
  const me = auth.account_id;
  const isSA = auth.is_super_admin === true;

  let body: { action?: string; payload?: Json };
  try {
    body = (await req.json()) as { action?: string; payload?: Json };
  } catch {
    return bad("Invalid JSON body");
  }
  const action = body.action;
  const p = (body.payload ?? {}) as Json;
  if (!action) return bad("Missing action");

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

  /* Resolve the channel that owns a message (for message-id-scoped writes). */
  const channelOfMessage = async (
    messageId: string,
  ): Promise<{ channel_id: string; author_account_id: string } | null> => {
    const { data } = await supabaseServer
      .from(MESSAGES)
      .select("channel_id, author_account_id")
      .eq("id", messageId)
      .maybeSingle();
    return (data as { channel_id: string; author_account_id: string } | null) ?? null;
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

  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

  try {
    switch (action) {
      /* ---- Channels -------------------------------------------------- */
      case "directChannel": {
        const otherId = str(p.otherId);
        if (!otherId) return bad("otherId required");
        const { data, error } = await supabaseServer.rpc(
          "find_or_create_direct_channel",
          { p_account_a: me, p_account_b: otherId },
        );
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true, data });
      }

      case "createChannel": {
        const kind = str(p.kind);
        const name = str(p.name);
        if (!kind || !name) return bad("kind and name required");
        const { data: channel, error } = await supabaseServer
          .from(CHANNELS)
          .insert({
            kind,
            name,
            description: str(p.description),
            icon: str(p.icon),
            color: str(p.color),
            created_by: me,
            tenant_id: auth.tenant_id ?? null,
          })
          .select("*")
          .single();
        if (error) return bad(error.message, 500);
        const channelId = (channel as { id: string }).id;
        const memberIds = Array.isArray(p.memberIds) ? (p.memberIds as string[]) : [];
        const allMembers = new Set<string>([me, ...memberIds]);
        const rows = Array.from(allMembers).map((accountId) => ({
          channel_id: channelId,
          account_id: accountId,
          role: accountId === me ? "admin" : "member",
        }));
        await supabaseServer.from(MEMBERS).insert(rows);
        await emitPings(Array.from(allMembers).map((id) => ({ topic: rtTopic.account(id) })));
        return NextResponse.json({ ok: true, data: channel });
      }

      case "updateChannel": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        const patch = (p.patch ?? {}) as Json;
        const clean: Json = {};
        for (const k of ["name", "description", "icon", "color"]) {
          if (k in patch) clean[k] = patch[k];
        }
        const { error } = await supabaseServer.from(CHANNELS).update(clean).eq("id", channelId);
        if (error) return bad(error.message, 500);
        await emitPings([{ topic: rtTopic.channel(channelId) }, ...(await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) }))]);
        return NextResponse.json({ ok: true });
      }

      case "archiveChannel": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        if (!(await isChannelAdmin(channelId))) return bad("Admins only", 403);
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
        const accountIds = Array.isArray(p.accountIds) ? (p.accountIds as string[]) : [];
        if (!channelId) return bad("channelId required");
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        if (accountIds.length === 0) return NextResponse.json({ ok: true, data: 0 });
        const rows = accountIds.map((id) => ({
          channel_id: channelId,
          account_id: id,
          role: "member" as const,
        }));
        const { count, error } = await supabaseServer
          .from(MEMBERS)
          .insert(rows, { count: "exact" });
        if (error && !/duplicate/i.test(error.message)) return bad(error.message, 500);
        await emitPings([
          { topic: rtTopic.channel(channelId) },
          ...(await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) })),
        ]);
        return NextResponse.json({ ok: true, data: count ?? accountIds.length });
      }

      case "leaveChannel": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ left_at: new Date().toISOString() })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        await emitPings([
          { topic: rtTopic.account(me) },
          ...(await channelMemberIds(channelId)).map((id) => ({ topic: rtTopic.account(id) })),
        ]);
        return NextResponse.json({ ok: true });
      }

      case "markRead": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { error } = await supabaseServer
          .from(MEMBERS)
          .update({ last_read_at: new Date().toISOString() })
          .eq("channel_id", channelId)
          .eq("account_id", me);
        if (error) return bad(error.message, 500);
        return NextResponse.json({ ok: true });
      }

      /* ---- Messages -------------------------------------------------- */
      case "sendMessage": {
        const channelId = str(p.channelId);
        const text = typeof p.body === "string" ? p.body : "";
        if (!channelId) return bad("channelId required");
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        const { data, error } = await supabaseServer
          .from(MESSAGES)
          .insert({
            channel_id: channelId,
            author_account_id: me,
            body: text,
            kind: str(p.kind) ?? "text",
            reply_to_message_id: str(p.replyToMessageId),
            metadata: (p.metadata as Json) ?? {},
          })
          .select("*")
          .single();
        if (error) return bad(error.message, 500);
        const memberIds = await channelMemberIds(channelId);
        await pingChannelActivity(channelId, memberIds, me);
        /* Best-effort phone / desktop push to every OTHER member who has
           enabled notifications on a device. Never blocks or fails the send;
           sendPushToAccounts only reaches accounts with an active device. */
        try {
          const recipients = memberIds.filter((id) => id !== me);
          if (recipients.length) {
            const preview = text.trim().replace(/\s+/g, " ").slice(0, 140);
            await sendPushToAccounts(
              recipients,
              {
                title: auth.username || "New message",
                body: preview || "Sent you a message",
                url: "/discuss",
                tag: `discuss:${channelId}`,
                kind: "discuss_message",
              },
              { actorAccountId: me },
            );
          }
        } catch { /* push is best-effort */ }
        return NextResponse.json({ ok: true, data });
      }

      case "editMessage": {
        const id = str(p.id);
        if (!id) return bad("id required");
        const msg = await channelOfMessage(id);
        if (!msg) return bad("Message not found", 404);
        if (!isSA && msg.author_account_id !== me) return bad("You can only edit your own messages", 403);
        const { error } = await supabaseServer
          .from(MESSAGES)
          .update({
            body: typeof p.body === "string" ? p.body : "",
            metadata: (p.metadata as Json) ?? {},
            edited_at: new Date().toISOString(),
          })
          .eq("id", id);
        if (error) return bad(error.message, 500);
        await emitPings([{ topic: rtTopic.channel(msg.channel_id) }]);
        return NextResponse.json({ ok: true });
      }

      case "deleteMessage": {
        const id = str(p.id);
        if (!id) return bad("id required");
        const msg = await channelOfMessage(id);
        if (!msg) return bad("Message not found", 404);
        const allowed =
          isSA || msg.author_account_id === me || (await isChannelAdmin(msg.channel_id));
        if (!allowed) return bad("Not allowed to delete this message", 403);
        const { error } = await supabaseServer
          .from(MESSAGES)
          .update({ deleted_at: new Date().toISOString() })
          .eq("id", id);
        if (error) return bad(error.message, 500);
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
        const msg = await channelOfMessage(messageId);
        if (!msg) return bad("Message not found", 404);
        if (!(await isMember(msg.channel_id))) return bad("Not a member of this channel", 403);
        const { data: existing } = await supabaseServer
          .from(REACTIONS)
          .select("id")
          .eq("message_id", messageId)
          .eq("account_id", me)
          .eq("emoji", emoji)
          .maybeSingle();
        if (existing) {
          await supabaseServer.from(REACTIONS).delete().eq("id", (existing as { id: string }).id);
          await emitPings([{ topic: rtTopic.channel(msg.channel_id) }]);
          return NextResponse.json({ ok: true, data: false });
        }
        const { error } = await supabaseServer
          .from(REACTIONS)
          .insert({ message_id: messageId, account_id: me, emoji });
        if (error) return bad(error.message, 500);
        await emitPings([{ topic: rtTopic.channel(msg.channel_id) }]);
        return NextResponse.json({ ok: true, data: true });
      }

      /* ---- Pinned + Starred ----------------------------------------- */
      case "pinMessage": {
        const channelId = str(p.channelId);
        const messageId = str(p.messageId);
        if (!channelId || !messageId) return bad("channelId and messageId required");
        if (!(await isMember(channelId))) return bad("Not a member of this channel", 403);
        const { error } = await supabaseServer
          .from(PINNED)
          .insert({ channel_id: channelId, message_id: messageId, pinned_by: me });
        if (error && !/duplicate/i.test(error.message)) return bad(error.message, 500);
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
        await emitPings([{ topic: rtTopic.channel(channelId) }]);
        return NextResponse.json({ ok: true });
      }

      case "toggleStar": {
        const messageId = str(p.messageId);
        if (!messageId) return bad("messageId required");
        const { data: existing } = await supabaseServer
          .from(STARRED)
          .select("id")
          .eq("account_id", me)
          .eq("message_id", messageId)
          .maybeSingle();
        if (existing) {
          await supabaseServer.from(STARRED).delete().eq("id", (existing as { id: string }).id);
          return NextResponse.json({ ok: true, data: false });
        }
        await supabaseServer.from(STARRED).insert({ account_id: me, message_id: messageId });
        return NextResponse.json({ ok: true, data: true });
      }

      /* ---- Drafts ---------------------------------------------------- */
      case "saveDraft": {
        const channelId = str(p.channelId);
        if (!channelId) return bad("channelId required");
        const { error } = await supabaseServer.from(DRAFTS).upsert(
          {
            account_id: me,
            channel_id: channelId,
            body: typeof p.body === "string" ? p.body : "",
            metadata: (p.metadata as Json) ?? {},
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
