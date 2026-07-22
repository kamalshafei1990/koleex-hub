import "server-only";

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/auth";
import { fetchPageText, type FetchPageError } from "@/lib/server/fetch-page";

/* POST /api/translator/website — read a public web page and return its text.

   Extraction ONLY. The blocks come back to the browser, which then sends them
   through /api/translator like any other text, so page content lands in the
   same shared tenant cache as everything else and a page whose paragraphs were
   already translated costs nothing the second time.

   Deliberately not a proxy: we never re-serve the remote page's HTML, CSS or
   scripts, so there is no way for a third-party site to run in our origin.

   All SSRF defence (scheme allow-list, private-range blocking, manual redirect
   re-validation, byte/time caps) lives in fetchPageText. */

export const runtime = "nodejs"; // needs node:dns + node:net for address checks

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { url?: string };
  const raw = String(body.url ?? "").trim();
  if (!raw) return NextResponse.json({ error: "bad_url" }, { status: 400 });

  // Bare domains are what people actually paste ("koleexgroup.com").
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const page = await fetchPageText(candidate);
    return NextResponse.json(page);
  } catch (e) {
    const code = (e instanceof Error ? e.message : "fetch_failed") as FetchPageError;
    const status = code === "blocked_host" || code === "bad_url" ? 400 : 502;
    return NextResponse.json({ error: code }, { status });
  }
}
