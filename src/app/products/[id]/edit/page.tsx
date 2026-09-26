import { redirect } from "next/navigation";

/* See /products/new — editing lives in Product Data, behind its gate. */
export default async function EditProductRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/product-data/${encodeURIComponent(id)}/edit`);
}
