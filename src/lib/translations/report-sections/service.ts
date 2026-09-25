import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the After-sales templates (`tpl.<key>.s.*`:
   sections, hints, checklist points, score criteria, table columns, answers).
   Loaded with a report of this family (./index.ts), never on the other
   Reports pages; the names and descriptions stay in ../reports.ts. */
const words: Translations = {
  "tpl.installation.s.link": { en: "Customer, order and machine", zh: "客户、订单和机器", ar: "العميل والطلبية والمكنة" },
  "tpl.installation.s.work": { en: "What was done", zh: "完成的工作", ar: "اتعمل إيه" },
  "tpl.installation.s.checks": { en: "Checks", zh: "检查", ar: "الفحص" },
  "tpl.installation.s.checks.i.delivered": { en: "Machine delivered complete", zh: "机器完整交付", ar: "المكنة وصلت كاملة" },
  "tpl.installation.s.checks.i.installed": { en: "Installed and levelled", zh: "已安装并调平", ar: "اتركبت واتظبطت" },
  "tpl.installation.s.checks.i.power": { en: "Power and connections checked", zh: "电源和连接已检查", ar: "الكهربا والتوصيلات اتفحصت" },
  "tpl.installation.s.checks.i.test_run": { en: "Test run passed", zh: "试运行通过", ar: "التشغيل التجريبي نجح" },
  "tpl.installation.s.checks.i.settings": { en: "Set up for the customer's material", zh: "已按客户材料调试", ar: "اتظبطت على خامة العميل" },
  "tpl.installation.s.checks.i.training": { en: "Operators trained", zh: "操作员已培训", ar: "العمال اتدربوا" },
  "tpl.installation.s.checks.i.safety": { en: "Safety explained", zh: "已讲解安全事项", ar: "السلامة اتشرحت" },
  "tpl.installation.s.checks.i.documents": { en: "Manual and warranty handed over", zh: "已交付说明书和保修卡", ar: "الكتالوج والضمان اتسلموا" },
  "tpl.installation.s.issues": { en: "Open issues", zh: "遗留问题", ar: "حاجات لسه مفتوحة" },
  "tpl.installation.s.customer_sign": { en: "Customer signature", zh: "客户签字", ar: "توقيع العميل" },
};

export default words;
