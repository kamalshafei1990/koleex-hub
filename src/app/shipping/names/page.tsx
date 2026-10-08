"use client";

import dynamic from "next/dynamic";
import AdminAuth from "@/components/admin/AdminAuthGate";
import PermissionGate from "@/components/layout/PermissionGate";
import { DirectoryListSkeleton } from "@/components/ui/skeletons/AppShellSkeletons";

/* Shipping → Port names. A Client Component page, so this dynamic() is a real
   split point: the review screen is its own chunk, the Shipping screen never
   carries it. The API behind it is Shipping · edit; the gate here is the
   module, like /shipping itself. */
const PlaceNamesReview = dynamic(() => import("@/components/shipping/PlaceNamesReview"), {
  ssr: false,
  loading: () => <DirectoryListSkeleton label="Loading port names…" />,
});

export default function ShippingNamesPage() {
  return (
    <AdminAuth>
      <PermissionGate module="Shipping">
        <PlaceNamesReview />
      </PermissionGate>
    </AdminAuth>
  );
}
