import { sanitizeDocInput, renderDocHtml } from "../src/lib/server/ai/doc-gen";
import { launchPdfBrowser } from "../src/lib/server/pdf/chromium";
import * as fs from "node:fs";

async function main() {
  const doc = sanitizeDocInput({
    title: "ملخص العمليات الأسبوعي",
    subtitle: "تقرير تجريبي من Koleex AI",
    kind: "تقرير",
    date: "٨ أكتوبر ٢٠٢٦",
    lang: "ar",
    sections: [
      { heading: "نظرة عامة", paragraphs: ["هذا الأسبوع شمل إصلاح سكرول الموارد البشرية وإطلاق توليد الصور."], bullets: ["لا تراجعات أمنية", "قدرتان جديدتان"] },
      { heading: "قائمة التعبئة", table: { columns: ["الصنف", "الموديل", "الكمية"], rows: [["ماكينة أوفرلوك", "KX-747D", "12"], ["ماكينة مسطحة", "KX-0303", "8"]] } },
    ],
    footerNote: "مستند عمل مُولّد — ليس مستنداً رسمياً.",
  });
  if (!doc) throw new Error("sanitize failed");
  const browser = await launchPdfBrowser();
  const page = await browser.newPage();
  await page.setContent(renderDocHtml(doc), { waitUntil: "load" });
  await page.screenshot({ path: "/tmp/kx-doc-ar.png", fullPage: false });
  await browser.close();
  console.log("arabic sample screenshot saved");
}
main().catch((e) => { console.error(e); process.exit(1); });
