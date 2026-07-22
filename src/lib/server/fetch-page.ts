import "server-only";

import dns from "node:dns/promises";
import net from "node:net";

/* ---------------------------------------------------------------------------
   Safe outbound page fetch — for the Translator's Website tab.

   Fetching a URL the user typed means our SERVER makes a request on their
   behalf, which is the classic SSRF shape: someone types
   http://169.254.169.254/… or http://10.0.0.5/admin and our backend reaches
   somewhere the browser never could. Everything here exists to close that:

     · scheme allow-list (http/https only — no file:, gopher:, data:)
     · every hostname is DNS-resolved and every resolved address checked
       against the private / loopback / link-local / CGNAT ranges
     · redirects are followed MANUALLY, re-validating each hop, so a public
       URL can't 302 into the private network
     · hard caps on hops, bytes and time so one request can't hang a function

   Text extraction is deliberately regex-based rather than a DOM parser: we
   only need reading order for translation, not a faithful tree, and it keeps
   a parser dependency out of the serverless bundle.
   --------------------------------------------------------------------------- */

export const PAGE_MAX_BYTES = 2_000_000;   // 2 MB of HTML is a very large page
export const PAGE_MAX_HOPS = 4;
export const PAGE_TIMEOUT_MS = 12_000;
export const PAGE_MAX_BLOCKS = 300;        // ~300 paragraphs is a long article

export type FetchPageError =
  | "bad_url"
  | "blocked_host"
  | "too_many_redirects"
  | "not_html"
  | "fetch_failed"
  | "empty_page";

/** True for addresses that must never be reachable from a user-supplied URL. */
function isPrivateAddress(ip: string): boolean {
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

/** Validate one URL: scheme, hostname, and every address it resolves to. */
async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("bad_url" satisfies FetchPageError);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("bad_url" satisfies FetchPageError);
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new Error("blocked_host" satisfies FetchPageError);
    return url;
  }
  if (/^localhost$/i.test(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("blocked_host" satisfies FetchPageError);
  }

  let addrs: Array<{ address: string }>;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error("fetch_failed" satisfies FetchPageError);
  }
  if (!addrs.length || addrs.some((a) => isPrivateAddress(a.address))) {
    // ANY private answer disqualifies the host — a DNS round-robin must not
    // be able to smuggle an internal address past us on a later attempt.
    throw new Error("blocked_host" satisfies FetchPageError);
  }
  return url;
}

export interface FetchedPage {
  url: string;
  title: string | null;
  blocks: string[];
  truncated: boolean;
}

/** Fetch a page and return its readable text blocks in document order. */
export async function fetchPageText(input: string): Promise<FetchedPage> {
  let current = await assertSafeUrl(input.trim());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PAGE_TIMEOUT_MS);

  try {
    let res: Response | null = null;
    for (let hop = 0; hop <= PAGE_MAX_HOPS; hop++) {
      res = await fetch(current.toString(), {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          // Identify honestly and ask for HTML; some sites 403 an empty UA.
          "User-Agent": "KoleexHub-Translator/1.0 (+https://hub.koleexgroup.com)",
          Accept: "text/html,application/xhtml+xml",
          "Accept-Language": "en,zh,ar;q=0.8",
        },
      }).catch(() => {
        throw new Error("fetch_failed" satisfies FetchPageError);
      });

      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) break;
        // Re-validate the target: a public page must not redirect us inward.
        current = await assertSafeUrl(new URL(loc, current).toString());
        res = null;
        continue;
      }
      break;
    }
    if (!res) throw new Error("too_many_redirects" satisfies FetchPageError);
    if (!res.ok) throw new Error("fetch_failed" satisfies FetchPageError);

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(type)) {
      throw new Error("not_html" satisfies FetchPageError);
    }

    const html = await readCapped(res, PAGE_MAX_BYTES);
    const { title, blocks } = extractReadableText(html);
    if (!blocks.length) throw new Error("empty_page" satisfies FetchPageError);

    return {
      url: current.toString(),
      title,
      blocks: blocks.slice(0, PAGE_MAX_BLOCKS),
      truncated: blocks.length > PAGE_MAX_BLOCKS,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Read a response body but stop at `max` bytes — a 500 MB "page" must not
    become a 500 MB string in a serverless function. */
async function readCapped(res: Response, max: number): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let out = "";
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    out += decoder.decode(value, { stream: true });
    if (total >= max) {
      await reader.cancel().catch(() => {});
      break;
    }
  }
  return out + decoder.decode();
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  mdash: "—", ndash: "–", hellip: "…", rsquo: "'", lsquo: "'",
  rdquo: "”", ldquo: "“", middot: "·",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}
function safeCodePoint(n: number): string {
  return Number.isFinite(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
}

/**
 * Pull the readable text out of an HTML document as ordered blocks.
 *
 * Not a parser — a stripper. Script/style/nav/footer chrome is removed
 * wholesale, block-level tags become paragraph breaks, everything else is
 * dropped, and the result is split on those breaks. Good enough to translate
 * a supplier page or a product spec; it is not trying to rebuild the layout.
 */
export function extractReadableText(html: string): { title: string | null; blocks: string[] } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim().slice(0, 300) : null;

  let s = html;
  // Chrome and non-content elements: remove tag AND contents.
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  s = s.replace(/<(script|style|noscript|svg|canvas|template|iframe)[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<(nav|header|footer|aside|form|select)[\s\S]*?<\/\1>/gi, " ");

  // Block-level boundaries become explicit breaks so paragraphs stay separate.
  s = s.replace(/<\/(p|div|section|article|li|tr|h[1-6]|blockquote|td|th|dd|dt)>/gi, "\n\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<li\b[^>]*>/gi, "\n• ");

  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);

  return {
    title,
    blocks: s
      .split(/\n{2,}/)
      .map((b) => b.replace(/[ \t ]+/g, " ").replace(/\n{2,}/g, "\n").trim())
      // One- or two-character fragments are menu crumbs, not content.
      .filter((b) => b.replace(/\s/g, "").length > 2),
  };
}
