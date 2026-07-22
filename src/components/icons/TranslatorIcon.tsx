/* Translator app icon — the "Translate" asset from the Database app's Visual
   Library (visual-library/pack/actions/translate.svg), not a hand-drawn SVG.

   Rendered as a CSS mask in currentColor so it inherits the launcher/sidebar
   text colour and stays monochrome in both themes, exactly like the other
   library-sourced icons. Plain component (no hooks) so it satisfies the
   AppIcon contract in navigation.ts on both server and client. */

import { vlMaskStyle } from "@/lib/visual-library/icons";

export default function TranslatorIcon({
  size = 24,
  className,
}: {
  size?: number | string;
  className?: string;
}) {
  const px = typeof size === "number" ? size : parseInt(String(size), 10) || 24;
  return <span aria-hidden className={`inline-block shrink-0 bg-current ${className ?? ""}`} style={vlMaskStyle("translate", px)} />;
}
