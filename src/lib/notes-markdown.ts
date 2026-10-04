/* ---------------------------------------------------------------------------
   notes-markdown — TipTap JSON → Markdown (GitHub-flavoured) for "Export as
   Markdown". Pure; no directive so it can run anywhere.

   Covers every node/mark the Notes schema has (src/lib/notes-schema.ts).
   What Markdown cannot say (text colour, highlight colour, alignment,
   underline) is dropped to its plain text rather than to raw HTML, so the
   file reads cleanly anywhere. Relative URLs (images, note links) are made
   absolute with `origin` so they still resolve outside the Hub.

   Conflict copies (`attrs.conflict: true`, a language-neutral flag) get the
   label the editor shows — "Conflict copy:" in the EXPORTING user's
   language, passed in as `conflictLabel` — as an italic prefix. The label
   exists only in the export: body_plain and search never contain it.
   --------------------------------------------------------------------------- */

type Mark = { type: string; attrs?: Record<string, unknown> };
type Node = { type?: string; text?: string; attrs?: Record<string, unknown>; marks?: Mark[]; content?: Node[] };

function escapeText(s: string): string {
  return s.replace(/([\\`*_[\]<>#|])/g, "\\$1");
}

function absolute(url: string, origin: string): string {
  if (!url) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return origin ? origin.replace(/\/$/, "") + (url.startsWith("/") ? url : `/${url}`) : url;
}

/** Export options threaded through the walk. */
interface Ctx {
  origin: string;
  conflictLabel: string;
}

/** The italic conflict-copy prefix for a flagged text block ("" if none). */
function conflictPrefix(n: Node, ctx: Ctx): string {
  return n.attrs?.conflict === true && ctx.conflictLabel.trim() ? `*${escapeText(ctx.conflictLabel.trim())}* ` : "";
}

function inline(nodes: Node[] | undefined, origin: string): string {
  if (!nodes) return "";
  let out = "";
  for (const n of nodes) {
    if (n.type === "hardBreak") { out += "  \n"; continue; }
    if (n.type === "image") { out += image(n, origin); continue; }
    if (typeof n.text !== "string") { out += inline(n.content, origin); continue; }
    const marks = n.marks ?? [];
    const isCode = marks.some((m) => m.type === "code");
    let t = isCode ? "`" + n.text.replace(/`/g, "​`") + "`" : escapeText(n.text);
    if (!isCode) {
      if (marks.some((m) => m.type === "bold")) t = `**${t}**`;
      if (marks.some((m) => m.type === "italic")) t = `*${t}*`;
      if (marks.some((m) => m.type === "strike")) t = `~~${t}~~`;
    }
    const link = marks.find((m) => m.type === "link");
    if (link && typeof link.attrs?.href === "string") t = `[${t}](${absolute(link.attrs.href, origin)})`;
    out += t;
  }
  return out;
}

function image(n: Node, origin: string): string {
  const src = typeof n.attrs?.src === "string" ? absolute(n.attrs.src, origin) : "";
  const alt = typeof n.attrs?.alt === "string" ? n.attrs.alt : "";
  return src ? `![${escapeText(alt)}](${src})` : "";
}

function indent(text: string, pad: string): string {
  return text.split("\n").map((l, i) => (i === 0 || !l ? l : pad + l)).join("\n");
}

function block(n: Node, ctx: Ctx, ordinal = 1): string {
  const origin = ctx.origin;
  switch (n.type) {
    case "paragraph":
      return conflictPrefix(n, ctx) + inline(n.content, origin);
    case "heading": {
      const level = Math.min(Math.max(Number(n.attrs?.level ?? 1), 1), 6);
      return `${"#".repeat(level)} ${conflictPrefix(n, ctx)}${inline(n.content, origin)}`;
    }
    case "blockquote":
      return blocks(n.content, ctx).split("\n").map((l) => (l ? `> ${l}` : ">")).join("\n");
    case "codeBlock": {
      const lang = typeof n.attrs?.language === "string" ? n.attrs.language : "";
      const code = (n.content ?? []).map((c) => c.text ?? "").join("");
      // A code block cannot hold the label: it goes on the line above.
      const label = conflictPrefix(n, ctx).trim();
      return (label ? `${label}\n` : "") + "```" + lang + "\n" + code + "\n```";
    }
    case "horizontalRule":
      return "---";
    case "image":
      return image(n, origin);
    case "bulletList":
      return (n.content ?? []).map((li) => `- ${indent(blocks(li.content, ctx, true), "  ")}`).join("\n");
    case "orderedList": {
      const start = Number(n.attrs?.start ?? ordinal) || 1;
      return (n.content ?? [])
        .map((li, i) => {
          const marker = `${start + i}. `;
          return marker + indent(blocks(li.content, ctx, true), " ".repeat(marker.length));
        })
        .join("\n");
    }
    case "taskList":
      return (n.content ?? [])
        .map((li) => `- [${li.attrs?.checked ? "x" : " "}] ${indent(blocks(li.content, ctx, true), "  ")}`)
        .join("\n");
    case "table":
      return table(n, ctx);
    default:
      return n.content ? blocks(n.content, ctx) : inline([n], origin);
  }
}

function table(n: Node, ctx: Ctx): string {
  const rows = (n.content ?? []).map((r) =>
    (r.content ?? []).map((cell) => blocks(cell.content, ctx, true).replace(/\n+/g, " ").replace(/\|/g, "\\|")),
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const line = (r: string[]) => `| ${pad(r).join(" | ")} |`;
  return [line(rows[0]), `| ${Array(width).fill("---").join(" | ")} |`, ...rows.slice(1).map(line)].join("\n");
}

function blocks(nodes: Node[] | undefined, ctx: Ctx, tight = false): string {
  if (!nodes) return "";
  return nodes.map((c) => block(c, ctx)).join(tight ? "\n" : "\n\n");
}

/**
 * The whole note as a Markdown document (title as H1, tags as a line).
 * `conflictLabel`: the localized "Conflict copy:" prefix for flagged
 * blocks (omitted → flagged blocks export without a label).
 */
export function noteToMarkdown(input: { title: string; tags?: string[]; body: unknown; origin?: string; conflictLabel?: string }): string {
  const ctx: Ctx = { origin: input.origin ?? "", conflictLabel: input.conflictLabel ?? "" };
  const parts: string[] = [];
  if (input.title.trim()) parts.push(`# ${escapeText(input.title.trim())}`);
  if (input.tags?.length) parts.push(input.tags.map((t) => `#${t.replace(/\s+/g, "-")}`).join(" "));
  const body = input.body && typeof input.body === "object" ? blocks((input.body as Node).content, ctx) : "";
  if (body.trim()) parts.push(body.trim());
  return parts.join("\n\n") + "\n";
}

/** A safe file name for the download. */
export function noteFileName(title: string, ext: string): string {
  const base = title.trim().replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${base || "note"}.${ext}`;
}
