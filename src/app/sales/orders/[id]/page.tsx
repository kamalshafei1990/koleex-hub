"use client";
import { use } from "react";
import SalesOrderDetail from "@/components/sales/SalesOrderDetail";

export default function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <SalesOrderDetail soId={id} />;
}
