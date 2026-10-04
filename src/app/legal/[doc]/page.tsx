/* A public legal page in English — /legal/privacy-policy, /legal/terms-of-
   service, /legal/data-deletion: the addresses the platforms' app settings
   hold. Built once at deploy (static); no sign-in. */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalDocument, { legalHref } from "@/components/legal/LegalDocument";
import { LEGAL_DOCS, LEGAL_LANGS, LEGAL_SLUGS, type LegalSlug } from "@/lib/legal/documents";

export const dynamicParams = false;

export function generateStaticParams() {
  return (Object.keys(LEGAL_SLUGS) as LegalSlug[]).map((doc) => ({ doc }));
}

const isSlug = (s: string): s is LegalSlug => s in LEGAL_SLUGS;

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }): Promise<Metadata> {
  const { doc } = await params;
  if (!isSlug(doc)) return {};
  const d = LEGAL_DOCS[LEGAL_SLUGS[doc]].en;
  return {
    title: `${d.title} — KOLEEX`,
    robots: { index: false, follow: false },
    alternates: { languages: Object.fromEntries(LEGAL_LANGS.map((l) => [l, legalHref(doc, l)])) },
  };
}

export default async function LegalPageEn({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  if (!isSlug(doc)) notFound();
  return <LegalDocument slug={doc} lang="en" />;
}
