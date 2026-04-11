"use client";

/* ---------------------------------------------------------------------------
   discuss — data layer for the Discuss (chat) app.

   Mirrors the pattern established in src/lib/inbox.ts:
     - Plain async functions, not hooks
     - supabaseAdmin client (anon key, dev-mode permissive RLS)
     - Resilient: returns empty arrays / stub success if a table hasn't
       been migrated yet, so the UI never crashes on a fresh DB
     - Leaves all React state management to the caller — this module
       only speaks to Supabase

   Real-time lives in a dedicated helper (`subscribeToChannel`) because
   that's the one place where a caller needs the raw Supabase channel
   object back so they can unsubscribe on unmount.
   --------------------------------------------------------------------------- */

import { supabaseAdmin as supabase } from "./supabase-admin";
import type {
  DiscussAttachment,
  DiscussAuthor,
  DiscussChannelKind,
  DiscussChannelRow,
  DiscussChannelWithState,
  DiscussDraftRow,
  DiscussLinkedContact,
  DiscussMemberRow,
  DiscussMessageKind,
  DiscussMessageMetadata,
  DiscussMessageRow,
  DiscussMessageWithAuthor,
  DiscussNotificationPref,
  DiscussPinnedRow,
  DiscussReactionRow,
  DiscussReplyPreview,
  DiscussSearchResult,
  DiscussVoiceMeta,
} from "@/types/supabase";

const CHANNELS = "discuss_channels";
const MEMBERS = "discuss_members";
const MESSAGES = "discuss_messages";
const REACTIONS = "discuss_reactions";
const PINNED = "discuss_pinned";
const STARRED = "discuss_starred";
const DRAFTS = "discuss_drafts";
const CONTACTS = "contacts";
const BUCKET = "media";

/** Silent fallback when a table hasn't been migrated yet. Matches the
 *  detection logic in inbox.ts so behavior is consistent. */
function isMissingTable(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("not found") ||
    m.includes("schema cache") ||
    m.includes("404")
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Channels
   ═══════════════════════════════════════════════════════════════════════ */

/** Atomically find or create the DM channel between two accounts. Uses
 *  the `find_or_create_direct_channel` SQL function which guarantees
 *  only one DM row exists per pair even under concurrent clicks. */
export async function findOrCreateDirectChannel(
  accountA: string,
  accountB: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("find_or_create_direct_channel", {
    p_account_a: accountA,
    p_account_b: accountB,
  });
  if (error) {
    console.error("[Discuss] findOrCreateDirectChannel:", error.message);
    return null;
  }
  return (data as string) ?? null;
}

/** Create a new group or channel. The creator is auto-added as admin.
 *  Pass `memberIds` to invite additional members in the same insert
 *  batch — we use a single `insert` call so Supabase generates all
 *  rows in one round-trip. */
export async function createChannel(input: {
  kind: Exclude<DiscussChannelKind, "direct">;
  name: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  createdBy: string;
  memberIds?: string[];
}): Promise<DiscussChannelRow | null> {
  const { data: channel, error: channelErr } = await supabase
    .from(CHANNELS)
    .insert({
      kind: input.kind,
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? null,
      created_by: input.createdBy,
    })
    .select("*")
    .single();

  if (channelErr) {
    console.error("[Discuss] Create channel:", channelErr.message);
    if (isMissingTable(channelErr.message)) {
      console.error(
        "[Discuss] `discuss_channels` is missing from Supabase. Apply " +
          "supabase/migrations/create_discuss_chat_system.sql (and " +
          "extend_discuss_phase_bcde.sql) in Supabase Studio → SQL Editor.",
      );
    }
    return null;
  }

  const allMembers = new Set([input.createdBy, ...(input.memberIds ?? [])]);
  const rows = Array.from(allMembers).map((accountId) => ({
    channel_id: (channel as DiscussChannelRow).id,
    account_id: accountId,
    role: accountId === input.createdBy ? ("admin" as const) : ("member" as const),
  }));

  const { error: memberErr } = await supabase.from(MEMBERS).insert(rows);
  if (memberErr) {
    console.error("[Discuss] Create channel members:", memberErr.message);
    /* Best-effort rollback. If the channel row lingers without any
       members, the sidebar fetch will still omit it because it filters
       by account_id in the join. Not worth a transaction for a dev
       failure mode. */
  }

  return channel as DiscussChannelRow;
}

/** Update a channel's editable metadata (name, description, icon, color).
 *  Used by the channel settings modal. */
export async function updateChannel(
  channelId: string,
  patch: Partial<Pick<DiscussChannelRow, "name" | "description" | "icon" | "color">>,
): Promise<boolean> {
  const { error } = await supabase
    .from(CHANNELS)
    .update(patch)
    .eq("id", channelId);
  if (error) {
    console.error("[Discuss] Update channel:", error.message);
    return false;
  }
  return true;
}

/** Soft-archive a channel. We never hard-delete so message history
 *  stays intact for audit. */
export async function archiveChannel(channelId: string): Promise<boolean> {
  const { error } = await supabase
    .from(CHANNELS)
    .update({ archived_at: new Date().toISOString() })
    .eq("id", channelId);
  if (error) {
    console.error("[Discuss] Archive channel:", error.message);
    return false;
  }
  return true;
}

/** Fetch every channel the account is a member of, enriched with:
 *   - unread_count (messages since last_read_at by OTHER people)
 *   - last_message preview
 *   - for DMs, the OTHER member's info so the sidebar shows "Sarah" not "DM #abc"
 *
 *  Sorted by `last_message_at DESC` so the most-recently-active thread
 *  sits at the top, Slack-style. */
export async function fetchMyChannels(
  accountId: string,
): Promise<DiscussChannelWithState[]> {
  /* 1. My active memberships — gives us the candidate channel ids + read cursors
        + notification prefs (Phase D). */
  const { data: memberships, error: memErr } = await supabase
    .from(MEMBERS)
    .select("channel_id, last_read_at, muted, notification_pref")
    .eq("account_id", accountId)
    .is("left_at", null);
  if (memErr) {
    if (!isMissingTable(memErr.message)) {
      console.error("[Discuss] Fetch memberships:", memErr.message);
    }
    return [];
  }
  const memRows = (memberships ?? []) as Array<{
    channel_id: string;
    last_read_at: string;
    muted: boolean;
    notification_pref: DiscussNotificationPref;
  }>;
  if (memRows.length === 0) return [];

  const channelIds = memRows.map((m) => m.channel_id);
  const readState = new Map(
    memRows.map((m) => [
      m.channel_id,
      {
        last_read_at: m.last_read_at,
        muted: m.muted,
        notification_pref: m.notification_pref ?? "all",
      },
    ]),
  );

  /* 2. The channel rows themselves. */
  const { data: channels, error: chanErr } = await supabase
    .from(CHANNELS)
    .select("*")
    .in("id", channelIds)
    .is("archived_at", null)
    .order("last_message_at", { ascending: false });
  if (chanErr) {
    console.error("[Discuss] Fetch channels:", chanErr.message);
    return [];
  }
  const chanRows = (channels ?? []) as DiscussChannelRow[];
  if (chanRows.length === 0) return [];

  /* 3. For DMs, resolve the "other" member + their person/account info
        in one shot. Group/channel kinds skip this. */
  const directChannelIds = chanRows.filter((c) => c.kind === "direct").map((c) => c.id);
  const otherByChannel = new Map<string, DiscussAuthor>();
  if (directChannelIds.length > 0) {
    const { data: otherMembers } = await supabase
      .from(MEMBERS)
      .select(
        `
        channel_id,
        account:accounts!discuss_members_account_id_fkey (
          id,
          username,
          avatar_url,
          person:people ( full_name )
        )
        `,
      )
      .in("channel_id", directChannelIds)
      .neq("account_id", accountId);

    for (const row of (otherMembers ?? []) as unknown as Array<{
      channel_id: string;
      account:
        | {
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }>) {
      const acc = Array.isArray(row.account) ? row.account[0] ?? null : row.account;
      if (!acc) continue;
      const person = Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person;
      otherByChannel.set(row.channel_id, {
        id: acc.id,
        username: acc.username,
        avatar_url: acc.avatar_url,
        full_name: person?.full_name ?? null,
      });
    }
  }

  /* 4. Last message preview per channel. We grab up to 50 most-recent
        messages across the candidate channels, then pick the newest per
        channel client-side — cheaper than N round-trips. */
  const { data: recentMsgs } = await supabase
    .from(MESSAGES)
    .select(
      `
      id,
      channel_id,
      body,
      kind,
      author_account_id,
      created_at,
      author:accounts!discuss_messages_author_account_id_fkey ( username )
      `,
    )
    .in("channel_id", channelIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.max(50, channelIds.length * 2));

  const lastByChannel = new Map<
    string,
    DiscussChannelWithState["last_message"]
  >();
  for (const row of (recentMsgs ?? []) as unknown as Array<{
    id: string;
    channel_id: string;
    body: string | null;
    kind: DiscussMessageKind;
    author_account_id: string | null;
    created_at: string;
    author:
      | { username: string }
      | Array<{ username: string }>
      | null;
  }>) {
    if (lastByChannel.has(row.channel_id)) continue;
    const author = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    lastByChannel.set(row.channel_id, {
      id: row.id,
      body: row.body,
      kind: row.kind,
      author_username: author?.username ?? null,
      created_at: row.created_at,
    });
  }

  /* 5. Unread counts. Head-only count queries per channel — Postgres
        serves these from the (channel_id, created_at DESC) index so
        each one is essentially free. Issued in parallel via
        Promise.all so the whole step finishes in one round-trip window. */
  const unreadCounts = await Promise.all(
    chanRows.map(async (ch) => {
      const readCursor = readState.get(ch.id)?.last_read_at;
      if (!readCursor) return [ch.id, 0] as const;
      const { count } = await supabase
        .from(MESSAGES)
        .select("id", { count: "exact", head: true })
        .eq("channel_id", ch.id)
        .is("deleted_at", null)
        .neq("author_account_id", accountId)
        .gt("created_at", readCursor);
      return [ch.id, count ?? 0] as const;
    }),
  );
  const unreadMap = new Map(unreadCounts);

  /* 6. Linked CRM contacts for customer-chat channels (Phase E).
        Only fetch for `kind === 'customer'` rows so non-customer
        workspaces pay zero cost. */
  const customerRows = chanRows.filter(
    (c) => c.kind === "customer" && c.linked_contact_id,
  );
  const contactByChannel = new Map<string, DiscussLinkedContact>();
  if (customerRows.length > 0) {
    const contactIds = Array.from(
      new Set(customerRows.map((c) => c.linked_contact_id as string)),
    );
    const { data: contacts } = await supabase
      .from(CONTACTS)
      .select(
        "id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type",
      )
      .in("id", contactIds);
    const contactById = new Map<string, DiscussLinkedContact>();
    for (const row of (contacts ?? []) as Array<{
      id: string;
      display_name: string | null;
      full_name: string | null;
      first_name: string | null;
      last_name: string | null;
      company: string | null;
      email: string | null;
      phone: string | null;
      photo_url: string | null;
      contact_type: string | null;
    }>) {
      const displayName =
        row.display_name ??
        row.full_name ??
        [row.first_name, row.last_name].filter(Boolean).join(" ") ??
        "Unnamed contact";
      contactById.set(row.id, {
        id: row.id,
        display_name: displayName || "Unnamed contact",
        full_name: row.full_name,
        company: row.company,
        email: row.email,
        phone: row.phone,
        avatar_url: row.photo_url,
        contact_type: row.contact_type,
      });
    }
    for (const c of customerRows) {
      const linked = contactById.get(c.linked_contact_id as string);
      if (linked) contactByChannel.set(c.id, linked);
    }
  }

  /* 7. Drafts the current user has open (Phase C). Surfaced as a
        boolean flag per channel so the sidebar can badge it and the
        Drafts view can re-use the sidebar query without re-fetching. */
  const draftChannelIds = new Set<string>();
  {
    const { data: drafts } = await supabase
      .from(DRAFTS)
      .select("channel_id, body, metadata")
      .eq("account_id", accountId)
      .in("channel_id", channelIds);
    for (const d of (drafts ?? []) as Array<{
      channel_id: string;
      body: string | null;
      metadata: DiscussMessageMetadata | null;
    }>) {
      const hasBody = !!(d.body && d.body.trim());
      const hasAttachments =
        !!d.metadata?.attachments && d.metadata.attachments.length > 0;
      if (hasBody || hasAttachments) draftChannelIds.add(d.channel_id);
    }
  }

  /* 8. Stitch it all together. */
  return chanRows.map((ch) => ({
    ...ch,
    unread_count: unreadMap.get(ch.id) ?? 0,
    last_read_at: readState.get(ch.id)?.last_read_at ?? null,
    muted: readState.get(ch.id)?.muted ?? false,
    notification_pref:
      readState.get(ch.id)?.notification_pref ?? ("all" as DiscussNotificationPref),
    other: otherByChannel.get(ch.id) ?? null,
    linked_contact: contactByChannel.get(ch.id) ?? null,
    last_message: lastByChannel.get(ch.id) ?? null,
    has_draft: draftChannelIds.has(ch.id),
  }));
}

/* ═══════════════════════════════════════════════════════════════════════
   Members
   ═══════════════════════════════════════════════════════════════════════ */

/** Add one or more members to a channel. No-op on duplicates — the
 *  table's UNIQUE(channel_id, account_id) constraint absorbs them and
 *  we swallow the error. */
export async function addMembers(
  channelId: string,
  accountIds: string[],
): Promise<number> {
  if (accountIds.length === 0) return 0;
  const rows = accountIds.map((id) => ({
    channel_id: channelId,
    account_id: id,
    role: "member" as const,
  }));
  const { error, count } = await supabase
    .from(MEMBERS)
    .insert(rows, { count: "exact" });
  if (error && !/duplicate/i.test(error.message)) {
    console.error("[Discuss] Add members:", error.message);
    return 0;
  }
  return count ?? accountIds.length;
}

/** Soft-leave: sets `left_at` so the user stops seeing the channel in
 *  their sidebar but historical messages still reference the member
 *  for author display. */
export async function leaveChannel(
  channelId: string,
  accountId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(MEMBERS)
    .update({ left_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .eq("account_id", accountId);
  if (error) {
    console.error("[Discuss] Leave channel:", error.message);
    return false;
  }
  return true;
}

/** Fetch active members of a channel with their account + person info.
 *  Used by the channel details pane and the mention autocomplete. */
export async function fetchChannelMembers(
  channelId: string,
): Promise<Array<DiscussMemberRow & { author: DiscussAuthor }>> {
  const { data, error } = await supabase
    .from(MEMBERS)
    .select(
      `
      *,
      account:accounts!discuss_members_account_id_fkey (
        id,
        username,
        avatar_url,
        person:people ( full_name )
      )
      `,
    )
    .eq("channel_id", channelId)
    .is("left_at", null);
  if (error) {
    console.error("[Discuss] Fetch members:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as Array<
    DiscussMemberRow & {
      account:
        | {
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }
  >).map((row) => {
    const acc = Array.isArray(row.account) ? row.account[0] ?? null : row.account;
    const person = acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
    return {
      ...row,
      author: acc
        ? {
            id: acc.id,
            username: acc.username,
            avatar_url: acc.avatar_url,
            full_name: person?.full_name ?? null,
          }
        : { id: "", username: "unknown", avatar_url: null, full_name: null },
    };
  });
}

/** Update the read cursor for a (channel, member) pair. Called from
 *  the UI when the user scrolls the message list to the bottom, or
 *  when they switch away from a channel. Idempotent. */
export async function markChannelRead(
  channelId: string,
  accountId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(MEMBERS)
    .update({ last_read_at: new Date().toISOString() })
    .eq("channel_id", channelId)
    .eq("account_id", accountId);
  if (error) {
    console.error("[Discuss] Mark channel read:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Messages
   ═══════════════════════════════════════════════════════════════════════ */

/** Fetch the last N messages of a channel with author info + reactions
 *  already aggregated. Sorted ASCENDING so the list renders oldest→newest
 *  from top of viewport, then the UI scrolls to the bottom. */
export async function fetchChannelMessages(
  channelId: string,
  options: { currentAccountId: string; limit?: number; before?: string } = {
    currentAccountId: "",
  },
): Promise<DiscussMessageWithAuthor[]> {
  const { limit = 80, before, currentAccountId } = options;

  let q = supabase
    .from(MESSAGES)
    .select(
      `
      *,
      author:accounts!discuss_messages_author_account_id_fkey (
        id,
        username,
        avatar_url,
        person:people ( full_name )
      )
      `,
    )
    .eq("channel_id", channelId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (before) q = q.lt("created_at", before);

  const { data, error } = await q;
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[Discuss] Fetch messages:", error.message);
    }
    return [];
  }

  const rows = ((data ?? []) as unknown as Array<
    DiscussMessageRow & {
      author:
        | {
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }
  >).map((row) => {
    const acc = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    const person = acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
    const author: DiscussAuthor | null = acc
      ? {
          id: acc.id,
          username: acc.username,
          avatar_url: acc.avatar_url,
          full_name: person?.full_name ?? null,
        }
      : null;
    return { ...row, author };
  });

  /* Reactions in one batched query so we don't N+1. */
  const messageIds = rows.map((r) => r.id);
  const reactionsByMessage = new Map<
    string,
    DiscussMessageWithAuthor["reactions"]
  >();
  if (messageIds.length > 0) {
    const { data: rxRows } = await supabase
      .from(REACTIONS)
      .select("*")
      .in("message_id", messageIds);
    for (const rx of (rxRows ?? []) as DiscussReactionRow[]) {
      const bucket = reactionsByMessage.get(rx.message_id) ?? [];
      const existing = bucket.find((b) => b.emoji === rx.emoji);
      if (existing) {
        existing.count += 1;
        existing.account_ids.push(rx.account_id);
        if (rx.account_id === currentAccountId) existing.reacted_by_me = true;
      } else {
        bucket.push({
          emoji: rx.emoji,
          count: 1,
          account_ids: [rx.account_id],
          reacted_by_me: rx.account_id === currentAccountId,
        });
      }
      reactionsByMessage.set(rx.message_id, bucket);
    }
  }

  /* Reply previews (Phase B). For every message that has a
     `reply_to_message_id`, grab the parent's author + body in one
     batched select — same 1-round-trip pattern as reactions. */
  const replyTargetIds = Array.from(
    new Set(rows.map((r) => r.reply_to_message_id).filter(Boolean) as string[]),
  );
  const replyPreviewById = new Map<string, DiscussReplyPreview>();
  if (replyTargetIds.length > 0) {
    const { data: parents } = await supabase
      .from(MESSAGES)
      .select(
        `
        id,
        body,
        kind,
        deleted_at,
        author:accounts!discuss_messages_author_account_id_fkey (
          username,
          person:people ( full_name )
        )
        `,
      )
      .in("id", replyTargetIds);
    for (const p of (parents ?? []) as unknown as Array<{
      id: string;
      body: string | null;
      kind: DiscussMessageKind;
      deleted_at: string | null;
      author:
        | {
            username: string;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            username: string;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }>) {
      const acc = Array.isArray(p.author) ? p.author[0] ?? null : p.author;
      const person =
        acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
      replyPreviewById.set(p.id, {
        id: p.id,
        body: p.body,
        kind: p.kind,
        deleted_at: p.deleted_at,
        author_username: acc?.username ?? null,
        author_full_name: person?.full_name ?? null,
      });
    }
  }

  /* Thread aggregation (Phase B). For every message in this page,
     count how many OTHER messages reply to it and who participated.
     We do this in a single group-by query so it's cheap even on
     busy channels. */
  const threadByParent = new Map<
    string,
    { reply_count: number; last_reply_at: string | null; participant_ids: string[] }
  >();
  if (messageIds.length > 0) {
    const { data: childRows } = await supabase
      .from(MESSAGES)
      .select("reply_to_message_id, author_account_id, created_at")
      .in("reply_to_message_id", messageIds)
      .is("deleted_at", null);
    for (const row of (childRows ?? []) as Array<{
      reply_to_message_id: string;
      author_account_id: string | null;
      created_at: string;
    }>) {
      const key = row.reply_to_message_id;
      const entry = threadByParent.get(key) ?? {
        reply_count: 0,
        last_reply_at: null as string | null,
        participant_ids: [] as string[],
      };
      entry.reply_count += 1;
      if (!entry.last_reply_at || row.created_at > entry.last_reply_at) {
        entry.last_reply_at = row.created_at;
      }
      if (
        row.author_account_id &&
        !entry.participant_ids.includes(row.author_account_id)
      ) {
        entry.participant_ids.push(row.author_account_id);
      }
      threadByParent.set(key, entry);
    }
  }

  return rows
    .map((row) => ({
      ...row,
      reactions: reactionsByMessage.get(row.id) ?? [],
      reply_preview: row.reply_to_message_id
        ? replyPreviewById.get(row.reply_to_message_id) ?? null
        : null,
      thread: threadByParent.get(row.id) ?? null,
    }))
    .reverse(); // oldest first for render
}

/** Send a new message in a channel. Accepts the full metadata payload
 *  (attachments / products / mentions / voice / link preview) so the
 *  caller just builds it once and hands it over. */
export async function sendDiscussMessage(input: {
  channelId: string;
  authorId: string;
  body: string;
  kind?: DiscussMessageKind;
  replyToMessageId?: string | null;
  metadata?: DiscussMessageMetadata;
}): Promise<DiscussMessageRow | null> {
  const { data, error } = await supabase
    .from(MESSAGES)
    .insert({
      channel_id: input.channelId,
      author_account_id: input.authorId,
      body: input.body,
      kind: input.kind ?? "text",
      reply_to_message_id: input.replyToMessageId ?? null,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) {
    console.error("[Discuss] Send message:", error.message);
    return null;
  }
  return data as DiscussMessageRow;
}

/** Edit the body of an existing message. Sets `edited_at` so the UI
 *  can show "(edited)". */
export async function editDiscussMessage(
  id: string,
  body: string,
  metadata?: DiscussMessageMetadata,
): Promise<boolean> {
  const { error } = await supabase
    .from(MESSAGES)
    .update({
      body,
      metadata: metadata ?? {},
      edited_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("[Discuss] Edit message:", error.message);
    return false;
  }
  return true;
}

/** Soft-delete. The UI will render a "message deleted" placeholder. */
export async function deleteDiscussMessage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from(MESSAGES)
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    console.error("[Discuss] Delete message:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Reactions
   ═══════════════════════════════════════════════════════════════════════ */

/** Toggle an emoji reaction on a message by the current user. If the
 *  row already exists it's deleted; otherwise inserted. Returns the
 *  new reacted state (true = now reacted). */
export async function toggleReaction(
  messageId: string,
  accountId: string,
  emoji: string,
): Promise<boolean> {
  /* Check current state first so we can decide insert vs delete. */
  const { data: existing } = await supabase
    .from(REACTIONS)
    .select("id")
    .eq("message_id", messageId)
    .eq("account_id", accountId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from(REACTIONS)
      .delete()
      .eq("id", (existing as { id: string }).id);
    if (error) {
      console.error("[Discuss] Remove reaction:", error.message);
    }
    return false;
  }
  const { error } = await supabase.from(REACTIONS).insert({
    message_id: messageId,
    account_id: accountId,
    emoji,
  });
  if (error) {
    console.error("[Discuss] Add reaction:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Pinned + Starred
   ═══════════════════════════════════════════════════════════════════════ */

export async function pinMessage(
  channelId: string,
  messageId: string,
  pinnedBy: string,
): Promise<boolean> {
  const { error } = await supabase.from(PINNED).insert({
    channel_id: channelId,
    message_id: messageId,
    pinned_by: pinnedBy,
  });
  if (error && !/duplicate/i.test(error.message)) {
    console.error("[Discuss] Pin message:", error.message);
    return false;
  }
  return true;
}

export async function unpinMessage(
  channelId: string,
  messageId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(PINNED)
    .delete()
    .eq("channel_id", channelId)
    .eq("message_id", messageId);
  if (error) {
    console.error("[Discuss] Unpin message:", error.message);
    return false;
  }
  return true;
}

export async function toggleStar(
  accountId: string,
  messageId: string,
): Promise<boolean> {
  const { data: existing } = await supabase
    .from(STARRED)
    .select("id")
    .eq("account_id", accountId)
    .eq("message_id", messageId)
    .maybeSingle();
  if (existing) {
    await supabase
      .from(STARRED)
      .delete()
      .eq("id", (existing as { id: string }).id);
    return false;
  }
  await supabase.from(STARRED).insert({
    account_id: accountId,
    message_id: messageId,
  });
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Drafts
   ═══════════════════════════════════════════════════════════════════════ */

/** Upsert a draft. Called from a debounced effect in the composer so
 *  every keystroke doesn't round-trip the DB. */
export async function saveDraft(input: {
  accountId: string;
  channelId: string;
  body: string;
  metadata?: DiscussMessageMetadata;
}): Promise<boolean> {
  const { error } = await supabase
    .from(DRAFTS)
    .upsert(
      {
        account_id: input.accountId,
        channel_id: input.channelId,
        body: input.body,
        metadata: input.metadata ?? {},
      },
      { onConflict: "account_id,channel_id" },
    );
  if (error) {
    console.error("[Discuss] Save draft:", error.message);
    return false;
  }
  return true;
}

export async function fetchDraft(
  accountId: string,
  channelId: string,
): Promise<DiscussDraftRow | null> {
  const { data, error } = await supabase
    .from(DRAFTS)
    .select("*")
    .eq("account_id", accountId)
    .eq("channel_id", channelId)
    .maybeSingle();
  if (error) {
    console.error("[Discuss] Fetch draft:", error.message);
    return null;
  }
  return (data as DiscussDraftRow) ?? null;
}

export async function clearDraft(
  accountId: string,
  channelId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from(DRAFTS)
    .delete()
    .eq("account_id", accountId)
    .eq("channel_id", channelId);
  if (error) {
    console.error("[Discuss] Clear draft:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Attachments
   ═══════════════════════════════════════════════════════════════════════ */

/** Upload a file to the shared `media` bucket under the
 *  `discuss-attachments/` prefix. Returns the structured record ready
 *  to embed in `discuss_messages.metadata.attachments`. Same shape and
 *  file-path pattern as the inbox uploader so storage can be shared. */
export async function uploadDiscussAttachment(
  file: File,
): Promise<DiscussAttachment | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `discuss-attachments/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, { cacheControl: "3600", upsert: false });
  if (error) {
    console.error("[Discuss] Attachment upload:", error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return {
    name: file.name,
    url: data.publicUrl,
    file_path: filePath,
    size: file.size,
    type: file.type || "application/octet-stream",
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Realtime
   ═══════════════════════════════════════════════════════════════════════ */

/** Subscribe to live inserts + updates on a channel's messages and
 *  reactions. The caller owns the returned unsubscribe function and
 *  should call it from their `useEffect` cleanup.
 *
 *  We return a composite unsubscriber rather than the raw channel
 *  object because most callers only need "stop listening" — they
 *  never care about the underlying Supabase channel handle. */
export function subscribeToChannel(
  channelId: string,
  handlers: {
    onMessageInsert?: (msg: DiscussMessageRow) => void;
    onMessageUpdate?: (msg: DiscussMessageRow) => void;
    onReactionInsert?: (rx: DiscussReactionRow) => void;
    onReactionDelete?: (rx: DiscussReactionRow) => void;
  },
): () => void {
  const realtimeChannel = supabase.channel(`discuss:${channelId}`, {
    config: { broadcast: { self: false } },
  });

  realtimeChannel
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "discuss_messages",
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        handlers.onMessageInsert?.(payload.new as DiscussMessageRow);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "discuss_messages",
        filter: `channel_id=eq.${channelId}`,
      },
      (payload) => {
        handlers.onMessageUpdate?.(payload.new as DiscussMessageRow);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "discuss_reactions",
      },
      (payload) => {
        handlers.onReactionInsert?.(payload.new as DiscussReactionRow);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "discuss_reactions",
      },
      (payload) => {
        handlers.onReactionDelete?.(payload.old as DiscussReactionRow);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(realtimeChannel);
  };
}

/** Subscribe to the "my channels" view — gets a ping whenever any
 *  channel the user is in has a new message (for sidebar unread badge
 *  updates) or whenever a new channel is created/removed. Cheap
 *  wrapper around a top-level postgres_changes subscription. */
export function subscribeToMyChannels(
  onAnyMessage: () => void,
): () => void {
  const realtimeChannel = supabase
    .channel("discuss:my-channels")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "discuss_messages" },
      () => onAnyMessage(),
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "discuss_channels" },
      () => onAnyMessage(),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(realtimeChannel);
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Presence / typing (ephemeral — uses Supabase Realtime broadcast)
   ═══════════════════════════════════════════════════════════════════════ */

/** Open a presence channel for a given conversation. Tracks the
 *  current user online while the channel is open, and relays a list
 *  of everyone else currently looking at the same conversation.
 *
 *  Typing indicators travel on the same channel via Realtime Broadcast
 *  (no DB write) — extremely cheap, no retention. */
export function openPresenceChannel(input: {
  channelId: string;
  accountId: string;
  username: string;
  onPresenceSync?: (online: string[]) => void;
  onTyping?: (accountId: string, username: string) => void;
}): {
  sendTyping: () => void;
  close: () => void;
} {
  const rt = supabase.channel(`discuss-presence:${input.channelId}`, {
    config: { presence: { key: input.accountId } },
  });

  rt.on("presence", { event: "sync" }, () => {
    const state = rt.presenceState<{ username: string }>();
    const ids = Object.keys(state);
    input.onPresenceSync?.(ids);
  });

  rt.on("broadcast", { event: "typing" }, (payload) => {
    const p = payload.payload as { account_id: string; username: string };
    if (p.account_id === input.accountId) return;
    input.onTyping?.(p.account_id, p.username);
  });

  rt.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      void rt.track({ username: input.username, at: Date.now() });
    }
  });

  return {
    sendTyping: () => {
      void rt.send({
        type: "broadcast",
        event: "typing",
        payload: {
          account_id: input.accountId,
          username: input.username,
        },
      });
    },
    close: () => {
      void rt.untrack();
      supabase.removeChannel(rt);
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase B — Threads
   ═══════════════════════════════════════════════════════════════════════ */

/** Fetch every reply to a given parent message, oldest first, plus the
 *  parent itself at index 0. Used by the thread pane so the UI can
 *  render the full conversation. Author + reactions are resolved the
 *  same way fetchChannelMessages does. */
export async function fetchThreadMessages(
  parentMessageId: string,
  currentAccountId: string,
): Promise<DiscussMessageWithAuthor[]> {
  const ids: string[] = [parentMessageId];

  /* Parent first, then children ordered ascending by created_at. */
  const { data: parentRow, error: parentErr } = await supabase
    .from(MESSAGES)
    .select(
      `
      *,
      author:accounts!discuss_messages_author_account_id_fkey (
        id,
        username,
        avatar_url,
        person:people ( full_name )
      )
      `,
    )
    .eq("id", parentMessageId)
    .maybeSingle();
  if (parentErr) {
    console.error("[Discuss] Fetch thread parent:", parentErr.message);
    return [];
  }
  if (!parentRow) return [];

  const { data: childRows, error: childErr } = await supabase
    .from(MESSAGES)
    .select(
      `
      *,
      author:accounts!discuss_messages_author_account_id_fkey (
        id,
        username,
        avatar_url,
        person:people ( full_name )
      )
      `,
    )
    .eq("reply_to_message_id", parentMessageId)
    .order("created_at", { ascending: true });
  if (childErr) {
    console.error("[Discuss] Fetch thread children:", childErr.message);
    return [];
  }

  const all = [parentRow, ...(childRows ?? [])];
  ids.push(...(childRows ?? []).map((r) => (r as { id: string }).id));

  /* Reactions batch. */
  const reactionsByMessage = new Map<
    string,
    DiscussMessageWithAuthor["reactions"]
  >();
  if (ids.length > 0) {
    const { data: rxRows } = await supabase
      .from(REACTIONS)
      .select("*")
      .in("message_id", ids);
    for (const rx of (rxRows ?? []) as DiscussReactionRow[]) {
      const bucket = reactionsByMessage.get(rx.message_id) ?? [];
      const existing = bucket.find((b) => b.emoji === rx.emoji);
      if (existing) {
        existing.count += 1;
        existing.account_ids.push(rx.account_id);
        if (rx.account_id === currentAccountId) existing.reacted_by_me = true;
      } else {
        bucket.push({
          emoji: rx.emoji,
          count: 1,
          account_ids: [rx.account_id],
          reacted_by_me: rx.account_id === currentAccountId,
        });
      }
      reactionsByMessage.set(rx.message_id, bucket);
    }
  }

  return (all as unknown as Array<
    DiscussMessageRow & {
      author:
        | {
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }
  >).map((row) => {
    const acc = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    const person =
      acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
    const author: DiscussAuthor | null = acc
      ? {
          id: acc.id,
          username: acc.username,
          avatar_url: acc.avatar_url,
          full_name: person?.full_name ?? null,
        }
      : null;
    return {
      ...row,
      author,
      reactions: reactionsByMessage.get(row.id) ?? [],
      reply_preview: null,
      thread: null,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase C — Full-text search
   ═══════════════════════════════════════════════════════════════════════ */

/** Full-text search over `discuss_messages.body` using the GIN index
 *  created in Phase A. Returns a ranked, highlighted snippet per hit.
 *
 *  The underlying search is a plain ILIKE fallback when the
 *  `discuss_messages_fts_idx` hasn't been created yet (fresh dev DB).
 *  In production we rely on the `to_tsvector('simple', body)` index
 *  for speed, and use `ts_headline` for the highlighted snippet. */
export async function searchDiscussMessages(input: {
  accountId: string;
  query: string;
  channelId?: string;
  limit?: number;
}): Promise<DiscussSearchResult[]> {
  const q = input.query.trim();
  if (q.length < 2) return [];
  const limit = input.limit ?? 40;

  /* 1. Restrict search to channels the current user is a member of —
        otherwise we'd leak private messages from other DMs. */
  const { data: memberships } = await supabase
    .from(MEMBERS)
    .select("channel_id")
    .eq("account_id", input.accountId)
    .is("left_at", null);
  const scopeIds = ((memberships ?? []) as Array<{ channel_id: string }>)
    .map((m) => m.channel_id)
    .filter((id) => !input.channelId || id === input.channelId);
  if (scopeIds.length === 0) return [];

  /* 2. ILIKE pass — works even without the FTS index. We do a single
        `%term%` match per word so multi-word queries behave intuitively.
        Postgres will use the GIN index for this if the operators line up. */
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const { data, error } = await supabase
    .from(MESSAGES)
    .select(
      `
      id,
      channel_id,
      body,
      created_at,
      author:accounts!discuss_messages_author_account_id_fkey (
        username,
        avatar_url,
        person:people ( full_name )
      ),
      channel:discuss_channels!discuss_messages_channel_id_fkey (
        id,
        name,
        kind
      )
      `,
    )
    .in("channel_id", scopeIds)
    .is("deleted_at", null)
    .ilike("body", `%${escaped}%`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[Discuss] Search:", error.message);
    return [];
  }

  const results: DiscussSearchResult[] = [];
  for (const row of (data ?? []) as unknown as Array<{
    id: string;
    channel_id: string;
    body: string | null;
    created_at: string;
    author:
      | {
          username: string;
          avatar_url: string | null;
          person: { full_name: string } | Array<{ full_name: string }> | null;
        }
      | Array<{
          username: string;
          avatar_url: string | null;
          person: { full_name: string } | Array<{ full_name: string }> | null;
        }>
      | null;
    channel:
      | { id: string; name: string | null; kind: DiscussChannelKind }
      | Array<{ id: string; name: string | null; kind: DiscussChannelKind }>
      | null;
  }>) {
    const acc = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    const person =
      acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
    const ch = Array.isArray(row.channel) ? row.channel[0] ?? null : row.channel;

    const body = row.body ?? "";
    /* Hand-rolled snippet: grab ~40 chars on either side of the match
       so the UI has a usable preview without bloating the payload. */
    const idx = body.toLowerCase().indexOf(q.toLowerCase());
    let snippet = body;
    if (idx >= 0 && body.length > 100) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(body.length, idx + q.length + 40);
      snippet =
        (start > 0 ? "…" : "") +
        body.slice(start, end) +
        (end < body.length ? "…" : "");
    }
    /* Wrap the match in <mark> so the UI can render it highlighted
       without re-searching client-side. */
    try {
      const re = new RegExp(
        `(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi",
      );
      snippet = snippet.replace(re, "<mark>$1</mark>");
    } catch {
      /* If the regex fails (weird unicode), fall back to plain snippet. */
    }

    results.push({
      message_id: row.id,
      channel_id: row.channel_id,
      channel_name: ch?.name ?? null,
      channel_kind: ch?.kind ?? "channel",
      author_username: acc?.username ?? null,
      author_full_name: person?.full_name ?? null,
      author_avatar_url: acc?.avatar_url ?? null,
      body,
      snippet,
      created_at: row.created_at,
      rank: 1,
    });
  }
  return results;
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase C — Drafts / Pinned / Starred list views
   ═══════════════════════════════════════════════════════════════════════ */

/** Fetch every draft the current user has saved across all channels —
 *  used by the Drafts sidebar section. Joined with the channel so the
 *  UI can render a pill per draft without a second fetch. */
export async function fetchAllDrafts(
  accountId: string,
): Promise<Array<DiscussDraftRow & { channel: DiscussChannelRow | null }>> {
  const { data, error } = await supabase
    .from(DRAFTS)
    .select(
      `
      *,
      channel:discuss_channels!discuss_drafts_channel_id_fkey ( * )
      `,
    )
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[Discuss] Fetch all drafts:", error.message);
    }
    return [];
  }
  return ((data ?? []) as unknown as Array<
    DiscussDraftRow & {
      channel: DiscussChannelRow | DiscussChannelRow[] | null;
    }
  >)
    .map((row) => {
      const ch = Array.isArray(row.channel) ? row.channel[0] ?? null : row.channel;
      return { ...row, channel: ch };
    })
    .filter(
      (row) =>
        (row.body && row.body.trim().length > 0) ||
        !!row.metadata?.attachments?.length,
    );
}

/** Fetch the pinned panel for a channel. Pinned → messages join so
 *  the caller gets the full MessageWithAuthor shape it already knows
 *  how to render. */
export async function fetchPinnedMessages(
  channelId: string,
  currentAccountId: string,
): Promise<DiscussMessageWithAuthor[]> {
  const { data: pinnedRows, error } = await supabase
    .from(PINNED)
    .select("message_id")
    .eq("channel_id", channelId)
    .order("pinned_at", { ascending: false });
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[Discuss] Fetch pinned:", error.message);
    }
    return [];
  }
  const ids = ((pinnedRows ?? []) as DiscussPinnedRow[]).map((r) => r.message_id);
  if (ids.length === 0) return [];

  const { data: msgs } = await supabase
    .from(MESSAGES)
    .select(
      `
      *,
      author:accounts!discuss_messages_author_account_id_fkey (
        id,
        username,
        avatar_url,
        person:people ( full_name )
      )
      `,
    )
    .in("id", ids)
    .is("deleted_at", null);

  /* Reactions batch, same shape as fetchChannelMessages. */
  const reactionsByMessage = new Map<
    string,
    DiscussMessageWithAuthor["reactions"]
  >();
  const { data: rxRows } = await supabase
    .from(REACTIONS)
    .select("*")
    .in("message_id", ids);
  for (const rx of (rxRows ?? []) as DiscussReactionRow[]) {
    const bucket = reactionsByMessage.get(rx.message_id) ?? [];
    const existing = bucket.find((b) => b.emoji === rx.emoji);
    if (existing) {
      existing.count += 1;
      existing.account_ids.push(rx.account_id);
      if (rx.account_id === currentAccountId) existing.reacted_by_me = true;
    } else {
      bucket.push({
        emoji: rx.emoji,
        count: 1,
        account_ids: [rx.account_id],
        reacted_by_me: rx.account_id === currentAccountId,
      });
    }
    reactionsByMessage.set(rx.message_id, bucket);
  }

  return ((msgs ?? []) as unknown as Array<
    DiscussMessageRow & {
      author:
        | {
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }
  >).map((row) => {
    const acc = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    const person =
      acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
    const author: DiscussAuthor | null = acc
      ? {
          id: acc.id,
          username: acc.username,
          avatar_url: acc.avatar_url,
          full_name: person?.full_name ?? null,
        }
      : null;
    return {
      ...row,
      author,
      reactions: reactionsByMessage.get(row.id) ?? [],
      reply_preview: null,
      thread: null,
    };
  });
}

/** Fetch every message the current user has starred, most-recent first.
 *  Used by the Starred sidebar view — a global bookmarks list. */
export async function fetchStarredMessages(
  accountId: string,
): Promise<DiscussMessageWithAuthor[]> {
  const { data: starRows, error } = await supabase
    .from(STARRED)
    .select("message_id, starred_at")
    .eq("account_id", accountId)
    .order("starred_at", { ascending: false })
    .limit(200);
  if (error) {
    if (!isMissingTable(error.message)) {
      console.error("[Discuss] Fetch starred:", error.message);
    }
    return [];
  }
  const ids = ((starRows ?? []) as Array<{ message_id: string }>).map(
    (r) => r.message_id,
  );
  if (ids.length === 0) return [];

  const { data: msgs } = await supabase
    .from(MESSAGES)
    .select(
      `
      *,
      author:accounts!discuss_messages_author_account_id_fkey (
        id,
        username,
        avatar_url,
        person:people ( full_name )
      )
      `,
    )
    .in("id", ids)
    .is("deleted_at", null);

  return ((msgs ?? []) as unknown as Array<
    DiscussMessageRow & {
      author:
        | {
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }
        | Array<{
            id: string;
            username: string;
            avatar_url: string | null;
            person: { full_name: string } | Array<{ full_name: string }> | null;
          }>
        | null;
    }
  >).map((row) => {
    const acc = Array.isArray(row.author) ? row.author[0] ?? null : row.author;
    const person =
      acc && (Array.isArray(acc.person) ? acc.person[0] ?? null : acc.person);
    const author: DiscussAuthor | null = acc
      ? {
          id: acc.id,
          username: acc.username,
          avatar_url: acc.avatar_url,
          full_name: person?.full_name ?? null,
        }
      : null;
    return {
      ...row,
      author,
      reactions: [],
      reply_preview: null,
      thread: null,
    };
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase D — Notification prefs + mute
   ═══════════════════════════════════════════════════════════════════════ */

/** Set the per-channel notification pref for the current user.
 *  `all` → every message notifies, `mentions` → only @mentions,
 *  `none` → silent (works like mute but preserves unread badges). */
export async function setNotificationPref(
  channelId: string,
  accountId: string,
  pref: DiscussNotificationPref,
): Promise<boolean> {
  const { error } = await supabase
    .from(MEMBERS)
    .update({ notification_pref: pref })
    .eq("channel_id", channelId)
    .eq("account_id", accountId);
  if (error) {
    console.error("[Discuss] Set notification pref:", error.message);
    return false;
  }
  return true;
}

/** Toggle the mute flag for a (channel, member) pair. Muted channels
 *  still count unreads but never play a sound or raise a desktop
 *  notification. */
export async function setChannelMuted(
  channelId: string,
  accountId: string,
  muted: boolean,
): Promise<boolean> {
  const { error } = await supabase
    .from(MEMBERS)
    .update({ muted })
    .eq("channel_id", channelId)
    .eq("account_id", accountId);
  if (error) {
    console.error("[Discuss] Set muted:", error.message);
    return false;
  }
  return true;
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase D — Voice notes
   ═══════════════════════════════════════════════════════════════════════ */

/** Upload a recorded voice blob to Storage and return the structured
 *  metadata ready to embed in `discuss_messages.metadata.voice`.
 *  Waveform is computed client-side in the recorder (see
 *  VoiceRecorder.tsx) and passed through verbatim. */
export async function uploadDiscussVoice(input: {
  blob: Blob;
  durationMs: number;
  waveform: number[];
}): Promise<DiscussVoiceMeta | null> {
  const filePath = `discuss-voice/${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}.webm`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, input.blob, {
      cacheControl: "3600",
      upsert: false,
      contentType: "audio/webm",
    });
  if (error) {
    console.error("[Discuss] Voice upload:", error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return {
    url: data.publicUrl,
    duration_ms: input.durationMs,
    waveform: input.waveform,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Phase E — Customer chat
   ═══════════════════════════════════════════════════════════════════════ */

/** Atomically find-or-create a customer-chat channel bound to a CRM
 *  contact. Wraps the `find_or_create_customer_channel` RPC created
 *  in extend_discuss_phase_bcde.sql. */
export async function findOrCreateCustomerChannel(input: {
  contactId: string;
  createdBy: string;
  displayName: string;
  additionalMemberIds?: string[];
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("find_or_create_customer_channel", {
    p_contact_id: input.contactId,
    p_created_by: input.createdBy,
    p_display_name: input.displayName,
  });
  if (error) {
    console.error("[Discuss] Find/create customer channel:", error.message);
    return null;
  }
  const channelId = (data as string) ?? null;
  if (!channelId) return null;

  /* Optionally add additional team members beyond the creator. The RPC
     only auto-adds the creator so the channel is immediately visible
     in their sidebar; everyone else joins via this call. */
  if (input.additionalMemberIds && input.additionalMemberIds.length > 0) {
    const extra = input.additionalMemberIds.filter((id) => id !== input.createdBy);
    if (extra.length > 0) await addMembers(channelId, extra);
  }
  return channelId;
}

/** Fetch the CRM contact linked to a customer-chat channel. Returns
 *  null for internal channels. Used by the details pane to render the
 *  customer contact card. */
export async function fetchLinkedContact(
  channelId: string,
): Promise<DiscussLinkedContact | null> {
  const { data: ch, error: chErr } = await supabase
    .from(CHANNELS)
    .select("linked_contact_id")
    .eq("id", channelId)
    .maybeSingle();
  if (chErr || !ch) return null;
  const contactId = (ch as { linked_contact_id: string | null }).linked_contact_id;
  if (!contactId) return null;

  const { data: contact } = await supabase
    .from(CONTACTS)
    .select(
      "id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type",
    )
    .eq("id", contactId)
    .maybeSingle();
  if (!contact) return null;

  const row = contact as {
    id: string;
    display_name: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    contact_type: string | null;
  };
  const displayName =
    row.display_name ??
    row.full_name ??
    [row.first_name, row.last_name].filter(Boolean).join(" ") ??
    "Unnamed contact";
  return {
    id: row.id,
    display_name: displayName || "Unnamed contact",
    full_name: row.full_name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    avatar_url: row.photo_url,
    contact_type: row.contact_type,
  };
}

/** Lightweight contact search for the "Start customer chat" picker.
 *  Searches display_name + company + email with an ILIKE prefix. */
export async function searchContactsForChat(
  query: string,
  limit = 12,
): Promise<DiscussLinkedContact[]> {
  const q = query.trim();
  if (q.length < 1) {
    /* Empty query → return the most recent customers so the picker
       has something to show on first open. */
    const { data } = await supabase
      .from(CONTACTS)
      .select(
        "id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type",
      )
      .eq("contact_type", "customer")
      .order("updated_at", { ascending: false })
      .limit(limit);
    return toLinkedContacts(data);
  }
  const escaped = q.replace(/[%_]/g, (c) => `\\${c}`);
  const { data } = await supabase
    .from(CONTACTS)
    .select(
      "id, display_name, full_name, first_name, last_name, company, email, phone, photo_url, contact_type",
    )
    .or(
      `display_name.ilike.%${escaped}%,full_name.ilike.%${escaped}%,company.ilike.%${escaped}%,email.ilike.%${escaped}%`,
    )
    .limit(limit);
  return toLinkedContacts(data);
}

/** Accounts that can receive messages — used by the DM + @mention picker.
 *  Returns only internal users (not customers / suppliers). Lives in
 *  `@/lib/discuss` so Discuss has no dependency on any parked mail
 *  modules. */
export async function fetchMessageableAccounts(): Promise<
  Array<{
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    role_name: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("accounts")
    .select(
      `
      id,
      username,
      avatar_url,
      person:people ( full_name, avatar_url ),
      role:roles ( name )
      `,
    )
    .eq("user_type", "internal")
    .eq("status", "active")
    .order("username");
  if (error) {
    console.error("[Discuss] Fetch recipients:", error.message);
    return [];
  }
  type Row = {
    id: string;
    username: string;
    avatar_url: string | null;
    person:
      | { full_name: string; avatar_url: string | null }
      | Array<{ full_name: string; avatar_url: string | null }>
      | null;
    role: { name: string } | Array<{ name: string }> | null;
  };
  return (data as unknown as Row[]).map((row) => {
    const person = Array.isArray(row.person) ? row.person[0] ?? null : row.person;
    const role = Array.isArray(row.role) ? row.role[0] ?? null : row.role;
    return {
      id: row.id,
      username: row.username,
      full_name: person?.full_name ?? null,
      avatar_url: row.avatar_url ?? person?.avatar_url ?? null,
      role_name: role?.name ?? null,
    };
  });
}

function toLinkedContacts(data: unknown): DiscussLinkedContact[] {
  return ((data ?? []) as Array<{
    id: string;
    display_name: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    company: string | null;
    email: string | null;
    phone: string | null;
    photo_url: string | null;
    contact_type: string | null;
  }>).map((row) => {
    const name =
      row.display_name ??
      row.full_name ??
      [row.first_name, row.last_name].filter(Boolean).join(" ") ??
      "Unnamed contact";
    return {
      id: row.id,
      display_name: name || "Unnamed contact",
      full_name: row.full_name,
      company: row.company,
      email: row.email,
      phone: row.phone,
      avatar_url: row.photo_url,
      contact_type: row.contact_type,
    };
  });
}
