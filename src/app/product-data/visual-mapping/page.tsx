/* ---------------------------------------------------------------------------
   The Product Visual Library now lives in the Database app's Visual Library
   (single home for everything visual). This old route just forwards there.
   --------------------------------------------------------------------------- */

import { redirect } from "next/navigation";

export default function VisualMappingRedirect() {
  redirect("/database/product-specs");
}
