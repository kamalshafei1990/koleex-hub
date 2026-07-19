/* ---------------------------------------------------------------------------
   PersonName — canonical way to render a person's name anywhere in the Hub.

   Shows the primary (usually English) name and, when the person has an
   alternate / native name (people.name_alt — e.g. a Chinese name 黎鑫燕),
   that name on a muted second line beneath it. One component so the two-line
   treatment is consistent everywhere and future surfaces get it for free.

   - `name`  : the primary display name (people.full_name / account username).
   - `alt`   : the native/alternate name (people.name_alt). Rendered only when
               present, non-blank, and different from the primary name.
   - `fallback`: used when `name` is empty (e.g. the account username).

   Purely presentational; no data fetching. Callers must include `name_alt`
   in whatever query feeds them (the person selects were widened for this).
   --------------------------------------------------------------------------- */

import type { CSSProperties } from "react";

export function hasAltName(name: string | null | undefined, alt: string | null | undefined): boolean {
  const a = (alt ?? "").trim();
  if (!a) return false;
  return a !== (name ?? "").trim();
}

interface PersonNameProps {
  name: string | null | undefined;
  alt?: string | null;
  /** Shown when `name` is blank. */
  fallback?: string | null;
  /** Wrapper class (applied to the block that stacks the two lines). */
  className?: string;
  /** Class for the primary name line. */
  nameClassName?: string;
  /** Class for the muted alt line. */
  altClassName?: string;
  style?: CSSProperties;
  /** Element for the primary line. Default "span". Use "div"/"h2" in headings. */
  as?: "span" | "div" | "h1" | "h2" | "h3" | "p";
  title?: string;
}

export default function PersonName({
  name,
  alt,
  fallback,
  className,
  nameClassName,
  altClassName,
  style,
  as = "span",
  title,
}: PersonNameProps) {
  const primary = (name ?? "").trim() || (fallback ?? "").trim() || "—";
  const showAlt = hasAltName(primary, alt);
  const Tag = as;

  // Inline case: no alt → just the name, no extra wrapper (keeps existing
  // layouts identical when a person has no native name).
  if (!showAlt) {
    return (
      <Tag className={nameClassName || className} style={style} title={title}>
        {primary}
      </Tag>
    );
  }

  return (
    <span className={`inline-flex flex-col leading-tight ${className ?? ""}`} style={style} title={title || `${primary} · ${alt}`}>
      <Tag className={nameClassName}>{primary}</Tag>
      <span
        className={altClassName || "text-[0.85em] text-[var(--text-dim)] font-normal"}
        lang="zh"
      >
        {(alt ?? "").trim()}
      </span>
    </span>
  );
}
