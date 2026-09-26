/* ---------------------------------------------------------------------------
   components/ai/source-links — web sources in an answer, drawn as small chips.

   Owner, 2026-09-26, on an answer that pasted
   "(https://www.forbes.com/sites/…/the-worlds-most-valuable-soccer-teams-2026)"
   into the middle of an Arabic sentence: "the resources like this which is
   not organized at all". A web source now reads as a short chip with the
   site's name — "forbes.com" — the way the assistants people know show them.
   The prompts ask for [Site](url) links; this is the screen's half, so an
   answer that still pastes a bare address is drawn the same way.

   Pure functions, no React, so the rules are testable.
   --------------------------------------------------------------------------- */

/** The longest link text drawn as a chip; longer text is part of a sentence
 *  and stays an ordinary link. */
const CHIP_TEXT_MAX = 30;

/** "https://www.forbes.com/sites/x" → "forbes.com"; null for anything that
 *  is not an absolute web address. */
export function siteLabel(href: string | undefined): string | null {
  if (!href || !/^https?:\/\//i.test(href)) return null;
  try {
    const host = new URL(href).hostname.replace(/^www\./i, "");
    return host || null;
  } catch {
    return null;
  }
}

/** Should this link be drawn as a source chip, and with what words? A web
 *  link whose text is its own address gets the site's name; a web link with
 *  a short name keeps its name. Hub links (/reports/…) and long link text
 *  are left as ordinary links. */
export function sourceChipLabel(href: string | undefined, text: string): string | null {
  const site = siteLabel(href);
  if (!site) return null;
  const t = text.trim();
  if (!t || /^https?:\/\//i.test(t) || /^www\./i.test(t)) return site;
  return t.length <= CHIP_TEXT_MAX ? t : null;
}

/** A bare address the model wrapped in brackets — "(https://…)" — loses the
 *  brackets, so the chip does not sit inside a pair of stray parentheses.
 *  A markdown link's "](url)" is left alone, and so is code. */
export function tidyBareLinks(markdown: string): string {
  if (!markdown || !/\(https?:\/\//i.test(markdown)) return markdown;
  return markdown
    .split(/(```[\s\S]*?```|`[^`\n]*`)/g)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(/(^|[^\]])\((https?:\/\/[^\s()]+)\)/g, "$1 $2")))
    .join("");
}
