import "server-only";

import dns from "node:dns/promises";
import net from "node:net";

/* ---------------------------------------------------------------------------
   safe-url — may our SERVER fetch this address on a user's behalf?

   Fetching a URL a user (or a model) supplied means our backend makes a
   request that the browser never could: the classic SSRF shape, where
   http://169.254.169.254/… or http://10.0.0.5/admin reaches inside. This
   module is the one answer to that question, shared by every server-side
   fetch of an outside address — the Translator's page fetch and Koleex AI's
   picture proxy today. It was lifted out of fetch-page.ts unchanged
   (2026-09-07) so the second caller could not drift from the first.

     · scheme allow-list (http/https — no file:, gopher:, data:)
     · every hostname is DNS-resolved and EVERY resolved address is checked
       against the private / loopback / link-local / CGNAT ranges; one
       private answer in a round-robin disqualifies the host
     · localhost, .local and .internal names are refused by name

   Redirects are the caller's business: follow them MANUALLY and pass each
   hop back through assertSafeUrl, so a public URL cannot 302 inward.

   ACCEPTED RESIDUAL (audit, 2026-09-11): the check resolves the name and the
   platform's fetch resolves it again, so a host that answers public first
   and private second could slip a request inward within that window. Every
   caller is gated to signed-in internal users or the super admin and
   re-checks each redirect hop; closing the window would mean connecting to
   the vetted address with our own TLS/SNI handling, which the platform's
   fetch does not expose. Recorded here so it is a known shape, not a
   surprise.
   --------------------------------------------------------------------------- */

export type SafeUrlError = "bad_url" | "blocked_host" | "fetch_failed";

/** True for addresses that must never be reachable from a user-supplied URL. */
export function isPrivateAddress(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;      // link-local incl. cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true;                     // multicast / reserved
    return false;
  }
  if (v === 6) {
    const s = ip.toLowerCase();
    if (s === "::1" || s === "::") return true;
    if (s.startsWith("fe80") || s.startsWith("fc") || s.startsWith("fd")) return true;
    // IPv4-mapped (::ffff:10.0.0.1) — unwrap and re-check.
    const mapped = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  return true; // not an IP at all → refuse
}

/** Validate one URL: scheme, hostname, and every address it resolves to.
 *  Throws an Error whose message is a SafeUrlError. */
export async function assertSafeUrl(raw: string, schemes: readonly string[] = ["http:", "https:"]): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("bad_url" satisfies SafeUrlError);
  }
  if (!schemes.includes(url.protocol)) {
    throw new Error("bad_url" satisfies SafeUrlError);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("blocked_host" satisfies SafeUrlError);
    return url;
  }
  if (/^localhost$/i.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("blocked_host" satisfies SafeUrlError);
  }

  let addrs: Array<{ address: string }>;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error("fetch_failed" satisfies SafeUrlError);
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
    // ANY private answer disqualifies the host — a DNS round-robin must not
    // be able to smuggle an internal address past us on a later attempt.
    throw new Error("blocked_host" satisfies SafeUrlError);
  }
  return url;
}
