"use client";

/* Settings → About. Read-only device / app / workspace info. */

import { useEffect, useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";

/* Human-facing app version. Bump on notable releases. */
const APP_VERSION = "2026.7";
const DESKTOP_VERSION = "1.0.2";

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 py-3 ${last ? "" : "border-b border-[var(--border-faint)]"}`}>
      <span className="text-[13px] text-[var(--text-dim)]">{label}</span>
      <span className="text-[13px] font-medium text-[var(--text-primary)] text-right truncate max-w-[60%]">{value}</span>
    </div>
  );
}

export default function AboutTab({ account }: { account: AccountWithLinks; onChanged?: () => void }) {
  const [device, setDevice] = useState({ browser: "—", installed: false });
  const { t } = useTranslation(settingsT);

  useEffect(() => {
    const ua = navigator.userAgent;
    const browser =
      /Edg\//.test(ua) ? "Edge" :
      /Chrome\//.test(ua) ? "Chrome" :
      /Safari\//.test(ua) ? "Safari" :
      /Firefox\//.test(ua) ? "Firefox" : "Browser";
    const installed = window.matchMedia?.("(display-mode: standalone)")?.matches
      || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setDevice({ browser, installed: !!installed });
  }, []);

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-2xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] flex items-center justify-center text-[15px] font-bold tracking-tight">KX</div>
          <div>
            <p className="text-[15px] font-bold text-[var(--text-primary)]">Koleex Hub</p>
            <p className="text-[12px] text-[var(--text-dim)]">{t("about.slogan")}</p>
          </div>
        </div>
        <div className="space-y-1">
          <Row label={t("about.version")} value={APP_VERSION} />
          <Row label={t("about.desktop")} value={`v${DESKTOP_VERSION} (macOS)`} />
          <Row label={t("about.device")} value={`${device.browser}${device.installed ? ` · ${t("about.installed")}` : ""}`} last />
        </div>
      </section>

      <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
        <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-3">{t("about.workspace")}</h2>
        <div className="space-y-1">
          <Row label={t("about.signedIn")} value={`@${account.username}`} />
          <Row label={t("about.accountType")} value={account.user_type ? account.user_type.charAt(0).toUpperCase() + account.user_type.slice(1) : "—"} />
          <Row label={t("about.role")} value={account.role?.name || "—"} last />
        </div>
      </section>

      <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
        <h2 className="text-[14px] font-bold text-[var(--text-primary)] mb-1">{t("about.support")}</h2>
        <p className="text-[12px] text-[var(--text-dim)]">
          {t("about.support.pre")} <span className="font-medium text-[var(--text-secondary)]">{t("about.support.report")}</span> {t("about.support.post")}
        </p>
      </section>
    </div>
  );
}
