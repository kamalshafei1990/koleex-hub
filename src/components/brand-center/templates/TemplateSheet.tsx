"use client";

/* ---------------------------------------------------------------------------
   One page of a template, drawn in millimetres (plan steps C6 + C7).

   The drawing is always left-to-right (a template places its own text for
   Arabic); an RTL page around it must not flip the anchors.

   screen — the page with its bleed; `guides` greys the bleed and draws the
            trim (blue) and the safe margin (grey dashes).
   print  — the real size for the press: the page with its bleed, crop marks
            at the trim lines outside the bleed, and a slug line that names
            the job. The <svg> is sized in mm, so the browser's PDF is 1:1.
   --------------------------------------------------------------------------- */

import { useEffect, useId, useState, type CSSProperties } from "react";
import type { TemplateDef, TemplateValues } from "@/lib/brand-center/templates/types";
import { forgetMeasures } from "@/lib/brand-center/templates/measure";
import { cardArabic } from "./fonts";

/** Re-draw once a font finishes loading: text is placed by measured widths. */
function useFontsLoaded() {
  const [, bump] = useState(0);
  useEffect(() => {
    const fonts = typeof document !== "undefined" ? document.fonts : undefined;
    if (!fonts) return;
    const redraw = () => { forgetMeasures(); bump((n) => n + 1); };
    fonts.addEventListener("loadingdone", redraw);
    void fonts.ready.then(redraw);
    return () => fonts.removeEventListener("loadingdone", redraw);
  }, []);
}

/** Paper around the trim on a print page: bleed + crop marks + the slug. */
export const PRINT_MARGIN = 12;
const MARK_GAP = 1; // crop marks stop 1 mm short of the bleed
const SLUG_SIZE = 1.6; // mm; the slug stays between the two bottom crop marks

export function sheetSize(def: TemplateDef, values: TemplateValues, mode: "screen" | "print") {
  const { w, h } = def.size(values);
  const pad = mode === "print" && def.marks !== false ? PRINT_MARGIN : def.bleed;
  return { w, h, outerW: w + pad * 2, outerH: h + pad * 2 };
}

export default function TemplateSheet({ def, values, pageId, qrs, mode, guides = false, slug, className, style, dataPage }: {
  def: TemplateDef; values: TemplateValues; pageId: string; qrs: Record<string, boolean[][]>;
  mode: "screen" | "print"; guides?: boolean; slug?: string; className?: string; style?: CSSProperties;
  /** Marks the sheet for saving as a picture (a post's page id). */
  dataPage?: string;
}) {
  const uid = `s${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  useFontsLoaded();
  const page = def.pages.find((p) => p.id === pageId) ?? def.pages[0];
  const { w, h, outerW, outerH } = sheetSize(def, values, mode);
  const b = def.bleed;
  const marks = mode === "print" && def.marks !== false;
  const off = marks ? PRINT_MARGIN - b : 0; // where the bleed box starts
  const trim = { x: off + b, y: off + b };
  const body = page.draw(values, { w, h, bleed: b, qrs, uid: `${uid}-${page.id}` });
  /* A shaped piece (round corners, a hole): cut on screen, its line in the guides. */
  const die = def.die?.(values, page.id, { w, h, bleed: b }) ?? null;
  const cut = !!die && mode === "screen" && !guides;

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${outerW} ${outerH}`}
      width={mode === "print" ? `${outerW}mm` : "100%"} height={mode === "print" ? `${outerH}mm` : undefined}
      className={`${cardArabic.variable}${className ? ` ${className}` : ""}`} style={{ direction: "ltr", ...style }} role="img" aria-label={slug} data-page={dataPage}>
      {mode === "print" ? <rect x={0} y={0} width={outerW} height={outerH} fill="#FFFFFF" /> : null}
      <defs>
        <clipPath id={`${uid}-bleed`}><rect x={off} y={off} width={w + b * 2} height={h + b * 2} /></clipPath>
        {cut ? <clipPath id={`${uid}-die`}><path d={die} clipRule="evenodd" /></clipPath> : null}
      </defs>
      <g clipPath={`url(#${uid}-bleed)`}>
        <g transform={`translate(${off} ${off})`}>
          {cut ? <g clipPath={`url(#${uid}-die)`}>{body}</g> : body}
        </g>
      </g>

      {mode === "screen" && guides ? (() => {
        /* a post is in pixels: its lines are drawn eight times heavier */
        const k = def.digital ? 8 : 1;
        const sf = def.safeFor?.(values) ?? { top: def.safe, right: def.safe, bottom: def.safe, left: def.safe };
        return (
          <g pointerEvents="none">
            {/* A mid grey, so the bleed reads on black cards and white ones alike. */}
            <path fillRule="evenodd" fill="#8E8E93" fillOpacity={0.5}
              d={`M0 0H${outerW}V${outerH}H0Z M${trim.x} ${trim.y}h${w}v${h}h-${w}Z`} />
            <rect x={trim.x} y={trim.y} width={w} height={h} fill="none" stroke="#0066FF" strokeWidth={0.2 * k} />
            <rect x={trim.x + sf.left} y={trim.y + sf.top} width={w - sf.left - sf.right} height={h - sf.top - sf.bottom}
              fill="none" stroke="#AAAAAA" strokeWidth={0.15 * k} strokeDasharray={`${0.8 * k} ${0.6 * k}`} />
            {/* the die line in the press's magenta */}
            {die ? <path d={die} transform={`translate(${off} ${off})`} fill="none" stroke="#EC008C" strokeWidth={0.2 * k} strokeDasharray={`${1 * k} ${0.5 * k}`} /> : null}
          </g>
        );
      })() : null}

      {marks ? (
        <g stroke="#000000" strokeWidth={0.1} fill="none">
          {[trim.x, trim.x + w].map((x) => (
            <g key={`v${x}`}>
              <line x1={x} y1={0} x2={x} y2={off - MARK_GAP} />
              <line x1={x} y1={outerH - off + MARK_GAP} x2={x} y2={outerH} />
            </g>
          ))}
          {[trim.y, trim.y + h].map((y) => (
            <g key={`h${y}`}>
              <line x1={0} y1={y} x2={off - MARK_GAP} y2={y} />
              <line x1={outerW - off + MARK_GAP} y1={y} x2={outerW} y2={y} />
            </g>
          ))}
        </g>
      ) : null}
      {marks && slug ? (
        <text x={trim.x + 2} y={outerH - 3} fill="#666666"
          {...(slug.length * SLUG_SIZE * 0.6 > w - 4 ? { textLength: w - 4, lengthAdjust: "spacingAndGlyphs" as const } : {})}
          style={{ fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace", fontSize: SLUG_SIZE }}>{slug}</text>
      ) : null}
    </svg>
  );
}
