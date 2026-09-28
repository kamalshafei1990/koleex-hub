"use client";

import dynamic from "next/dynamic";

/* Browser-only: the fill comes from the window that opened this page. */
const TemplatePrint = dynamic(() => import("@/components/brand-center/templates/TemplatePrint"), { ssr: false });

export default function BrandTemplatePrintPage() {
  return <TemplatePrint />;
}
