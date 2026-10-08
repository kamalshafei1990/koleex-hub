"use client";

import dynamic from "next/dynamic";
import { ConversationSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

const KoleexAiApp = dynamic(() => import("@/components/ai/KoleexAiApp"), {
  ssr: false,
  /* THE SAME skeleton the route boundary (ai/loading.tsx) shows — the two
     loading stages must be indistinguishable. The old fallback swapped the
     skeleton for the orb-and-line surface (in a min-h-screen wrapper that
     made the page taller than the viewport), so the loader visibly CHANGED
     mid-load and jumped: "it seems it have two and they appear and
     disappear" (owner). One look from click to content. */
  loading: () => <ConversationSkeleton label="Loading Koleex AI…" />,
});

/* NO SECOND GATE HERE (owner, 2026-09-18: "remove it").

   THE GATE IS THE SHELL'S, and it always was. RootShell wraps every route in
   <AuthGate> except two prefixes — `/auth` and anything ending `/print` — so
   `/ai` cannot render at all until that gate has passed. This page wrapped
   itself in <AdminAuth> a SECOND time: the same gate, twice, on one route.

   It was not free. The inner copy starts its own `authed` state at null and
   paints a full-height <BrandLoading> until its effect has read storage — and
   <KoleexAiApp/> is `next/dynamic`, so its chunk could not even BEGIN
   downloading until that effect had run. It also made three different loading
   surfaces appear in a row (the route skeleton, then BrandLoading, then the
   skeleton again), which is exactly what the comment above this component
   promises not to do: "One look from click to content."

   Removing it takes nothing away. Checked before touching it: `/ai` is not in
   either bypass list, and AuthGate gates it (AdminAuthGate; the Supabase flag
   that once gave AuthGate a second branch was retired on 26/09/2026), so the
   route is behind a gate, and it is now gated the same way as the other
   forty-five routes that never double-wrapped. validate:ai-client-render pins
   all of that, so this cannot quietly become "no gate" later. */
export default function AiPage() {
  return <KoleexAiApp />;
}
