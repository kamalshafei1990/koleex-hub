import "server-only";

/* ---------------------------------------------------------------------------
   search_web — the agent's only route to the public internet.

   It exists because the model's knowledge has a cut-off and a lot of ordinary
   questions do not: today's weather, this week's exchange rate, whether a
   port is congested, what a public spec sheet says. Answering those from
   memory is worse than admitting ignorance, because it sounds equally
   confident either way.

   THREE GUARDS, in the order they matter:

   1. PUBLIC INFORMATION ONLY. The query string leaves our network. The
      description below tells the model, in the words it actually reads, never
      to put customer names, prices, quotation contents or anything from
      Koleex's own records into it — those questions have their own tools,
      which stay behind the permission layer.

   2. THE BRAND RULE SURVIVES. Koleex AI never recommends another
      manufacturer's machines. Web results are reference material for facts,
      not a catalogue to shop from, and the result envelope repeats that where
      the model will see it.

   3. HONEST FAILURE. No API key, or a provider that times out, returns a
      plain "couldn't check" — never a confident answer dressed up as fresh.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { searchWeb, type WebResult, type WebImage } from "../../ai/web-search";
import { scanEgress, egressRefusalMessage } from "../../ai/security/egress-scanner";

interface SearchArgs {
  query: string;
}

interface SearchData {
  answer?: string;
  results: WebResult[];
  /** Pictures the search found. Present only when there are any, so a
   *  result with none says nothing about pictures at all. */
  images?: WebImage[];
  /** Repeated into the model's context on every call — a system prompt read
   *  20 messages ago loses to fresh text sitting next to the data. */
  usage_note: string;
}

const BRAND_NOTE =
  "These are public web results, for facts only. Never present another " +
  "manufacturer's product as an option — Koleex only ever recommends Koleex " +
  "machines. Cite the source URL for any figure you take from here, and say " +
  "how fresh it is when a date is given.";

/* Repeated beside the pictures, where the model reads it, for the same
   reason BRAND_NOTE is: a rule in the data beats a rule twenty messages up. */
const IMAGE_NOTE =
  "PICTURES: show one when the user asked to SEE something, or when a picture " +
  "answers better than words (what a thing looks like), as markdown " +
  "![description](url) with the url EXACTLY as given — at most two, never a " +
  "gallery, and never for a question words answer fine. NEVER show another " +
  "manufacturer's machine or logo; for Koleex products use the product's own " +
  "photo from the product tools, not a web picture. Say where a picture is " +
  "from if the user asks. Some hosts do not load from mainland China; a " +
  "picture that fails to load is not an error to apologise for.";

const searchTheWeb: ToolDef<SearchArgs, SearchData> = {
  name: "search_web",
  description:
    "Search the public internet for CURRENT or PUBLIC information the model cannot know: today's weather, news, exchange rates, shipping or port conditions, public standards and specifications, or any fact that may have changed since training. " +
    "Call this whenever the user asks something time-sensitive instead of saying you have no live access. " +
    "NEVER put Koleex's own data in the query — no customer names, prices, quotation contents, employee details or internal codes; those have their own tools. " +
    "Never use it to find or suggest machines from other manufacturers. " +
    "Also the way to SHOW a picture of a public thing the user asks to see (a port, a fabric, a tool, a place): results carry pictures you may embed as markdown.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "A short public-web search query, e.g. 'Cairo weather today' or 'USD to CNY rate'. Public terms only.",
      },
    },
    required: ["query"],
  },
  /* No module gate: this reads nothing from the tenant. Every signed-in
     internal user may look something up, exactly as they could in a browser
     tab — the route that hosts the agent already requires an internal user. */
  requiredModule: undefined,
  requiredAction: "view",
  minRole: "internal",
  handler: async (ctx, args): Promise<ToolResult<SearchData>> => {
    const query = String(args?.query ?? "").trim();
    if (!query) {
      return {
        ok: false,
        permissionStatus: "allowed",
        data: null,
        message: "A search query is required.",
      };
    }

    /* ── GUARD 1 (audit Issue 2, P0): data egress ──────────────────────────
       Until now the prohibition above ("NEVER put Koleex's own data in the
       query") lived ONLY in this description and the system prompt. A rule the
       model follows only sometimes is not a rule, and a customer name reaching
       a search vendor returns HTTP 200 — there is no error to notice later.
       This is the deterministic check that makes the rule real.

       Default ON. AI_EGRESS_SCAN=off is an emergency rollback, not a setting:
       a security guard that defaults to off is not a guard. */
    if (process.env.AI_EGRESS_SCAN !== "off") {
      const verdict = scanEgress(query);
      if (!verdict.allowed) {
        /* Logged WITHOUT the query text — the whole point is that this string
           should not be copied around. The audit row records the attempt via
           dispatchTool; `matched` says which rule fired, which is what an
           operator needs to tune it. */
        console.warn(`[ai.egress.blocked] rule=${verdict.matched} len=${query.length}`);
        return {
          ok: false,
          /* NOT "denied": a denial short-circuits the orchestrator and prints
             `message` verbatim, which would show English to an Arabic speaker.
             Reporting it as an ordinary unsuccessful result lets the model
             relay the refusal in the user's own language — the same contract
             the not-configured and empty-result paths below already use. */
          permissionStatus: "allowed",
          data: null,
          message: egressRefusalMessage(verdict.reason),
        };
      }
      if (verdict.warnings.length > 0) {
        console.warn(`[ai.egress.warn] ${verdict.warnings.join(",")} len=${query.length}`);
      }
    }

    void ctx; /* reserved: per-tenant name matching lands with the Phase 5 cache */

    const outcome = await searchWeb(query);

    /* NOT permissionStatus "denied", even though this is a failure. A denial
       short-circuits the orchestrator and prints `message` to the user
       verbatim — which would show an English sentence to an Arabic speaker,
       and any model-directed wording in it would leak straight into the
       chat. Reporting it as an ordinary unsuccessful result lets the model
       relay it in the user's own language. Both messages below are written
       to read correctly whether the model rephrases them or a caller shows
       them as-is, which is the ToolResult.message contract. */
    if (!outcome.configured) {
      return {
        ok: false,
        permissionStatus: "allowed",
        data: null,
        message:
          "Web search isn't configured on this deployment, so there is no live web access right now. Say so plainly instead of answering from memory.",
      };
    }

    if (outcome.error || outcome.results.length === 0) {
      return {
        ok: false,
        permissionStatus: "allowed",
        data: null,
        message:
          "The web search came back empty this time, so nothing current could be confirmed. Say so plainly instead of answering from memory.",
      };
    }

    return {
      ok: true,
      permissionStatus: "allowed",
      data: {
        answer: outcome.answer,
        results: outcome.results,
        ...(outcome.images.length > 0 ? { images: outcome.images } : {}),
        usage_note: outcome.images.length > 0 ? `${BRAND_NOTE} ${IMAGE_NOTE}` : BRAND_NOTE,
      },
      /* Surfaced to the UI as the "Sources" line under the reply. */
      sources: outcome.results.map((r) => r.url),
    };
  },
};

export const webSearchTools: ToolDef[] = [searchTheWeb as unknown as ToolDef];
