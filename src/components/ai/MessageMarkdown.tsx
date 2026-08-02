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
      
    </div>
  );
}
