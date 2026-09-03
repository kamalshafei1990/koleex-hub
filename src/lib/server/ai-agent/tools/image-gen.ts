import "server-only";

/* ---------------------------------------------------------------------------
   generate_image — Koleex AI makes a picture the user asked for.

   The adapter (ai/image-gen.ts) talks to the vendor; this file is the part
   that decides whether it MAY, and where the picture goes.

   FOUR GUARDS, in the order they run:

   1. EGRESS. The prompt leaves our network, exactly as a web search query
      does, and the same deterministic scanner refuses one that carries a
      customer name, a price, a quotation number.

   2. BUDGET. A picture costs real money per call — unlike a search, unlike
      a chat turn. Per account per hour and per tenant per day, in the same
      limiter every other AI surface uses, checked BEFORE the vendor is paid.

   3. HONESTY. Not configured, or the vendor failed, is said plainly in
      words the model relays in the user's language — never a made-up URL,
      never "here is your picture" with nothing under it.

   4. THE BRAND, in the data. A generated picture is an ILLUSTRATION. It is
      never presented as a Koleex product, a real machine, or a photograph —
      a manufacturer whose assistant shows invented machines as its own
      range has a problem no prompt rule fixes afterwards. The note rides
      beside the URL where the model reads it.

   WHERE THE PICTURE LIVES: the Hub's public `media` bucket, under
   ai-generated/<tenant>/<account>/<id>.<ext>. Reachable from mainland China
   because the Hub is; permanent because a chat message is. Written with the
   service role, which is the only writer of that prefix.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { scanEgress, egressRefusalMessage } from "../../ai/security/egress-scanner";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "../../ai/security/rate-limit";
import { generateImage, EXT_FOR, MAX_PROMPT_CHARS, type ImageMime } from "../../ai/image-gen";
import { supabaseServer } from "../../supabase-server";
import { isUuid } from "../uuid";

interface ImageArgs {
  prompt: string;
}

interface ImageData {
  image_url: string;
  usage_note: string;
}

export const GENERATED_IMAGE_NOTE =
  "This is a GENERATED illustration, made just now from the prompt. Show it as " +
  "markdown ![Generated: <a few words on what it shows>](image_url) with the url " +
  "EXACTLY as given, and say in one short phrase that it is a generated picture. " +
  "NEVER present it as a Koleex product, a real machine, a photograph or a " +
  "catalogue image — Koleex's own products are shown only through the product " +
  "tools' photos. Never put another manufacturer's name, logo or trademark in a " +
  "picture. One picture per request; offer to adjust it rather than making several.";

export const NOT_CONFIGURED_MESSAGE =
  "Image creation isn't set up on this deployment, so no picture can be made right now. Say so plainly and offer to describe it in words instead.";

export const FAILED_MESSAGE =
  "The picture could not be made this time. Say so plainly, without inventing an image, and offer to try again or describe it in words.";

export const OVER_BUDGET_MESSAGE =
  "The image allowance for now is used up. Say so plainly and suggest trying again later.";

const BUCKET = "media";
const PREFIX = "ai-generated";

/** The real store: the Hub's public media bucket, under the caller's own
 *  tenant and account so a path can never be guessed into someone else's. */
async function storeInMedia(tenantId: string, accountId: string, bytes: Uint8Array, mime: ImageMime): Promise<string | null> {
  if (!isUuid(tenantId) || !isUuid(accountId)) return null;
  const path = `${PREFIX}/${tenantId}/${accountId}/${crypto.randomUUID()}.${EXT_FOR[mime]}`;
  const { error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error("[ai.image] store failed", error.message);
    return null;
  }
  const { data } = supabaseServer.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

const generateImageTool: ToolDef<ImageArgs, ImageData> = {
  name: "generate_image",
  description:
    "CREATE a new picture from a description, when the user asks you to draw, design, generate, make or illustrate something: a poster or banner idea, a scene, an illustration for a deck or a training note, a mock-up of an idea. " +
    "Returns a URL you show as a markdown image. " +
    "NOT for showing something that exists — use the product tools for Koleex products and search_web for public things. " +
    "NEVER put Koleex's own data in the prompt — no customer names, prices, quotation contents or internal codes — and never another manufacturer's name or logo. " +
    "Each picture costs money: one per request, and adjust rather than repeat.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description:
          "What the picture should show, in English, concrete and visual: subject, setting, style, mood, colours. Public and generic terms only.",
      },
    },
    required: ["prompt"],
  },
  /* No module gate: nothing from the tenant is read. Every signed-in
     internal user may ask for a picture, as they could in any drawing tool
     — the budget, not a module, is what bounds it. */
  requiredModule: undefined,
  requiredAction: "view",
  minRole: "internal",
  handler: async (ctx, args): Promise<ToolResult<ImageData>> => {
    const prompt = String(args?.prompt ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_PROMPT_CHARS);
    if (!prompt) {
      return { ok: false, permissionStatus: "allowed", data: null, message: "A description of the picture is required." };
    }

    /* ── GUARD 1: egress. Same scanner, same posture as search_web. ────── */
    if (process.env.AI_EGRESS_SCAN !== "off") {
      const verdict = scanEgress(prompt);
      if (!verdict.allowed) {
        console.warn(`[ai.egress.blocked] tool=generate_image rule=${verdict.matched} len=${prompt.length}`);
        return { ok: false, permissionStatus: "allowed", data: null, message: egressRefusalMessage(verdict.reason) };
      }
    }

    /* ── GUARD 2: budget, BEFORE the vendor is paid. Fails open like every
       other budget; enforced only in enforce mode. ────────────────────── */
    if (limitMode() !== "off") {
      const [acct, tenant] = await Promise.all([
        consumeBudget(subjectFor.account(ctx.auth.account_id), BUDGETS.imagePerAccount()),
        consumeBudget(subjectFor.tenant(ctx.auth.tenant_id), BUDGETS.imagePerTenant()),
      ]);
      const hit = !acct.allowed ? acct : !tenant.allowed ? tenant : null;
      if (hit) {
        console.warn(`[ai.image] ratelimit ${!acct.allowed ? "account" : "tenant"} count=${hit.count} max=${hit.max} mode=${limitMode()}`);
        if (limitMode() === "enforce") {
          return { ok: false, permissionStatus: "allowed", data: null, message: OVER_BUDGET_MESSAGE };
        }
      }
    }

    const outcome = await generateImage(prompt, {
      fetch: globalThis.fetch,
      store: (bytes, mime) => storeInMedia(ctx.auth.tenant_id, ctx.auth.account_id, bytes, mime),
    });

    /* ── GUARD 3: honesty. NOT "denied" — a denial prints its message
       verbatim; an ordinary failure lets the model relay it in the user's
       language, the contract every other tool in this directory uses. ─── */
    if (!outcome.configured) {
      return { ok: false, permissionStatus: "allowed", data: null, message: NOT_CONFIGURED_MESSAGE };
    }
    if (!outcome.ok) {
      return { ok: false, permissionStatus: "allowed", data: null, message: FAILED_MESSAGE };
    }

    return {
      ok: true,
      permissionStatus: "allowed",
      data: { image_url: outcome.url, usage_note: GENERATED_IMAGE_NOTE },
      /* No sources: nothing was looked up. The UI's "Sources" line stays empty. */
    };
  },
};

export const imageGenTools: ToolDef[] = [generateImageTool as unknown as ToolDef];
