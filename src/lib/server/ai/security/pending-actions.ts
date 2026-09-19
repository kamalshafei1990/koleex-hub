import "server-only";

/* ---------------------------------------------------------------------------
   security/pending-actions — server-enforced write confirmation.

   THE PROBLEM THIS SOLVES (audit Issue 1, P0)
   -------------------------------------------
   Fifteen write tools implement a two-phase preview/confirm pattern:

       if (args.confirm !== true) { return preview }   // tools/todos.ts

   but NOTHING on the server verified a preview ever happened. `preToolGuard`
   never inspected `confirm`; `dispatchTool` never inspected `confirm`; and
   `pendingAction` — which 15 tools return — was read by nothing at all.

   So a model emitting `deleteTodo({task_id, confirm:true})` on its FIRST call
   deleted the task, with no preview and no user consent. The rule against it
   lived only in the system prompt. Six tools delete permanently.

   It is also what made prompt injection consequential: injected text in an
   uploaded document cannot read data it lacks permission for, but it could
   trigger a write the user is entitled to make.

   HOW IT WORKS
   ------------
   No tool changes. The 15 tools already return `pendingAction` on their
   preview — that dead metadata becomes the mechanism:

     turn 1  tool returns approval_required + pendingAction
             → dispatchTool records a row keyed by
               (conversation, tool, sha256(normalized args))
     turn 2  model sends confirm:true
             → dispatchTool must find and atomically consume a matching
               UNEXPIRED pending row, or the call is denied

   The model cannot authorise itself, because it cannot fabricate a row it did
   not cause to be written. A confirm for DIFFERENT arguments hashes
   differently and is correctly refused — a changed action needs a new preview.

   MODES (`AI_CONFIRM_LEDGER`)
   ---------------------------
     enforce  (default) — unmatched confirms are denied
     observe            — logged but allowed; for watching real traffic before
                          enforcing, mirroring this repo's AUTH_RATELIMIT
                          precedent
     off                — disabled entirely; emergency rollback

   Default is `enforce`, not `observe`. A mismatched confirm costs the user a
   retry; an unverified one can delete a record permanently. For a destructive
   action that trade is not close.
   --------------------------------------------------------------------------- */

import { skillMeta } from "@/lib/server/ai/skills/catalog";
import { createHash } from "node:crypto";
import { supabaseServer } from "../../supabase-server";
import type { UserContext } from "../../ai-agent/types";

export type LedgerMode = "enforce" | "observe" | "off";

export function ledgerMode(): LedgerMode {
  const v = (process.env.AI_CONFIRM_LEDGER ?? "enforce").toLowerCase();
  return v === "off" || v === "observe" ? v : "enforce";
}

/** Canonical form: `confirm` removed, keys sorted recursively. The same intent
 *  must hash identically whichever order the model emits its arguments in. */
export function normalizeArgs(args: Record<string, unknown>): unknown {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        if (k === "confirm") continue;
        out[k] = norm((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return norm(args);
}

export function hashArgs(args: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(normalizeArgs(args))).digest("hex");
}

/** Risk class for the agent safety matrix.
 *
 *  PHASE 6A. This used to infer the class from the tool's NAME, which was the
 *  right place to start and cannot express §L: `search_web` came out as
 *  "high_risk_write" rather than an external side effect, `remember_about_user`
 *  — reversible and self-scoped — came out the same, and a future
 *  `archiveCustomer` would come out as a write rather than destructive. The
 *  class is a property of what a tool DOES; its name is a coincidence.
 *
 *  The declared catalogue is authoritative now. The old inference survives as
 *  the fallback for an UNDECLARED tool, and it is kept precisely because its
 *  default is the strict one: an unknown tool is treated as a high-risk write,
 *  never as harmless. validate:ai-skills fails the build before that path can
 *  be reached in practice — this is the belt behind the braces, not the
 *  mechanism. */
export function riskClassFor(toolName: string, requiredAction?: string): string {
  const declared = skillMeta(toolName);
  if (declared) return declared.risk;
  /* Undeclared: fall back to the strict inference rather than guessing low. */
  if (requiredAction === "delete" || /^delete/i.test(toolName)) return "destructive";
  if (/quotation|invoice|price/i.test(toolName)) return "financial";
  return "high_risk_write";
}

/** Record a preview. Best-effort: a ledger write failure must not break the
 *  user's turn — it only means the follow-up confirm will not match, which
 *  fails CLOSED (denied), never open. */
export async function recordPendingAction(opts: {
  ctx: UserContext;
  conversationId: string | null;
  toolName: string;
  args: Record<string, unknown>;
  preview: unknown;
  riskClass: string;
}): Promise<void> {
  try {
    await supabaseServer.from("ai_pending_actions").insert({
      tenant_id: opts.ctx.auth.tenant_id,
      account_id: opts.ctx.auth.account_id,
      conversation_id: opts.conversationId,
      tool_name: opts.toolName,
      normalized_args: normalizeArgs(opts.args) as object,
      args_hash: hashArgs(opts.args),
      preview_payload: (opts.preview ?? null) as object,
      risk_class: opts.riskClass,
    });
  } catch (e) {
    console.error("[ai.ledger.record]", e instanceof Error ? e.message : String(e));
  }
}

export type ConsumeResult =
  | { matched: true }
  | { matched: false; reason: "no_match" | "error" };

/**
 * Atomically consume a matching pending action.
 *
 * The UPDATE ... WHERE status='pending' AND expires_at > now() RETURNING is the
 * whole safety property: it is a single statement, so two concurrent confirms
 * for the same preview cannot both succeed — exactly one flips the row.
 */
export async function consumePendingAction(opts: {
  ctx: UserContext;
  conversationId: string | null;
  toolName: string;
  args: Record<string, unknown>;
}): Promise<ConsumeResult> {
  try {
    const hash = hashArgs(opts.args);
    let q = supabaseServer
      .from("ai_pending_actions")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .eq("tenant_id", opts.ctx.auth.tenant_id)
      .eq("account_id", opts.ctx.auth.account_id)
      .eq("tool_name", opts.toolName)
      .eq("args_hash", hash);

    /* A conversation-less call (should not happen from the agent route) must
       not match rows from every conversation. */
    q = opts.conversationId
      ? q.eq("conversation_id", opts.conversationId)
      : q.is("conversation_id", null);

    const { data, error } = await q.select("id").limit(1);
    if (error) {
      console.error("[ai.ledger.consume]", error.message);
      return { matched: false, reason: "error" };
    }
    return data && data.length > 0 ? { matched: true } : { matched: false, reason: "no_match" };
  } catch (e) {
    console.error("[ai.ledger.consume]", e instanceof Error ? e.message : String(e));
    return { matched: false, reason: "error" };
  }
}

/** Message returned when a confirm has no matching preview. Written for the
 *  MODEL — it must ask again rather than insisting, and must not claim the
 *  action happened. */
export const UNCONFIRMED_MESSAGE =
  "That action was not carried out: no confirmed preview matches it. " +
  "Show the user what will happen and get their explicit agreement first, " +
  "then try again. Do not tell them it is done.";
