"use client";

/* The View-as button, on its own so the header can paint it at once while
   the picker behind it loads after first paint (MainHeader's ViewAsSlot).
   The loading stand-in and the real picker render THIS component, so the
   header cannot shift when one replaces the other. */

import { useTranslation } from "@/lib/i18n";
import { hubT } from "@/lib/translations/hub";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

export default function ViewAsTrigger({ dk, onClick, onMouseEnter }: {
  dk: boolean;
  onClick?: () => void;
  onMouseEnter?: () => void;
}) {
  const { t } = useTranslation(hubT);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      className={`h-8 w-8 px-0 justify-center sm:w-auto sm:px-3 md:h-9 rounded-lg md:rounded-xl border text-[12px] font-medium flex items-center sm:gap-2 transition-all ${
        dk
          ? "kx-hover-glow bg-white/[0.04] border-white/10 text-white/85 hover:bg-white/[0.08]"
          : "kx-hover-glow bg-black/[0.04] border-black/10 text-black/80 hover:bg-black/[0.08]"
      }`}
      title={t("viewAs.tooltip", "Super Admin — view the system as another user or role")}
    >
      <UsersIcon size={14} className="shrink-0" />
      <span className="max-w-[120px] truncate hidden sm:inline">{t("viewAs.label", "View as")}</span>
      <AngleDownIcon size={11} className="shrink-0 opacity-60 hidden sm:block" />
    </button>
  );
}
