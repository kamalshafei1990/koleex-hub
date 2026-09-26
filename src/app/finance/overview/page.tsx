import { redirect } from "next/navigation";

/* /finance/overview was one of three routes rendering the same statements
   screen. The statements live at /finance/statements; old links follow. */
export default function FinanceOverviewRedirect() {
  redirect("/finance/statements");
}
