/* /products/[id]/print?lang=en|zh|ar — the printed product sheet.
 *
 * Rebuild phase 5 (19/09/2026). Rendered on the server from the SAME loader
 * the page and the AI read, with audience "print": no price of any kind
 * reaches this document. The Hub shell skips every "/print" route
 * (RootShell BYPASS_SUFFIXES), so the sheets are the whole page — nothing
 * else prints. `?auto=1` opens the print dialog once images and fonts have
 * settled (PrintReady), which is also how a headless PDF snapshot waits.
 *
 * Who may open it: anyone signed in (a Hub account), for any product they
 * can see on the page. A draft prints for staff so a sheet can be proofed
 * before the product goes live; it never prints for a public reader.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerAuth } from "@/lib/server/auth";
import { loadPublicSchemaProduct } from "@/lib/server/product-detail";
import ProductPrintDoc from "@/components/product-print/ProductPrintDoc";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const LANGS: Lang[] = ["en", "zh", "ar"];
const pickLang = (v: string | string[] | undefined): Lang => {
  const s = Array.isArray(v) ? v[0] : v;
  return LANGS.includes(s as Lang) ? (s as Lang) : "en";
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const loaded = await loadPublicSchemaProduct(id, { audience: "print" });
  return { title: loaded ? `${loaded.productName}${loaded.preview.primaryModel ? ` · ${loaded.preview.primaryModel}` : ""}` : "Product sheet" };
}

export default async function ProductPrintPage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const lang = pickLang(sp.lang);
  const auth = await getServerAuth();
  const loaded = await loadPublicSchemaProduct(id, { allowUnpublished: Boolean(auth), audience: "print" });
  if (!loaded) notFound();
  /* The root layout owns <html>/<body>; the shell steps aside for "/print"
     routes, so the sheets are all that renders. Direction is set per sheet. */
  return <ProductPrintDoc loaded={loaded} lang={lang} />;
}
