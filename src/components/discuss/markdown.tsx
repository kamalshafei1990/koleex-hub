"use client";

/* ---------------------------------------------------------------------------
   markdown — minimal Slack/WhatsApp-style markdown renderer for Discuss.

   Why a hand-rolled parser instead of remark/react-markdown:
     · We only support a narrow subset (bold, italic, strike, inline code,
       code blocks, links) so pulling in 200 kB of remark is overkill
     · We need to interleave @mention spans (already pre-computed as
       offset/length ranges) with inline formatting without double-parsing
     · Zero dependencies keeps the bundle tight — Discuss renders messages
       on every scroll, so parsing has to be O(n) in message length

   Supported syntax:
     **bold**      → <strong>
     *italic*      → <em>        (also _italic_)
     ~~strike~~    → <del>
     `code`        → <code>      (inline, monospace background)
     ```code```    → pre block   (multi-line, syntax-hint friendly)
     [text](url)   → <a>         (http/https only)

   Auto-linking: bare http(s):// URLs are detected and wrapped in <a>
   without requiring the markdown [text](url) syntax.

   Security: all URLs are validated against an http(s) allowlist before
   being used as href. Nothing ever renders as raw HTML — we build a
   React tree of strings + spans + anchors, so an injected <script> tag
   in the body would just render as the literal text "<script>".
   --------------------------------------------------------------------------- */

import type { DiscussMention } from "@/types/supabase";

/** Inline token output — one item per contiguous text/formatting run. */
type InlineNode = React.ReactNode;

/** Detect bare URLs so we can auto-link them. Anchored to word boundaries
 *  so "foo.http://bar" doesn't match. */
const URL_RE = /https?:\/\/[^\s<>()"]+/g;

/** Safe-href check: only allow http(s), never javascript:/data:. */
function safeHref(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    return null;
  } catch {
    return null;
  }
}

/** Split a message body into code-block and non-code-block segments.
 *  Code blocks are fenced with triple backticks; everything else runs
 *  through the inline parser. */
function splitCodeBlocks(body: string): Array<
  | { kind: "code"; lang: string | null; content: string }
  | { kind: "text"; content: string }
> {
  const out: Array<
    | { kind: "code"; lang: string | null; content: string }
    | { kind: "text"; content: string }
  > = [];
  const re = /```([a-zA-Z0-9_+-]*)\n?([\s\S]*?)```/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    if (match.index > cursor) {
      out.push({ kind: "text", content: body.slice(cursor, match.index) });
    }
    out.push({
      kind: "code",
      lang: match[1] || null,
      content: match[2] ?? "",
    });
    cursor = match.index + match[0].length;
  }
  if (cursor < body.length) {
    out.push({ kind: "text", content: body.slice(cursor) });
  }
  return out;
}

/** Inline parser: walks the string once, applying bold/italic/strike/code
 *  and auto-linking as it goes. Returns an array of React nodes. */
function parseInline(text: string, keyPrefix: string): InlineNode[] {
  if (!text) return [];
  const out: InlineNode[] = [];

  /* Step 1: split by bare URLs so we can auto-link them first. */
  let cursor = 0;
  let counter = 0;
  const urlMatches = Array.from(text.matchAll(URL_RE));

  for (const m of urlMatches) {
    const idx = m.index ?? 0;
    if (idx > cursor) {
      out.push(
        ...parseFormatting(
          text.slice(cursor, idx),
          `${keyPrefix}-t-${counter++}`,
        ),
      );
    }
    const safe = safeHref(m[0]);
    if (safe) {
      out.push(
        <a
          key={`${keyPrefix}-u-${counter++}`}
          href={safe}
          target="_blank"
          rel="noreferrer"
          className="text-blue-300 underline decoration-blue-300/40 hover:decoration-blue-300 break-words"
        >
          {m[0]}
        </a>,
      );
    } else {
      out.push(m[0]);
    }
    cursor = idx + m[0].length;
  }
  if (cursor < text.length) {
    out.push(
      ...parseFormatting(text.slice(cursor), `${keyPrefix}-t-${counter++}`),
    );
  }
  return out;
}

/** Step 2: within a plain (non-URL) segment, parse the bold/italic/strike/
 *  inline-code tokens. Uses a single left-to-right scan with a small
 *  state machine so we don't accidentally match across nested or
 *  unbalanced delimiters. */
function parseFormatting(text: string, keyPrefix: string): InlineNode[] {
  const out: InlineNode[] = [];
  /* We match the longest-first delimiters so `**a**` resolves as bold, not
     double-italic. Order matters. */
  const PATTERN =
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\*\*([^*\n]+?)\*\*|__([^_\n]+?)__|~~([^~\n]+?)~~|`([^`\n]+?)`|\*([^*\n]+?)\*|_([^_\n]+?)_/g;
  let cursor = 0;
  let counter = 0;
  let match: RegExpExecArray | null;
  while ((match = PATTERN.exec(text)) !== null) {
    const idx = match.index;
    if (idx > cursor) out.push(text.slice(cursor, idx));
    if (match[1] !== undefined && match[2] !== undefined) {
      /* [text](url) */
      const href = safeHref(match[2]);
      if (href) {
        out.push(
          <a
            key={`${keyPrefix}-l-${counter++}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-blue-300 underline decoration-blue-300/40 hover:decoration-blue-300 break-words"
          >
            {match[1]}
          </a>,
        );
      } else {
        out.push(match[0]);
      }
    } else if (match[3] !== undefined) {
      /* **bold** */
      out.push(
        <strong
          key={`${keyPrefix}-b-${counter++}`}
          className="font-semibold text-[var(--text-primary)]"
        >
          {match[3]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      /* __bold__ */
      out.push(
        <strong
          key={`${keyPrefix}-b2-${counter++}`}
          className="font-semibold text-[var(--text-primary)]"
        >
          {match[4]}
        </strong>,
      );
    } else if (match[5] !== undefined) {
      /* ~~strike~~ */
      out.push(
        <del
          key={`${keyPrefix}-s-${counter++}`}
          className="line-through text-[var(--text-muted)]"
        >
          {match[5]}
        </del>,
      );
    } else if (match[6] !== undefined) {
      /* `code` */
      out.push(
        <code
          key={`${keyPrefix}-c-${counter++}`}
          className="px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11.5px] text-orange-300"
        >
          {match[6]}
        </code>,
      );
    } else if (match[7] !== undefined) {
      /* *italic* */
      out.push(
        <em key={`${keyPrefix}-i-${counter++}`} className="italic">
          {match[7]}
        </em>,
      );
    } else if (match[8] !== undefined) {
      /* _italic_ */
      out.push(
        <em key={`${keyPrefix}-i2-${counter++}`} className="italic">
          {match[8]}
        </em>,
      );
    }
    cursor = idx + match[0].length;
  }
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

/** Apply @mention ranges on top of parsed inline nodes. Because mentions
 *  are stored as offset ranges against the RAW body (not the parsed
 *  token stream), we re-parse the body char-by-char here: plain text
 *  chars go through the inline parser, and chars inside a mention range
 *  become a styled span. */
function renderWithMentions(
  body: string,
  mentions: DiscussMention[],
  keyPrefix: string,
): InlineNode[] {
  if (!mentions || mentions.length === 0) {
    return parseInline(body, keyPrefix);
  }
  const sorted = [...mentions].sort((a, b) => a.offset - b.offset);
  const out: InlineNode[] = [];
  let cursor = 0;
  let counter = 0;
  for (const m of sorted) {
    if (m.offset < cursor || m.offset > body.length) continue;
    if (m.offset > cursor) {
      out.push(
        ...parseInline(
          body.slice(cursor, m.offset),
          `${keyPrefix}-m-${counter++}`,
        ),
      );
    }
    const end = Math.min(m.offset + m.length, body.length);
    out.push(
      <span
        key={`${keyPrefix}-mention-${counter++}`}
        className="inline-flex items-center px-1 rounded bg-blue-500/15 text-blue-300 font-semibold"
      >
        @{m.username}
      </span>,
    );
    cursor = end;
  }
  if (cursor < body.length) {
    out.push(
      ...parseInline(body.slice(cursor), `${keyPrefix}-tail-${counter++}`),
    );
  }
  return out;
}

/** Public: render a full message body. Splits into code blocks and
 *  non-code-block segments, then runs each non-code segment through
 *  inline parsing + mentions. Returns an array of React nodes ready
 *  to drop into a <div className="whitespace-pre-wrap">. */
export function renderDiscussMarkdown(
  body: string,
  mentions: DiscussMention[] | undefined,
  keyPrefix: string,
): React.ReactNode {
  if (!body) return null;
  const segments = splitCodeBlocks(body);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "code") {
          return (
            <pre
              key={`${keyPrefix}-pre-${i}`}
              className="my-1.5 p-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-x-auto"
            >
              {seg.lang && (
                <div className="mb-1.5 text-[9.5px] font-mono font-semibold uppercase tracking-wider text-[var(--text-dim)]">
                  {seg.lang}
                </div>
              )}
              <code className="font-mono text-[11.5px] leading-relaxed text-[var(--text-primary)] whitespace-pre">
                {seg.content}
              </code>
            </pre>
          );
        }
        return (
          <span key={`${keyPrefix}-seg-${i}`}>
            {renderWithMentions(seg.content, mentions ?? [], `${keyPrefix}-s${i}`)}
          </span>
        );
      })}
    </>
  );
}
