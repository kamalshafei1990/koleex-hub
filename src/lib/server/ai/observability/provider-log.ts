import "server-only";

/* ---------------------------------------------------------------------------
   provider-log — what a provider's failure may say in OUR log.

   An OpenAI-compatible 400 body quotes the offending message, which is the
   user's own words, and a vision failure quotes the question asked of the
   picture. Printing bodies verbatim put prompts into the platform log by
   accident (audit, 2026-09-11). The log gets the status and a CLASS of
   failure — enough to act on — and the body only under the same opt-in that
   dumps replies (AI_DEBUG_REPLIES=true).
   --------------------------------------------------------------------------- */

/** One word for what the body says, derived from its error type/code when it
 *  has one and from a few stable phrases when it does not. Never the text. */
export function classifyProviderBody(body: string): string {
  if (!body.trim()) return "empty";
  try {
    const j = JSON.parse(body) as { error?: { type?: string; code?: string | number; message?: string } | string; message?: string };
    const e = typeof j.error === "string" ? { message: j.error } : j.error ?? { message: j.message };
    const type = e?.type ?? e?.code;
    if (type !== undefined && type !== null && String(type).trim()) return String(type).replace(/[^\w.-]/g, "_").slice(0, 40);
    const m = e?.message ?? "";
    if (/rate|too many/i.test(m)) return "rate_limited";
    if (/balance|quota|billing|insufficient|credit/i.test(m)) return "quota";
    if (/auth|api key|unauthori[sz]ed|forbidden/i.test(m)) return "auth";
    if (/context|too long|maximum|length/i.test(m)) return "too_long";
    if (/model/i.test(m)) return "model";
    return m ? "error" : "empty";
  } catch {
    return "non_json";
  }
}

/** The one place a provider failure is logged. */
export function logProviderFailure(tag: string, status: number, body: string): void {
  console.error(`${tag} status=${status} why=${classifyProviderBody(body)} bytes=${body.length}`);
  if (process.env.AI_DEBUG_REPLIES === "true") console.error(`${tag} body=${body.slice(0, 500)}`);
}
