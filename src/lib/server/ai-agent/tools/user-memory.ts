import "server-only";

/* ---------------------------------------------------------------------------
   user-memory — let the agent remember what the USER tells it about
   themselves, so it stops asking the same question every conversation.

   Scope, deliberately narrow:
     · facts the signed-in user volunteers ABOUT THEMSELVES (birthday,
       how they like answers, what they are working on);
     · stored on their OWN account row, in preferences.ai_memory;
     · never about anyone else, and never company data — those stay behind
       the permission layer, unchanged by this file.

   Stored in the existing accounts.preferences JSONB rather than a new
   table: it is per-account by definition, tiny, and needs no migration.
   --------------------------------------------------------------------------- */

import { mergeAccountPrefs } from "@/lib/server/ai/security/account-prefs";
import type { ToolDef, ToolResult } from "../types";
import { supabaseServer } from "../../supabase-server";

const MAX_FACTS = 25;
const MAX_KEY = 40;
const MAX_VALUE = 200;

const rememberAboutUser: ToolDef<
  { key: string; value: string },
  { remembered: Record<string, string> }
> = {
  name: "remember_about_user",
  description:
    "Save a fact the CURRENT user just told you about themselves so you still know it in later conversations (e.g. birthday, preferred answer style, what they are working on, their phone). Only call this after they actually tell you — never guess, and never store facts about other people or company data. Use a short snake_case key like 'birthday' or 'prefers'.",
  parameters: {
    type: "object",
    properties: {
      key: { type: "string", description: "Short snake_case label, e.g. birthday, prefers, focus." },
      value: { type: "string", description: "What to remember, in the user's own words. Keep it short." },
    },
    required: ["key", "value"],
  },
  /* No module gate: this writes to the caller's OWN account preferences.
     Every signed-in user may record their own facts, and the handler can
     only ever touch ctx.auth.account_id. */
  requiredModule: undefined,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<{ remembered: Record<string, string> }>> => {
    /* A super admin "viewing as" someone else must not write into that
       person's memory — the whole point of view-as is read-only. */
    if (ctx.auth.viewing_as) {
      return { ok: false, permissionStatus: "denied", data: null,
        message: "Not while viewing as another user." };
    }

    const key = String(args.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, MAX_KEY);
    const value = String(args.value ?? "").trim().slice(0, MAX_VALUE);
    if (!key || !value) {
      return { ok: false, permissionStatus: "denied", data: null,
        message: "Both a key and a value are required." };
    }

    /* PHASE 7 / finding N12. This still READS the current facts, because the
       25-cap needs to know what is already there — but it no longer writes the
       whole preferences document back. The write is one atomic merge of the
       `ai_memory` key alone, so a concurrent setReplyLanguage can no longer be
       erased by it (or erase it).

       A narrower race remains and is worth naming rather than implying it is
       gone: two remember_about_user calls landing together can still lose one
       fact, because the cap is computed from a read. That needs one row per
       fact — the `ai_memories` table in plan §S — and it is far less reachable
       than the one this fixes, which a single message could trigger. */
    const { data, error } = await supabaseServer
      .from("accounts").select("preferences").eq("id", ctx.auth.account_id).maybeSingle();
    if (error) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't read your profile." };
    }

    const prefs = ((data?.preferences ?? {}) as Record<string, unknown>);
    const current = (prefs.ai_memory ?? {}) as Record<string, string>;
    const next: Record<string, string> = { ...current, [key]: value };

    /* Cap the store so a long-running chat can't grow it without bound;
       drop the oldest keys first (insertion order is preserved by JSON). */
    const keys = Object.keys(next);
    if (keys.length > MAX_FACTS) {
      for (const k of keys.slice(0, keys.length - MAX_FACTS)) delete next[k];
    }

    const merged = await mergeAccountPrefs(ctx.auth.account_id, { ai_memory: next });
    if (!merged) {
      return { ok: false, permissionStatus: "denied", data: null, message: "Couldn't save that." };
    }

    return { ok: true, permissionStatus: "allowed", data: { remembered: next } };
  },
};

const forgetAboutUser: ToolDef<{ key: string }, { remembered: Record<string, string> }> = {
  name: "forget_about_user",
  description:
    "Forget a fact previously saved about the current user, when they ask you to (e.g. 'forget my birthday').",
  parameters: {
    type: "object",
    properties: { key: { type: "string", description: "The key to remove." } },
    required: ["key"],
  },
  requiredModule: undefined,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<{ remembered: Record<string, string> }>> => {
    if (ctx.auth.viewing_as) {
      return { ok: false, permissionStatus: "denied", data: null,
        message: "Not while viewing as another user." };
    }
    const key = String(args.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const { data } = await supabaseServer
      .from("accounts").select("preferences").eq("id", ctx.auth.account_id).maybeSingle();
    const prefs = ((data?.preferences ?? {}) as Record<string, unknown>);
    const next = { ...((prefs.ai_memory ?? {}) as Record<string, string>) };
    delete next[key];
    /* The merge is SHALLOW at the top level, which is what makes removal work:
       writing a smaller ai_memory object REPLACES the old one rather than
       deep-merging the deleted key back in. Verified on staging. */
    await mergeAccountPrefs(ctx.auth.account_id, { ai_memory: next });
    return { ok: true, permissionStatus: "allowed", data: { remembered: next } };
  },
};

export const userMemoryTools: ToolDef[] = [
  rememberAboutUser as unknown as ToolDef,
  forgetAboutUser as unknown as ToolDef,
];
