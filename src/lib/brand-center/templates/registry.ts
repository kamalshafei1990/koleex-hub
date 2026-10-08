/* Brand Center templates — every fill-in template the studio offers. A new
   template is one file beside business-card.tsx and one line here. */

import type { TemplateDef } from "./types";
import { businessCard } from "./business-card";
import { printProof } from "./print-proof";
import { idBadge } from "./id-badge";
import { emailSignature } from "./email-signature";
import { eventBadge } from "./event-badge";
import { certificate } from "./certificate";
import { productPost } from "./product-post";
import { eventPost } from "./event-post";
import { occasionPost } from "./occasion-post";
import { hiringPost } from "./hiring-post";

export const TEMPLATES: TemplateDef[] = [businessCard, idBadge, emailSignature, eventBadge, certificate, productPost, eventPost, occasionPost, hiringPost, printProof];

/** Old addresses that still open the right template. */
const ALIASES: Record<string, string> = { "business-card-team": "business-card" };

export function templateById(id: string): TemplateDef | null {
  const real = ALIASES[id] ?? id;
  return TEMPLATES.find((t) => t.id === real) ?? null;
}
