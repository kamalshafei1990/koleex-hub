/* Brand Center templates — every fill-in template the studio offers. A new
   template is one file beside business-card.tsx and one line here. */

import type { TemplateDef } from "./types";
import { businessCardTeam } from "./business-card";

export const TEMPLATES: TemplateDef[] = [businessCardTeam];

export function templateById(id: string): TemplateDef | null {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
