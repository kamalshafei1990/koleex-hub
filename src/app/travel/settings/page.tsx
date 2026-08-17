"use client";

/* ---------------------------------------------------------------------------
   /travel/settings — the Chinese company side of every letter.

   Fields 20-26 of the invitation form: the registered name in both languages,
   the credit code, the licence address, who signs, and the licence scan.
   Entered once; every letter reads them.

   Editing is SUPER-ADMIN ONLY. This is the company's legal identity as a
   consulate sees it — the name and address here are compared against the
   business licence on page 3, so a mismatch is the letter's problem, not a
   typo. Everyone with the Travel module can read them, because they are
   printed on the document anyway.

   The stamp and signature are NOT here: they live in Quotations' saved assets
   and are shared Hub-wide, so the owner uploads them once for everything.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { travelT } from "@/lib/translations/travel";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TravelIcon from "@/components/icons/TravelIcon";
import { Section, TextField } from "@/components/travel/fields";
import type { InvitationSettings } from "@/lib/invitations/types";

const EMPTY: InvitationSettings = {
  companyNameEn: null, companyNameCn: null, creditCode: null,
  addressEn: null, addressCn: null, inviterName: null,
  inviterPositionEn: null, inviterPositionCn: null,
  inviterPhone: null, licenceDocUrl: null,
};

type Editable = Exclude<keyof InvitationSettings, "licenceDocUrl">;

export default function TravelSettingsPage() {
  const { t } = useTranslation(travelT);
  const fileRef = useRef<HTMLInputElement>(null);

  const [s, setS] = useState<InvitationSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Populated from the first 403 — the page then shows a read-only notice
   *  instead of letting a non-SA fill a form that cannot be saved. */
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/invitations/settings", { cache: "no-store" });
        if (!res.ok) throw new Error();
        setS((await res.json()) as InvitationSettings);
      } catch {
        setError("Could not load the settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = useCallback((key: Editable, value: string) => {
    setS((prev) => ({ ...prev, [key]: value === "" ? null : value }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/invitations/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      if (res.status === 403) {
        setReadOnly(true);
        setError("Only a super-admin can change these details.");
        return;
      }
      if (!res.ok) throw new Error();
      setS((await res.json()) as InvitationSettings);
      setMessage("Saved.");
    } catch {
      setError("Could not save.");
    } finally {
      setSaving(false);
    }
  }, [s]);

  const uploadLicence = useCallback(async (file: File) => {
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/invitations/licence", { method: "POST", body: fd });
      if (res.status === 403) {
        setReadOnly(true);
        setError("Only a super-admin can replace the business licence.");
        return;
      }
      const body = (await res.json()) as { licenceDocUrl?: string; error?: string };
      if (!res.ok) {
        setError(body.error ?? "Upload failed.");
        return;
      }
      setS((prev) => ({ ...prev, licenceDocUrl: body.licenceDocUrl ?? null }));
      setMessage("Licence uploaded — it prints as page 3 of every letter.");
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        <SpinnerIcon size={28} />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-4xl px-4 pb-24 sm:px-6">
        <PageHeader
          title={t("nav.settings")}
          subtitle={t("app.subtitle")}
          icon={<TravelIcon size={16} />}
          backHref="/travel"
          showTabs={false}
          action={
            <Button onClick={() => void save()} disabled={saving || readOnly}>
              {saving ? t("act.saving") : t("act.save")}
            </Button>
          }
        />

        {error && (
          <div className="mt-4 rounded-2xl border border-[var(--state-error)] p-4 text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mt-4 rounded-2xl border border-[var(--state-success)] p-4 text-sm">
            {message}
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4">
          <Section title="Company">
            <TextField
              label="Registered name (English)"
              value={s.companyNameEn ?? ""}
              onChange={(v) => set("companyNameEn", v)}
              wide
            />
            <TextField
              label="Registered name (Chinese)"
              value={s.companyNameCn ?? ""}
              onChange={(v) => set("companyNameCn", v)}
              wide
            />
            <TextField
              label="Unified Social Credit Code"
              hint="From the licence — it is how the consulate ties the letter to page 3"
              value={s.creditCode ?? ""}
              onChange={(v) => set("creditCode", v)}
              wide
            />
            <TextField
              label="Address (English)"
              hint="Must match the business licence word for word"
              value={s.addressEn ?? ""}
              onChange={(v) => set("addressEn", v)}
              wide
            />
            <TextField
              label="Address (Chinese)"
              hint="The licence address verbatim — not a shortened version"
              value={s.addressCn ?? ""}
              onChange={(v) => set("addressCn", v)}
              wide
            />
          </Section>

          <Section title="Inviter">
            <TextField
              label="Name"
              value={s.inviterName ?? ""}
              onChange={(v) => set("inviterName", v)}
              wide
            />
            <TextField
              label="Position (English)"
              value={s.inviterPositionEn ?? ""}
              onChange={(v) => set("inviterPositionEn", v)}
            />
            <TextField
              label="Position (Chinese)"
              value={s.inviterPositionCn ?? ""}
              onChange={(v) => set("inviterPositionCn", v)}
            />
            <TextField
              label="Phone"
              value={s.inviterPhone ?? ""}
              onChange={(v) => set("inviterPhone", v)}
              wide
            />
          </Section>

          <section className="kx-glass rounded-2xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Business licence</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Page 3 of every letter. Upload it once; replace it only when the licence
              itself changes.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              {s.licenceDocUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element -- a
                   single settings thumbnail; next/image's wrapper buys
                   nothing here and its lazy behaviour hides the one thing
                   the operator opened this screen to check. */
                <img
                  src={s.licenceDocUrl}
                  alt="Business licence"
                  className="h-40 w-auto rounded-xl border border-[var(--border-subtle)] bg-white object-contain"
                />
              ) : (
                <div className="flex h-40 w-64 items-center justify-center rounded-xl border border-dashed border-[var(--border-subtle)] text-xs text-[var(--text-dim)]">
                  Not uploaded yet
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={uploading || readOnly}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? t("act.saving") : s.licenceDocUrl ? t("scan.replace") : t("scan.upload")}
                </Button>
                {s.licenceDocUrl && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.open(s.licenceDocUrl!, "_blank", "noopener")}
                  >
                    {t("scan.view")}
                  </Button>
                )}
              </div>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadLicence(f);
                e.target.value = "";
              }}
            />
          </section>

          <section className="kx-glass rounded-2xl p-4 sm:p-5">
            <h2 className="text-sm font-semibold">Stamp and signature</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Shared with the Quotation editor, so they are uploaded once for the whole
              Hub. Manage them under Quotations — super-admin only.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
