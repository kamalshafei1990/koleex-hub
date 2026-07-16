/* Route loading boundary (Phase 4 — Home & App Launch Performance).
   App-shaped skeleton shown instantly on navigation, inside the persistent Hub
   shell (header/sidebar stay). No data fetch; reduced-motion-safe. */
import { WorkspaceSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

export default function Loading() {
  return <WorkspaceSkeleton label="Loading sales…" />;
}
