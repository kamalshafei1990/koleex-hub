"use client";

import { useParams } from "next/navigation";
import AdminAuth from "@/components/admin/AdminAuth";
import ProductForm from "@/components/admin/ProductForm";

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;

  return (
    <AdminAuth title="Product Admin" subtitle="Edit product details">
      <ProductForm productId={id} />
    </AdminAuth>
  );
}
