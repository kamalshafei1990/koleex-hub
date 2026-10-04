"use client";

/* ---------------------------------------------------------------------------
   A template page as a picture (plan step C14 — posts are pixels, not
   paper). The page's own <svg> is copied and made self-contained, then
   drawn onto a canvas at the post's exact pixel size:

     · fonts — the CSS variables in every font stack are resolved, and the
       @font-face files of the faces the page uses (Inter, Noto Sans Arabic;
       self-hosted by next/font) are embedded as data: URLs — an SVG drawn as
       a picture may not load anything;
     · pictures — every <image> (a product photo from our storage, a picture
       chosen on this computer) becomes a data: URL, so the canvas is not
       tainted and the file can be saved.

   Nothing leaves the browser.
   --------------------------------------------------------------------------- */

const XLINK = "http://www.w3.org/1999/xlink";

function resolveVars(value: string, css: CSSStyleDeclaration): string {
  return value.replace(/var\((--[\w-]+)\)\s*,?/g, (_, name: string) => {
    const v = css.getPropertyValue(name).trim();
    return v ? `${v},` : "";
  });
}

async function asDataUrl(url: string): Promise<string | null> {
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** The @font-face rules of the families named, with their files embedded. */
const faceCache = new Map<string, string>();
async function fontFaces(families: Set<string>): Promise<string> {
  const rules: CSSFontFaceRule[] = [];
  const walk = (list: CSSRuleList) => {
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSFontFaceRule) {
        const fam = rule.style.getPropertyValue("font-family").replace(/["']/g, "").trim();
        if (families.has(fam)) rules.push(rule);
      } else if ("cssRules" in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try { walk(sheet.cssRules); } catch { /* another origin's sheet */ }
  }
  const out = await Promise.all(rules.map(async (rule) => {
    const text = rule.cssText;
    const hit = faceCache.get(text);
    if (hit) return hit;
    const urls = [...text.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((m) => m[1]);
    /* a face's file is named relative to its own stylesheet */
    const base = rule.parentStyleSheet?.href ?? document.baseURI;
    let css = text;
    for (const u of urls) {
      const abs = new URL(u, base).href;
      const data = await asDataUrl(abs);
      if (data) css = css.split(u).join(data);
    }
    faceCache.set(text, css);
    return css;
  }));
  return out.join("\n");
}

/** The first family of every font stack used in the drawing. */
function familiesIn(svg: SVGSVGElement): Set<string> {
  const found = new Set<string>();
  for (const el of Array.from(svg.querySelectorAll<SVGElement>("[style], [font-family]"))) {
    const stack = el.style?.fontFamily || el.getAttribute("font-family") || "";
    for (const part of stack.split(",")) {
      const fam = part.replace(/["']/g, "").trim();
      if (fam) found.add(fam);
    }
  }
  return found;
}

/** The page as a PNG (or JPEG) of exactly `width` × `height` pixels. */
export async function rasterize(source: SVGSVGElement, width: number, height: number, type: "image/png" | "image/jpeg" = "image/png"): Promise<Blob | null> {
  const svg = source.cloneNode(true) as SVGSVGElement;
  const css = getComputedStyle(source);
  /* the variables the page's fonts are named by (next/font's --font-*) */
  for (const el of [svg, ...Array.from(svg.querySelectorAll<SVGElement>("*"))]) {
    const style = el.getAttribute("style");
    if (style && style.includes("var(")) el.setAttribute("style", resolveVars(style, css));
  }
  svg.removeAttribute("class");
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("xmlns:xlink", XLINK);

  await Promise.all(Array.from(svg.querySelectorAll("image")).map(async (img) => {
    const href = img.getAttribute("href") ?? img.getAttributeNS(XLINK, "href");
    if (!href) return;
    const data = await asDataUrl(href);
    if (data) { img.setAttribute("href", data); img.removeAttributeNS(XLINK, "href"); } else img.remove();
  }));

  const faces = await fontFaces(familiesIn(svg));
  if (faces) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = faces;
    svg.insertBefore(style, svg.firstChild);
  }

  const text = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    return await new Promise((resolve) => canvas.toBlob(resolve, type, 0.92));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
