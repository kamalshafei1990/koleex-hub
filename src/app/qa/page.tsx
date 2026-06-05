import { redirect } from "next/navigation";

/* Issue Reports now lives inside the Database app. Keep /qa as a stable
   shortcut that redirects there. */
export default function QaRedirect() {
  redirect("/database/issues");
}
