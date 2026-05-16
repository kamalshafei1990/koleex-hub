import "server-only";

/* ===========================================================================
   POST /api/reports/export/pdf
   Body: { type: ReportType, filters: ReportFilters }
   Returns: application/pdf attachment

   The route builds the report payload, renders the official HTML via
   the renderer, and pipes it directly to Puppeteer's setContent. We
   don't navigate a print page on this route because:
     1. The HTML is fully self-contained (no external assets, no API
        callbacks) — setContent is faster and avoids forwarding the
        session cookie.
     2. The audit row is written by buildAndAudit() before we hand off
        to Puppeteer, so a Chromium crash still records the attempt.
   ========================================================================== */

import { NextResponse } from "next/server";
import { requireAuth, requireModuleAccess } from "@/lib/server/auth";
import { buildAndAudit } from "@/lib/reports/build";
import { renderReportHtml } from "@/lib/reports/html-renderer";
import { pageFooterTemplate } from "@/lib/reports/layout";
import type { ReportFilters, ReportType } from "@/lib/reports/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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
    try { await access(p); return p; } catch { /* try next */ }
  }
  return null;
}

async function launchBrowser() {
  const onVercel = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
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
  if (!localPath) throw new Error("No local Chrome found. Set PUPPETEER_EXECUTABLE_PATH or install Chrome.");
  return puppeteer.launch({
    executablePath: localPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1240, height: 1754 },
  });
}

interface Body {
  type?: ReportType;
  filters?: ReportFilters;
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;
  const deny = await requireModuleAccess(auth, "Finance");
  if (deny) return deny;

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.type) return NextResponse.json({ error: "type is required" }, { status: 400 });

  const built = await buildAndAudit({
    auth,
    type: body.type,
    filters: body.filters ?? {},
    channel: "pdf",
  });
  if (!built.ok) return NextResponse.json({ error: built.error }, { status: built.status });

  const html = renderReportHtml(built.result.payload, { autoPrint: false });

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    /* setContent with waitUntil "load" ensures fonts + inline SVG
       finish before snapshot. No external network needed. */
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    /* Belt-and-braces: wait for the renderer's ready flag too. */
    await page.waitForFunction(
      () => (window as unknown as { __report_pdf_ready__?: boolean }).__report_pdf_ready__ === true,
      { timeout: 8_000, polling: 100 },
    ).catch(() => undefined);

    /* Phase R — enterprise PDF output:
         · preferCSSPageSize:true so the @page rule in the document
           drives margins (single source of truth)
         · displayHeaderFooter:true with a footer template that prints
           "Page X of Y" + report ID + tenant on EVERY page
         · empty headerTemplate so the top margin stays clean (the
           document header is rendered inside the first page) */
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: `<div></div>`,
      footerTemplate: pageFooterTemplate(built.result.payload),
      margin: { top: "0", right: "0", bottom: "20mm", left: "0" },
    });

    const filename = `${built.result.payload.meta.report_no}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[api/reports/export/pdf]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
