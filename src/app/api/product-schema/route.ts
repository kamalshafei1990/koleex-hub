import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { listSchemas, resolveSchema } from "@/lib/product-schema";

/* ---------------------------------------------------------------------------
   /api/product-schema — the spec-template registry, served.

   GET ?division=&category=&subcategory=[&machineKind=]
       → { schema, source, appliedRules }   (resolveSchema, same ladder)
   GET ?all=1
       → { schemas }                          (listSchemas)

   WHY A ROUTE
   The registry (lib/product-schema/index.ts) imports every spec template —
   532 KB of source — to build itself. Two client screens used to import it
   to resolve ONE template (the product editor) or to list them (the spec
   icon hub), and so every visitor to those screens downloaded the whole
   registry: measured 19/09/2026, the same import cost the product page 280
   KB before it moved to leaf modules. Those two screens genuinely need the
   registry's answer, not its source — this route gives them the answer.

   Templates change only with a deploy, so the browser may keep an answer
   for an hour; a deploy is a new build id and the app's kx-build defuse
   handles the rest. Signed-in only: templates are the company's own
   product model.
   --------------------------------------------------------------------------- */

export async function GET(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const headers = { "Cache-Control": "private, max-age=3600" };

  if (url.searchParams.get("all") === "1") {
    return NextResponse.json({ schemas: listSchemas() }, { headers });
  }

  const division = url.searchParams.get("division") ?? "";
  const category = url.searchParams.get("category") ?? "";
  const subcategory = url.searchParams.get("subcategory") ?? "";
  const machineKind = url.searchParams.get("machineKind") || undefined;
  const res = resolveSchema({ divisionCode: division, categoryCode: category, subcategoryCode: subcategory, machineKindId: machineKind });
  return NextResponse.json(res, { headers });
}
