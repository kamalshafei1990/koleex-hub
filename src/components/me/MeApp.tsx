"use client";

/* ---------------------------------------------------------------------------
   MeApp — "My HR": the employee's own leave, attendance, payslips, documents
   and contact details. Identity-scoped — the page shows whoever is signed in
   and nobody else — so it needs no HR permission and sits in every
   employee's launcher.

   ONE request (/api/me/hr) feeds all six tabs; the previous payload warm-
   starts the paint from sessionStorage and the fresh one reconciles. Every
   mutation returns the rows it changed and the tab patches the bundle in
   place — no second round-trip to "refresh".
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";
import type { MyHrBundle } from "@/lib/me-hr-types";
import PageHeader from "@/components/ui/PageHeader";
import BrandLoading from "@/components/ui/BrandLoading";
import { useTabMotion } from "@/components/ui/useTabMotion";
import { EmptyState, primaryBtnCls } from "@/components/hr/shared";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import CalendarPlusIcon from "@/components/icons/ui/CalendarPlusIcon";
import ClockIcon from "@/components/icons/ui/ClockIcon";
import WalletIcon from "@/components/icons/ui/WalletIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import ShieldExclamationIcon from "@/components/icons/ui/ShieldExclamationIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import { ME_TABS, ME_WARM_KEY, browserTz, meFetch, type MeTab, type MeTabProps } from "./shared";
import Overview from "./Overview";
import Leave from "./Leave";
import Approvals from "./Approvals";
import Attendance from "./Attendance";
import Payslips from "./Payslips";
import Documents from "./Documents";
import Profile from "./Profile";

const TAB_ICONS: Record<MeTab, ComponentType<{ size?: number; className?: string }>> = {
  overview: LayoutGridIcon,
  leave: CalendarPlusIcon,
  approvals: CheckCircleIcon,
  attendance: ClockIcon,
  payslips: WalletIcon,
  documents: DocumentIcon,
  profile: UserCheckIcon,
};

const TAB_VIEWS: Record<MeTab, ComponentType<MeTabProps>> = {
  overview: Overview,
  leave: Leave,
  approvals: Approvals,
  attendance: Attendance,
  payslips: Payslips,
  documents: Documents,
  profile: Profile,
};

type Phase = "loading" | "ready" | "not_employee" | "error";

export default function MeApp() {
  const { t, lang } = useTranslation(hrT);

  const [tab, setTab] = useState<MeTab>(() => {
    if (typeof window === "undefined") return "overview";
    const q = new URLSearchParams(window.location.search).get("tab");
    return (ME_TABS as string[]).includes(q ?? "") ? (q as MeTab) : "overview";
  });
  /* A notification's /me?tab=leave opened through the router renders this
     BEFORE the new URL is written, so the initializer above read the old
     one. Read ?tab= again once the navigation has committed. */
  useEffect(() => {
    void Promise.resolve().then(() => {
      const q = new URLSearchParams(window.location.search).get("tab");
      if ((ME_TABS as string[]).includes(q ?? "")) setTab(q as MeTab);
    });
  }, []);
  const tabMotion = useTabMotion(ME_TABS.indexOf(tab));

  const [bundle, setBundle] = useState<MyHrBundle | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");

  const reload = useCallback(async () => {
    const res = await meFetch<MyHrBundle>(`/api/me/hr?tz=${encodeURIComponent(browserTz())}`, { cache: "no-store" });
    if (res.ok) {
      setBundle(res.data);
      setPhase("ready");
      try { sessionStorage.setItem(ME_WARM_KEY, JSON.stringify(res.data)); } catch { /* quota */ }
    } else if (res.status === 404 && res.error === "not_employee") {
      setPhase("not_employee");
      try { sessionStorage.removeItem(ME_WARM_KEY); } catch { /* ignore */ }
    } else {
      setPhase((p) => (p === "ready" ? p : "error"));
    }
  }, []);

  /* Warm start after hydration (a microtask, never a sync setState in the
     effect body), then the network reconciles underneath. */
  useEffect(() => {
    let cancelled = false;
    try {
      const raw = sessionStorage.getItem(ME_WARM_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as MyHrBundle;
        if (cached?.employee?.id) {
          queueMicrotask(() => {
            if (cancelled) return;
            setBundle(cached);
            setPhase("ready");
          });
        }
      }
    } catch { /* corrupt — the network path covers it */ }
    /* Deferred a tick for the same reason: the effect body only subscribes;
       the fetch (and its setState) runs outside it. */
    void Promise.resolve().then(() => { if (!cancelled) reload(); });
    return () => { cancelled = true; };
  }, [reload]);

  /* The Approvals tab exists only for a manager — and the count on it is
     the work waiting, not a message count. */
  const isManager = !!bundle?.team?.isManager;
  const visibleTabs = ME_TABS.filter((id) => id !== "approvals" || isManager);
  const View = TAB_VIEWS[tab === "approvals" && !isManager && bundle ? "overview" : tab];

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="min-h-full">
      {/* The Hub shell — same width and top padding as every app (was 1200
          wide with pt-6/md:pt-8, 32 px under the header vs the Hub's 16).
          !pb-28: the floating AI/Discuss chip parks bottom-right; without this
          a form's Save button at the end of the page scrolls exactly under it.
          `!` because the compact density layer rewrites .py-6's bottom. */}
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8 !pb-28">
        <div className="mb-6">
          <PageHeader
            title={t("hr.me.title")}
            subtitle={bundle ? bundle.person.fullName : undefined}
            icon={<UserCheckIcon size={16} />}
            tabs={visibleTabs.map((id) => {
              const Icon = TAB_ICONS[id];
              const n = id === "approvals" ? bundle?.team.pending.length ?? 0 : 0;
              return {
                key: id,
                label: n > 0 ? `${t(`hr.me.tab.${id}`)} · ${n}` : t(`hr.me.tab.${id}`),
                icon: <Icon size={12} />,
                onClick: () => setTab(id),
                active: tab === id,
              };
            })}
          />
        </div>

        {phase === "loading" && <BrandLoading className="min-h-[40vh]" />}

        {phase === "not_employee" && (
          <div className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)]">
            <EmptyState icon={ShieldExclamationIcon} title={t("hr.me.notEmployee.title")} subtitle={t("hr.me.notEmployee.body")} />
          </div>
        )}

        {phase === "error" && (
          <div className="kx-glass bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-10 text-center">
            <p className="text-[14px] text-[var(--text-muted)] mb-4">{t("hr.me.error")}</p>
            <button type="button" onClick={reload} className={primaryBtnCls}>{t("hr.me.retry")}</button>
          </div>
        )}

        {phase === "ready" && bundle && (
          <div key={tab} className={tabMotion}>
            <View
              bundle={bundle}
              setBundle={(next) => setBundle((prev) => (typeof next === "function" ? (prev ? next(prev) : prev) : next))}
              reload={reload}
              t={t}
              lang={lang}
              setTab={setTab}
            />
          </div>
        )}
      </div>
    </div>
  );
}
