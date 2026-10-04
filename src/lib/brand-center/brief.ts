/* ---------------------------------------------------------------------------
   Brand Center — an item's supplier brief: the rules as plain text to paste
   into a message to a printer or a supplier (WeChat, WhatsApp, email). In
   English, like the rules themselves; the company by its everyday name.
   --------------------------------------------------------------------------- */

import type { BcType } from "./client";
import { notAllowedOf, optionRef, type ItemRules } from "./rules";

export function supplierBrief(itemName: string, rules: ItemRules, types: BcType[]): string {
  const out: string[] = [`Koleex International Group — ${itemName}`, ""];
  for (const p of rules.specs ?? []) out.push(`${p.k}: ${p.v}`);
  if (rules.logo) out.push("", `Logo: ${rules.logo}`);

  const no = notAllowedOf(rules);
  const allowed = types
    .map((ty) => ({ label: ty.label, options: ty.options.filter((o) => o.chosen && !no.has(optionRef(ty.key, o.key))).map((o) => o.label) }))
    .filter((ty) => ty.options.length);
  if (allowed.length) {
    out.push("", "Allowed versions:");
    for (const ty of allowed) out.push(`- ${ty.label}: ${ty.options.join("; ")}`);
  }
  const forbidden = types.flatMap((ty) => ty.options.filter((o) => no.has(optionRef(ty.key, o.key))).map((o) => `- ${o.label} — ${no.get(optionRef(ty.key, o.key))}`));
  if (rules.do?.length) out.push("", "Do:", ...rules.do.map((x) => `- ${x}`));
  if (rules.dont?.length || forbidden.length) out.push("", "Don't:", ...(rules.dont ?? []).map((x) => `- ${x}`), ...forbidden);
  if (rules.vendor) out.push("", `Files and approval: ${rules.vendor}`);
  return out.join("\n").trim();
}
