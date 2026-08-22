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

export interface AskUserOption {
  /** Short, tappable. What the user is choosing. */
  label: string;
  /** Optional one-line consequence — what happens if they pick it. */
  detail?: string;
  /** At most one. The model's own pick when it leans one way. */
  recommended?: boolean;
}

export interface AskUserPayload {
  question: string;
  options: AskUserOption[];
}

const askUser: ToolDef<Record<string, unknown>, AskUserPayload> = {
  name: "askUser",
  description:
    "Ask the user a CLOSED question — one whose sensible answers are a short knowable list — and let them tap the answer instead of typing it. " +
    "Call this whenever you were about to write a sentence offering the user a choice: \"which one did you mean\", \"would you like A or B\", \"should I use X or Y\". If your reply would contain two or more alternatives for them to pick between, it belongs here instead. " +
    "Typical: several products/customers/suppliers match what they said; which market or currency to price in; which language to draft in; whether to include cost figures; which of two machines to compare; which project a task belongs to. " +
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

    return {
      ok: true,
      permissionStatus: "allowed",
      data: { question, options },
      message: question,
    };
  },
};

export const askUserTools = [askUser];
