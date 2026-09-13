/* ---------------------------------------------------------------------------
   validate:ai-export — one conversation as a printable page (roadmap D5).
   --------------------------------------------------------------------------- */
import { readFileSync } from "node:fs";
import { escapeHtml, markdownToHtml, renderExportHtml } from "../src/lib/server/ai/export-html";
import { ATTACH_SPLIT } from "../src/lib/server/ai/attach-embed";

let pass = 0;
const failures: string[] = [];
function check(label: string, cond: boolean | (() => boolean)) {
  let ok = false;
  try { ok = typeof cond === "function" ? cond() : cond; } catch (e) { label += ` (threw: ${e instanceof Error ? e.message : String(e)})`; }
  if (ok) { pass++; console.log(`  ✓ ${label}`); } else { failures.push(label); console.log(`  ✗ ${label}`); }
}

console.log("── 1. The page ──");
{
  const html = renderExportHtml({
    title: `Ningbo <script>alert(1)</script> "quote"`,
    lang: "en",
    exportedAt: new Date("2026-09-04T03:00:00Z"),
    messages: [
      { role: "user", content: `Price of the KX-200?${ATTACH_SPLIT}spec.pdf EMBEDDED TRANSPORT`, created_at: "2026-09-03T10:00:00Z" },
      { role: "assistant", content: "**KX-200** is 1,250 USD FOB.\n\n- 40x40 cm\n- ![KX-200](https://cdn.example/kx200.jpg)", created_at: "2026-09-03T10:00:05Z" },
      { role: "system", content: "hidden", created_at: "2026-09-03T10:00:06Z" },
      { role: "assistant", content: "   ", created_at: "2026-09-03T10:00:07Z" },
    ],
  });
  check("the title is escaped, never markup; the page is a full document with print styles and no indexing",
    html.includes("Ningbo &lt;script&gt;alert(1)&lt;/script&gt; &quot;quote&quot; · Koleex AI") && !html.includes("<script>") &&
    html.startsWith("<!doctype html>") && /@media print/.test(html) && /name="robots" content="noindex, nofollow"/.test(html));
  check("user and assistant turns are labelled and rendered as markdown; system and blank rows are left out",
    html.includes('<span class="who">You</span>') && html.includes('<span class="who">Koleex AI</span>') &&
    html.includes("<strong>KX-200</strong>") && html.includes("<li>40x40 cm</li>") && html.includes('<img src="https://cdn.example/kx200.jpg" alt="KX-200"') &&
    !html.includes("hidden") && (html.match(/<article/g) ?? []).length === 2);
  check("a typed turn's attachment transport is stripped for the page",
    html.includes("Price of the KX-200?") && !html.includes("EMBEDDED TRANSPORT"));
  check("the two labels and the direction follow the language",
    renderExportHtml({ title: null, lang: "ar", messages: [] }).includes('dir="rtl"') && renderExportHtml({ title: null, lang: "ar", messages: [] }).includes("<h1>محادثة</h1>") &&
    renderExportHtml({ title: null, lang: "zh", messages: [{ role: "user", content: "你好", created_at: "t" }] }).includes('<span class="who">你</span>') &&
    renderExportHtml({ title: "", lang: "en", messages: [] }).includes("<h1>Conversation</h1>"));
  check("escapeHtml covers the five characters; markdownToHtml never emits raw HTML from the content",
    escapeHtml(`&<>"'`) === "&amp;&lt;&gt;&quot;&#39;" && !/<img[^>]*onerror/.test(markdownToHtml("<img src=x onerror=alert(1)>")) &&
    markdownToHtml("<img src=x onerror=alert(1)>").includes("&lt;img") && !/href="javascript:/.test(markdownToHtml("[x](javascript:alert(1))")));
}

console.log("\n── 2. The route and the sidebar, read ──");
{
  const route = readFileSync("src/app/api/ai/conversations/[id]/export/route.ts", "utf8");
  check("the route opens with the conversation doors and the owner triple, then renders the saved messages as HTML with no-store",
    /requireAuth\(\)[\s\S]{0,200}?requireInternalUser\(auth\)/.test(route) &&
    /\.eq\("id", conversationId\)\s*\.eq\("tenant_id", auth\.tenant_id\)\s*\.eq\("account_id", auth\.account_id\)/.test(route) &&
    /renderExportHtml\(\{ title: [\s\S]{0,120}?lang, messages: \(rows \?\? \[\]\) as ExportMessage\[\] \}\)/.test(route) &&
    /"Content-Type": "text\/html; charset=utf-8"/.test(route) && /"Cache-Control": "no-store"/.test(route) &&
    /console\.log\(`\[ai\.conversations\.export\] ok messages=/.test(route) && !/console\.\w+\([^)]*content/.test(route));
  const sidebar = readFileSync("src/components/ai/Sidebar.tsx", "utf8");
  check("the row menu offers Export / print only when a handler is given, above the danger separator",
    /\.\.\.\(onExport\s*\?\s*\[\{ key: "export", label: copy\.exportChat,[\s\S]{0,140}?onSelect: onExport \} as MenuItem\]\s*:\s*\[\]\),\s*\{ key: "sep-danger"/.test(sidebar));
  const app = readFileSync("src/components/ai/KoleexAiApp.tsx", "utf8");
  check("every chat row opens the export in a new tab with the caller's language",
    /window\.open\(`\/api\/ai\/conversations\/\$\{encodeURIComponent\(id\)\}\/export\?lang=\$\{lang\}`, "_blank", "noopener"\)/.test(app) &&
    (app.match(/onExport=\{\(\) => exportConversation\(c\.id\)\}/g) ?? []).length === 3);
}

console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILED:");
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
console.log("NOT proved here: the page on a phone and Share → Print — exporting a real chat is the test.");
