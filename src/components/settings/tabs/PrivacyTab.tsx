"use client";

/* Settings → Privacy & data. Self-service export of your own account data
   (profile, preferences, recent sign-ins) via GET /api/me/export. */

import { useState } from "react";
import type { AccountWithLinks } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import { useTranslation } from "@/lib/i18n";
import { settingsT } from "@/lib/translations/settings";

export default function PrivacyTab(_props: { account: AccountWithLinks }) {
  const [busy, setBusy] = useState(false);
  const { t } = useTranslation(settingsT);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/me/export", { credentials: "include" });
      if (!res.ok) throw new Error(`(${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "koleex-account-export.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("priv.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-subtle)] p-5 md:p-6">
        <h2 className="text-[14px] font-bold text-[var(--text-primary)]">{t("priv.title")}</h2>
        <p className="text-[12px] text-[var(--text-dim)] mt-0.5 mb-4">
          {t("priv.sub")}
        </p>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {busy ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <DownloadIcon className="h-4 w-4" />}
          {busy ? t("priv.preparing") : t("priv.download")}
        </button>
        {error && <p className="text-[12px] text-[#FF3333] mt-3">{t("priv.error")} {error}</p>}
      </section>

      <p className="text-[11px] text-[var(--text-faint)] px-1">
        {t("priv.footer")}
      </p>
    </div>
  );
}
