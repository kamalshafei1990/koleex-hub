"use client";

/* ---------------------------------------------------------------------------
   ProductBuilder — the clean, single-page "add / edit product" experience
   that replaces the old 7-step wizard. Built from zero per the frozen North
   Star: ONE smart page, every fact in ONE place (no duplication), reusing the
   EXISTING data layer (createProduct / updateProduct / …) so no data is lost.

   Built incrementally, section by section. This increment ships the clean
   shell + Identity + Description, wired to load & save. Remaining sections
   (Classification · Specs · Commercial · Logistics · Media · Variants) are
   added next and shown here as locked placeholders so the structure is clear.

   The old wizard stays live untouched until this is complete.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CheckIcon from "@/components/icons/ui/CheckIcon";
import { createProduct, updateProduct, fetchProductById } from "@/lib/products-admin";

/* Only the fields this increment edits. Everything writes to the products
   table via the existing create/update functions. */
interface BuilderState {
  product_name: string;
  brand: string;
  status: "draft" | "active" | "archived";
  excerpt: string;
  highlights: string[];
  description: string;
}

const EMPTY: BuilderState = {
  product_name: "",
  brand: "",
  status: "draft",
  excerpt: "",
  highlights: [],
  description: "",
};

const SECTIONS = [
  { id: "identity", label: "Identity", ready: true },
  { id: "description", label: "Description", ready: true },
  { id: "classification", label: "Classification", ready: false },
  { id: "specs", label: "Specs", ready: false },
  { id: "commercial", label: "Commercial", ready: false },
  { id: "logistics", label: "Logistics", ready: false },
  { id: "media", label: "Media", ready: false },
  { id: "variants", label: "Variants", ready: false },
] as const;

export default function ProductBuilder({ productId }: { productId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<BuilderState>(EMPTY);
  const [loading, setLoading] = useState(!!productId);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [id, setId] = useState<string | undefined>(productId);

  const set = useCallback(<K extends keyof BuilderState>(k: K, v: BuilderState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  useEffect(() => {
    if (!productId) return;
    (async () => {
      try {
        const p = (await fetchProductById(productId)) as Record<string, unknown> | null;
        if (p) {
          setForm({
            product_name: String(p.product_name ?? ""),
            brand: String(p.brand ?? ""),
            status: (["draft", "active", "archived"].includes(String(p.status)) ? p.status : "draft") as BuilderState["status"],
            excerpt: String(p.excerpt ?? ""),
            highlights: Array.isArray(p.highlights) ? (p.highlights as string[]) : [],
            description: String(p.description ?? ""),
          });
        }
      } catch {
        setErr("Couldn't load this product.");
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  const save = useCallback(async () => {
    if (!form.product_name.trim()) { setErr("Product name is required."); return; }
    setSaving(true);
    setErr(null);
    const payload = {
      product_name: form.product_name.trim(),
      brand: form.brand.trim() || null,
      status: form.status,
      excerpt: form.excerpt.trim() || null,
      highlights: form.highlights.filter((h) => h.trim()),
      description: form.description || null,
    };
    try {
      if (id) {
        const ok = await updateProduct(id, payload);
        if (!ok) throw new Error("update failed");
      } else {
        const created = (await createProduct(payload)) as { id?: string } | null;
        if (!created?.id) throw new Error("create failed");
        setId(created.id);
        router.replace(`/product-data/builder?id=${created.id}`);
      }
      setSavedAt(Date.now());
    } catch {
      setErr("Save failed — please retry.");
    } finally {
      setSaving(false);
    }
  }, [form, id, router]);

  if (loading) {
    return <div className="h-72 grid place-items-center text-[13px] text-[var(--text-dim)]">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Sticky top bar */}
      <div className="sticky top-0 z-30 border-b border-[var(--border-subtle)] bg-[var(--bg-primary)]/95 backdrop-blur-md">
        <div className="mx-auto max-w-[1180px] px-4 md:px-6 lg:px-10 h-16 flex items-center gap-3">
          <Link href="/product-data" className="h-8 w-8 grid place-items-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] shrink-0">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--text-dim)] leading-none">
              {id ? "Edit product" : "New product"}
            </p>
            <p className="text-[16px] font-bold tracking-tight truncate leading-tight mt-0.5">
              {form.product_name || "Untitled product"}
            </p>
          </div>
          {savedAt && !saving && <span className="text-[11px] text-emerald-400 inline-flex items-center gap-1"><CheckIcon className="h-3 w-3" /> Saved</span>}
          <button
            onClick={save}
            disabled={saving}
            className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-[1180px] px-4 md:px-6 lg:px-10 py-6 flex gap-8">
        {/* Section rail */}
        <nav className="hidden lg:block w-44 shrink-0 sticky top-24 self-start space-y-0.5">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={s.ready ? `#${s.id}` : undefined}
              className={`block px-3 py-2 rounded-lg text-[13px] ${
                s.ready
                  ? "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
                  : "text-[var(--text-ghost)] cursor-default"
              }`}
            >
              {s.label}{!s.ready && <span className="text-[10px] ml-1.5 opacity-70">soon</span>}
            </a>
          ))}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">
          {err && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 px-3 py-2 text-[12px] text-amber-400">{err}</div>
          )}

          {/* ── Identity ── */}
          <section id="identity" className="scroll-mt-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
            <h2 className="text-[15px] font-bold mb-1">Identity</h2>
            <p className="text-[12px] text-[var(--text-dim)] mb-4">The product&apos;s name, brand and state — entered once.</p>
            <div className="space-y-4">
              <Field label="Product name" required>
                <input
                  value={form.product_name}
                  onChange={(e) => set("product_name", e.target.value)}
                  placeholder="e.g. Intelligent Lockstitch Sewing Machine"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Brand">
                  <input value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="Koleex" className={inputCls} />
                </Field>
                <Field label="Status">
                  <div className="inline-flex rounded-lg border border-[var(--border-subtle)] overflow-hidden">
                    {(["draft", "active", "archived"] as const).map((st) => (
                      <button
                        key={st}
                        onClick={() => set("status", st)}
                        className={`px-3 h-10 text-[12px] font-medium capitalize border-r border-[var(--border-subtle)] last:border-r-0 ${
                          form.status === st ? "bg-[var(--text-primary)] text-[var(--bg-primary)]" : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            </div>
          </section>

          {/* ── Description ── */}
          <section id="description" className="scroll-mt-24 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-5">
            <h2 className="text-[15px] font-bold mb-1">Description</h2>
            <p className="text-[12px] text-[var(--text-dim)] mb-4">Short summary, hero highlights and the full description — together so they stay consistent.</p>
            <div className="space-y-4">
              <Field label="Excerpt" hint="1–2 sentences shown on cards & search">
                <textarea value={form.excerpt} onChange={(e) => set("excerpt", e.target.value)} rows={2} className={inputCls} />
              </Field>
              <Field label="Highlights" hint="3–5 short selling points">
                <div className="space-y-2">
                  {form.highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={h}
                        onChange={(e) => set("highlights", form.highlights.map((x, xi) => (xi === i ? e.target.value : x)))}
                        placeholder="e.g. 5000 spm · auto thread trimmer"
                        className={inputCls}
                      />
                      <button onClick={() => set("highlights", form.highlights.filter((_, xi) => xi !== i))} className="h-9 w-9 grid place-items-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-[var(--bg-surface)]">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => set("highlights", [...form.highlights, ""])} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-[var(--text-muted)] border border-dashed border-[var(--border-subtle)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)]">
                    <PlusIcon className="h-3 w-3" /> Add highlight
                  </button>
                </div>
              </Field>
              <Field label="Full description">
                <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={8} className={inputCls} />
              </Field>
            </div>
          </section>

          {/* Locked sections — next increments */}
          {SECTIONS.filter((s) => !s.ready).map((s) => (
            <section key={s.id} id={s.id} className="rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]/40 p-5">
              <h2 className="text-[15px] font-bold text-[var(--text-muted)]">{s.label} <span className="text-[11px] font-medium text-[var(--text-dim)]">· coming next</span></h2>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-10 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12px] font-semibold text-[var(--text-primary)]">
        {label}{required && <span className="text-amber-400"> *</span>}
        {hint && <span className="text-[var(--text-dim)] font-normal"> — {hint}</span>}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
