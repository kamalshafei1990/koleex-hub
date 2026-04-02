"use client";

import AdminAuth from "@/components/admin/AdminAuth";
import ProductList from "@/components/admin/ProductList";

export default function ProductsPage() {
  return (
    <AdminAuth title="Product Admin" subtitle="Manage your product catalog">
      <ProductList />
    </AdminAuth>
  );
}
