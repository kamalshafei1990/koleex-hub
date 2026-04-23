"use client";

import { useParams } from "next/navigation";
import PermissionGate from "@/components/layout/PermissionGate";
import ProductForm from "@/components/admin/ProductForm";

export default function EditProductDataPage() {
  const params = useParams();
  const id = params.id as string;
  return (
    <PermissionGate module="Product Data">
      <ProductForm productId={id} />
    </PermissionGate>
  );
}
