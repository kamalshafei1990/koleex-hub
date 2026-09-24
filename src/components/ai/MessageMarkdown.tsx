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

import { isValidElement, useCallback, useMemo, useState, type ReactNode } from "react";
import { COPY } from "@/components/ai/copy";
import type { Lang } from "@/lib/i18n";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PhotoLightbox, { type LightboxPhoto } from "@/components/ai/PhotoLightbox";
import { aiImage } from "@/lib/ai/image-url";
import { blockDirection, type TextDir } from "@/lib/text-direction";

interface Props {
  content: string;
  className?: string;
  /** The screen's language, for the code-block and lightbox labels. */
  lang?: Lang;
  /** The bubble's measured direction. When given, every paragraph, heading
   *  and list item that clearly runs the other way is marked with its own
   *  dir — an Arabic reply that quotes an English paragraph, or an English
   *  one that quotes Arabic, reads correctly on both sides (owner,
   *  2026-09-15). Code blocks are always left-to-right. */
  dir?: TextDir;
}

/* The words of a hast node, for the direction of one block. */
function hastText(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; value?: string; children?: unknown[] };
  if (n.type === "text") return n.value ?? "";
  return (n.children ?? []).map(hastText).join("");
}

type MdLabels = { copied: string; copyCode: string; codeLabel: string; closePhoto: string };

function CodeBlock({
  children,
  language,
  labels,
}: {
  children: string;
  language?: string;
  labels: MdLabels;
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
    /* CODE IS LEFT-TO-RIGHT, whatever the reply around it: an Arabic answer
       that hands over a command or a prompt must not mirror it. */
    <div className="koleex-code-block" dir="ltr">
      <div className="koleex-code-header">
        <span className="koleex-code-lang">{language || labels.codeLabel}</span>
        <button
          type="button"
          onClick={onCopy}
          className="koleex-code-copy"
          aria-label={copied ? labels.copied : labels.copyCode}
        >
          {copied ? labels.copied : labels.copyCode}
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
  lang = "en",
  dir,
}: Props): React.ReactElement {
  const [lightbox, setLightbox] = useState<LightboxPhoto | null>(null);
  const closeLightbox = useCallback(() => setLightbox(null), []);
  const copy = COPY[lang] ?? COPY.en;
  const labels = useMemo<MdLabels>(
    () => ({ copied: copy.copied, copyCode: copy.copyCode, codeLabel: copy.codeLabel, closePhoto: copy.closePhoto }),
    [copy],
  );
  /* PARSED ONCE PER CHANGE OF TEXT. Every streamed token used to re-run
     remark over every reply on the screen, because the parent re-renders
     the whole thread on each delta (audit, 2026-09-07). The tree is memoised
     on the text, so a bubble whose words did not change costs nothing. */
  const rendered = useMemo(
    () => {
      /* A block's own dir, only where it differs from the bubble's, only
         when the bubble's is known. */
      const blockDir = (node: unknown): TextDir | undefined => {
        if (!dir) return undefined;
        const d = blockDirection(hastText(node), dir);
        return d === dir ? undefined : d;
      };
      return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        /* react-markdown v9 defaults to safe rendering — no raw HTML,
           no script execution. We still force link safety explicitly. */
        components={{
          p: ({ node, children, ...rest }) => <p {...rest} dir={blockDir(node)}>{children}</p>,
          h1: ({ node, children, ...rest }) => <h1 {...rest} dir={blockDir(node)}>{children}</h1>,
          h2: ({ node, children, ...rest }) => <h2 {...rest} dir={blockDir(node)}>{children}</h2>,
          h3: ({ node, children, ...rest }) => <h3 {...rest} dir={blockDir(node)}>{children}</h3>,
          h4: ({ node, children, ...rest }) => <h4 {...rest} dir={blockDir(node)}>{children}</h4>,
          li: ({ node, children, ...rest }) => <li {...rest} dir={blockDir(node)}>{children}</li>,
          blockquote: ({ node, children, ...rest }) => <blockquote {...rest} dir={blockDir(node)}>{children}</blockquote>,
          /* `node` is the hast element react-markdown hands every
             component; it must not reach the DOM as an attribute. */
          a: ({ node, href, children, ...rest }) => (void node, (
            <a
              {...rest}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
            >
              {children}
            </a>
          )),
          code: ({ node, className: cls, children, ...rest }) => {
            void node;
            /* Tree structure: inline code uses <code> directly; block
               code is wrapped in <pre><code className="language-x">. */
            const isBlock = /language-/.test(cls ?? "");
            if (!isBlock) {
              /* Inline code is its own island: `stack` inside an Arabic
                 sentence keeps its letters and its punctuation together. */
              return (
                <code {...rest} className="koleex-md-inline-code" dir="auto">
                  {children}
                </code>
              );
            }
            const language = (cls ?? "").replace(/^language-/, "") || undefined;
            const text = String(children).replace(/\n$/, "");
            return <CodeBlock labels={labels} language={language}>{text}</CodeBlock>;
          },
          /* A FENCE WITH NO LANGUAGE IS STILL A BLOCK (deep check,
             2026-09-24). Blocks were detected by `language-…` on the code
             element, so a plain ``` fence rendered as inline code: its
             newlines collapsed and it had no copy button. The <pre> is what
             marks a block — whatever the code renderer made of it, it is
             drawn as one here. */
          pre: ({ children }) => {
            const child = Array.isArray(children) ? children[0] : children;
            if (isValidElement(child) && child.type === CodeBlock) return <>{children}</>;
            const inner = isValidElement(child) ? (child.props as { children?: ReactNode }).children : children;
            const text = String(inner ?? "").replace(/\n$/, "");
            return <CodeBlock labels={labels}>{text}</CodeBlock>;
          },
          /* PRODUCT PHOTOS, DRAWN LIKE PART OF THE ANSWER. The model embeds a
             product's photo as markdown (PRODUCT_PHOTO_RULE); without this
             the image landed as a bare <img> at its natural size with no
             edge, no spacing and nothing to tap. Now: bounded, rounded,
             hairline border, and a tap opens the full picture in a new tab.

             https ONLY. A markdown image is a URL the model wrote, and a
             URL that is not https is rendered as its alt text rather than
             fetched — the same rule the call screen applies to photos it
             reads out of a tool result. */
          img: ({ src, alt }) => {
            const url = typeof src === "string" ? src : "";
            if (!/^https:\/\//i.test(url)) return <span>{alt ?? ""}</span>;
            /* A TAP EXPANDS THE PICTURE IN PLACE (PhotoLightbox) rather than
               leaving the app for a bare file in a new tab. */
            return <MarkdownPhoto url={url} alt={alt ?? ""} onOpen={() => setLightbox({ url, label: alt ?? "" })} />;
          },
          table: ({ node, children, ...rest }) => (void node, (
            <div className="koleex-md-table-wrap">
              <table {...rest}>{children}</table>
            </div>
          )),
        }}
      >
        {content}
      </ReactMarkdown>
      );
    },
    [content, labels, dir],
  );
  return (
    <div className={`koleex-md ${className ?? ""}`}>
      {rendered}
      <PhotoLightbox photo={lightbox} onClose={closeLightbox} closeLabel={labels.closePhoto} />
    </div>
  );
}

/* A PICTURE THAT FAILS TO LOAD BECOMES ITS WORDS. A web image can be a dead
   link or a host that refuses hot-linking, and the browser's broken-image
   icon inside a bordered box is the worst of both — a frame around nothing.
   The alt text is the product's or the place's name, which reads fine. */
function MarkdownPhoto({ url, alt, onOpen }: { url: string; alt: string; onOpen: () => void
}) {
  const [broken, setBroken] = useState(false);
  if (broken) return <span className="koleex-md-img-fallback">{alt}</span>;
  return (
    <button type="button" onClick={onOpen} className="koleex-md-img-link" aria-label={alt || "Photo"}>
      {/* A web photo at bubble width through the AI picture proxy, a
          catalogue photo through the optimizer — never the original file:
          a phone decoding camera-sized originals in a page that also holds
          a live call is what got that page killed (2026-09-07). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={aiImage(url, 768)} alt={alt} loading="lazy" decoding="async" className="koleex-md-img" onError={() => setBroken(true)} />
    </button>
  );
}
