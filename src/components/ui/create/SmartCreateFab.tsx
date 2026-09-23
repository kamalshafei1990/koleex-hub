"use client";

/* ---------------------------------------------------------------------------
   SmartCreateFab — the phone's way into Smart Create.

   On a desktop the drawer opens from the header chip or the "c" key; a phone
   has neither within thumb reach, so this round "+" sits in the bottom START
   corner (the AI / Discuss dock owns the END corner). Phones only (sm:hidden),
   signed-in only, and never on screens whose bottom edge is already an input
   or a document: the AI chat, Discuss, the /create forms and print pages —
   nor in Inventory, which has its own phone "+" (MobileFab) for stock moves.
   Lifts above a MobileActionBar via --kx-actionbar-h, like the update capsule.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import { useCurrentAccountId } from "@/lib/identity";
import { useTranslation } from "@/lib/i18n";
import { smartCreateT } from "@/lib/translations/smart-create";
import { openSmartCreate } from "./SmartCreateDrawer";

const HIDDEN_ON = ["/ai", "/discuss", "/create", "/inbox", "/inventory"];

export default function SmartCreateFab() {
  const pathname = usePathname() || "/";
  const accountId = useCurrentAccountId();
  const { t } = useTranslation(smartCreateT);

  if (!accountId) return null;
  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  if (pathname.endsWith("/print")) return null;

  return (
    <button
      type="button"
      onClick={() => openSmartCreate()}
      aria-label={t("sc.fab")}
      className="kx-sc-fab kx-glass-pop fixed start-4 bottom-[calc(env(safe-area-inset-bottom,0px)+var(--kx-actionbar-h,0px)+16px)] z-[55] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-lg shadow-black/30 transition-transform active:scale-95 sm:hidden"
    >
      <PlusIcon className="h-5 w-5" />
    </button>
  );
}
