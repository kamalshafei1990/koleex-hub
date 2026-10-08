import "server-only";

/* ---------------------------------------------------------------------------
   ai/export-html — one conversation as a page a person can print or share.

   Roadmap D5. The owner wants to hand a chat to a colleague or keep it: on a
   phone that means "open, then Share → Print → Save as PDF", which any
   browser does from a plain page. So the export is HTML, rendered on the
   server from the saved messages, with the same markdown the chat shows and
   print styles — no PDF library, no headless browser, nothing that fails in
   a serverless function or behind a mainland network.

   WHAT IS IN IT: the caller's own conversation only (the route checks the
   owner triple), the messages as saved with the attachment transport
   stripped (attach-embed), the caller's language for the two labels. Every
   piece of text is either escaped or rendered by the markdown renderer;
   nothing is interpolated raw into markup.
   --------------------------------------------------------------------------- */

import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import type { Lang } from "@/lib/i18n";
import { stripAttachEmbed } from "@/lib/server/ai/attach-embed";

export type ExportMessage = { role: string; content: string | null; created_at: string };

const LABELS: Record<Lang, { you: string; assistant: string; exported: string; untitled: string }> = {
  en: { you: "You", assistant: "Koleex AI", exported: "Exported", untitled: "Conversation" },
  zh: { you: "你", assistant: "Koleex AI", exported: "导出于", untitled: "对话" },
  ar: { you: "انت", assistant: "Koleex AI", exported: "تم التصدير", untitled: "محادثة" },
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** Markdown to HTML with the same GFM grammar the chat renders (react-markdown
 *  is built on this parser; react-dom/server is not available to a route
 *  under the server condition). Raw HTML in the content is ESCAPED, never
 *  emitted as markup, and unsafe URL schemes are dropped — both micromark
 *  defaults, relied on here and asserted in the suite. */
export function markdownToHtml(content: string): string {
  return micromark(content, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
}

function whenLabel(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const locale = lang === "zh" ? "zh-CN" : lang === "ar" ? "ar-EG" : "en-GB";
  try {
    return d.toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

export function renderExportHtml(input: {
  title: string | null;
  lang: Lang;
  messages: readonly ExportMessage[];
  exportedAt?: Date;
}): string {
  const L = LABELS[input.lang];
  const dir = input.lang === "ar" ? "rtl" : "ltr";
  const title = escapeHtml((input.title ?? "").trim() || L.untitled);
  const exported = whenLabel((input.exportedAt ?? new Date()).toISOString(), input.lang);
  const body = input.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => {
      const who = m.role === "user" ? L.you : L.assistant;
      const text = m.role === "user" ? stripAttachEmbed(m.content as string) : (m.content as string);
      return `<article class="msg ${m.role}"><header><span class="who">${escapeHtml(who)}</span><time>${escapeHtml(whenLabel(m.created_at, input.lang))}</time></header><div class="body">${markdownToHtml(text)}</div></article>`;
    })
    .join("\n");
  return `<!doctype html>
<html lang="${input.lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title} · Koleex AI</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 24px 16px 48px; font: 15px/1.55 -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", "Noto Sans SC", sans-serif; color: #0D0D0D; background: #FFFFFF; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666666; font-size: 12px; margin-bottom: 24px; }
  .msg { border-top: 1px solid #E6E6E6; padding: 14px 0; }
  .msg header { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; color: #666666; margin-bottom: 4px; }
  .msg .who { font-weight: 600; color: #0D0D0D; }
  .msg.assistant .who { color: #0066FF; }
  .body p { margin: 0 0 8px; } .body ul, .body ol { margin: 0 0 8px; padding-inline-start: 22px; }
  .body img { max-width: 100%; height: auto; border-radius: 12px; display: block; margin: 8px 0; }
  .body table { border-collapse: collapse; } .body td, .body th { border: 1px solid #E6E6E6; padding: 4px 8px; font-size: 13px; }
  .body pre { background: #F4F4F4; padding: 8px 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; }
  .body a { color: #0066FF; }
  @media print { body { padding: 0; } .msg { break-inside: avoid; } }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <div class="meta">Koleex AI · ${escapeHtml(L.exported)} ${escapeHtml(exported)}</div>
${body}
</main>
</body>
</html>
`;
}
