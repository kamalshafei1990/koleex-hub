/* ---------------------------------------------------------------------------
   notes-text — plain-text projection of a TipTap document.

   Shared by the client (list previews, auto-title) and the API (the server
   derives body_plain itself instead of trusting the client's copy). No
   directive on purpose so both sides can import it.
   --------------------------------------------------------------------------- */

type TipTapNode = {
  type?: string;
  text?: string;
  content?: unknown[];
};

/**
 * Flatten a TipTap document into plain text. Inline text inside one block is
 * concatenated as-is (marks split a word into several text nodes, so joining
 * with a space would read "He llo"), and a newline separates block nodes, so
 * the first line is the first paragraph/heading — which is what
 * deriveAutoTitle and the list preview need.
 */
export function extractPlainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  let out = "";
  const walk = (n: unknown, isRoot: boolean) => {
    if (!n || typeof n !== "object") return;
    const node = n as TipTapNode;
    if (typeof node.text === "string") {
      out += node.text;
      return;
    }
    if (node.type === "hardBreak") {
      out += "\n";
      return;
    }
    if (Array.isArray(node.content)) {
      for (const c of node.content) walk(c, false);
    }
    // Any non-text node that is not the root is a block (paragraph, heading,
    // list item, table cell, …): end it with a line break.
    if (!isRoot) out += "\n";
  };
  walk(doc, true);
  return out
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/**
 * Best "title" for a TipTap doc — its first non-empty line. Used when the
 * user hasn't typed an explicit title.
 */
export function deriveAutoTitle(doc: unknown): string {
  const plain = extractPlainText(doc);
  if (!plain) return "";
  const firstLine = plain.split("\n")[0].trim();
  return firstLine.length > 80 ? firstLine.slice(0, 80) + "…" : firstLine;
}
