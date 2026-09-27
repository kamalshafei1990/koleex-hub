"use client";

/* MarketingHeader — the header of a marketing space's screens: its name and
   the tabs between them (Feed, Posts, Calendar, Accounts). One place for its screens, so
   their header and tabs never drift apart. Tabs are routes (key = href);
   PageHeader lights the one the address matches. */

import type { ReactNode } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Share2Icon from "@/components/icons/ui/Share2Icon";
import CrownIcon from "@/components/icons/ui/CrownIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import PenSquareIcon from "@/components/icons/ui/PenSquareIcon";
import CalendarRawIcon from "@/components/icons/ui/CalendarRawIcon";
import { useTranslation, type Translations } from "@/lib/i18n";
import { SPACE_CALENDAR, SPACE_HOME, SPACE_POSTS, SPACE_ROUTE, type MarketingSpace } from "@/lib/marketing/spaces";

const T: Translations = {
  "title.company": { en: "Social Marketing", zh: "社交媒体营销", ar: "التسويق عبر السوشيال ميديا" },
  "title.ceo":     { en: "CEO Brand", zh: "CEO 个人品牌", ar: "براند المدير التنفيذي" },
  "sub.company":   { en: "Koleex's social accounts, their posts and numbers", zh: "Koleex 的社交账号及其帖子和数据", ar: "حسابات كولكس على السوشيال ميديا ومنشوراتها وأرقامها" },
  "sub.ceo":       { en: "The CEO's own social accounts", zh: "CEO 本人的社交账号", ar: "حسابات السوشيال ميديا الخاصة بالمدير التنفيذي" },
  "tab.feed":      { en: "Feed", zh: "动态", ar: "الـFeed" },
  "tab.posts":     { en: "Posts", zh: "帖子", ar: "المنشورات" },
  "tab.calendar":  { en: "Calendar", zh: "日历", ar: "التقويم" },
  "tab.accounts":  { en: "Accounts", zh: "账号", ar: "الحسابات" },
};

export default function MarketingHeader({ space, action }: { space: MarketingSpace; action?: ReactNode }) {
  const { t } = useTranslation(T);
  return (
    <PageHeader
      title={t(`title.${space}`)}
      subtitle={t(`sub.${space}`)}
      icon={space === "ceo" ? <CrownIcon size={16} /> : <Share2Icon size={16} />}
      backHref="/"
      action={action}
      tabs={[
        { key: SPACE_HOME[space], label: t("tab.feed"), icon: <LayoutGridIcon size={14} /> },
        { key: SPACE_POSTS[space], label: t("tab.posts"), icon: <PenSquareIcon size={14} /> },
        { key: SPACE_CALENDAR[space], label: t("tab.calendar"), icon: <CalendarRawIcon size={14} /> },
        { key: SPACE_ROUTE[space], label: t("tab.accounts"), icon: <UsersIcon size={14} /> },
      ]}
    />
  );
}
