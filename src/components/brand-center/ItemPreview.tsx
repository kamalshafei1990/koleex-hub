"use client";

/* Brand Center item — what it looks like: its template drawn in its
   first approved style, every side at its real proportions. Loaded on its
   own (the templates are heavy), after the page. */

import { useMemo } from "react";
import { templateById } from "@/lib/brand-center/templates/registry";
import { qrCodes } from "@/lib/brand-center/templates/qr";
import type { TemplateDef, TemplateValues } from "@/lib/brand-center/templates/types";
import TemplateSheet from "./templates/TemplateSheet";

/** The template's starting fill, moved off a style that starts as a draft. */
function startingFill(def: TemplateDef): TemplateValues {
  const v: TemplateValues = { ...def.defaults };
  const field = def.fields.find((f) => f.key === "style");
  if (!field || field.kind !== "choice" || !def.draftStyles?.includes(String(v.style))) return v;
  const first = field.options.map((o) => o.value).find((x) => !def.draftStyles?.includes(x));
  if (!first) return v;
  return def.restyle ? def.restyle(v, first) : { ...v, style: first };
}

export default function ItemPreview({ templateId, label }: { templateId: string; label: string }) {
  const def = templateById(templateId);
  const values = useMemo(() => (def ? startingFill(def) : {}), [def]);
  const qrs = useMemo(() => (def ? qrCodes(def.qrRequests?.(values)) : {}), [def, values]);
  if (!def || def.html || !def.pages.length) return null;
  const ids = def.pagesFor?.(values) ?? def.pages.map((p) => p.id);
  const pages = def.pages.filter((p) => ids.includes(p.id)).slice(0, 2);
  return (
    <div className="grid [&>*]:min-w-0 items-center gap-3" style={{ gridTemplateColumns: `repeat(${pages.length}, minmax(0, 1fr))` }}>
      {pages.map((p) => (
        <TemplateSheet key={p.id} def={def} values={values} pageId={p.id} qrs={qrs} mode="screen" slug={label}
          className="mx-auto block h-auto max-h-[320px] w-full drop-shadow-[0_6px_18px_rgba(0,0,0,0.22)]" />
      ))}
    </div>
  );
}
