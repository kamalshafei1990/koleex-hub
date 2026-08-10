"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
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

export default function AiPage() {
  return (
    <AdminAuth title="Koleex AI" subtitle="Sign in to chat with Koleex AI">
      <KoleexAiApp />
    </AdminAuth>
  );
}
