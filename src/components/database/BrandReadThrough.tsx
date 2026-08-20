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

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation, type Translations } from "@/lib/i18n";

const T: Translations = {
  "vl.brands.suppliers":       { en: "Supplier logos", zh: "供应商标志", ar: "شعارات الموردين" },
  "vl.brands.suppliersNote":   { en: "Live from the Suppliers app — edit a supplier's logo there and it changes here immediately.", zh: "实时来自供应商应用——在那里修改标志，这里立即更新。", ar: "مباشرةً من تطبيق الموردين — عدّل شعار المورد هناك ويتغير هنا فورًا." },
  "vl.brands.openSuppliers":   { en: "Open Suppliers", zh: "打开供应商", ar: "افتح الموردين" },
  "vl.brands.noPermission":    { en: "Viewing supplier logos requires Suppliers permission.", zh: "查看供应商标志需要“供应商”权限。", ar: "عرض شعارات الموردين يتطلب صلاحية تطبيق الموردين." },
  "vl.brands.noneWithLogo":    { en: "No suppliers carry a logo yet.", zh: "尚无供应商上传标志。", ar: "لا يوجد موردون لديهم شعارات بعد." },
  "vl.brands.replace":         { en: "Replace", zh: "替换", ar: "استبدال" },
  "vl.brands.remove":          { en: "Remove", zh: "移除", ar: "إزالة" },
  "vl.brands.saveFailed":      { en: "Save failed — you need Suppliers edit permission.", zh: "保存失败——需要供应商编辑权限。", ar: "فشل الحفظ — تحتاج صلاحية تعديل الموردين." },
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

/* Upload a logo file to Storage (same convention as the Contacts app:
   media bucket, contact-images/ prefix) and return its public URL. */
async function uploadLogoFile(file: File): Promise<string | null> {
  try {
    const safe = (file.name || "logo").normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(0, 80);
    const fd = new FormData();
    fd.append("file", file, safe);
    fd.append("bucket", "media");
    fd.append("path", `contact-images/${Date.now()}_${safe}`);
    fd.append("contentType", file.type || "image/png");
    const res = await fetch("/api/storage/upload", { method: "POST", body: fd, credentials: "include" });
    if (!res.ok) return null;
    const json = (await res.json()) as { publicUrl?: string };
    return json.publicUrl ?? null;
  } catch { return null; }
}

export default function BrandReadThrough() {
  const { t } = useTranslation(T);
  const [suppliers, setSuppliers] = useState<SupplierRow[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const targetRef = useRef<string | null>(null);

  /* One control center, one truth: the write goes to the SAME contacts row
     every app reads (PATCH /api/contacts/[id], Suppliers-edit enforced), so
     a change here shows up in Suppliers, pickers, quotations — everywhere —
     immediately. */
  const patchLogo = async (id: string, logo_url: string | null) => {
    setBusyId(id); setErr(null);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo_url }),
      });
      if (!res.ok) { setErr(t("vl.brands.saveFailed", "Save failed — you need Suppliers edit permission.")); setBusyId(null); return; }
      setSuppliers((prev) => (prev ?? []).map((r) => (r.id === id ? { ...r, logo_url } : r)).filter((r) => r.logo_url || r.photo_url));
    } catch {
      setErr(t("vl.brands.saveFailed", "Save failed — you need Suppliers edit permission."));
    }
    setBusyId(null);
  };

  const onPickFile = async (f: File | null) => {
    const id = targetRef.current;
    targetRef.current = null;
    if (!f || !id) return;
    setBusyId(id);
    const url = await uploadLogoFile(f);
    if (!url) { setErr(t("vl.brands.saveFailed", "Save failed — you need Suppliers edit permission.")); setBusyId(null); return; }
    await patchLogo(id, url);
  };

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
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { void onPickFile(e.target.files?.[0] ?? null); e.currentTarget.value = ""; }}
        />
        {err && <p className="mt-2 text-[11.5px] text-rose-400">{err}</p>}
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
                <div key={r.id} className="group relative flex flex-col items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5" title={name(r)}>
                  <span className="flex aspect-square w-full items-center justify-center rounded-lg bg-white p-2 overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={(r.logo_url || r.photo_url)!} alt={name(r)} className={`max-h-full max-w-full object-contain ${busyId === r.id ? "opacity-30" : ""}`} loading="lazy" />
                  </span>
                  <span className="w-full truncate text-center text-[10px] text-[var(--text-muted)]">{name(r)}</span>
                  <span className="absolute inset-x-1.5 top-1.5 flex justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      disabled={busyId !== null}
                      onClick={() => { targetRef.current = r.id; fileRef.current?.click(); }}
                      className="rounded-md border border-[var(--border-subtle)] bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                    >
                      {t("vl.brands.replace", "Replace")}
                    </button>
                    {r.logo_url && (
                      <button
                        type="button"
                        disabled={busyId !== null}
                        onClick={() => { void patchLogo(r.id, null); }}
                        className="rounded-md border border-[var(--border-subtle)] bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-[var(--text-secondary)] hover:text-rose-400 disabled:opacity-40"
                      >
                        {t("vl.brands.remove", "Remove")}
                      </button>
                    )}
                  </span>
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
