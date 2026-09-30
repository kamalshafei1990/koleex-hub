import type { Translations } from "@/lib/i18n";

/* The public website — lib/server/website/leads.ts: someone wrote from the
   contact form, or asked for a quotation from a product's page. {who} is
   the name they gave (with their company when they gave one), {product}
   the product's name, {text} their own words. */
export const websiteTpl: Translations = {
  "website_lead.s": { en: "{who} wrote from the website", zh: "{who} 通过网站发来留言", ar: "رسالة من {who} عبر الموقع" },
  "website_lead.b": { en: "[[{text:free}]]", zh: "[[{text:free}]]", ar: "[[{text:free}]]" },
  "website_lead_quote.s": { en: "{who} asked for a quotation on the website", zh: "{who} 通过网站索取报价", ar: "طلب عرض سعر من {who} عبر الموقع" },
  "website_lead_quote.b": { en: "[[{product} · ]][[{text:free}]]", zh: "[[{product} · ]][[{text:free}]]", ar: "[[{product} · ]][[{text:free}]]" },
};
