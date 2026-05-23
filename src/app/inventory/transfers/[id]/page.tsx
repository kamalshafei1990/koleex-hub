import InventoryTransferDetail from "@/components/inventory/InventoryTransferDetail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InventoryTransferDetail transferId={id} />;
}
