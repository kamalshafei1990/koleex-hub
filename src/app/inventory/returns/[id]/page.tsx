import InventoryReturnDetail from "@/components/inventory/InventoryReturnDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InventoryReturnDetail returnId={id} />;
}
