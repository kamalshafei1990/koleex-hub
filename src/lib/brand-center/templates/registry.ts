/* Brand Center templates — every fill-in template the studio offers. A new
   template is one file beside business-card.tsx and one line here. */

import type { TemplateDef } from "./types";
import { businessCard } from "./business-card";

export const TEMPLATES: TemplateDef[] = [businessCard];

/** Old addresses that still open the right template. */
const ALIASES: Record<string, string> = { "business-card-team": "business-card" };

export function templateById(id: string): TemplateDef | null {
  const real = ALIASES[id] ?? id;
  return TEMPLATES.find((t) => t.id === real) ?? null;
}
