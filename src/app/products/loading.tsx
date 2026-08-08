/* Route loading boundary — renders the Hub's ONE loading moment.
   This route used to carry a bespoke animate-pulse skeleton, which is why
   the owner met three or four different loading looks while moving between
   apps. Every route now shows the same brand loader. */
import BrandLoading from "@/components/ui/BrandLoading";

export default function Loading() {
  return <BrandLoading label="Loading…" className="min-h-screen" />;
}
