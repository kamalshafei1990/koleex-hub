import "server-only";

/* ---------------------------------------------------------------------------
   ask-user — the tool that lets Koleex AI stop and ASK instead of guessing.

   Owner, 2026-08-22: when the assistant is unsure it should come back with a
   short question and a few answers to pick from — with a recommendation when
   it has one — and a way to say "none of those, here is the real answer",
   rather than acting on a guess.

   WHY A TOOL AND NOT A PROMPT INSTRUCTION. "Ask if unsure" in the prompt
   produces a paragraph of hedging that the user has to read and reply to in
   prose. A tool produces STRUCTURE: the UI can render real buttons, one tap
   answers, and the answer comes back as a normal message that the agent
   continues from. It also gives the turn a definite end — the orchestrator
   breaks the tool loop on this result, so the model cannot ask a question and
   then answer it itself in the same breath.

   THE DANGER IS OVERUSE, not underuse. An assistant that checks before every
   step is worse than one that occasionally guesses wrong, because it moves
   the work back onto the person who asked. The description below is written
   to be read by the model as a narrow licence, and the prompt rule that
   accompanies it says the same thing from the other side.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { supabaseServer } from "../../supabase-server";
import { mainPhotoByProduct } from "../../product-photos";

export interface AskUserOption {
  /** Short, tappable. What the user is choosing. */
  label: string;
  /** Optional one-line consequence — what happens if they pick it. */
  detail?: string;
  /** At most one. The model's own pick when it leans one way. */
  recommended?: boolean;
  /** A Koleex product/model code the option stands for. INPUT ONLY. */
  product_code?: string;
  /** Resolved HERE from product_code — never accepted from the model. */
  photo_url?: string;
}

export interface AskUserPayload {
  question: string;
  options: AskUserOption[];
  /* The language the question is written in, so the card can label itself
     ("Recommended", "Something else") to match the answer rather than the
     UI chrome — the owner writes to Koleex AI in Arabic while his Hub is
     set to English, and an Arabic card with an English badge reads wrong. */
  lang: "ar" | "zh" | "en";
}

/* Same one-line guard products.ts and customers.ts each keep locally —
   PostgREST reads commas and parens as structural syntax, so a code with
   either in it builds an invalid URL and throws. */
function safeLike(input: string, maxLen = 80): string {
  return input.replace(/[,()*%\\]/g, " ").trim().slice(0, maxLen);
}

/* Which language the question is written in. The model writes the question
   in the USER's language, so the card's own labels should follow the question,
   not the Hub's UI setting. Script detection, not a language model: an Arabic
   letter means Arabic, a CJK ideograph means Chinese. */
function detectLang(text: string): "ar" | "zh" | "en" {
  if (/[\u0600-\u06FF]/.test(text)) return "ar";
  if (/[\u4E00-\u9FFF]/.test(text)) return "zh";
  return "en";
}

/* Turn the model's product CODES into real photo URLs. The model never hands
   over a URL — it names a code, and the address is looked up here, so a
   hallucinated link cannot reach the card. Resolution mirrors
   getProductByCode: product slug/name first, then any model code. */
async function attachPhotos(options: AskUserOption[]): Promise<void> {
  const coded = options.filter((o) => o.product_code);
  if (coded.length === 0) return;

  const byOption = await Promise.all(
    coded.map(async (o) => {
      const code = safeLike(String(o.product_code));
      if (!code) return null;
      const { data: pHit } = await supabaseServer
        .from("products")
        .select("id")
        .or(`slug.ilike.%${code}%,product_name.ilike.%${code}%`)
        .limit(1)
        .maybeSingle();
      if (pHit) return String(pHit.id);
      const { data: mHit } = await supabaseServer
        .from("product_models")
        .select("product_id")
        .or(`primary_model.ilike.%${code}%,model_name.ilike.%${code}%,reference_model.ilike.%${code}%`)
        .limit(1)
        .maybeSingle();
      return mHit ? String(mHit.product_id) : null;
    }),
  );

  const ids = byOption.filter((v): v is string => !!v);
  if (ids.length === 0) return;
  const photos = await mainPhotoByProduct(ids);
  coded.forEach((o, i) => {
    const id = byOption[i];
    /* No photo on file is normal, not an error — the row simply renders
       without one, exactly as it did before this existed. */
    if (id && photos[id]) o.photo_url = photos[id];
  });
}

const askUser: ToolDef<Record<string, unknown>, AskUserPayload> = {
  name: "askUser",
  description:
    "Ask the user a CLOSED question — one whose sensible answers are a short knowable list — and let them tap the answer instead of typing it. " +
    "Call this whenever you were about to write a sentence offering the user a choice: \"which one did you mean\", \"would you like A or B\", \"should I use X or Y\". If your reply would contain two or more alternatives for them to pick between, it belongs here instead. " +
    "Typical: several products/customers/suppliers match what they said; which market or currency to price in; which language to draft in; whether to include cost figures; which of two machines to compare; which project a task belongs to. " +
    "When an option stands for a real Koleex product or model, set product_code to its code — the card shows that product's photo, which makes machines far easier to tell apart than names alone. " +
    "Mark ONE option as recommended when you have a reasoned preference. The user can always ignore the options and type their own answer, so never add an 'other' option yourself. " +
    "DO NOT use it for anything you can look up with another tool, for confirmation of something already clear from the conversation, or before ordinary read-only answers — asking when you could simply answer wastes the user's time and is worse than a wrong guess you can correct. " +
    "After calling it, say nothing else: the turn ends with your question and the user replies next.",
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question, one sentence, in the user's language.",
      },
      options: {
        type: "array",
        description: "2 to 4 distinct choices.",
        items: {
          type: "object",
          properties: {
            label: { type: "string", description: "Short choice text (1-6 words)." },
            detail: { type: "string", description: "Optional one line on what this choice means." },
            recommended: { type: "boolean", description: "True on at most ONE option." },
            product_code: {
              type: "string",
              description:
                "When the option IS a Koleex product or model, its code (e.g. XF-A10). The card then shows that product's real photo. Give the code only — never a URL, and never guess a code you have not seen in a tool result.",
            },
          },
          required: ["label"],
        },
      },
    },
    required: ["question", "options"],
  },
  /* No module: it reads nothing and writes nothing — it addresses the person
     already in the conversation. The bar is expressed as a role tier instead,
     because `requiredModule: undefined` alone means UNGATED, and that is how
     the knowledge tool ended up open to everyone. */
  requiredModule: undefined,
  requiredAction: "view",
  minRole: "internal",
  handler: async (_ctx, args): Promise<ToolResult<AskUserPayload>> => {
    const question = String(args.question ?? "").trim();
    const raw = Array.isArray(args.options) ? args.options : [];
    /* Normalised HERE, not trusted from the model: a malformed options array
       would otherwise reach the UI and render an empty or broken card. */
    const options: AskUserOption[] = raw
      .map((o) => ({
        label: String((o as AskUserOption)?.label ?? "").trim().slice(0, 60),
        detail: (o as AskUserOption)?.detail
          ? String((o as AskUserOption).detail).trim().slice(0, 120)
          : undefined,
        recommended: (o as AskUserOption)?.recommended === true,
        product_code: (o as AskUserOption)?.product_code
          ? String((o as AskUserOption).product_code).trim().slice(0, 40)
          : undefined,
        /* photo_url is deliberately NOT read from the model's arguments —
           it is set below from a real lookup or not at all. */
      }))
      .filter((o) => o.label.length > 0)
      .slice(0, 4);

    /* At most one recommendation, whatever the model claimed. Two "best"
       answers is not a recommendation, it is noise. */
    let seenRecommended = false;
    for (const o of options) {
      if (o.recommended && seenRecommended) o.recommended = false;
      else if (o.recommended) seenRecommended = true;
    }

    if (!question || options.length < 2) {
      return {
        ok: false,
        permissionStatus: "allowed",
        data: null,
        message:
          "A clarifying question needs a question and at least two distinct options. Answer directly instead, or ask again with proper options.",
      };
    }

    /* Photos are neutral catalogue data — the same picture the product page
       shows — so there is no extra permission surface here. A lookup failure
       degrades to a card without pictures rather than failing the turn. */
    try {
      await attachPhotos(options);
    } catch (err) {
      console.error("[askUser.photos]", err);
    }

    return {
      ok: true,
      permissionStatus: "allowed",
      data: { question, options, lang: detectLang(question) },
      message: question,
    };
  },
};

export const askUserTools = [askUser];
