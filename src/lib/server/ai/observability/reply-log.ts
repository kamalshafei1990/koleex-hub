import "server-only";

/* ---------------------------------------------------------------------------
   observability/reply-log — safe logging for the seal chain.

   THE PROBLEM THIS SOLVES (audit Issue 3, P0)
   -------------------------------------------
   orchestrate() logged the COMPLETE assistant reply twice per turn, at 14
   call sites:

       console.warn("[ai.agent.final.before]", finalReply);
       console.warn("[ai.agent.final.after]",  safeReply);

   That is customer names, quotation totals, margins, task contents and the
   full text of any user-attached document, written unredacted and untenanted
   into the platform log stream — retained by the host, readable by anyone
   with log access. For an ERP carrying commercial terms and supplier
   relationships that is a data-handling problem regardless of key safety.

   WHY NOT JUST DELETE THE LOGS
   ----------------------------
   They earn their place: they are how an operator answers "did a seal rewrite
   this reply, and which one?" — the question behind several of the incidents
   the seals exist for. Deleting them would trade a privacy problem for a
   blindness problem.

   WHAT THIS DOES INSTEAD
   ----------------------
   Logs the SHAPE of the transformation, not its content:

       [ai.agent.seal] changed=1 before=1284b/9f3a2c11 after=132b/4d81e0aa

   · `changed` answers the diagnostic question directly — better than two
     dumps a human had to diff by eye.
   · lengths catch truncation and runaway generation.
   · the short hash lets two log lines be correlated (same reply seen twice)
     WITHOUT carrying the text. It is a fingerprint, not a recoverable value.

   Full text returns only under an explicit opt-in, off in production:

       AI_DEBUG_REPLIES=true

   The flag is read per call rather than cached at module load so it can be
   flipped on a running deployment without a rebuild.
   --------------------------------------------------------------------------- */

import { createHash } from "node:crypto";

/** Short, non-reversible fingerprint. 8 hex chars is ample to correlate two
 *  lines within one request and far too little to reconstruct anything. */
function fingerprint(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 8);
}

function debugEnabled(): boolean {
  return process.env.AI_DEBUG_REPLIES === "true";
}

/**
 * Log what the seal chain did to a reply, without logging the reply.
 *
 * @param before the model's text on the way in
 * @param after  the sealed text on the way out
 * @param label  optional call-site marker (e.g. "fast", "rescue", "fallback")
 */
export function logSealTransform(before: string, after: string, label?: string): void {
  const changed = before !== after;
  const tag = label ? ` at=${label}` : "";
  console.warn(
    `[ai.agent.seal]${tag} changed=${changed ? 1 : 0}` +
      ` before=${before.length}b/${fingerprint(before)}` +
      ` after=${after.length}b/${fingerprint(after)}`,
  );

  /* Opt-in only. Never on by default, never on in production unless an
     operator has deliberately turned it on for a debugging window. */
  if (debugEnabled()) {
    console.warn("[ai.agent.seal.debug.before]", before);
    console.warn("[ai.agent.seal.debug.after]", after);
  }
}
