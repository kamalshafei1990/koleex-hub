/* ---------------------------------------------------------------------------
   LegalDocument — one of Koleex's public legal pages, as a plain document:
   the KOLEEX logo, the three pages and three languages to switch between,
   and the text. A server component with no script of its own, served to
   anyone without signing in (RootShell leaves /legal outside the Hub's gate
   and chrome) — the platforms' reviewers open these links. Light paper on
   purpose, whatever the Hub's theme: it is a document.
   --------------------------------------------------------------------------- */

import Link from "next/link";
import { LEGAL_DOCS, LEGAL_LANGS, LEGAL_SLUGS, type LegalLang, type LegalPart, type LegalSlug } from "@/lib/legal/documents";
import { legalNameEn } from "@/lib/legal-name";

const LANG_NAME: Record<LegalLang, string> = { en: "English", ar: "العربية", zh: "中文" };
/* The formal name from the one source; built at deploy like the page. */
const FOOTER: Record<LegalLang, string> = {
  en: legalNameEn(),
  ar: legalNameEn(),
  zh: "科莱恪斯国际商业管理（台州）有限公司",
};

/** The public address of a page in a language (English is the plain one). */
export const legalHref = (slug: LegalSlug, lang: LegalLang) => (lang === "en" ? `/legal/${slug}` : `/legal/${slug}/${lang}`);

function Parts({ parts }: { parts: LegalPart[] }) {
  return (
    <>
      {parts.map((p, i) =>
        typeof p === "string" ? <span key={i}>{p}</span>
        : "b" in p ? <strong key={i} className="font-semibold text-[#111]">{p.b}</strong>
        : "a" in p ? <a key={i} href={p.a} dir="ltr" className="break-all text-[#3E6796] underline underline-offset-2">{p.text}</a>
        : "ltr" in p ? <span key={i} dir="ltr">{p.ltr}</span>
        : <br key={i} />,
      )}
    </>
  );
}

export default function LegalDocument({ slug, lang }: { slug: LegalSlug; lang: LegalLang }) {
  const doc = LEGAL_DOCS[LEGAL_SLUGS[slug]][lang];
  const rtl = lang === "ar";
  return (
    <main className="min-h-dvh bg-[#F4F5F7] px-4 py-8 text-[#111] [color-scheme:light] md:py-14">
      <div className="mx-auto flex max-w-[820px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/koleex-logo-black.svg" alt="KOLEEX" width={134} height={20} className="h-5 w-auto" />
          <nav aria-label="Language" className="inline-flex rounded-full border border-[#E1E4E9] bg-white p-1">
            {LEGAL_LANGS.map((l) => (
              <Link
                key={l}
                href={legalHref(slug, l)}
                hrefLang={l}
                lang={l}
                aria-current={l === lang ? "page" : undefined}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium ${l === lang ? "bg-[#111] text-white" : "text-[#5A6170] hover:text-[#111]"}`}
              >
                {LANG_NAME[l]}
              </Link>
            ))}
          </nav>
        </header>

        <nav aria-label={doc.title} dir={rtl ? "rtl" : "ltr"} lang={lang} className="flex flex-wrap gap-2">
          {(Object.keys(LEGAL_SLUGS) as LegalSlug[]).map((s) => (
            <Link
              key={s}
              href={legalHref(s, lang)}
              aria-current={s === slug ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-[13px] ${s === slug ? "border-[#111] bg-white font-semibold text-[#111]" : "border-[#E1E4E9] bg-white/60 text-[#5A6170] hover:text-[#111]"}`}
            >
              {LEGAL_DOCS[LEGAL_SLUGS[s]][lang].title}
            </Link>
          ))}
        </nav>

        <article lang={lang} dir={rtl ? "rtl" : "ltr"} className="rounded-2xl border border-[#E1E4E9] bg-white px-5 py-8 shadow-[0_1px_2px_rgba(11,12,14,0.05)] md:px-14 md:py-12">
          <h1 className="text-balance text-[26px] font-bold leading-tight md:text-[30px]">{doc.title}</h1>
          <p className="mt-1.5 text-[13.5px] text-[#5A6170]">{doc.updated}</p>
          <div className={`mt-7 flex flex-col gap-3 text-[15px] ${lang === "en" ? "leading-7" : "leading-8"} text-[#2E2E2E]`}>
            {doc.blocks.map((b, i) =>
              b.t === "h2" ? <h2 key={i} className="mt-4 text-balance text-[17px] font-semibold text-[#111]"><Parts parts={b.parts} /></h2>
              : b.t === "p" ? <p key={i} className="break-words"><Parts parts={b.parts} /></p>
              : b.t === "ul" ? <ul key={i} className="flex list-disc flex-col gap-1.5 ps-6 marker:text-[#888]">{b.items.map((it, j) => <li key={j} className="break-words"><Parts parts={it} /></li>)}</ul>
              : <ol key={i} className="flex list-decimal flex-col gap-1.5 ps-6 marker:text-[#888]">{b.items.map((it, j) => <li key={j} className="break-words"><Parts parts={it} /></li>)}</ol>,
            )}
          </div>
        </article>

        <footer className="text-center text-[12px] leading-5 text-[#666]">
          <span lang={lang}>{FOOTER[lang]}</span> · <span dir="ltr">info@koleexgroup.com</span>
        </footer>
      </div>
    </main>
  );
}
