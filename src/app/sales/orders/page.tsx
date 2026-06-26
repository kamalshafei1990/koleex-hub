"use client";
import { Suspense } from "react";
import SalesOrders from "@/components/sales/SalesOrders";
export default function SalesOrdersPage() {
  return (
    <Suspense fallback={null}>
      <SalesOrders />
    </Suspense>
  );
}
