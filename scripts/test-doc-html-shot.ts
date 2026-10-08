import { sanitizeDocInput, renderDocHtml } from "../src/lib/server/ai/doc-gen";
import { launchPdfBrowser } from "../src/lib/server/pdf/chromium";

async function shot(name: string, raw: unknown, path: string) {
  const doc = sanitizeDocInput(raw);
  if (!doc) throw new Error("sanitize failed for " + name);
  const browser = await launchPdfBrowser();
  const page = await browser.newPage();
  await page.setContent(renderDocHtml(doc), { waitUntil: "load" });
  await page.screenshot({ path, fullPage: false });
  await browser.close();
  console.log("saved", name);
}

async function main() {
  await shot("ar", {
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
  }, "/tmp/kx-doc-ar.png");

  await shot("zh", {
    title: "每周运营总结",
    subtitle: "Koleex AI 生成的测试文档",
    kind: "报告",
    date: "2026年10月8日",
    lang: "zh",
    sections: [
      { heading: "概览", paragraphs: ["本周完成了人力资源滚动修复并上线了图像生成功能。"], bullets: ["无安全回退", "两项新的 AI 能力"] },
      { heading: "装箱单", table: { columns: ["产品", "型号", "数量"], rows: [["包缝机", "KX-747D", "12"], ["平缝机", "KX-0303", "8"]] } },
    ],
    footerNote: "生成的文件 — 非正式商务文件。",
  }, "/tmp/kx-doc-zh.png");
}
main().catch((e) => { console.error(e); process.exit(1); });
