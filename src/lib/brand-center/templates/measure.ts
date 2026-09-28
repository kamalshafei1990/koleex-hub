/* Real text widths from the browser's own layout (a canvas), in a
   template's typeface — so a slash or a title can sit right after a name of
   any length. CSS variables in the stack are resolved on the page. The
   cache is dropped when a font finishes loading (TemplateSheet re-draws). */

const measured = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null | undefined;
export function forgetMeasures() { measured.clear(); }
function resolveStack(font: string): string {
  if (typeof document === "undefined") return font;
  const css = getComputedStyle(document.documentElement);
  return font.replace(/var\((--[\w-]+)\)\s*,?/g, (_, name: string) => {
    const v = css.getPropertyValue(name).trim();
    return v ? `${v},` : "";
  });
}
export function measure(text: string, size: number, weight: number, font: string, italic: boolean): number | null {
  if (typeof document === "undefined") return null;
  const key = `${font}|${weight}|${italic ? 1 : 0}|${text}`;
  const hit = measured.get(key);
  if (hit !== undefined) return hit * size;
  if (measureCtx === undefined) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return null;
  measureCtx.font = `${italic ? "italic " : ""}${weight} 100px ${resolveStack(font)}`;
  const em = measureCtx.measureText(text).width / 100;
  measured.set(key, em);
  return em * size;
}

