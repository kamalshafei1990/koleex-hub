import "server-only";

/* ---------------------------------------------------------------------------
   /api/quotations/[id]/pdf — Server-side PDF render of a quotation.

   Launches headless Chromium via @sparticuz/chromium-min on Vercel,
   or a locally-installed Chrome on dev machines. Navigates to the
   chrome-less /quotations/<id>/print page, forwards the caller's
   session cookie so the data fetch succeeds, waits for the page to
   signal `window.__quotation_pdf_ready__ = true` (set once images
   finish decoding), then snapshots the page to PDF at A4 / no
   margins.

   Local dev: needs Chrome installed. The route looks at PUPPETEER_
   EXECUTABLE_PATH first, then falls back to the macOS / Linux
   default paths. If neither resolves, the response is a 500 with a
   readable error so the caller can wire up an env var.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";
import { assertScopeShadowForRow, toScopeContext } from "@/lib/server/apply-scope";
import { getScopeMode } from "@/lib/server/scope-flags";
import { isCustomerEnforced, ownsQuotation } from "@/lib/server/customer-quotation-guard";

export const runtime = "nodejs";
/* PDF rendering on Vercel needs headroom: the chromium binary download
   on first invocation is slow, then the navigation/render itself can
   take 5-15 s for an 8-page quote with photos. 60 s is the Pro-plan
   ceiling — bump to that. */
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ id: string }> };

/* Pinned Chromium pack hosted by @sparticuz. The URL has to match the
   exact @sparticuz/chromium-min version installed in package.json so
   the launcher and the binary agree on the protocol version. */
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

async function resolveLocalChrome(): Promise<string | null> {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env) return env;
  /* Conventional install locations. Best-effort — if none exist we
     bubble a clear error up to the route. */
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  const { access } = await import("node:fs/promises");
  for (const p of candidates) {
    try {
      await access(p);
      return p;
    } catch {
      /* keep trying */
    }
  }
  return null;
}

async function launchBrowser() {
  const onVercel =
    !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  /* Use dynamic import so the heavy @sparticuz/chromium-min binary
     download isn't pulled into the build of routes that don't need
     it. Same for puppeteer-core — keep them out of the cold path. */
  const puppeteer = (await import("puppeteer-core")).default;

  if (onVercel) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: true,
    });
  }

  const localPath = await resolveLocalChrome();
  if (!localPath) {
    throw new Error(
      "No local Chrome found. Set PUPPETEER_EXECUTABLE_PATH or install Chrome.",
    );
  }
  return puppeteer.launch({
    executablePath: localPath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
    defaultViewport: { width: 1240, height: 1754 },
  });
}

export async function GET(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Quotations");
  if (deny) return deny;

  const { id } = await params;

  /* CQE — Customer-only enforcement: block the PDF of a quote an external
     customer doesn't own, BEFORE any headless-browser work. Same 404 as
     "not found". Inert when the flag is off → internal/SA unchanged. */
  if (await isCustomerEnforced(auth, supabaseServer)) {
    const { data: owner } = await supabaseServer
      .from("quotations")
      .select("created_by")
      .eq("id", id)
      .eq("tenant_id", auth.tenant_id)
      .maybeSingle();
    if (!ownsQuotation(owner as { created_by?: string | null } | null, auth.account_id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
  }

  /* DS1b-1 — single-row data_scope SHADOW (log-only) for the PDF endpoint.
     The PDF itself is rendered by a headless browser hitting the print page
     (which calls /api/quotations/[id]); this route never reads the quote
     server-side. So, ONLY when the flag is "shadow", do a tiny created_by-only
     read purely to emit the shadow log. Wrapped so it can NEVER affect the
     PDF output or status code; skipped entirely when the flag is off. */
  if (getScopeMode("Quotations") === "shadow") {
    try {
      const { data: scopeRow } = await supabaseServer
        .from("quotations")
        .select("created_by")
        .eq("id", id)
        .eq("tenant_id", auth.tenant_id)
        .maybeSingle();
      if (scopeRow) {
        await assertScopeShadowForRow({
          row: scopeRow as Record<string, unknown>,
          ctx: toScopeContext(auth),
          module: "Quotations",
          endpoint: "GET /api/quotations/[id]/pdf",
          db: supabaseServer,
          mode: "shadow",
        });
      }
    } catch {
      /* shadow logging must never break PDF rendering */
    }
  }

  /* Pull the session cookie value off the incoming request so the
     headless browser can authenticate as the same user. Cookie is
     HttpOnly, so it's only visible server-side — that's why this
     route exists at all (the client can't access it directly). */
  const cookieHeader = req.headers.get("cookie") ?? "";
  const koleexCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("koleex_session="));
  if (!koleexCookie) {
    return NextResponse.json(
      { error: "Missing session cookie." },
      { status: 401 },
    );
  }
  const cookieValue = koleexCookie.slice("koleex_session=".length);

  /* Resolve the base URL the browser should hit. Vercel sets VERCEL_URL
     (no protocol). Local dev: use the Host header. */
  const explicitBase = process.env.NEXT_PUBLIC_APP_URL;
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto =
    process.env.VERCEL || host.indexOf("localhost") === -1 ? "https" : "http";
  const baseUrl = explicitBase
    ? explicitBase.replace(/\/$/, "")
    : `${proto}://${host}`;
  const printUrl = `${baseUrl}/quotations/${encodeURIComponent(id)}/print`;
  const cookieDomain = (host.split(":")[0]).replace(/^www\./, "");

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    /* Forward the user's auth cookie so the print page's /api/quotations
       lookup returns data. Domain match has to be exact OR a leading
       dot — use the request host stripped of port. */
    await page.setCookie({
      name: "koleex_session",
      value: cookieValue,
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      secure: proto === "https",
    });

    /* Speed pass — every wait below got tightened after the user
       reported renders feeling "very long". The big saver is dropping
       networkidle-style behaviour: we don't care if Supabase or the
       sidebar finishes warming up, only that the doc + its images
       resolve, and the print page's `__quotation_pdf_ready__` flag
       already covers that.

       Bumped timeout to 60 s only for the cold-start case where
       Chromium downloads the binary mid-navigation; warm calls
       complete in well under 5 s. */
    await page.goto(printUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page
      .waitForFunction(
        () =>
          (window as unknown as { __quotation_pdf_ready__?: boolean })
            .__quotation_pdf_ready__ === true,
        { timeout: 20_000, polling: 100 },
      )
      .catch(() => {
        /* Fall through — render whatever's on screen rather than fail. */
      });

    /* preferCSSPageSize:false — we set the A4 / margin:0 layout via
       the @page rule in /quotations/[id]/print/page.tsx AND via the
       format option here. Letting Puppeteer trust the format option
       avoids a class of edge case where a missing/conflicting @page
       declaration produces oddly-sized first pages. */
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    /* Sniff the saved quote_no for the filename so the download is
       something useful like "KL2025-1024.pdf" instead of a UUID. */
    const quoteNo = await page
      .evaluate(() => {
        const el = document.querySelector("[data-quote-no]");
        return el ? el.getAttribute("data-quote-no") : null;
      })
      .catch(() => null);

    const filename = `${quoteNo ?? `quotation-${id}`}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/quotations/[id]/pdf]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
