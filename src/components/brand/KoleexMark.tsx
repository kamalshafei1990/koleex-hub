/* BrandMark — a product's brand line: the KOLEEX logo, never the word.
 *
 * Owner rule (19/09/2026, product pages): the brand is never written as
 * the word "KOLEEX" on a product page, a brochure or a print — it is always
 * the original logo. The wordmark itself already exists once, as
 * components/layout/KoleexLogo (inline SVG, currentColor, ratio locked by
 * its viewBox); this file only decides WHEN it is drawn, so every product
 * surface makes that decision the same way:
 *
 *   · brand unset  → KOLEEX. Our own products carry no brand value; a
 *                    distributed brand is set explicitly.
 *   · "Koleex"     → KOLEEX (any case, any surrounding space).
 *   · anything else → that brand's own name as text — it is not ours to draw.
 *
 * Sizing is the parent's: pass h-* / text colour in className exactly as
 * for KoleexLogo. `textClassName` styles the fallback name when a surface
 * wants it set differently from the mark (an eyebrow, a table cell).
 */
import KoleexLogo from "@/components/layout/KoleexLogo";

export function isKoleexBrand(brand: string | null | undefined): boolean {
  const b = (brand ?? "").trim();
  return b === "" || /^koleex$/i.test(b);
}

export function BrandMark({ brand, className = "", textClassName }: {
  brand: string | null | undefined;
  className?: string;
  textClassName?: string;
}) {
  if (isKoleexBrand(brand)) {
    return <KoleexLogo className={`inline-block shrink-0 w-auto align-middle ${className}`} />;
  }
  return <span className={textClassName ?? className}>{(brand as string).trim()}</span>;
}
