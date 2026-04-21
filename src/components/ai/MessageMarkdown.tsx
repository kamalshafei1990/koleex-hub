"use client";

/* ---------------------------------------------------------------------------
   MessageMarkdown — assistant-reply renderer.

   Takes raw model text and renders it as proper markdown (bullets,
   headings, bold/italic, inline code, code blocks, tables, links)
   instead of flat text that shows literal `**` and `-`. Uses
   react-markdown v9 (safe by default — no raw HTML) with remark-gfm
   for GitHub-style extensions (tables, strikethrough, task lists,
   autolinks).

   Design decisions:
     · No syntax highlighter — we'd ship a 100KB+ highlight.js bundle
       for something most users never see. Code blocks get a clean
       monospace box + a copy button, which covers 95% of the value.
     · Links force target=_blank + rel=noreferrer so the Hub doesn't
       leak referrer or get hijacked by window.opener.
     · Tables get a horizontal scroll wrapper — they blow out mobile
       bubbles otherwise.
     · Keeps the surrounding bubble's dir/unicode-bidi so Arabic
       replies still flow right-to-left without us fighting the
       browser's bidi algorithm inside the markdown tree.

   Not used for user messages — those stay literal. A user who types
   "what does **bold** mean?" should see "**bold**", not "bold".
   --------------------------------------------------------------------------- */

import { useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface Props {
  content: string;
  className?: string;
}

function CodeBlock({
  children,
  language,
}: {
  children: string;
  language?: string;
}): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(children).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {
        /* clipboard denied — silent; users can still select & copy */
      },
    );
  }, [children]);

  return (
    <div className="koleex-code-block">
      <div className="koleex-code-header">
        <span className="koleex-code-lang">{language || "code"}</span>
        <button
          type="button"
          onClick={onCopy}
          className="koleex-code-copy"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre>
        <code>{children}</code>
      </pre>
      <style jsx>{`
        .koleex-code-block {
          margin: 10px 0;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
          border-radius: 10px;
          overflow: hidden;
        }
        .koleex-code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          font-size: 11px;
          color: var(--text-dim, rgba(255, 255, 255, 0.55));
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.06));
        }
        .koleex-code-lang {
          text-transform: lowercase;
          letter-spacing: 0.02em;
        }
        .koleex-code-copy {
          background: transparent;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 11px;
          padding: 2px 6px;
          border-radius: 4px;
        }
        .koleex-code-copy:hover {
          background: rgba(255, 255, 255, 0.06);
        }
        .koleex-code-block :global(pre) {
          margin: 0;
          padding: 10px 12px;
          overflow-x: auto;
          font-size: 13px;
          line-height: 1.5;
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          white-space: pre;
        }
        .koleex-code-block :global(code) {
          font-family: inherit;
          background: transparent;
          padding: 0;
        }
      `}</style>
    </div>
  );
}

export default function MessageMarkdown({
  content,
  className,
}: Props): React.ReactElement {
  return (
    <div className={`koleex-md ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        /* react-markdown v9 defaults to safe rendering — no raw HTML,
           no script execution. We still force link safety explicitly. */
        components={{
          a: ({ href, children, ...rest }) => (
            <a
              {...rest}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
            >
              {children}
            </a>
          ),
          code: ({ className: cls, children, ...rest }) => {
            /* Tree structure: inline code uses <code> directly; block
               code is wrapped in <pre><code className="language-x">. */
            const isBlock = /language-/.test(cls ?? "");
            if (!isBlock) {
              return (
                <code {...rest} className="koleex-md-inline-code">
                  {children}
                </code>
              );
            }
            const language = (cls ?? "").replace(/^language-/, "") || undefined;
            const text = String(children).replace(/\n$/, "");
            return <CodeBlock language={language}>{text}</CodeBlock>;
          },
          pre: ({ children }) => <>{children}</>,
          table: ({ children, ...rest }) => (
            <div className="koleex-md-table-wrap">
              <table {...rest}>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      <style jsx>{`
        .koleex-md {
          font-size: inherit;
          line-height: 1.55;
        }
        .koleex-md :global(p) {
          margin: 0 0 10px;
        }
        .koleex-md :global(p:last-child) {
          margin-bottom: 0;
        }
        .koleex-md :global(h1),
        .koleex-md :global(h2),
        .koleex-md :global(h3),
        .koleex-md :global(h4) {
          margin: 14px 0 6px;
          font-weight: 600;
          line-height: 1.3;
        }
        .koleex-md :global(h1) { font-size: 1.15em; }
        .koleex-md :global(h2) { font-size: 1.1em; }
        .koleex-md :global(h3) { font-size: 1.05em; }
        .koleex-md :global(h4) { font-size: 1em; }
        .koleex-md :global(ul),
        .koleex-md :global(ol) {
          margin: 6px 0 10px;
          padding-inline-start: 22px;
        }
        .koleex-md :global(li) {
          margin: 2px 0;
        }
        .koleex-md :global(li > p) {
          margin: 0;
        }
        .koleex-md :global(blockquote) {
          border-inline-start: 3px solid var(--border-subtle, rgba(255,255,255,0.2));
          padding: 2px 10px;
          margin: 8px 0;
          color: var(--text-dim, rgba(255,255,255,0.7));
        }
        .koleex-md :global(strong) {
          font-weight: 600;
        }
        .koleex-md :global(em) {
          font-style: italic;
        }
        .koleex-md :global(hr) {
          border: none;
          border-top: 1px solid var(--border-subtle, rgba(255,255,255,0.1));
          margin: 12px 0;
        }
        .koleex-md :global(a) {
          color: var(--text-accent, #6aa7ff);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .koleex-md :global(.koleex-md-inline-code) {
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 0.92em;
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 5px;
          border-radius: 4px;
        }
        .koleex-md :global(.koleex-md-table-wrap) {
          overflow-x: auto;
          margin: 8px 0;
        }
        .koleex-md :global(table) {
          border-collapse: collapse;
          width: 100%;
          font-size: 0.92em;
        }
        .koleex-md :global(th),
        .koleex-md :global(td) {
          border: 1px solid var(--border-subtle, rgba(255,255,255,0.12));
          padding: 5px 10px;
          text-align: start;
        }
        .koleex-md :global(th) {
          background: rgba(255, 255, 255, 0.04);
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
