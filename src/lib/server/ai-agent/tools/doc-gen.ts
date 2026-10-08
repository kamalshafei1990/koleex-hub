import "server-only";

/* ---------------------------------------------------------------------------
   generate_document — Koleex AI hands the user a real PDF.

   The document counterpart of generate_image (tools/image-gen.ts). The user
   asks for "an organised PDF of these details", "a packing list", "a report
   from this file", "redesign this document" — the model has ALREADY read
   the uploaded file or photo through the attachment pipeline; this tool is
   where the restructured content becomes a downloadable A4 PDF.

   THE GUARDS, in the order they run:

   1. SHAPE. sanitizeDocInput makes a defensive copy of the model's
      structure — wrong types dropped, fields clamped, totals capped —
      before any of it touches the renderer. Nothing raw reaches HTML.

   2. BUDGET. Rendering is Chromium CPU inside our own function, so the
      ceilings sit above the paid-image ones — but a document loop is
      still abuse, checked BEFORE the browser launches.

   3. HONESTY. A render failure is said plainly and retried, never a
      link to a file that does not exist.

   4. WHAT IT IS NOT. This is a WORKING PAPER, never an official Koleex
      business document — quotations, invoices and invitations have their
      own numbered, permissioned flows. The note rides beside the URL.

   NO EGRESS SCAN, deliberately: unlike the image tool there is no vendor
   call. The content goes model → our renderer → our bucket; nothing
   leaves the deployment, so there is nothing to scan on the way out.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";
import { BUDGETS, consumeBudget, limitMode, subjectFor } from "../../ai/security/rate-limit";
import { sanitizeDocInput, renderDocumentPdf, type DocInput } from "../../ai/doc-gen";
import { supabaseServer } from "../../supabase-server";
import { isUuid } from "../uuid";

interface DocArgs {
  title: string;
  subtitle?: string;
  kind?: string;
  reference?: string;
  date?: string;
  lang?: string;
  sections: Array<{
    heading?: string;
    paragraphs?: string[];
    bullets?: string[];
    table?: { columns: string[]; rows: string[][] };
  }>;
  footerNote?: string;
}

interface DocData {
  document_url: string;
  usage_note: string;
}

export const GENERATED_DOC_NOTE =
  "This is a GENERATED working document, made just now as a PDF. Show it as " +
  "a markdown link with a clear label, e.g. [Download the PDF](document_url) " +
  "with the url EXACTLY as given, and say in one short phrase that it is a " +
  "generated document. NEVER present it as an official Koleex business " +
  "document — quotations, invoices and invitations are made only through " +
  "their own tools and flows. One document per request; offer to adjust the " +
  "content and regenerate rather than making several.";

export const DOC_FAILED_MESSAGE =
  "The document could not be made this time. Say so plainly, without inventing a file, and offer to try again.";

export const DOC_OVER_BUDGET_MESSAGE =
  "The document allowance for now is used up. Say so plainly and suggest trying again later.";

const BUCKET = "media";
const PREFIX = "ai-generated";

/** The real store: the Hub's public media bucket, under the caller's own
 *  tenant and account — the same prefix and rule the image tool uses. */
async function storePdf(tenantId: string, accountId: string, bytes: Uint8Array): Promise<string | null> {
  if (!isUuid(tenantId) || !isUuid(accountId)) return null;
  const path = `${PREFIX}/${tenantId}/${accountId}/${crypto.randomUUID()}.pdf`;
  const { error } = await supabaseServer.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "application/pdf", upsert: false, cacheControl: "31536000" });
  if (error) {
    console.error("[ai.doc] store failed", error.message);
    return null;
  }
  const { data } = supabaseServer.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl || null;
}

const generateDocumentTool: ToolDef<DocArgs, DocData> = {
  name: "generate_document",
  description:
    "MAKE a downloadable PDF document, when the user asks you to create, organise, format, redesign or export a document: a report, a summary, a packing list, a price list, a training note, a redesigned version of an uploaded file, or an organised document built from details in a photo or an attached file you have already read. " +
    "You supply the structured content (title, sections with paragraphs, bullets and optional tables); the tool renders the A4 PDF in the Koleex house style and returns a download URL you show as a markdown link. " +
    "Use the user's language for the content and pass it in `lang` (en / ar / zh) so direction and fonts are right. " +
    "NOT for official business documents — quotations, invoices and invitations have their own dedicated tools and flows, never this one. " +
    "One document per request; adjust and regenerate rather than repeating.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The document title, in the user's language." },
      subtitle: { type: "string", description: "Optional line under the title." },
      kind: { type: "string", description: "Short kicker label, e.g. 'Report', 'Packing list', 'Meeting summary'." },
      reference: { type: "string", description: "Optional reference number or code to print in the header." },
      date: { type: "string", description: "Optional date line, e.g. '8 October 2026'." },
      lang: { type: "string", enum: ["en", "ar", "zh"], description: "The language the document is written in — sets direction and fonts." },
      sections: {
        type: "array",
        description: "The document body, in order. Each section has an optional heading, paragraphs, bullets and/or one table.",
        items: {
          type: "object",
          properties: {
            heading: { type: "string" },
            paragraphs: { type: "array", description: "Plain-text paragraphs.", items: { type: "string" } },
            bullets: { type: "array", description: "Bullet points.", items: { type: "string" } },
            table: {
              type: "object",
              description: "One table: column headers plus rows (each row one cell per column).",
              properties: {
                columns: { type: "array", items: { type: "string" } },
                /* Each row is an array of cell strings; the schema subset
                   cannot nest items twice, so the cell type is implied. */
                rows: { type: "array", items: { type: "array" } },
              },
              required: ["columns", "rows"],
            },
          },
        },
      },
      footerNote: { type: "string", description: "Optional small-print line at the end of the document." },
    },
    required: ["title", "sections"],
  },
  /* No module gate: nothing from the tenant is read. Every signed-in
     internal user may ask for a document, as they could in any editor —
     the budget, not a module, is what bounds it. */
  requiredModule: undefined,
  requiredAction: "view",
  minRole: "internal",
  handler: async (ctx, args): Promise<ToolResult<DocData>> => {
    /* ── GUARD 1: shape. ─────────────────────────────────────────────── */
    const doc: DocInput | null = sanitizeDocInput(args);
    if (!doc) {
      return {
        ok: false,
        permissionStatus: "allowed",
        data: null,
        message: "A title and at least one section with content are required.",
      };
    }

    /* ── GUARD 2: budget, BEFORE the browser launches. Same fail-open
       posture as every other budget; enforced only in enforce mode. ──── */
    if (limitMode() !== "off") {
      const [acct, tenant] = await Promise.all([
        consumeBudget(subjectFor.account(ctx.auth.account_id), BUDGETS.docPerAccount()),
        consumeBudget(subjectFor.tenant(ctx.auth.tenant_id), BUDGETS.docPerTenant()),
      ]);
      const hit = !acct.allowed ? acct : !tenant.allowed ? tenant : null;
      if (hit) {
        console.warn(`[ai.doc] ratelimit ${!acct.allowed ? "account" : "tenant"} count=${hit.count} max=${hit.max} mode=${limitMode()}`);
        if (limitMode() === "enforce") {
          return { ok: false, permissionStatus: "allowed", data: null, message: DOC_OVER_BUDGET_MESSAGE };
        }
      }
    }

    const outcome = await renderDocumentPdf(doc);

    /* ── GUARD 3: honesty. ───────────────────────────────────────────── */
    if (!outcome.ok) {
      return { ok: false, permissionStatus: "allowed", data: null, message: DOC_FAILED_MESSAGE };
    }

    const url = await storePdf(ctx.auth.tenant_id, ctx.auth.account_id, outcome.bytes);
    if (!url) {
      return { ok: false, permissionStatus: "allowed", data: null, message: DOC_FAILED_MESSAGE };
    }

    return {
      ok: true,
      permissionStatus: "allowed",
      data: { document_url: url, usage_note: GENERATED_DOC_NOTE },
      /* No sources: nothing was looked up. */
    };
  },
};

export const docGenTools: ToolDef[] = [generateDocumentTool as unknown as ToolDef];
