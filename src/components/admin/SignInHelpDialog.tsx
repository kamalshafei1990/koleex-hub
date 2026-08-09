"use client";

/* ---------------------------------------------------------------------------
   SignInHelpDialog — "Having trouble?" on the sign-in screen.

   Opened by someone who cannot get in, so it assumes nothing: no session, no
   account, no stored identity. It collects the least an admin needs to call
   the person back — what went wrong, who they are, and how to reach them —
   and posts it to /api/support/sign-in-help, which files it and drops a copy
   in every internal admin's Mail.

   The reference number is shown on success so the person has something to
   quote when someone rings them back.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import { COUNTRIES } from "@/types/product-form";
import { useTranslation } from "@/lib/i18n";
import { signInT } from "@/lib/translations/signin";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";

/* Ordered by how often an administrator is actually asked. A forgotten
   USERNAME sits second because the Hub signs in by username, not email, so it
   is at least as common as a forgotten password — and there was no way to say
   it before. "I need an app I can't see" is a permissions request rather than
   a sign-in fault, but it is the other thing people are stuck on at this
   screen, so it belongs here rather than nowhere. */
const PROBLEMS = [
  "forgot_password",
  "forgot_username",
  "account_locked",
  "account_disabled",
  "password_expired",
  "no_account",
  "code_not_received",
  "contact_changed",
  "no_app_access",
  "error_message",
  "hub_not_loading",
  "suspicious_activity",
  "other",
] as const;

/* The reasons where an administrator's first question is "which account?".
   Asking for the username on "I don't have an account yet" would be absurd,
   so the field appears only where it can be answered. */
const ASKS_USERNAME = new Set([
  "forgot_password", "account_locked", "account_disabled",
  "password_expired", "code_not_received", "contact_changed",
  "no_app_access", "suspicious_activity",
]);

const DIALS = COUNTRIES.filter((c) => "dial" in c) as ReadonlyArray<{
  code: string; name: string; dial: string;
}>;

/** 🇪🇬 from "EG" — the two letters shifted into Unicode's regional-indicator
 *  block. No flag assets, no lookup table, works for every country code. */
function flagOf(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

interface Props { open: boolean; onClose: () => void }

export default function SignInHelpDialog({ open, onClose }: Props) {
  const { t, lang } = useTranslation(signInT);
  const rtl = lang === "ar";
  const [problem, setProblem] = useState<string>("forgot_password");
  const [message, setMessage] = useState("");
  const [usernameGuess, setUsernameGuess] = useState("");
  const [company, setCompany] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  /* Default the dial code to Egypt — head office — rather than leaving it
     blank and making every visitor hunt for it. */
  const [country, setCountry] = useState("EG");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentRef, setSentRef] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement | null>(null);

  /* Reset on every open so a second visit never shows the last person's
     details — this screen is shared by definition. */
  useEffect(() => {
    if (!open) return;
    setProblem("forgot_password"); setMessage(""); setFullName("");
    setEmail(""); setCountry("EG"); setPhone("");
    setUsernameGuess(""); setCompany("");
    setError(null); setSentRef(null); setBusy(false);
    const t = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => clearTimeout(t);
  }, [open]);

  /* Escape closes, and the page behind must not scroll under the dialog. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const dial = DIALS.find((c) => c.code === country)?.dial ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/support/sign-in-help", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: problem,
          message: message.trim(),
          username: usernameGuess.trim(),
          company: company.trim(),
          reported_language: lang,
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          phone_code: dial,
          country_code: country,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok?: boolean; ref?: string; error?: string } | null;
      if (!res.ok || !json?.ok) {
        setError(json?.error ?? t("err.generic"));
        return;
      }
      setSentRef(json.ref ?? "");
    } catch {
      setError(t("err.network"));
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full h-11 rounded-xl bg-white/[0.04] border border-white/10 px-3 text-[14px] " +
    "text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors";

  return (
    /* Dim + blur behind every popup — house rule. */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      dir={rtl ? "rtl" : "ltr"}
      role="dialog"
      aria-modal="true"
      aria-label="Request sign-in help"
    >
      <div className="w-full max-w-[440px] max-h-[90dvh] overflow-y-auto bg-[#121212] rounded-2xl border border-white/[0.08] shadow-2xl">
        <div className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-semibold text-white">
            {sentRef ? t("help.sentTitle") : t("help.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-8 w-8 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors text-[18px] leading-none"
          >
            ×
          </button>
        </div>

        {sentRef ? (
          <div className="px-6 py-8 text-center">
            <CheckCircleIcon className="h-10 w-10 text-[#10B981] mx-auto mb-4" />
            <p className="text-[15px] text-white font-semibold">
              {t("help.sentHead")}
            </p>
            <p className="text-[13px] text-white/50 mt-2 leading-relaxed">
              {t("help.sentBody")}
            </p>
            <p className="text-[12px] text-white/40 mt-5">{t("help.reference")}</p>
            <p className="text-[16px] text-white font-semibold tabular-nums tracking-wide mt-1">
              {sentRef}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full h-11 rounded-xl bg-white/90 text-black text-[14px] font-semibold hover:bg-white transition-colors"
            >
              {t("help.close")}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-5 space-y-5">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                {t("help.problem")}
              </label>
              {/* A dropdown, not thirteen radio rows: the list grew past the
                  point where scanning it beats picking from it, and on a phone
                  the rows pushed the name and phone fields off the screen
                  entirely. */}
              {/* truncate: a <select> does NOT shorten its own selected text —
                  measured at 375px, the longest option ran 61px past the box and
                  disappeared under the chevron. The labels were shortened too;
                  this is the guard for whatever gets added later. */}
              <select
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                /* ps-3 pe-9, not px-3: the browser draws the chevron inside
                   the inline-END padding, so 12px reserved nothing and long
                   text ran underneath it. Logical properties because that edge
                   is the RIGHT in English and the LEFT in Arabic. */
                className="w-full h-11 truncate rounded-xl bg-white/[0.04] border border-white/10 ps-3 pe-9 text-[14px] text-white outline-none focus:border-white/25 transition-colors"
              >
                {PROBLEMS.map((id) => (
                  <option key={id} value={id} className="bg-[#121212]">
                    {t(`help.p.${id}`)}
                  </option>
                ))}
              </select>
              {problem === "suspicious_activity" && (
                /* Say it back to them. Someone reporting a possible break-in
                   needs to know it was not filed as a password reset. */
                <p className="mt-2 text-[11.5px] text-[#F59E0B] flex items-center gap-1.5">
                  <ExclamationIcon className="h-3.5 w-3.5 shrink-0" />
                  {t("help.urgent")}
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                {problem === "other" ? t("help.describe") : t("help.optional")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={
                  problem === "other"
                    ? t("help.ph.describe")
                    : t("help.ph.detail")
                }
                className="w-full rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2.5 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors resize-none"
              />
            </div>

            <div className="space-y-3">
              {ASKS_USERNAME.has(problem) && (
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                    {t("help.username")}
                  </label>
                  <input
                    value={usernameGuess}
                    onChange={(e) => setUsernameGuess(e.target.value)}
                    maxLength={120}
                    autoComplete="username"
                    className={field}
                    placeholder="jane.cooper"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                  {t("help.name")}
                </label>
                <input
                  ref={firstFieldRef}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  maxLength={120}
                  autoComplete="name"
                  className={field}
                  placeholder="Ahmed Hassan"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                  {t("help.email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={160}
                  autoComplete="email"
                  className={field}
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                  {t("help.company")}
                </label>
                <input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  maxLength={120}
                  autoComplete="organization"
                  className={field}
                  placeholder="Koleex · Production"
                />
              </div>

              {/* The country gets its own full-width row so the NAME fits
                  beside the flag and the code. Squeezed into 124px next to the
                  number it could only ever show "+20", which tells someone
                  scrolling a 29-item list nothing. */}
              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                  {t("help.country")}
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  aria-label="Country"
                  className="w-full h-11 truncate rounded-xl bg-white/[0.04] border border-white/10 ps-3 pe-9 text-[14px] text-white outline-none focus:border-white/25 transition-colors"
                >
                  {DIALS.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#121212]">
                      {flagOf(c.code)}  {c.name}  ·  {c.dial}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] uppercase tracking-[0.14em] text-white/40 font-semibold mb-2">
                  {t("help.phone")}
                </label>
                <div className="flex gap-2">
                  {/* The dial code is shown, not re-picked — it follows the
                      country above. */}
                  <span className="h-11 shrink-0 inline-flex items-center rounded-xl bg-white/[0.06] border border-white/10 px-3 text-[14px] text-white/70 tabular-nums">
                    {dial}
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    maxLength={32}
                    autoComplete="tel"
                    className="flex-1 min-w-0 h-11 rounded-xl bg-white/[0.04] border border-white/10 px-3 text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/25 transition-colors"
                    placeholder="100 123 4567"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-[#FF3333]/10 border border-[#FF3333]/25 px-3 py-2.5">
                <ExclamationIcon className="h-4 w-4 text-[#FF3333] shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-[#FF8A8A]">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full h-11 rounded-xl bg-white/90 text-black text-[14px] font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {busy ? (
                <><SpinnerIcon size={16} className="animate-spin" /> {t("help.sending")}</>
              ) : (
                t("help.send")
              )}
            </button>

            <p className="text-[11px] text-white/30 text-center leading-relaxed">
              {t("help.privacy")}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
