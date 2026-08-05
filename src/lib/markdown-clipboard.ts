/* ---------------------------------------------------------------------------
   markdown-clipboard — what "Copy" on an AI reply actually puts on the
   clipboard.

   The bubble RENDERS markdown, but copying used to write the RAW model
   text — so pasting anywhere produced `**bold**`, `### headings` and
   `| table | soup |`. Two converters fix both paste targets:

     · markdownToPlainText — organized plain text for editors that only
       accept text (chat apps, terminals, plain notes): markers stripped,
       bullets become "•", table rows keep their column separation,
       headings keep their own line with breathing room.
     · bubbleHtmlForClipboard — the ALREADY-RENDERED bubble DOM, cleaned
       for rich targets (Word, Mail, WeChat rich input): UI chrome
       (code-copy buttons, language chips) removed, table borders inlined
       because paste targets don't receive our stylesheet.

   No markdown-to-HTML library: the bubble's DOM is the HTML — rendering
   it a second time could only disagree with what the user sees.
   --------------------------------------------------------------------------- */

/** Strip inline markdown markers from one line of text. */
function inlineText(s: string): string {
  return s
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t: string, u: string) =>
      t.trim() === u.trim() ? u : `${t} (${u})`)
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/___([^_]+)___/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1");
}

export function markdownToPlainText(md: string): string {
  if (!md) return "";
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const raw of lines) {
    if (/^\s*(```|~~~)/.test(raw)) {
      /* Fence markers vanish; the code inside stays verbatim. */
      inFence = !inFence;
      out.push("");
      continue;
    }
    if (inFence) { out.push(raw); continue; }

    /* Table separator row (|---|---|) is layout, not content. */
    if (/^\s*\|?\s*:?-{2,}/.test(raw) && /^[\s|:\-]+$/.test(raw)) continue;

    /* Table row → cells with a readable separator. */
    if (/^\s*\|.*\|\s*$/.test(raw)) {
      const cells = raw.trim().replace(/^\|/, "").replace(/\|$/, "")
        .split("|").map((c) => inlineText(c.trim()));
      out.push(cells.join("   |   "));
      continue;
    }

    /* Heading → its own line with a blank line above. */
    const h = raw.match(/^\s*#{1,6}\s+(.*)$/);
    if (h) {
      if (out.length && out[out.length - 1] !== "") out.push("");
      out.push(inlineText(h[1]));
      continue;
    }

    /* Horizontal rule → a visible divider. */
    if (/^\s*([-*_]\s*){3,}$/.test(raw)) { out.push("────────────"); continue; }

    let line = raw
      .replace(/^(\s*)[-*+]\s+/, "$1• ")   /* bullets */
      .replace(/^\s*>\s?/, "");            /* blockquote marker */
    line = inlineText(line);
    out.push(line);
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Clean the rendered bubble's DOM for a text/html clipboard flavor. */
export function bubbleHtmlForClipboard(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  /* UI chrome is not content: code-block headers (language chip + Copy
     button) and any other buttons that live inside the bubble. */
  clone.querySelectorAll(".koleex-code-header").forEach((n) => n.remove());
  clone.querySelectorAll("button").forEach((n) => n.remove());
  /* Paste targets never see our stylesheet — carry the structural styles
     inline so tables and code blocks arrive looking like tables and code. */
  clone.querySelectorAll("table").forEach((t) => {
    (t as HTMLElement).style.borderCollapse = "collapse";
  });
  clone.querySelectorAll("th, td").forEach((c) => {
    const e = c as HTMLElement;
    e.style.border = "1px solid #999";
    e.style.padding = "4px 8px";
    e.style.textAlign = "start";
  });
  clone.querySelectorAll("pre").forEach((p) => {
    const e = p as HTMLElement;
    e.style.fontFamily = "Menlo, Consolas, monospace";
    e.style.background = "#f5f5f5";
    e.style.padding = "10px 12px";
    e.style.borderRadius = "6px";
    e.style.whiteSpace = "pre-wrap";
  });
  /* Our utility classes mean nothing outside the Hub. */
  clone.querySelectorAll("[class]").forEach((n) => n.removeAttribute("class"));
  return clone.innerHTML;
}
