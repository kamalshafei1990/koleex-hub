import { redirect } from "next/navigation";

/* /products is the catalogue — people READ here. Creating a product is
   Product Data work, and the route there carries the Product Data
   permission gate; this one rendered the full editor to anyone who typed
   the URL (writes were refused server-side, the screen simply opened).
   One editor, one home; old links keep working. */
export default function NewProductRedirect() {
  redirect("/product-data/new");
}
