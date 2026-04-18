"use client";

/* ---------------------------------------------------------------------------
   PreferencesTab — general user preferences (language, theme, email signature,
   notifications). Stored in accounts.preferences jsonb.

   The tab reads from the merged AccountPreferences bag (stored + defaults),
   and only persists the keys the user actually interacts with.
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import BellIcon from "@/components/icons/ui/BellIcon";
import Settings2Icon from "@/components/icons/ui/Settings2Icon";
import LanguagesIcon from "@/components/icons/ui/LanguagesIcon";
import PaletteIcon from "@/components/icons/ui/PaletteIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import type {
  AccountWithLinks,
  AccountPreferences,
} from "@/types/supabase";
import { withDefaults } from "@/lib/access-control";
import { updateAccountPreferences } from "@/lib/accounts-admin";
import { useTranslation } from "@/lib/i18n";
import { accountsT } from "@/lib/translations/accounts";
import {
  tabCardClass,
  tabSectionTitle,
  selectClass,
  textareaClass,
  labelClass,
  Toggle,
  TabActionBar,
} from "./shared";

interface Props {
  account: AccountWithLinks;
  onChanged?: (prefs: AccountPreferences) => void;
}

export default function PreferencesTab({ account, onChanged }: Props) {
  const { t } = useTranslation(accountsT);
  const initial = useMemo(() => withDefaults(account.preferences), [account.preferences]);

  const [prefs, setPrefs] = useState<AccountPreferences>(initial);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPrefs(initial), [initial]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  async function save() {
    setSaving(true);
    setError(null);
    // Persist the full merged bag — simpler than diffing and the jsonb
    // payload is small.
    const ok = await updateAccountPreferences(account.id, prefs);
    setSaving(false);
    if (!ok) {
      setError(t("acc.err.preferencesFailed"));
      return;
    }
    setToast(t("acc.msg.preferencesSaved"));
    onChanged?.(prefs);
  }

  return (
    <div className="space-y-4">
      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <Settings2Icon className="h-3.5 w-3.5" />
          {t("acc.prefs.general")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>
              <LanguagesIcon className="h-3 w-3 inline mr-1" /> {t("acc.prefs.language")}
            </label>
            <select
              className={selectClass}
              value={prefs.language ?? "en"}
              onChange={(e) =>
                setPrefs({ ...prefs, language: e.target.value as "en" | "ar" })
              }
            >
              <option value="en">{t("acc.prefs.langEnglish")}</option>
              <option value="ar">العربية (Arabic)</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>
              <PaletteIcon className="h-3 w-3 inline mr-1" /> {t("acc.prefs.theme")}
            </label>
            <select
              className={selectClass}
              value={prefs.theme ?? "system"}
              onChange={(e) =>
                setPrefs({
                  ...prefs,
                  theme: e.target.value as "light" | "dark" | "system",
                })
              }
            >
              <option value="system">{t("acc.prefs.themeSystem")}</option>
              <option value="dark">{t("acc.prefs.themeDark")}</option>
              <option value="light">{t("acc.prefs.themeLight")}</option>
            </select>
          </div>
        </div>
      </section>

      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <EnvelopeIcon className="h-3.5 w-3.5" />
          {t("acc.prefs.emailSignature")}
        </h2>
        <textarea
          className={textareaClass}
          rows={6}
          value={prefs.email_signature ?? ""}
          onChange={(e) => setPrefs({ ...prefs, email_signature: e.target.value })}
          placeholder={`Jane Cooper\nSales Manager · Koleex International Group\njane@koleex.com · +971 50 000 0000`}
        />
        <p className="text-[11px] text-[var(--text-dim)] mt-2">
          {t("acc.prefs.signatureHint")}
        </p>
      </section>

      <section className={tabCardClass}>
        <h2 className={tabSectionTitle}>
          <BellIcon className="h-3.5 w-3.5" />
          {t("acc.prefs.notifications")}
        </h2>
        <div className="space-y-4">
          <Toggle
            label={t("acc.prefs.emailNotifications")}
            description={t("acc.prefs.emailNotifDesc")}
            checked={prefs.notifications?.email ?? true}
            onChange={(v) =>
              setPrefs({
                ...prefs,
                notifications: {
                  email: v,
                  in_app: prefs.notifications?.in_app ?? true,
                },
              })
            }
          />
          <Toggle
            label={t("acc.prefs.inAppNotifications")}
            description={t("acc.prefs.inAppNotifDesc")}
            checked={prefs.notifications?.in_app ?? true}
            onChange={(v) =>
              setPrefs({
                ...prefs,
                notifications: {
                  email: prefs.notifications?.email ?? true,
                  in_app: v,
                },
              })
            }
          />
        </div>
      </section>

      {toast && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <CheckCircleIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/[0.08] text-red-300 px-4 py-3 text-[13px] flex items-start gap-2">
          <ExclamationIcon className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <section className={tabCardClass}>
        <TabActionBar
          dirty={dirty}
          saving={saving}
          onSave={save}
          onReset={() => setPrefs(initial)}
        />
      </section>
    </div>
  );
}
