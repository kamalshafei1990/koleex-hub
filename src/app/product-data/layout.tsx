"use client";

/* ---------------------------------------------------------------------------
   /product-data/* layout — the shared Hub app header, rendered ONCE for the
   segment (same pattern as /inventory/layout.tsx and /purchase/layout.tsx).

   Owner request, 2026-08-12: "compare opening Product Data against Inventory
   and Purchases — I like Inventory's way far more, I can't catch the
   difference." Measured, the difference was not the loading screen (all three
   render the same BrandLoading), not speed (Product Data paints at 124ms vs
   Inventory's 548ms) and not lazy images. It was that Inventory opens on a
   landing screen with a hero + tab strip, and Product Data opened straight
   into 17 screens of raw catalogue.

   WHY ONLY TWO ROUTES GET THE HEADER. Inventory puts its header on every
   route in the segment. Product Data's inner routes are editors — /new,
   /[id], /[id]/edit — and each already carries a strong header of its own, so
   a second app header above them would be chrome on top of chrome. The header
   is therefore scoped to the two BROWSE surfaces (home + catalogue); the
   editors are untouched.
   --------------------------------------------------------------------------- */

import { usePathname } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import type { PageTab } from "@/components/ui/PageHeader";
import AppIcon from "@/components/common/AppIcon";
import { useTranslation } from "@/lib/i18n";
import { PRODUCTS_UI_I18N } from "@/lib/products-ui-i18n";
import PlusIcon from "@/components/icons/ui/PlusIcon";

/* ONLY the landing screen. The catalogue keeps the header it already has:
   that grid's sticky search bar and category nav break OUT of the page
   padding with negative margins (-mx-4 md:-mx-6 lg:-mx-8) and share one
   blurred ramp, so wrapping it in this layout's own padded container would
   have to be a rewrite of that whole top strip, not a header swap. It gets
   the tab strip in a later pass, once the owner has seen this shape.
   Everything else in the segment is an editor with its own chrome. */
const HEADER_ROUTES = new Set(["/product-data"]);

export default function ProductDataLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/product-data";
  const { t } = useTranslation(PRODUCTS_UI_I18N);

  if (!HEADER_ROUTES.has(pathname)) return <>{children}</>;

  const isCatalog = pathname === "/product-data/catalog";
  const key = isCatalog ? "catalog" : "home";

  const tabs: PageTab[] = [
    { key: "/product-data",          label: t("tab.home", "Home"),              icon: "home" },
    { key: "/product-data/catalog",  label: t("tab.catalog", "Catalogue"),      icon: "box-open" },
    { key: "/product-data/settings", label: t("tab.settings", "Control Panel"), icon: "tools" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-16 text-[var(--text-primary)] md:pb-6">
      <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 sm:px-6">
        <PageHeader
          title={t(`page.${key}.title`, "Product Data")}
          subtitle={t(`page.${key}.subtitle`, "")}
          icon={<AppIcon appId="product-data" className="h-4 w-4" size={16} />}
          backHref="/"
          tabs={tabs}
          action={
            <Link
              href="/product-data/new"
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg"
            >
              <PlusIcon className="h-4 w-4" /> {t("action.addProduct", "Add Product")}
            </Link>
          }
        />
        {children}
      </div>
    </div>
  );
}
