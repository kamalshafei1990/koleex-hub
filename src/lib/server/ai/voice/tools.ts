import "server-only";

/* ---------------------------------------------------------------------------
   Which tools a VOICE call may use, and why the list is this short.

   A voice call has no confirmation step. There is no draft to read, no button
   to press, no diff to check — the model decides, and by the time the user
   hears about it the thing has happened. The standing rule is that there are
   no uncontrolled autonomous writes, and a spoken "yes" is not a confirmation
   the server can verify: it is audio the model transcribed, arriving through
   the same channel as the request.

   So: READ-ONLY, and only the reads whose worst case is a wasted second.

     · search_web — the model's knowledge has a cut-off and a lot of ordinary
       questions do not. Asked about today's weather or this week's rate, a
       call with no tools answers from training data and sounds exactly as
       confident as if it knew.

     · search_knowledge — KOLEEX'S OWN APPROVED KNOWLEDGE, including what the
       owner has taught it. This was the gap that made a call feel like a
       different assistant: the same question answered in writing reached the
       approved knowledge and in a call reached nothing.

     · searchMachineKnowledge, searchCatalog, searchProducts,
       getProductByCode, getProductDetails, listCatalogFamilies — Koleex
       products. A Koleex assistant that cannot answer about Koleex machines
       out loud is not the product.

     · searchTradeTerms — Incoterms and trade vocabulary; reference material,
       no tenant data at all.

   WHY THE KOLEEX READS ARE HERE NOW, having been excluded when the bridge
   was built. The reason given then was that they carry Koleex data into a
   channel whose transcript is not persisted anywhere the owner can audit,
   and that adding them without deciding that would be deciding it by
   accident. The owner has since decided it — and the premise was weaker than
   it read: dispatchTool writes an audit row for EVERY call, with the tool,
   the arguments, the caller and the outcome. What is unaudited is the spoken
   words, not the data access. Every one of these is read-only and
   permission-filtered, so a caller hears only what they could already read
   on their own screen.

   NOT HERE, and these are the real line:
     · every create, update and delete tool — a write with no confirmation;
     · createQuotationDraft — a write, and a commercial one;
     · remember_about_user / forget_about_user — writes to the user's own
       record, and ones they cannot see happening;
     · calculateQuotationPricing — a quotation figure, and quotations by
       voice are off the list by the owner's decision (roadmap, Sept 2026);
     · getInventoryStatus — today a stub that answers "not available"; a
       schema for it would only cost session bytes and a wasted lookup.
   MOVED ONTO THE LIST BY THE OWNER'S PLAN (roadmap C1, 2026-09-03), and
   the reasons they were kept off are still true and still written here so
   the move is a decision, not drift:
     · getCustomerByName / getCustomerByCode — a customer's details read
       aloud in a room the customer is not in. The caller chooses the room;
       the data is what their own screen shows them, field-filtered by the
       same permissions (Customers/view, private fields only with
       can_view_private), and dispatchTool audits the read.
     · getPricingRules — margin and discount caps. Spoken numbers cannot be
       checked against a source by the person hearing them, and a misheard
       margin is worse than none — so the instructions make the model say
       the figures exactly as returned, name what each is, and offer to put
       them in the chat; margins are withheld inside the tool for accounts
       without private-data permission, as they are in writing.
       THE FIRST EXCEPTION, by the owner's decision: getProductPrice — the
       SELLING price in USD, FOB, straight from the engine, with no cost, no
       margin and no level in its payload. "When I ask any price of any of
       Koleex products it gives a wrong price": a call with no price tool
       answered from memory, and memory is worse than a spoken engine figure.
       The exact price for a country and customer type is still gated on
       Quotations/view inside the tool, as calculateQuotationPricing is.

   THIS LIST IS THE SECURITY BOUNDARY, and it lives on the server because the
   standing rule is that the client never determines a permission. The browser
   relays a NAME it received from the model; both the model and the browser
   are outside the trust boundary, so the name is a claim. It is checked here,
   against this list, before anything runs — and then checked AGAIN by
   dispatchTool's own permission gates, which is where a user who may not use
   a tool is stopped even if it is on this list.
   --------------------------------------------------------------------------- */

import { getTool } from "@/lib/server/ai-agent/tool-registry";
import { skillMeta } from "@/lib/server/ai/skills/catalog";

/** The only tool names a voice call may invoke. */
export const VOICE_TOOL_NAMES: readonly string[] = [
  "search_web",
  "search_knowledge",
  "searchMachineKnowledge",
  /* THE HUB'S PRODUCTS BEFORE THE PRINTED INDEX. The order a model reads
     tools in is the order it reaches for them; the older reference used to
     sit above the live products and was what a call answered from. */
  "searchProducts",
  "getProductByCode",
  "getProductDetails",
  "getProductPrice",
  "searchCatalog",
  "listCatalogFamilies",
  "searchTradeTerms",
  /* THE CALLER'S OWN WORK, READ ONLY — added after the owner, a super admin,
     was told on a call that things were not his to see. "What is on my list
     today", "what is in my calendar", "which projects am I on" were questions
     a call could not answer because it had no tool that reads them, and a
     model with no tool says it cannot access — which the caller hears as
     permission. Each of these reads the caller's OWN items (dispatchTool
     scopes them to the account), or public catalogue statistics, or the
     caller's own permissions — nothing about another person, no figure. */
  "listMyTodos",
  "listMyCalendar",
  "listMyPlanning",
  "listMyProjects",
  "findTeamMember",
  "getUserPermissions",
  "countProducts",
  "getCatalogStats",
  /* ROADMAP C1 — customers and pricing rules, read only, under the caller's
     own module permissions. See the header for why they were off the list
     and what changed. Last, so the catalogue reads stay first in the order
     the model reaches for tools. */
  "getCustomerByName",
  "getCustomerByCode",
  "getPricingRules",
  /* ONE WRITE, AND ONLY WITH A TAP (roadmap D1). "Save a task: follow up
     with X on Thursday" is the thing a person on a call most wants written
     down, and the one thing a call could not do. createTodo is the tool the
     text lane uses, with the same two phases: the model may only PREVIEW
     (confirm unset), which the ledger records; the execution (confirm:true)
     is accepted by the tool route ONLY from the caller's tap on the card the
     preview put on screen (`via: "tap"`), never from the model's own
     function call — a spoken "yes" can be misheard, a tap cannot. See
     VOICE_WRITE_TOOLS and the route. */
  "createTodo",
];

/** The write tools a call may reach. Each is two-phase in the registry and
 *  gated by the pending-actions ledger; on a call the confirming phase is
 *  additionally reserved for the caller's tap (tool route). */
export const VOICE_WRITE_TOOLS: readonly string[] = ["createTodo"];

export function isVoiceWriteTool(name: string): boolean {
  /* THE CATALOGUE DECIDES, NOT ONLY THE LIST (audit, 2026-09-07). A write
     added to VOICE_TOOL_NAMES but not to VOICE_WRITE_TOOLS would have gone
     straight to the registry, where the model's own preview satisfies the
     ledger — a spoken yes would have written a record. Anything the skills
     catalogue does not declare read-only is a write here, whatever the list
     says; the list stays as the explicit, reviewed set. */
  if (VOICE_WRITE_TOOLS.includes(name)) return true;
  const meta = skillMeta(name);
  return meta ? meta.risk !== "read_only" : true;
}

/**
 * How many tool calls one voice session may make.
 *
 * A CAP, NOT A RATE LIMIT, and it is here because a model that can call a
 * tool and then be asked to speak again can do that forever. The standing
 * rule is no uncontrolled agent loops; this is what makes it true for voice.
 * Generous enough that a real conversation never notices. Twelve was not:
 * one real call spent it in four minutes (three or four tools per question
 * — a search, a broader search, the details, the price) and every picture
 * asked for after that was described from memory. The per-minute budget on
 * the tool route is the rate limit; this is the ceiling on a runaway loop.
 */
export const VOICE_TOOL_CALLS_PER_SESSION = 60;

/* THE TWO THAT SURVIVE THE CUT, when the session has to be small.
   The compact session exists for a transport that refuses a large message,
   and nine tool schemas are 5.4 KB of it. These two are the ones the product
   is actually missing without: Koleex's own approved knowledge, and the
   public web. The catalogue reads are a real loss and that is why this is a
   fallback rather than the default. */
const COMPACT_VOICE_TOOL_NAMES: readonly string[] = ["search_knowledge", "search_web"];

/** True when a name may be invoked over voice. Nothing else may be.
 *
 *  DELIBERATELY NOT NARROWED FOR THE COMPACT SESSION: the allow-list is a
 *  security boundary and the compact variant is a size decision. A model that
 *  somehow asks for a catalogue read on a compact session is refused by
 *  dispatchTool's permission gates like any other caller, not by this — and
 *  making the boundary depend on which payload got sent would be one more
 *  thing that has to be right. */
export function isVoiceTool(name: string): boolean {
  return VOICE_TOOL_NAMES.includes(name);
}

/**
 * The tool schemas the SERVER puts in session.update.
 *
 * Built from the live registry rather than retyped, so a tool whose
 * description or parameters change cannot end up described one way to the
 * text lane and another way to voice. A name on the list that is not in the
 * registry is dropped rather than invented: this must never advertise a tool
 * that cannot run.
 */
/** A description written for the CALL where the text lane's contradicts the
 *  voice instructions (audit, 2026-09-07): the text lane's createTodo says
 *  "call again with confirm:true after they agree", the call says "never
 *  confirm yourself — the caller taps". The model was given both. */
const VOICE_DESCRIPTION_OVERRIDES: Record<string, string> = {
  createTodo:
    "Save a task for the caller. Call WITHOUT confirm with the title in their words and the due date if they said one:" +
    " a card appears on their screen and only their tap saves it. Never call with confirm yourself.",
};

export function voiceToolSchemas(variant: "full" | "compact" = "full"): Array<{
  type: "function";
  name: string;
  description: string;
  parameters: unknown;
}> {
  const names = variant === "compact" ? COMPACT_VOICE_TOOL_NAMES : VOICE_TOOL_NAMES;
  const out: Array<{ type: "function"; name: string; description: string; parameters: unknown }> = [];
  for (const name of names) {
    const tool = getTool(name);
    if (!tool) continue;
    out.push({
      type: "function",
      name: tool.name,
      description: VOICE_DESCRIPTION_OVERRIDES[tool.name] ?? tool.description,
      parameters: tool.parameters,
    });
  }
  return out;
}

/* WHAT A CALL NEEDS FROM A WEB SEARCH IS LESS. The text lane renders six
   results with their snippets as a source list; a call renders nothing —
   the model reads the whole payload and then speaks. A picture request came
   back in three seconds and was heard a good while later (owner,
   2026-09-07: "show me a photo takes very long time"): the seconds after
   the lookup are the model working through six long snippets to say one
   sentence about a picture the screen already shows. Fewer, shorter
   results are read faster and spoken sooner; the pictures and the
   provider's one-line answer are kept whole. Pure; exported for the suite. */
export const VOICE_SEARCH_RESULTS = 3;
export const VOICE_SNIPPET_CHARS = 200;
export function forVoice(tool: string, data: unknown): unknown {
  if (tool !== "search_web" || !data || typeof data !== "object" || Array.isArray(data)) return data;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.results)) return data;
  return {
    ...d,
    results: d.results.slice(0, VOICE_SEARCH_RESULTS).map((r) => {
      if (!r || typeof r !== "object") return r;
      const row = r as Record<string, unknown>;
      const snippet = typeof row.snippet === "string" ? row.snippet : "";
      return { ...row, snippet: snippet.length > VOICE_SNIPPET_CHARS ? `${snippet.slice(0, VOICE_SNIPPET_CHARS)}…` : snippet };
    }),
  };
}
