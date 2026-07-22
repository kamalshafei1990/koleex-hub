/* ---------------------------------------------------------------------------
   Visual Library icon paths — the single source for UI icons pulled from the
   Database app's General Icons Library.

   Deliberately a PLAIN module (no "use client"): both the client
   <VlIcon> component and the server-renderable app-registry icons import it,
   so the map must not drag a client boundary along with it.

   Every entry is a real `visual_assets` row in the `media` bucket — the value
   is that row's `svg_path`, copied from the asset drawer in the Visual
   Library. A static map (rather than a lookup by slug at runtime) keeps icons
   free of API round-trips and loading flashes.
   --------------------------------------------------------------------------- */

export const VL_ICON_PATHS = {
  translate:          "visual-library/pack/actions/translate.svg",
  language:           "visual-library/pack/actions/language.svg",
  exchange:           "visual-library/pack/actions/exchange.svg",
  microphone:         "visual-library/pack/files/microphone.svg",
  speaker:            "visual-library/pack/files/speaker.svg",
  "volume-mute":      "visual-library/pack/files/volume-mute.svg",
  "copy-alt":         "visual-library/pack/files/copy-alt.svg",
  check:              "visual-library/pack/status/check.svg",
  star:               "visual-library/general/status/star.svg",
  bookmark:           "visual-library/pack/actions/bookmark.svg",
  "cross-small":      "visual-library/pack/status/cross-small.svg",
  search:             "visual-library/general/navigation/search.svg",
  "angle-small-down": "visual-library/pack/navigation/angle-small-down.svg",
  "rotate-left":      "visual-library/pack/navigation/rotate-left.svg",
  "trash-xmark":      "visual-library/pack/misc/trash-xmark.svg",
  spinner:            "visual-library/pack/actions/spinner.svg",
  document:           "visual-library/general/documents/document.svg",
  "cloud-upload":     "visual-library/pack/devices/cloud-upload.svg",
  download:           "visual-library/general/actions/download.svg",
} as const;

export type VlIconSlug = keyof typeof VL_ICON_PATHS;

/** Public CDN URL for a Visual Library icon. */
export function vlIconUrl(slug: VlIconSlug): string {
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  return `${base}/storage/v1/object/public/media/${VL_ICON_PATHS[slug]}`;
}

/** Inline style that paints a Visual Library SVG as a CSS mask in
    `currentColor`. Library assets carry a fixed (usually black) fill, which
    vanishes on dark surfaces; masking makes one asset work in both themes and
    keeps the brand monochrome-first. */
export function vlMaskStyle(slug: VlIconSlug, size: number): React.CSSProperties {
  // Stray whitespace inside url() invalidates the mask and the element paints
  // as a solid square — strip it.
  const url = vlIconUrl(slug).replace(/\s+/g, "");
  return {
    width: size,
    height: size,
    WebkitMaskImage: `url("${url}")`,
    maskImage: `url("${url}")`,
    WebkitMaskRepeat: "no-repeat",
    maskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    maskPosition: "center",
    WebkitMaskSize: "contain",
    maskSize: "contain",
  };
}
