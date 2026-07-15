"use client";

import { useParams } from "next/navigation";
import ProductForm from "@/components/admin/ProductFormLazy";

export default function EditProductPage() {
  const params = useParams();
  const id = params.id as string;

  return <ProductForm productId={id} />;
}
