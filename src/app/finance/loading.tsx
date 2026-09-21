/* Route loading boundary — renders the Hub's ONE loading moment.
   This route used to carry a bespoke animate-pulse skeleton, which is why
   the owner met three or four different loading looks while moving between
   apps. Every route now shows the same brand loader.

   Shorter than the full-page surface: the finance header and tab strip are
   drawn by the layout ABOVE this boundary, so a viewport-tall loader here
   would push the page past the bottom and let it scroll while loading —
   the "dancing" the owner keeps calling out. The orb sits in the space the
   content will take, under a strip that never went away. */
import BrandLoading from "@/components/ui/BrandLoading";

export default function Loading() {
  return <BrandLoading className="h-[calc(100svh-var(--kx-header-h,3.5rem)-14rem)] min-h-[240px] overflow-hidden" />;
}
