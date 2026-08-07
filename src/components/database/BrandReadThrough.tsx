"use client";

/* ---------------------------------------------------------------------------
   BrandReadThrough — Database › Visual Library › Brands (below the product
   brands manager).

   Owner intent: Brands is where ALL logos in the system are visible — from
   suppliers to the company itself. Product brands are MANAGED here
   (BrandsManager above); this block is the READ-THROUGH view of the other two
   logo families, each owned by its own app:

   · Supplier logos — live from the Contacts store (Suppliers app owns them).
     Changing a supplier's logo there changes it here instantly. Requires the
     viewer to hold Suppliers permission (the API enforces it); without it we
     say so instead of failing silently.
   · Company identity — the official KOLEEX Hub logo set shipped with the
     platform (public/brand). Read-only by design.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.brands.suppliers":       { en: "Supplier logos", zh: "供应商标志", ar: "شعارات الموردين" },
  "vl.brands.suppliersNote":   { en: "Live from the Suppliers app — edit a supplier's logo there and it changes here immediately.", zh: "实时来自供应商应用——在那里修改标志，这里立即更新。", ar: "مباشرةً من تطبيق الموردين — عدّل شعار المورد هناك ويتغير هنا فورًا." },
  "vl.brands.openSuppliers":   { en: "Open Suppliers", zh: "打开供应商", ar: "افتح الموردين" },
  "vl.brands.noPermission":    { en: "Viewing supplier logos requires Suppliers permission.", zh: "查看供应商标志需要“供应商”权限。", ar: "عرض شعارات الموردين يتطلب صلاحية تطبيق الموردين." },
  "vl.brands.noneWithLogo":    { en: "No suppliers carry a logo yet.", zh: "尚无供应商上传标志。", ar: "لا يوجد موردون لديهم شعارات بعد." },
  "vl.brands.company":         { en: "Company identity", zh: "公司标识", ar: "هوية الشركة" },
  "vl.brands.companyNote":     { en: "The official KOLEEX Hub logo set — shipped with the platform, read-only.", zh: "官方 KOLEEX Hub 标志组——随平台提供，只读。", ar: "مجموعة شعارات KOLEEX Hub الرسمية — تأتي مع المنصة، للقراءة فقط." },
};

interface SupplierRow {
  id: string;
  company_name_en?: string | null;
  company_name?: string | null;
  display_name?: string | null;
  full_name?: string | null;
  logo_url?: string | null;
  photo_url?: string | null;
}

const COMPANY_ASSETS: { label: string; src: string; dark?: boolean }[] = [
  { label: "Hub logo · light", src: "/brand/hub-logo/koleex-hub-logo-for-light.png" },
  { label: "Hub logo · dark", src: "/brand/hub-logo/koleex-hub-logo-for-dark.png", dark: true },
  { label: "Stacked · light", src: "/brand/hub-logo/koleex-hub-stacked-for-light.png" },
  { label: "Stacked · dark", src: "/brand/hub-logo/koleex-hub-stacked-for-dark.png", dark: true },
  { label: "Mono · light", src: "/brand/hub-logo/koleex-hub-logo-mono-light.png" },
  { label: "Mono · dark", src: "/brand/hub-logo/koleex-hub-logo-mono-dark.png", dark: true },
  { label: "Script", src: "/brand/hub-logo/hub-script.png", dark: true },
  { label: "AI face", src: "/brand/koleex-ai-face.png", dark: true },
];

export default function BrandReadThrough() {
  const { t } = useTranslation(T);
  const [suppliers, setSuppliers] = useState<SupplierRow[] | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/contacts?paged=1&type=supplier&pageSize=100", { credentials: "include" });
        if (res.status === 403) { if (alive) setDenied(true); return; }
        const json = (await res.json().catch(() => null)) as { rows?: SupplierRow[] } | null;
        if (alive) setSuppliers((json?.rows ?? []).filter((r) => r.logo_url || r.photo_url));
      } catch {
        if (alive) setSuppliers([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const name = (r: SupplierRow) =>
    r.company_name_en || r.company_name || r.display_name || r.full_name || "—";

  return (
    <div className="space-y-5 mt-8">
      {/* Supplier logos — read-through */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[13.5px] font-bold text-[var(--text-primary)]">{t("vl.brands.suppliers", "Supplier logos")}</h3>
            <p className="text-[11.5px] text-[var(--text-dim)] mt-0.5">{t("vl.brands.suppliersNote", "Live from the Suppliers app — edit a supplier's logo there and it changes here immediately.")}</p>
          </div>
          <Link href="/suppliers" className="text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0">
            {t("vl.brands.openSuppliers", "Open Suppliers")} →
          </Link>
        </div>
        <div className="mt-3">
          {denied ? (
            <p className="text-[12px] text-[var(--text-ghost)] py-4 text-center">{t("vl.brands.noPermission", "Viewing supplier logos requires Suppliers permission.")}</p>
          ) : suppliers === null ? (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-xl bg-[var(--bg-surface-subtle)] animate-pulse" />
              ))}
            </div>
          ) : suppliers.length === 0 ? (
            <p className="text-[12px] text-[var(--text-ghost)] py-4 text-center">{t("vl.brands.noneWithLogo", "No suppliers carry a logo yet.")}</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-7 gap-2">
              {suppliers.map((r) => (
                <div key={r.id} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5" title={name(r)}>
                  <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-white p-2 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={(r.logo_url || r.photo_url)!} alt={name(r)} className="max-h-full max-w-full object-contain" loading="lazy" />
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-[var(--text-muted)]">{name(r)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Company identity — read-only */}
      <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
        <h3 className="text-[13.5px] font-bold text-[var(--text-primary)]">{t("vl.brands.company", "Company identity")}</h3>
        <p className="text-[11.5px] text-[var(--text-dim)] mt-0.5">{t("vl.brands.companyNote", "The official KOLEEX Hub logo set — shipped with the platform, read-only.")}</p>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {COMPANY_ASSETS.map((a) => (
            <div key={a.src} className="flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5">
              <span className={`flex h-16 w-full items-center justify-center rounded-lg p-2 ${a.dark ? "bg-neutral-900" : "bg-white"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.src} alt={a.label} className="max-h-full max-w-full object-contain" loading="lazy" />
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">{a.label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
