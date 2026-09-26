import type { Translations } from "@/lib/i18n";

/* Reports — the section words of the Visits templates (`tpl.<key>.s.*`:
   sections, hints, checklist points, score criteria, table columns, answers).
   Loaded with a report of this family (./index.ts), never on the other
   Reports pages; the names and descriptions stay in ../reports.ts. */
const words: Translations = {
  "tpl.customer_visit.s.link": { en: "Customer, products and order", zh: "客户、产品和订单", ar: "العميل والمنتجات والطلبية" },
  "tpl.customer_visit.s.who": { en: "Customer, people and place", zh: "客户、人员和地点", ar: "العميل والأشخاص والمكان" },
  "tpl.customer_visit.s.purpose": { en: "Purpose of the visit", zh: "拜访目的", ar: "هدف الزيارة" },
  "tpl.customer_visit.s.discussion": { en: "What was discussed", zh: "讨论内容", ar: "اتكلمنا في إيه" },
  "tpl.customer_visit.s.opportunities": { en: "Opportunities", zh: "机会", ar: "الفرص" },
  "tpl.customer_visit.s.next_steps": { en: "Next steps", zh: "下一步", ar: "الخطوات الجاية" },
  "tpl.supplier_visit.s.link": { en: "Supplier and products", zh: "供应商和产品", ar: "المورد والمنتجات" },
  "tpl.supplier_visit.s.who": { en: "Supplier, people and place", zh: "供应商、人员和地点", ar: "المورد والأشخاص والمكان" },
  "tpl.supplier_visit.s.purpose": { en: "Purpose of the visit", zh: "拜访目的", ar: "هدف الزيارة" },
  "tpl.supplier_visit.s.findings": { en: "Findings", zh: "发现", ar: "اللي لقيناه" },
  "tpl.supplier_visit.s.decisions": { en: "Agreed or decided", zh: "约定及决定", ar: "اتفقنا أو قررنا" },
  "tpl.supplier_visit.s.next_steps": { en: "Next steps", zh: "下一步", ar: "الخطوات الجاية" },
};

export default words;
