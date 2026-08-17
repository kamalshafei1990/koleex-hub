import "server-only";

/* ---------------------------------------------------------------------------
   /api/invitations/[id]/pdf — the three-page letter as one PDF.

   Same shape as the quotation PDF route, which is the point: one headless-
   Chromium pattern in this codebase, not two. Launches Chromium (the pinned
   @sparticuz pack on Vercel, a local Chrome on dev machines), navigates to the
   chrome-less /travel/<id>/print page with the caller's session cookie
   forwarded, waits for `__invitation_pdf_ready__`, and snapshots to A4.

   The three pages are three .inv-a4 sheets with `break-after: page`, so this
   produces ONE file with English, Chinese and the licence — which is what a
   consulate expects to be handed.
   --------------------------------------------------------------------------- */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { supabaseServer } from "@/lib/server/supabase-server";

export const runtime = "nodejs";
/* Cold start downloads the Chromium pack; a warm call is a couple of seconds.
   60 s is the Pro-plan ceiling. */
export const maxDuration = 60;

type RouteCtx = { params: Promise<{ id: string }> };

/* Must match the @sparticuz/chromium-min version in package.json so the
   launcher and the binary agree on the protocol version. */
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

async function resolveLocalChrome(): Promise<string | null> {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env) return env;
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
  const onVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  /* Dynamic imports keep the heavy binary out of the build of every route
     that does not render a PDF. */
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
    throw new Error("No local Chrome found. Set PUPPETEER_EXECUTABLE_PATH or install Chrome.");
  }
  return puppeteer.launch({
    executablePath: localPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1240, height: 1754 },
  });
}

export async function GET(req: Request, { params }: RouteCtx) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Travel");
  if (deny) return deny;

  const { id } = await params;

  /* Confirm the letter exists in THIS tenant before spending a browser
     launch on it, and grab the reference for the filename in the same read. */
  const { data: row, error } = await supabaseServer
    .from("invitation_letters")
    .select("reference, visitor_name")
    .eq("id", id)
    .eq("tenant_id", auth.tenant_id)
    .maybeSingle();
  if (error) {
    console.error("[api/invitations/pdf] lookup:", error.message);
    return NextResponse.json({ error: "Failed to load the invitation" }, { status: 500 });
  }
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionCookie = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("koleex_session="));
  if (!sessionCookie) {
    return NextResponse.json({ error: "Missing session cookie." }, { status: 401 });
  }
  const cookieValue = sessionCookie.slice("koleex_session=".length);

  const explicitBase = process.env.NEXT_PUBLIC_APP_URL;
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = process.env.VERCEL || host.indexOf("localhost") === -1 ? "https" : "http";
  const baseUrl = explicitBase ? explicitBase.replace(/\/$/, "") : `${proto}://${host}`;
  const printUrl = `${baseUrl}/travel/${encodeURIComponent(id)}/print`;
  const cookieDomain = (host.split(":")[0] ?? "").replace(/^www\./, "");

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    /* The print page fetches its own data from our APIs, so it needs the
       caller's session. Exact domain match, port stripped. */
    await page.setCookie({
      name: "koleex_session",
      value: cookieValue,
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      secure: proto === "https",
    });

    await page.goto(printUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page
      .waitForFunction(
        () =>
          (window as unknown as { __invitation_pdf_ready__?: boolean })
            .__invitation_pdf_ready__ === true,
        { timeout: 20_000, polling: 100 },
      )
      .catch(() => {
        /* Render what is on screen rather than fail outright — a letter
           missing its stamp beats no letter at all, and the operator can
           see the difference immediately. */
      });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    /* Name it after the visitor and the reference — the operator emails this
       straight to the customer, and "invitation-<uuid>.pdf" helps nobody. */
    const visitor = String(row.visitor_name ?? "")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    const filename = `${row.reference}${visitor ? `-${visitor}` : ""}.pdf`;

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/invitations/[id]/pdf]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
