"use client";

/* ---------------------------------------------------------------------------
   /issues — Issue Reports as its OWN app (owner 2026-08-07: totally separate
   from the Database app). /database/issues now redirects here, so every old
   notification link keeps working. Header icon resolves from the Semantic
   Icon Registry (app.issue-reports).
   --------------------------------------------------------------------------- */

import { Suspense } from "react";
import PermissionGate from "@/components/layout/PermissionGate";
import PageHeader from "@/components/ui/PageHeader";
import BoundIcon from "@/components/common/BoundIcon";
import RrIcon from "@/components/ui/RrIcon";
import QaReportsApp from "@/components/qa/QaReportsApp";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "issues.title":  { en: "Issue Reports", zh: "问题报告", ar: "بلاغات المشاكل" },
  "issues.sub":    { en: "Bugs, UI issues and suggestions reported from across the Hub.", zh: "来自整个 Hub 的缺陷、界面问题和建议。", ar: "الأخطاء ومشاكل الواجهة والاقتراحات الواردة من جميع أنحاء النظام." },
  "issues.search": { en: "Search issue reports…", zh: "搜索问题报告…", ar: "ابحث في بلاغات المشاكل…" },
};

export default function IssuesPage() {
  const { t } = useTranslation(T);
  return (
    <PermissionGate module="Issue Reports">
      <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
        <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
          <PageHeader
            title={t("issues.title", "Issue Reports")}
            subtitle={t("issues.sub", "Bugs, UI issues and suggestions reported from across the Hub.")}
            icon={<BoundIcon semanticKey="app.issue-reports" className="h-4 w-4" fallback={<RrIcon name="megaphone" size={16} />} />}
            searchPlaceholder={t("issues.search", "Search issue reports…")}
            searchHref="/issues"
          />
          <Suspense fallback={null}>
            <QaReportsApp embedded />
          </Suspense>
        </div>
      </div>
    </PermissionGate>
  );
}
