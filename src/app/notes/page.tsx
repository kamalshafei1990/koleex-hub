"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuth";
import PermissionGate from "@/components/layout/PermissionGate";
import BrandLoading from "@/components/ui/BrandLoading";

/* The Notes app uses TipTap which needs the browser — load the whole
   component tree client-side only. SSR would just render an empty
   shell anyway since the editor won't mount until hydration. */
const NotesApp = dynamic(() => import("@/components/notes/NotesApp"), {
  ssr: false,
  loading: () => <BrandLoading />,
});

export default function NotesPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Notes">
        <NotesApp />
      </PermissionGate>
    </AdminAuth>
  );
}
