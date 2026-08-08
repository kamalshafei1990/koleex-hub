"use client";

/* Dynamic-import fallback for heavy app shells (SW-4, Phase 4).
   Loading language v2 (2026-08-08): renders the shared brand moment —
   the breathing KOLEEX hub lockup — same as every route loading.tsx,
   so a code-split shell never flashes a blank screen OR an off-brand
   gray skeleton. Kept as its own module so existing imports stand. */
import BrandLoading from "@/components/ui/BrandLoading";

export default function AppLoadingSkeleton({ label = "Loading…" }: { label?: string }) {
  return <BrandLoading label={label} />;
}
