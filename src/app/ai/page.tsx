"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

const KoleexAiApp = dynamic(() => import("@/components/ai/KoleexAiApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
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
