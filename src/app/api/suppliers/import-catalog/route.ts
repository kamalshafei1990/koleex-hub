import "server-only";

/* ---------------------------------------------------------------------------
   POST /api/suppliers/import-catalog

   Analyze-only: receives catalog TEXT (extracted client-side from the PDF —
   selectable text and/or OCR of scanned pages) and returns a reviewable
   SupplierDraft via the AI. Does NOT create anything; the client reviews the
   draft and then creates the supplier through the normal flow.

   Access: signed in + "Suppliers" module.
   Body:   { text: string, filename?: string }
   Reply:  { draft: SupplierDraft } | { error: string }
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { structureSupplierFromText } from "@/lib/server/catalog-extract";

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Suppliers");
  if (deny) return deny;

  let body: { text?: unknown; filename?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const filename = typeof body.filename === "string" ? body.filename : "catalog.pdf";
  if (text.trim().length < 30) {
    return NextResponse.json(
      { error: "Couldn't read enough from this PDF. It may be a scanned file that didn't OCR cleanly — try another, or fill the form manually." },
      { status: 422 },
    );
  }
  if (text.length > 200_000) {
    return NextResponse.json({ error: "Catalog text too large." }, { status: 413 });
  }

  const { draft, error } = await structureSupplierFromText(text, filename);
  if (!draft) {
    return NextResponse.json({ error: error || "Extraction failed." }, { status: 502 });
  }
  return NextResponse.json({ draft });
}
