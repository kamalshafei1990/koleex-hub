/* ---------------------------------------------------------------------------
   SpecGlyph

   A single SVG component that renders any glyph in the
   SPEC_GLYPHS path map. Each glyph is sourced from exactly one
   uicons-regular-rounded SVG so the Specs page never duplicates
   icons across fields, groups, or cards.

   Renders the inner SVG body (raw <path>...) via dangerouslySetInnerHTML
   — the source SVGs are bundled with the project, so the input is
   trusted at build time and never user-supplied.

   Falls back silently when the name isn't mapped: returns a small
   neutral disc so the form layout doesn't shift on a missing key.
   --------------------------------------------------------------------------- */

import { SPEC_GLYPHS } from "./glyph-paths";

interface Props {
  name: string;
  className?: string;
  size?: number | string;
  title?: string;
}

export default function SpecGlyph({ name, className, size = 16, title }: Props) {
  const inner = SPEC_GLYPHS[name];
  const px = typeof size === "string" ? parseInt(size, 10) || 16 : size;
  if (!inner) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={px}
        height={px}
        fill="currentColor"
        className={className}
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      fill="currentColor"
      className={className}
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : "") + inner }}
    />
  );
}
