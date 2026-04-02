"use client";

import AdminAuth from "@/components/admin/AdminAuth";
import ProductForm from "@/components/admin/ProductForm";

export default function NewProductPage() {
  return (
    <AdminAuth title="Product Admin" subtitle="Create a new product">
      <ProductForm />
    </AdminAuth>
  );
}
