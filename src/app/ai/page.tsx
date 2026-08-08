"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import BrandLoading from "@/components/ui/BrandLoading";

const KoleexAiApp = dynamic(() => import("@/components/ai/KoleexAiApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <BrandLoading />
    </div>
  ),
});

export default function AiPage() {
  return (
    <AdminAuth title="Koleex AI" subtitle="Sign in to chat with Koleex AI">
      <KoleexAiApp />
    </AdminAuth>
  );
}
