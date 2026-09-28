/* A public legal page in Arabic or Chinese — /legal/<doc>/ar, /legal/<doc>/zh.
   Built once at deploy (static); no sign-in. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalDocument, { legalHref } from "@/components/legal/LegalDocument";
import { LEGAL_DOCS, LEGAL_LANGS, LEGAL_SLUGS, type LegalLang, type LegalSlug } from "@/lib/legal/documents";

export const dynamicParams = false;

const OTHER: readonly LegalLang[] = ["ar", "zh"];

export function generateStaticParams() {
  return (Object.keys(LEGAL_SLUGS) as LegalSlug[]).flatMap((doc) => OTHER.map((lang) => ({ doc, lang })));
}

const isSlug = (s: string): s is LegalSlug => s in LEGAL_SLUGS;
const isLang = (s: string): s is LegalLang => (OTHER as readonly string[]).includes(s);

export async function generateMetadata({ params }: { params: Promise<{ doc: string; lang: string }> }): Promise<Metadata> {
  const { doc, lang } = await params;
  if (!isSlug(doc) || !isLang(lang)) return {};
  const d = LEGAL_DOCS[LEGAL_SLUGS[doc]][lang];
  return {
    title: `${d.title} — KOLEEX`,
    robots: { index: false, follow: false },
    alternates: { languages: Object.fromEntries(LEGAL_LANGS.map((l) => [l, legalHref(doc, l)])) },
  };
}

export default async function LegalPageOther({ params }: { params: Promise<{ doc: string; lang: string }> }) {
  const { doc, lang } = await params;
  if (!isSlug(doc) || !isLang(lang)) notFound();
  return <LegalDocument slug={doc} lang={lang} />;
}
