import "server-only";

/* ---------------------------------------------------------------------------
   ai/prompt-builder — builds the system + user messages for each task mode.
   Different prompts per mode; the router picks which one to use.

   Kept as pure functions for trivial testability. No side effects.
   --------------------------------------------------------------------------- */

import type { AiContext, AiMessage } from "./types";

const LANG_NAME: Record<string, string> = {
  en: "English",
  zh: "Chinese (Simplified)",
  ar: "Arabic",
};

/** Chat mode — short, friendly, helpful. Use for greetings, identity
 *  questions, UI help, general info lookups the model can answer
 *  without business data. */
export function buildChatPrompt(
  userMsg: string,
  ctx: AiContext = {},
): AiMessage[] {
  const lang = LANG_NAME[ctx.userLang ?? "en"] ?? "English";
  const whoAmI = ctx.username ? ` The current user is ${ctx.username}.` : "";
  return [
    {
      role: "system",
      content:
        `You are Koleex AI, the in-app assistant for Koleex Hub (a multilingual ERP).${whoAmI}` +
        ` Reply in ${lang}. Keep answers short, friendly, and direct.` +
        ` Use bullet points when helpful.` +
        ` Never invent data about customers, invoices, inventory, pricing, or any records —` +
        ` if the user asks for specifics you can't see, suggest they open the relevant app in the hub.`,
    },
    { role: "user", content: userMsg },
  ];
}

/** Business mode — structured reasoning, anti-hallucination, permission-aware.
 *  Use for quotations, pricing, margin/commission math, approvals, credit, anything
 *  that drives a commercial decision. */
export function buildBusinessPrompt(
  userMsg: string,
  ctx: AiContext = {},
): AiMessage[] {
  const lang = LANG_NAME[ctx.userLang ?? "en"] ?? "English";
  const whoAmI = ctx.username ? ` The current user is ${ctx.username}.` : "";

  /* Cost-visibility redirect — the exact string the spec requires when
     the user's role cannot see KOLEEX cost. The prompt tells the model
     to deflect neutrally instead of saying "you are not allowed". */
  const costRule =
    ctx.canSeeCost === false
      ? ` When the user asks about KOLEEX cost, internal margin, or other` +
        ` restricted numbers, reply with exactly:` +
        ` "I can help with approved commercial pricing, product details, and quotation-related information."` +
        ` Do not reveal the figure and do not tell them they are unauthorised.`
      : "";

  return [
    {
      role: "system",
      content:
        `You are Koleex AI's business reasoning assistant for Koleex Hub.${whoAmI}` +
        ` Reply in ${lang}. Structure answers as short bullet points or numbered steps.` +
        ` HARD RULES — never break these:` +
        ` (1) Do NOT generate any pricing, cost, margin, discount, commission, credit-limit,` +
        ` or quotation value unless the exact number is present in the context provided to you.` +
        ` No estimates, no "approximately", no "should be around" — if the number isn't given,` +
        ` say you need it and name what you need.` +
        ` (2) Do NOT fabricate customer names, product codes, order numbers, invoice numbers,` +
        ` supplier names, or any identifier.` +
        ` (3) If a required detail is missing (customer, product, quantity, market, destination` +
        ` country, currency, payment terms), ASK for it before answering — never guess.` +
        ` (4) Margins, multipliers, band adjustments, discount caps, approval thresholds, and` +
        ` commission rates live in the Commercial Policy. Cite them only when they appear in` +
        ` the context above; otherwise direct the user to open the Commercial Policy app.` +
        `${costRule}`,
    },
    { role: "user", content: userMsg },
  ];
}
