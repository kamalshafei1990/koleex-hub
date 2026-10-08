import "server-only";

/* ---------------------------------------------------------------------------
   pdf/chromium — the one headless-Chromium launcher for server-side PDF.

   Extracted, unchanged in behaviour, from /api/quotations/[id]/pdf — the
   route that proved this recipe in production: @sparticuz/chromium-min with
   its pinned binary pack on Vercel, a locally-installed Chrome on dev
   machines (PUPPETEER_EXECUTABLE_PATH first, then the conventional macOS /
   Linux paths), dynamic imports so the binary never lands in a bundle that
   does not render PDFs.

   New PDF surfaces (the AI document tool) launch through here so the next
   chromium bump is one line in one file. The quotation / report / invitation
   routes still carry their own copy — moving them is a deliberate follow-up,
   not a drive-by in an AI feature commit.
   --------------------------------------------------------------------------- */

/* Pinned Chromium pack hosted by @sparticuz. The URL has to match the
   exact @sparticuz/chromium-min version installed in package.json so
   the launcher and the binary agree on the protocol version. */
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

function resolveLocalChrome(): string | null {
  const env = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (env) return env;
  /* Conventional install locations. Best-effort — if none exist the
     caller gets a clear error, not a stack trace. */
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ];
  for (const p of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      if (require("node:fs").existsSync(p)) return p;
    } catch {
      /* keep looking */
    }
  }
  return null;
}

/** A headless browser pointed at a renderable page. Caller owns `close()`. */
export async function launchPdfBrowser() {
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

  const localPath = resolveLocalChrome();
  if (!localPath) {
    throw new Error(
      "No local Chrome found. Set PUPPETEER_EXECUTABLE_PATH or install Chrome.",
    );
  }
  return puppeteer.launch({
    executablePath: localPath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1240, height: 1754 },
  });
}
