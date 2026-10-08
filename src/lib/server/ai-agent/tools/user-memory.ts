import "server-only";

/* ---------------------------------------------------------------------------
   user-memory — let the agent remember what the USER tells it about
   themselves, so it stops asking the same question every conversation.

   Scope, deliberately narrow:
     · facts the signed-in user volunteers ABOUT THEMSELVES (birthday,
       how they like answers, what they are working on);
     · stored on their OWN account, one row per fact in ai_memories;
     · never about anyone else, and never company data — those stay behind
       the permission layer, unchanged by this file.

   2026-10-07: moved off accounts.preferences.ai_memory to the ai_memories
   table. The JSON store capped facts by read-modify-write, so two saves
   landing together could lose one; the table's UPSERT is atomic and the cap
   is one statement (ai_memories_cap). The preferences key is no longer read
   here — the migration carried its facts over.
   --------------------------------------------------------------------------- */

import { readPersonalization } from "@/lib/server/ai/personalization-prompt";
import {
  MEMORY_MAX_KEY,
  MEMORY_MAX_VALUE,
  readMemories,
  rememberFact,
  forgetFact,
} from "@/lib/server/ai/user-memory-store";
import type { ToolDef, ToolResult } from "../types";
import { supabaseServer } from "../../supabase-server";

const rememberAboutUser: ToolDef<
  { key: string; value: string },
  { remembered: Record<string, string> }
> = {
  name: "remember_about_user",
  description:
    "Save a fact the CURRENT user told you about themselves so you still know it in later conversations (e.g. mother's name, birthday, preferred answer style, what they are working on, their phone). Call this PROACTIVELY the moment they volunteer a personal fact — do not wait for them to ask you to remember, and do not interrupt the reply to announce it. Never guess, and never store facts about other people or company data. Use a short snake_case key like 'mother_name' or 'prefers'.",
  parameters: {
    type: "object",
    properties: {
      key: { type: "string", description: "Short snake_case label, e.g. birthday, prefers, focus." },
      value: { type: "string", description: "What to remember, in the user's own words. Keep it short." },
    },
    required: ["key", "value"],
  },
  /* No module gate: this writes to the caller's OWN account. Every signed-in
     user may record their own facts, and the handler can only ever touch
     ctx.auth.account_id. */
  requiredModule: undefined,
  requiredAction: "edit",
  handler: async (ctx, args): Promise<ToolResult<{ remembered: Record<string, string> }>> => {
    /* A super admin "viewing as" someone else must not write into that
       person's memory — the whole point of view-as is read-only. */
    if (ctx.auth.viewing_as) {
      return { ok: false, permissionStatus: "denied", data: null,
        message: "Not while viewing as another user." };
    }

    const key = String(args.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").slice(0, MEMORY_MAX_KEY);
    const value = String(args.value ?? "").trim().slice(0, MEMORY_MAX_VALUE);
    if (!key || !value) {
      return { ok: false, permissionStatus: "allowed", data: null,
        message: "Both a key and a value are required." };
    }

    /* Memory switched off in Settings → Koleex AI: nothing is stored, and
       the user is told where the switch is rather than left believing the
       fact was kept. Existing facts are untouched — off means "do not
       read or write", not "erase"; erasing is its own button.
       One small read of the account row for the switch; the facts themselves
       live in ai_memories now. */
    const { data } = await supabaseServer
      .from("accounts").select("preferences").eq("id", ctx.auth.account_id).maybeSingle();
    if (!readPersonalization((data?.preferences ?? {}) as Record<string, unknown>).memory) {
      return { ok: false, permissionStatus: "allowed", data: null,
        message: "Memory is turned off in Settings → Koleex AI, so this was not saved. Tell the user they can turn it on there." };
    }

    const ok = await rememberFact(ctx.auth.account_id, key, value);
    if (!ok) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "Couldn't save that." };
    }
    return { ok: true, permissionStatus: "allowed",
      data: { remembered: await readMemories(ctx.auth.account_id) } };
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
    await forgetFact(ctx.auth.account_id, key);
    return { ok: true, permissionStatus: "allowed",
      data: { remembered: await readMemories(ctx.auth.account_id) } };
  },
};

export const userMemoryTools: ToolDef[] = [
  rememberAboutUser as unknown as ToolDef,
  forgetAboutUser as unknown as ToolDef,
];
