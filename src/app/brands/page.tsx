import { redirect } from "next/navigation";

/* Brands moved into the Database app's Visual Library. Keep /brands as a stable
   shortcut that redirects to its new home. */
export default function BrandsRedirect() {
  redirect("/database/brands");
}
