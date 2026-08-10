"use client";

/* ---------------------------------------------------------------------------
   JoinPanel — the "Become Koleex Member" form.

   WHY IT LIVES IN ITS OWN FILE. AdminAuth is the auth gate: it wraps every
   route in the Hub, so anything it imports statically is downloaded by every
   signed-in user on every cold load. Measured on production, the sign-in
   chunk was 71 KB of a 1083 KB boot — and the bulk of it was this form, the
   199-country list, the help dialog and the image shrinker, none of which a
   signed-in person will ever see.

   Split out and loaded on demand, so the gate costs a visitor the same and
   costs everybody else nothing.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import dynamic from "next/dynamic";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import MessageSquareIcon from "@/components/icons/ui/MessageSquareIcon";
import PhoneIcon from "@/components/icons/ui/PhoneIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import GlobeIcon from "@/components/icons/ui/GlobeIcon";
import Link2Icon from "@/components/icons/ui/Link2Icon";
import SparklesIcon from "@/components/icons/ui/SparklesIcon";
import UserCheckIcon from "@/components/icons/ui/UserCheckIcon";
import TruckIcon from "@/components/icons/ui/TruckIcon";
import HandshakeIcon from "@/components/icons/ui/HandshakeIcon";
import HelpCircleIcon from "@/components/icons/ui/HelpCircleIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import SelectChevron from "@/components/admin/SelectChevron";
import { countriesFor, countryName, flagOf } from "@/lib/countries-dial";
import { shrinkImage } from "@/lib/shrink-image";
import { useTranslation } from "@/lib/i18n";
import { signInT } from "@/lib/translations/signin";
import { signInJoinT } from "@/lib/translations/signin-join";

/* Merged once at module scope, not per render. The gate half is already
   resident — it ships in the boot chunk — so this costs nothing beyond the
   join copy that arrives with this file, and a missing key is impossible
   because the form can still read anything the gate can. */
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
const joinDict = { ...signInT, ...signInJoinT };
import { inputBase, selectBase, textareaBase, labelBase, primaryButton } from "./field-styles";

/* BrandGlyph carries the simple-icons dataset — lazy even here, so the logos
   arrive with the chips rather than with the form. */
const BrandGlyph = dynamic(() => import("@/components/icons/brands/BrandGlyph"), {
  ssr: false,
  loading: () => <span className="inline-block h-[15px] w-[15px] shrink-0" />,
});

const RELATIONSHIPS: Array<{
  value: string;
  Icon: React.ComponentType<{ size?: number | string; className?: string }>;
}> = [
  { value: "new_prospect", Icon: SparklesIcon },
  { value: "existing_customer", Icon: UserCheckIcon },
  { value: "supplier", Icon: TruckIcon },
  { value: "partner", Icon: HandshakeIcon },
  { value: "other", Icon: HelpCircleIcon },
];

/* Kept in step with PARTNER_TYPES in the membership-request route — the route
   allow-lists them, so adding one here alone files it as "distributor". */
const PARTNER_TYPES = ["distributor", "agent", "service", "other"] as const;

/* Was six hard-coded English strings on a screen that reads in three
   languages, and short enough that "Other" collected most of the answers.
   Labels now come from the dictionary like everything else. */
const HEARD_FROM_OPTIONS = [
  "", "linkedin", "google", "referral", "existing_customer", "sales_rep",
  "partner", "exhibition", "event", "website", "marketplace", "wechat",
  "social", "press", "email", "other",
] as const;

/* How to reach them. A work email is the field we insist on and often the
   worst way to actually reach somebody — a supplier in Shenzhen answers
   WeChat in minutes and email in days. `brand` picks the real logo out of
   BrandGlyph; the rest fall back to a library icon. */
const CONTACT_CHANNELS: Array<{
  value: string;
  brand?: string;
  Icon?: React.ComponentType<{ size?: number | string; className?: string }>;
}> = [
  { value: "email", Icon: EnvelopeIcon },
  { value: "whatsapp", brand: "whatsapp" },
  { value: "wechat", brand: "wechat" },
  { value: "telegram", brand: "telegram" },
  { value: "messenger", brand: "messenger" },
  { value: "sms", Icon: MessageSquareIcon },
  { value: "phone", Icon: PhoneIcon },
  { value: "other", Icon: HelpCircleIcon },
];
/* Channels whose handle IS a phone number — prefilled from the number they
   already typed, because asking twice for the same digits is how a form
   loses somebody at the last field. */
const PHONE_CHANNELS = new Set(["whatsapp", "sms", "phone"]);

/* ── Join / Be a Koleex Member panel ──────────────────────────────────── */

export interface JoinState {
  name: string;
  email: string;
  phone: string;
  relationship: string;
  company: string;
  jobTitle: string;
  country: string;
  customerCode: string;
  koleexContact: string;
  partnerType: string;
  territory: string;
  supplies: string;
  website: string;
  docs: File[];
  contactVia: string;
  contactHandle: string;
  heardFrom: string;
  message: string;
}

export interface JoinSetters {
  setName: (v: string) => void;
  setEmail: (v: string) => void;
  setPhone: (v: string) => void;
  setRelationship: (v: string) => void;
  setCompany: (v: string) => void;
  setJobTitle: (v: string) => void;
  setCountry: (v: string) => void;
  setCustomerCode: (v: string) => void;
  setKoleexContact: (v: string) => void;
  setPartnerType: (v: string) => void;
  setTerritory: (v: string) => void;
  setSupplies: (v: string) => void;
  setWebsite: (v: string) => void;
  setDocs: (v: File[]) => void;
  setContactVia: (v: string) => void;
  setContactHandle: (v: string) => void;
  setHeardFrom: (v: string) => void;
  setMessage: (v: string) => void;
}

export interface JoinPanelProps {
  state: JoinState;
  setters: JoinSetters;
  busy: boolean;
  error: string | null;
  onSubmit: (e: React.FormEvent) => void;
  /* Someone who already has an account is told to sign in instead — the link
     has to actually take them there, not just say so. */
  onGoSignIn: () => void;
}

export default function JoinPanel({
  state,
  setters,
  busy,
  error,
  onSubmit,
  onGoSignIn,
}: JoinPanelProps) {
  const { t, lang } = useTranslation(joinDict);
  const [docErr, setDocErr] = useState<string | null>(null);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {/* Relationship — pill buttons. First thing the admin wants to
          know, so we ask it first and use a visual control so visitors
          don't miss it. */}
      <div>
        <label className={labelBase}>{t("join.relationship")}</label>
        {/* A dropdown, like the reason picker on the help dialog — the same
            screen should not ask two questions two different ways.

            It replaced a grid of five cards. Those were the loudest thing on a
            screen whose whole job is to be quiet: 300px of boxes-inside-boxes,
            centred text against a left-aligned form, and a 2+2+1 grid where
            the least important option got the widest card. One 44px row says
            the same thing, and the helper line under it carries the meaning
            the card subtitles were there for. */}
        <div className="relative">
          {(() => {
            const Current = (RELATIONSHIPS.find((r) => r.value === state.relationship)
              ?? RELATIONSHIPS[0]).Icon;
            return (
              <Current
                size={15}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
              />
            );
          })()}
          <select
            value={state.relationship}
            onChange={(e) => setters.setRelationship(e.target.value)}
            className={`${selectBase.replace('ps-3', '')} ps-9`}
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value} className="bg-[#121212]">
                {t(`rel.${r.value}`)}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
        <p className="mt-1.5 text-[11px] text-white/35">
          {t(`rel.${state.relationship}.d`)}
        </p>
      </div>

      <div className="h-px bg-white/[0.05]" aria-hidden />

      {/* Name — always full width, required */}
      <div>
        <label className={labelBase}>{t("join.name")}</label>
        <div className="relative">
          <UserIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
          <input
            type="text"
            required
            autoComplete="name"
            value={state.name}
            onChange={(e) => setters.setName(e.target.value)}
            placeholder="Jane Cooper"
            className={`${inputBase} ps-9`}
          />
        </div>
      </div>

      {/* Email + Phone row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>{t("join.email")}</label>
          <div className="relative">
            <EnvelopeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="email"
              required
              autoComplete="email"
              value={state.email}
              onChange={(e) => setters.setEmail(e.target.value)}
              placeholder="jane@company.com"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
        <div>
          <label className={labelBase}>{t("join.phone")}</label>
          <div className="relative">
            <PhoneIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="tel"
              autoComplete="tel"
              value={state.phone}
              onChange={(e) => setters.setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      </div>

      {/* Company + Job title row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>{t("join.company")}</label>
          <div className="relative">
            <Building2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              autoComplete="organization"
              value={state.company}
              onChange={(e) => setters.setCompany(e.target.value)}
              placeholder="Acme Inc."
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
        <div>
          <label className={labelBase}>{t("join.jobTitle")}</label>
          <div className="relative">
            <BriefcaseIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              autoComplete="organization-title"
              value={state.jobTitle}
              onChange={(e) => setters.setJobTitle(e.target.value)}
              placeholder="Procurement Manager"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      </div>

      {/* Country + City row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div>
          <label className={labelBase}>{t("join.country")}</label>
          <div className="relative">
            <GlobeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <select
              value={state.country}
              onChange={(e) => setters.setCountry(e.target.value)}
              className={`${selectBase.replace('ps-3', '')} ps-9`}
            >
              <option value="" className="bg-[#121212]">
                {t("join.selectCountry")}
              </option>
              {/* Every country, in the reader's own alphabet. The 29-market
                  pricing list used to be here, so a visitor from Spain or
                  Japan had no row to pick. */}
              {countriesFor(lang).map((c) => (
                <option key={c.code} value={c.code} className="bg-[#121212]">
                  {flagOf(c.code)}  {countryName(c, lang)}
                </option>
              ))}
            </select>
            <SelectChevron />
          </div>
        </div>
        {/* Only an existing customer has a code. Everyone else was being asked
            for a city the admin was never going to use. */}
        {state.relationship === "existing_customer" ? (
          <div>
            <label className={labelBase}>{t("join.customerCode")}</label>
            <div className="relative">
              <Building2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
              <input
                type="text"
                value={state.customerCode}
                onChange={(e) => setters.setCustomerCode(e.target.value)}
                placeholder="KX-1042"
                className={`${inputBase} ps-9`}
              />
            </div>
          </div>
        ) : null}
      </div>


      {/* ── The one question each relationship turns on ──────────────────
          Every field here had to answer: if it were blank, would the
          reviewer have to write back before deciding? Anything that failed
          is not on the form. The most valuable of them is the Koleex
          contact — one internal message to a named colleague settles an
          application faster than reading any document. */}
      {state.relationship === "existing_customer" ||
      state.relationship === "partner" ||
      state.relationship === "supplier" ? (
        <div>
          <label className={labelBase}>{t("join.koleexContact")}</label>
          <div className="relative">
            <UserCheckIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={state.koleexContact}
              onChange={(e) => setters.setKoleexContact(e.target.value)}
              placeholder="Mohamed Adel"
              className={`${inputBase} ps-9`}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-white/35">{t("join.koleexContactHint")}</p>
        </div>
      ) : null}

      {state.relationship === "partner" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <div>
            <label className={labelBase}>{t("join.partnerType")}</label>
            <div className="relative">
              <HandshakeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              <select
                value={state.partnerType}
                onChange={(e) => setters.setPartnerType(e.target.value)}
                className={`${selectBase.replace('ps-3', '')} ps-9`}
              >
                {PARTNER_TYPES.map((v) => (
                  <option key={v} value={v} className="bg-[#121212]">
                    {t(`ptype.${v}`)}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>
          <div>
            <label className={labelBase}>{t("join.territory")}</label>
            <div className="relative">
              <GlobeIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
              <input
                type="text"
                value={state.territory}
                onChange={(e) => setters.setTerritory(e.target.value)}
                placeholder="Upper Egypt"
                className={`${inputBase} ps-9`}
              />
            </div>
          </div>
        </div>
      ) : null}

      {state.relationship === "supplier" ? (
        <div>
          <label className={labelBase}>{t("join.supplies")}</label>
          <div className="relative">
            <TruckIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              value={state.supplies}
              onChange={(e) => setters.setSupplies(e.target.value)}
              placeholder="Spare parts"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      ) : null}

      {state.relationship === "new_prospect" ? (
        <div>
          <label className={labelBase}>{t("join.website")}</label>
          <div className="relative">
            <Link2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
            <input
              type="text"
              inputMode="url"
              value={state.website}
              onChange={(e) => setters.setWebsite(e.target.value)}
              placeholder="company.com"
              className={`${inputBase} ps-9`}
            />
          </div>
        </div>
      ) : null}


      {/* ── Proof ─────────────────────────────────────────────────────────
          The owner's rule: a company license from EVERY applicant, whoever
          they say they are. An invoice or a contract proves a transaction
          happened, not that this person works there — the license is what
          establishes the company, and the second document is what tells the
          reviewer WHICH company record to attach it to.

          The hint is named per relationship on purpose. "Supporting document"
          tells nobody what to go and find. */}
      <div>
        <label className={labelBase}>{t("join.docs")}</label>
        <p className="text-[11px] text-white/45 leading-relaxed mb-2">
          {t("join.docsNeed")}
          <br />
          <span className="text-white/35">{t(`docs.${state.relationship}`)}</span>
        </p>

        {state.docs.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {state.docs.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] px-3 py-2"
              >
                <PaperclipIcon className="h-3.5 w-3.5 text-white/35 shrink-0" />
                <span className="flex-1 min-w-0 truncate text-[12px] text-white/75">{f.name}</span>
                <span className="text-[11px] text-white/35 tabular-nums shrink-0">
                  {Math.max(1, Math.round(f.size / 1024))} KB
                </span>
                <button
                  type="button"
                  onClick={() => setters.setDocs(state.docs.filter((_, j) => j !== i))}
                  className="text-white/40 hover:text-white transition-colors shrink-0"
                  aria-label={t("join.docsRemove")}
                >
                  <CrossIcon className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {state.docs.length < 2 && (
          <label className="flex items-center justify-center gap-2 h-11 rounded-lg border border-dashed border-white/[0.14] bg-white/[0.02] text-[12px] text-white/55 cursor-pointer hover:border-white/25 hover:text-white/80 transition-colors">
            <PaperclipIcon className="h-3.5 w-3.5" />
            {t("join.docsAdd")}
            <input
              type="file"
              className="sr-only"
              multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={async (e) => {
                const picked = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (picked.length === 0) return;
                setDocErr(null);
                /* A license photographed on a phone is 4-6 MB and the ceiling
                   is 4. Shrink it rather than telling someone their own
                   document is "too large" and leaving them to work out why. */
                const room = 2 - state.docs.length;
                const next: File[] = [];
                for (const f of picked.slice(0, room)) {
                  const small = await shrinkImage(f, 4 * 1024 * 1024);
                  if (small.size > 4 * 1024 * 1024) {
                    setDocErr(t("join.docsTooBig"));
                    continue;
                  }
                  next.push(small);
                }
                if (next.length > 0) setters.setDocs([...state.docs, ...next]);
              }}
            />
          </label>
        )}
        {docErr ? (
          <p className="mt-1.5 text-[11px] text-red-300">{docErr}</p>
        ) : (
          <p className="mt-1.5 text-[11px] text-white/30">{t("join.docsHint")}</p>
        )}
        <p className="mt-1.5 text-[11px] text-white/30 leading-relaxed">{t("join.docsPrivate")}</p>
      </div>


      {/* ── How to reach them ─────────────────────────────────────────────
          Chips rather than a dropdown, because the logos ARE the label: you
          recognise the WeChat glyph faster than you read the word, and this
          is the one question on the form where the answer is a brand. Real
          marks from BrandGlyph — the Hub's own component, backed by Simple
          Icons — never hand-drawn. Two columns on a phone, four from sm. */}
      <div>
        <label className={labelBase}>{t("join.contactVia")}</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CONTACT_CHANNELS.map((c) => {
            const on = state.contactVia === c.value;
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setters.setContactVia(c.value);
                  /* Prefill the digits they already typed rather than asking
                     for the same number twice. */
                  setters.setContactHandle(
                    PHONE_CHANNELS.has(c.value) ? state.phone.trim() : "",
                  );
                }}
                className={`h-11 px-2 rounded-lg border text-[12px] font-medium flex items-center justify-center gap-1.5 min-w-0 transition-colors ${
                  on
                    ? "border-white/30 bg-white/[0.09] text-white"
                    : "border-white/[0.08] bg-white/[0.03] text-white/55 hover:text-white/85 hover:border-white/20"
                }`}
              >
                {c.brand ? (
                  <BrandGlyph name={c.brand} size={15} className="shrink-0" />
                ) : c.Icon ? (
                  <c.Icon size={14} className="h-3.5 w-3.5 shrink-0" />
                ) : null}
                <span className="truncate">{t(`cv.${c.value}`)}</span>
              </button>
            );
          })}
        </div>

        {state.contactVia === "email" ? (
          <p className="mt-1.5 text-[11px] text-white/35">{t("cv.emailNote")}</p>
        ) : (
          <div className="mt-2.5">
            <div className="relative">
              {(() => {
                const c = CONTACT_CHANNELS.find((x) => x.value === state.contactVia);
                return c?.brand ? (
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <BrandGlyph name={c.brand} size={14} />
                  </span>
                ) : (
                  <MessageSquareIcon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
                );
              })()}
              <input
                type={PHONE_CHANNELS.has(state.contactVia) ? "tel" : "text"}
                inputMode={PHONE_CHANNELS.has(state.contactVia) ? "tel" : "text"}
                value={state.contactHandle}
                onChange={(e) => setters.setContactHandle(e.target.value)}
                placeholder={t(`cv.h.${state.contactVia}`)}
                aria-label={t(`cv.h.${state.contactVia}`)}
                className={`${inputBase} ps-9`}
              />
            </div>
            {PHONE_CHANNELS.has(state.contactVia) && state.phone.trim() &&
             state.contactHandle.trim() !== state.phone.trim() && (
              <button
                type="button"
                onClick={() => setters.setContactHandle(state.phone.trim())}
                className="mt-1.5 text-[11px] text-white/40 underline underline-offset-2 hover:text-white/70 transition-colors"
              >
                {t("cv.sameAsPhone")}
              </button>
            )}
          </div>
        )}
      </div>

      {/* How did you hear — only asked of someone who has just found us. An
          existing customer or supplier already knows who we are. */}
      {(state.relationship === "new_prospect" || state.relationship === "other") ? (
      <div>
        <label className={labelBase}>{t("join.heardFrom")}</label>
        <div className="relative">
          <Link2Icon className="absolute start-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30 pointer-events-none" />
          <select
            value={state.heardFrom}
            onChange={(e) => setters.setHeardFrom(e.target.value)}
            className={`${selectBase.replace('ps-3', '')} ps-9`}
          >
            {HEARD_FROM_OPTIONS.map((v) => (
              <option key={v || "none"} value={v} className="bg-[#121212]">
                {t(`hf.${v}`)}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
      </div>
      ) : null}

      {/* The last question follows the relationship. "Which parts of the Hub
          would you like access to" is unanswerable for someone who has never
          seen the Hub — which is exactly who ticks "New to Koleex". */}
      <div>
        <label className={labelBase}>{t(`join.q.${state.relationship}`)}</label>
        <div className="relative">
          <MessageSquareIcon className="absolute start-3 top-3 h-3.5 w-3.5 text-white/30" />
          <textarea
            value={state.message}
            onChange={(e) => setters.setMessage(e.target.value)}
            placeholder={t(`join.qh.${state.relationship}`)}
            className={`${textareaBase} ps-9`}
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.08] text-red-300 px-3 py-2 text-[12px] flex items-start gap-2">
          <ExclamationIcon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !state.name || !state.email}
        className={primaryButton}
      >
        {busy ? (
          <>
            <SpinnerIcon className="h-4 w-4" /> Submitting…
          </>
        ) : (
          <>
            <UserPlusIcon className="h-4 w-4" /> {t("join.submit")}
          </>
        )}
      </button>

      <p className="text-[11px] text-white/30 text-center pt-1">
        {t("join.privacy")}
      </p>
    </form>
  );
}

/* ── Success panel shown after a membership request is submitted. ─────── */
