"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* The Notes app uses TipTap which needs the browser — load the whole
   component tree client-side only. SSR would just render an empty
   shell anyway since the editor won't mount until hydration. */
const NotesApp = dynamic(() => import("@/components/notes/NotesApp"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <SpinnerIcon className="h-5 w-5 text-[var(--text-dim)] animate-spin" />
    </div>
  ),
});

export default function NotesPage() {
  return (
    <AdminAuth title="Notes" subtitle="Sign in to access your notes">
      <PermissionGate module="Notes">
        <NotesApp />
      </PermissionGate>
    </AdminAuth>
  );
}
