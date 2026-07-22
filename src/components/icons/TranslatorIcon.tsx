/* Translator app icon — the two-script motif (Latin "A" + a CJK-style
   glyph) used by translation tools everywhere, drawn as outline strokes
   at the same weight as the rest of the Koleex app icon set. */

export default function TranslatorIcon({
  size = 24,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Latin "A" — source language */}
      <path d="M3 13.5 6.2 5.5 9.4 13.5" />
      <line x1="4.3" y1="10.9" x2="8.1" y2="10.9" />
      {/* Arrow between the two scripts */}
      <path d="M10.8 17.4h3.4" />
      <path d="M12.9 16.1 14.2 17.4 12.9 18.7" />
      {/* CJK-style glyph — target language */}
      <rect x="13.2" y="7.2" width="7.8" height="7.8" rx="1.8" />
      <line x1="15" y1="9.9" x2="19.2" y2="9.9" />
      <line x1="17.1" y1="9.9" x2="17.1" y2="13" />
    </svg>
  );
}
