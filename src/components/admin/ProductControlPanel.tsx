"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import TabStrip from "@/components/ui/TabStrip";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import FolderTreeIcon from "@/components/icons/ui/FolderTreeIcon";
import RefreshIcon from "@/components/icons/ui/RefreshIcon";
import SettingsIcon2 from "@/components/icons/ui/SettingsIcon2";
import ImageIcon from "@/components/icons/ui/PictureIcon";
import BookmarkIcon from "@/components/icons/ui/BookmarkIcon";
import { getDivisionIcon } from "@/components/icons/divisions";
import {
  fetchDivisions, fetchCategories, fetchSubcategories,
  createDivision, updateDivision, deleteDivision,
  createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
  fetchCategoryCounts, fetchSubcategoryCounts,
  fetchBrandLogos, uploadBrandLogo, deleteBrandLogo,
  fetchDivisionLogos, uploadDivisionLogo, deleteDivisionLogo,
  fetchCategoryLogos, uploadCategoryLogo, deleteCategoryLogo,
  fetchSubcategoryLogos, uploadSubcategoryLogo, deleteSubcategoryLogo,
} from "@/lib/products-admin";
import {
  fetchAttributeUsage, renameAttributeInProducts, deleteAttributeFromProducts,
  fetchProductCountsByClassification,
} from "@/lib/product-attributes";
import type { AttributeUsage } from "@/lib/product-attributes";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import nextDynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = nextDynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });
/* Tiny wrapper so the aurora branch (the one JS piece CSS can't switch)
   stays out of the page component's already-long body. */
function ControlPanelGround() {
  const aurora = useSkin() === "aurora";
  if (!aurora) return null;
  return (
    <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
      <WavyBackground topLight />
    </div>
  );
}

/* ── Tabs ── */
/* ── WHY THERE ARE TWO TABS AND NOT EIGHT ──────────────────────────────────
   Level · Tags · Plug Types · Colors · Watt · Voltage were retired on
   2026-08-25 after measuring what they actually held across all 272 products:

     Classifications  272/272     Tags        0/272
     Brands           272/272     Plug Types  0/272
     Level              4/272     Colors      0/272
     Voltage            1/272     Watt        0/272

   The zeroes were not neglect, they were a VERDICT. Those six were columns on
   `products` — on the PRODUCT — while voltage, colour, wattage and plug
   standard are exactly what separates one MODEL from another. A machine sold
   in a 220V and a 380V model has no honest value to put in a single
   product-level box, so nobody put one.

   The spec schemas already answer it properly: `voltage_options` (plural, in
   _shared-machine-groups) plus power_consumption_w and phase, resolved per
   subcategory, with per-model overrides. 240 of 272 products carry a schema.

   Level is the exception and its FIELD survives on the product form: it is
   filled from the live Commercial Policy via /api/products/price-preview,
   whose codes come from LEVEL_TO_TIER in the form's own code — never from
   the list this tab used to edit. The tab was editing a list nothing read.

   NO DATA WAS DELETED. The `products` columns and
   media/config/product-attributes.json are untouched; only the ways IN are
   closed, so nothing new lands in a shape we already know is wrong. Dropping
   the columns is a separate, later, one-way step.
   ------------------------------------------------------------------------ */
const TABS = [
  { id: "classifications", label: "Classifications", icon: FolderTreeIcon },
  { id: "brands", label: "Brands", icon: BookmarkIcon },
] as const;
type TabId = (typeof TABS)[number]["id"];

function toSlug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

/* ═══════════════════════════════════════════════
   ── Attribute Edit Modal (with image upload) ──
   ═══════════════════════════════════════════════ */

/* Was a generic modal switched by `attrType` across seven value lists. Brands
   is the only one left, so it says so — a type parameter with one possible
   value is a lie about how many things this edits. */
function BrandModal({
  open, onClose, editValue, editImage, existingValues, onSave,
}: {
  open: boolean;
  onClose: () => void;
  editValue: string | null;
  editImage?: string | null;
  existingValues: string[];
  onSave: (oldValue: string | null, newValue: string, imageFile?: File | null, removeImage?: boolean) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(editValue || "");
      setImageFile(null);
      setImagePreview(editImage || null);
      setRemoveImage(false);
      setError("");
    }
  }, [open, editValue, editImage]);

  const handleImageSelect = (files: FileList | null) => {
    if (!files?.length) return;
    setImageFile(files[0]);
    setImagePreview(URL.createObjectURL(files[0]));
    setRemoveImage(false);
  };

  const handleSave = async () => {
    const trimmed = value.trim();
    if (!trimmed) { setError("Value is required"); return; }
    if (existingValues.some(v => v.toLowerCase() === trimmed.toLowerCase() && v !== editValue)) {
      setError("Already exists"); return;
    }
    setSaving(true);
    await onSave(editValue, trimmed, imageFile, removeImage);
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  const l = { title: "Brand", placeholder: "e.g. FANUC, ABB, Koleex" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{editValue ? `Edit ${l.title}` : `New ${l.title}`}</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><CrossIcon className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">{error}</div>}

          <div className="flex gap-4 items-start">
            {/* Image upload area */}
            {(
              <div className="shrink-0">
                <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Image</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e.target.files)} />
                {imagePreview && !removeImage ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-bright)]">
                    <img src={imagePreview} alt="" className="w-full h-full object-contain p-1.5" />
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true); if (fileRef.current) fileRef.current.value = ""; }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-[var(--bg-surface-active)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-surface-bright)] transition-colors"><CrossIcon className="h-2.5 w-2.5" /></button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()} className="w-20 h-20 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-blue-500/30 bg-[var(--bg-surface)] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group">
                    <ImageIcon className="h-5 w-5 text-[var(--text-dim)] group-hover:text-[var(--text-dim)] transition-colors" />
                    <span className="text-[9px] text-[var(--text-dim)] group-hover:text-[var(--text-dim)]">Upload</span>
                  </button>
                )}
              </div>
            )}

            {/* Name input */}
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">{l.title} Name *</label>
              <input type="text" value={value} onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
                placeholder={l.placeholder} autoFocus
                className="w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all"
              />
              {editValue && <p className="text-[10px] text-[var(--text-dim)] mt-1.5">Renaming updates all products.</p>}
            </div>
          </div>

          {/* Tag color picker */}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !value.trim()} className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-40">
            {saving && <SpinnerIcon className="h-4 w-4" />}
            {saving ? "Saving..." : editValue ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   ── Classification Edit Modal ──
   ═══════════════════════════════ */
function ClassificationModal({
  open, onClose, type, editItem, parentName, onSave, editLogoUrl, onUploadLogo, onDeleteLogo,
}: {
  open: boolean; onClose: () => void;
  type: "division" | "category" | "subcategory";
  editItem: { id: string; name: string; slug: string; description: string } | null;
  parentName?: string;
  onSave: (data: { name: string; slug: string; description: string }, id?: string) => Promise<boolean>;
  editLogoUrl?: string | null;
  onUploadLogo?: (slug: string, file: File) => Promise<string | null>;
  onDeleteLogo?: (slug: string) => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) { setName(editItem?.name || ""); setSlug(editItem?.slug || ""); setSlugEdited(!!editItem); setDescription(editItem?.description || ""); setError(""); setLogoFile(null); setLogoPreview(editLogoUrl || null); setRemoveLogo(false); }
  }, [open, editItem, editLogoUrl]);

  useEffect(() => { if (!slugEdited && name) setSlug(toSlug(name)); }, [name, slugEdited]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true); setError("");
    const ok = await onSave({ name: name.trim(), slug, description: description.trim() }, editItem?.id);
    if (!ok) { setError("Failed to save"); setSaving(false); return; }
    // Handle logo upload/delete
    const finalSlug = slug || toSlug(name.trim());
    if (onUploadLogo && logoFile) await onUploadLogo(finalSlug, logoFile);
    if (onDeleteLogo && removeLogo && !logoFile) await onDeleteLogo(finalSlug);
    setSaving(false); onClose();
  };

  if (!open) return null;
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div>
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{editItem ? `Edit ${typeLabel}` : `New ${typeLabel}`}</h2>
            {parentName && <p className="text-[11px] text-[var(--text-dim)] mt-0.5">in {parentName}</p>}
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><CrossIcon className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">{error}</div>}
          {/* Logo upload */}
          {onUploadLogo && (
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Logo</label>
              <div className="flex items-center gap-3">
                <input ref={logoRef} type="file" accept=".svg,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setLogoFile(f); setLogoPreview(URL.createObjectURL(f)); setRemoveLogo(false); } e.target.value = ""; }} />
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center overflow-hidden shrink-0 transition-colors ${logoPreview && !removeLogo ? "bg-[var(--bg-surface-bright)] border border-[var(--border-subtle)]" : "bg-[var(--bg-surface)] border-2 border-dashed border-[var(--border-subtle)]"}`}>
                  {logoPreview && !removeLogo ? (
                    <img src={logoFile ? URL.createObjectURL(logoFile) : logoPreview} alt="" className="w-9 h-9 object-contain" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-[var(--text-dim)]" />
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <button type="button" onClick={() => logoRef.current?.click()} className="h-7 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[10px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] flex items-center gap-1 transition-colors">
                    <PlusIcon className="h-2.5 w-2.5" />{logoPreview && !removeLogo ? "Replace" : "Upload"}
                  </button>
                  {logoPreview && !removeLogo && (
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); setRemoveLogo(true); }} className="h-7 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-medium text-red-400/70 hover:text-red-400 flex items-center gap-1 transition-colors">
                      <TrashIcon className="h-2.5 w-2.5" />Remove
                    </button>
                  )}
                  <span className="text-[9px] text-[var(--text-dim)]">SVG, PNG, JPG</span>
                </div>
              </div>
            </div>
          )}
          <div><label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Name *</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={`${typeLabel} name`} className={inp} autoFocus /></div>
          <div><label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Slug</label><input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }} placeholder="auto-generated" className={inp + " font-mono text-[12px]"} /></div>
          <div><label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Description</label><textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} className={inp + " h-auto py-3 resize-none"} /></div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 transition-all shadow-lg disabled:opacity-40">
            {saving && <SpinnerIcon className="h-4 w-4" />}{saving ? "Saving..." : editItem ? "Save" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════
   ── Delete Confirm Modal ──
   ══════════════════════════ */
function DeleteModal({ open, onClose, title, message, warning, onConfirm, deleting }: {
  open: boolean; onClose: () => void; title: string; message: string; warning?: string; onConfirm: () => void; deleting: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="px-6 py-5">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">{title}</h2>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">{message}</p>
          {warning && <div className="mt-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400">{warning}</div>}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500/30 transition-all disabled:opacity-40">
            {deleting ? <SpinnerIcon className="h-4 w-4" /> : <TrashIcon className="h-3.5 w-3.5" />}{deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════
   ── Classification Panel Column ──
   ═════════════════════════════════ */
function ClassPanel({ title, items, selectedId, onSelect, childCounts, productCounts, onAdd, onEdit, onDelete, emptyLabel, logoMap, useDivisionIcons }: {
  title: string; items: { id: string; name: string; slug: string; description?: string | null }[];
  selectedId: string | null; onSelect: (id: string) => void;
  childCounts: Record<string, number>; productCounts: Record<string, number>;
  onAdd: () => void; onEdit: (item: { id: string; name: string; slug: string; description: string }) => void;
  onDelete: (item: { id: string; name: string; slug: string }) => void; emptyLabel: string;
  logoMap?: Record<string, string>; useDivisionIcons?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim() ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[var(--text-dim)] tabular-nums">{items.length}</span>
          <button onClick={onAdd} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><PlusIcon className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {items.length > 5 && (
        <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
          <div className="relative"><SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full h-7 pl-7 pr-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-subtle)]" />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? <div className="px-4 py-8 text-center text-[11px] text-[var(--text-dim)]">{emptyLabel}</div> : filtered.map(item => {
          const isActive = selectedId === item.id;
          const cc = childCounts[item.id] || 0;
          const pc = productCounts[item.slug] || 0;
          return (
            <div key={item.id} onClick={() => onSelect(item.id)} className={`group flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-[var(--border-subtle)] transition-all ${isActive ? "bg-[var(--bg-surface-hover)] border-l-2 border-l-blue-500" : "hover:bg-[var(--bg-surface)] border-l-2 border-l-transparent"}`}>
              <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${isActive ? "bg-blue-500/20 text-blue-400" : "bg-[var(--bg-surface)] text-[var(--text-dim)]"}`}>
                      {(() => {
                        if (useDivisionIcons) {
                          const DivIcon = getDivisionIcon(item.slug);
                          if (DivIcon) return <DivIcon className="h-4.5 w-4.5" size={18} />;
                        }
                        if (logoMap?.[item.slug]) return <img src={logoMap[item.slug]} alt="" className="w-5 h-5 object-contain" />;
                        return <span className="text-[12px] font-bold">{item.name.charAt(0).toUpperCase()}</span>;
                      })()}
                    </div>
              <div className="flex-1 min-w-0"><p className={`text-[13px] font-medium truncate ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">{cc > 0 && <span className="text-[10px] text-[var(--text-dim)]">{cc} sub</span>}{pc > 0 && <span className="text-[10px] text-[var(--text-dim)]">{pc} prod</span>}{!cc && !pc && <span className="text-[10px] text-[var(--text-dim)] font-mono">{item.slug}</span>}</div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit({ id: item.id, name: item.name, slug: item.slug, description: item.description || "" }); }} className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><PencilIcon className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete({ id: item.id, name: item.name, slug: item.slug }); }} className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors"><TrashIcon className="h-3 w-3" /></button>
              </div>
              {cc > 0 && isActive && <AngleRightIcon className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═════════════════════
   ── MAIN PAGE ──
   ═════════════════════ */
export default function ProductControlPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("classifications");
  const [loading, setLoading] = useState(true);

  // Attribute config + usage
  /* NOTE: there is no attribute-config state any more. With the six value
     lists retired, this page neither READS nor WRITES
     media/config/product-attributes.json — which removes the second writer on
     a whole-file, lock-free document. The Visual Library is now its only
     editor, so two people can no longer overwrite each other's work there. */
  const [usage, setUsage] = useState<AttributeUsage>({ tags: {}, plug_types: {}, colors: {}, voltage: {}, watt: {}, levels: {}, brands: {} });

  // Brand data
  const [brandLogos, setBrandLogos] = useState<Record<string, string>>({});
  // Taxonomy logos
  const [divLogos, setDivLogos] = useState<Record<string, string>>({});
  const [catLogos, setCatLogos] = useState<Record<string, string>>({});
  const [subLogos, setSubLogos] = useState<Record<string, string>>({});

  // Classification data
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [subcategories, setSubcategories] = useState<SubcategoryRow[]>([]);
  const [catCounts, setCatCounts] = useState<Record<string, number>>({});
  const [subCounts, setSubCounts] = useState<Record<string, number>>({});
  const [prodCounts, setProdCounts] = useState<{ byDivision: Record<string, number>; byCategory: Record<string, number>; bySubcategory: Record<string, number> }>({ byDivision: {}, byCategory: {}, bySubcategory: {} });
  const [selectedDiv, setSelectedDiv] = useState<string | null>(null);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);

  // Modals
  const [attrModal, setAttrModal] = useState<{ open: boolean; editValue: string | null; editImage?: string | null }>({ open: false, editValue: null });
  const [classModal, setClassModal] = useState<{ open: boolean; type: "division" | "category" | "subcategory"; editItem: { id: string; name: string; slug: string; description: string } | null }>({ open: false, type: "division", editItem: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; warning?: string; onConfirm: () => Promise<void> }>({ open: false, title: "", message: "", onConfirm: async () => {} });
  const [deleting, setDeleting] = useState(false);

  // ── Load ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [divs, cats, subs, cc, sc, pc, usg, logos, dLogos, cLogos, sLogos] = await Promise.all([
      fetchDivisions(), fetchCategories(), fetchSubcategories(),
      fetchCategoryCounts(), fetchSubcategoryCounts(), fetchProductCountsByClassification(),
      fetchAttributeUsage(), fetchBrandLogos(),
      fetchDivisionLogos(), fetchCategoryLogos(), fetchSubcategoryLogos(),
    ]);
    setDivisions(divs); setCategories(cats); setSubcategories(subs);
    setCatCounts(cc); setSubCounts(sc); setProdCounts(pc);
    setBrandLogos(logos); setDivLogos(dLogos); setCatLogos(cLogos); setSubLogos(sLogos);
    /* ⚠️ THIS USED TO WRITE THE CONFIG BACK ON EVERY LOAD when the merged view
       differed from what was read — so merely OPENING this page could rewrite
       media/config/product-attributes.json. That file is written WHOLE, with
       no version and no lock, and the Visual Library writes the same file:
       two people with a page open, and the later write silently discards the
       earlier one. A read must never be a write.

       The whole read is gone now along with the six lists it fed. */
    setUsage(usg);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Derived ──
  const selectedDivision = useMemo(() => divisions.find(d => d.id === selectedDiv), [divisions, selectedDiv]);
  const filteredCategories = useMemo(() => selectedDiv ? categories.filter(c => c.division_id === selectedDiv) : [], [categories, selectedDiv]);
  const selectedCategory = useMemo(() => categories.find(c => c.id === selectedCat), [categories, selectedCat]);
  const filteredSubcategories = useMemo(() => selectedCat ? subcategories.filter(s => s.category_id === selectedCat) : [], [subcategories, selectedCat]);

  // Brands list from usage counts + logos
  const brandsList = useMemo(() => {
    return Object.keys(usage.brands).sort().map(name => {
      const slug = toSlug(name);
      return { name, slug, logoUrl: brandLogos[slug] || null, productCount: usage.brands[name] || 0 };
    });
  }, [usage.brands, brandLogos]);

  // ── Classification CRUD ──
  const handleClassSave = async (data: { name: string; slug: string; description: string }, id?: string) => {
    if (classModal.type === "division") {
      if (id) return await updateDivision(id, { name: data.name, slug: data.slug, tagline: data.description || null, description: data.description || null });
      const result = await createDivision({ name: data.name, slug: data.slug, tagline: data.description || null, description: data.description || null, order: divisions.length + 1 });
      return !!result;
    }
    if (classModal.type === "category") {
      if (!selectedDiv) return false;
      if (id) return await updateCategory(id, { name: data.name, slug: data.slug, description: data.description || null });
      const result = await createCategory({ name: data.name, slug: data.slug, description: data.description || null, division_id: selectedDiv, order: filteredCategories.length + 1 });
      return !!result;
    }
    if (classModal.type === "subcategory") {
      if (!selectedCat) return false;
      if (id) return await updateSubcategory(id, { name: data.name, slug: data.slug, description: data.description || null });
      const result = await createSubcategory({ name: data.name, slug: data.slug, description: data.description || null, category_id: selectedCat, order: filteredSubcategories.length + 1 });
      return !!result;
    }
    return false;
  };

  const handleClassDelete = async (type: "division" | "category" | "subcategory", id: string) => {
    if (type === "division") { await deleteDivision(id); if (selectedDiv === id) { setSelectedDiv(null); setSelectedCat(null); } }
    else if (type === "category") { await deleteCategory(id); if (selectedCat === id) setSelectedCat(null); }
    else await deleteSubcategory(id);
    await loadAll();
  };

  /* ── Brand CRUD ──────────────────────────────────────────────────────────
     Brands are the only value list this page still edits. The six attribute
     lists it used to own (Level · Tags · Plug Types · Colors · Watt · Voltage)
     were retired on 2026-08-25 — see the note above TABS. The generic
     attribute branches went with them rather than being left as reachable
     code for tabs that no longer exist. */
  const handleBrandSave = async (oldValue: string | null, newValue: string, imageFile?: File | null, removeImage?: boolean) => {
    const slug = toSlug(newValue);
    if (imageFile) await uploadBrandLogo(slug, imageFile);
    else if (removeImage && oldValue) await deleteBrandLogo(toSlug(oldValue));
    /* A brand has no row of its own — it exists because a product carries the
       name — so renaming means rewriting it on every product that has it. */
    if (oldValue && oldValue !== newValue) await renameAttributeInProducts("brands", oldValue, newValue);
    setUsage(await fetchAttributeUsage());
    setBrandLogos(await fetchBrandLogos());
  };

  const handleBrandDelete = async (value: string) => {
    await deleteAttributeFromProducts("brands", value);
    await deleteBrandLogo(toSlug(value));
    setUsage(await fetchAttributeUsage());
    setBrandLogos(await fetchBrandLogos());
  };

  // ── Tab counts ──
  const tabCounts: Record<string, number> = {
    classifications: divisions.length,
    brands: brandsList.length,
  };

  // ── Helper: open delete confirm ──
  const confirmDelete = (value: string, count: number) => {
    setDeleteModal({
      open: true,
      title: `Delete "${value}"`,
      message: "Are you sure you want to delete this?",
      warning: count > 0 ? `Used by ${count} product${count !== 1 ? "s" : ""}. It will be removed.` : undefined,
      onConfirm: async () => { setDeleting(true); await handleBrandDelete(value); setDeleting(false); setDeleteModal(m => ({ ...m, open: false })); },
    });
  };

  return (
    /* kx-pd: the Control Panel is part of the Product Data family — same
       Aurora scope (variable remap + well fields). Ground canvas included
       via CSS-less mount below. */
    <div className="kx-pd min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <ControlPanelGround />
      <div className="relative z-[1] max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/products" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"><ArrowLeftIcon className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2"><SettingsIcon2 className="h-5 w-5 text-[var(--text-dim)]" /><h1 className="text-xl md:text-[26px] font-bold tracking-tight">Product Control Panel</h1></div>
        </div>
        <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mb-6 md:mb-8 ml-11">Divisions, categories and subcategories, and the brands products carry</p>

        {/* Tab Bar */}
        <div className="flex items-center gap-1.5 mb-6">
          <TabStrip
            className="flex-1 min-w-0"
            items={TABS.map(tab => {
              const Icon = tab.icon;
              return {
                key: tab.id,
                label: <span className="hidden sm:inline">{tab.label}</span>,
                icon: <Icon className="h-3.5 w-3.5" />,
                active: activeTab === tab.id,
                onClick: () => setActiveTab(tab.id),
                badge: tabCounts[tab.id] || 0,
              };
            })}
          />
          <button onClick={loadAll} disabled={loading} className="h-10 w-10 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-focus)] transition-all flex items-center justify-center ml-auto"><RefreshIcon className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" /></div>
        ) : (
          <div key={activeTab} className="kx-tab-in min-h-[500px]">

            {/* ── CLASSIFICATIONS ── */}
            {activeTab === "classifications" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                  <ClassPanel title="Divisions" items={divisions.map(d => ({ id: d.id, name: d.name, slug: d.slug, description: d.tagline || d.description }))} selectedId={selectedDiv} onSelect={(id) => { setSelectedDiv(id); setSelectedCat(null); }} childCounts={catCounts} productCounts={prodCounts.byDivision}
                    logoMap={divLogos} useDivisionIcons
                    onAdd={() => setClassModal({ open: true, type: "division", editItem: null })}
                    onEdit={(item) => setClassModal({ open: true, type: "division", editItem: item })}
                    onDelete={(item) => { const cc = catCounts[item.id] || 0; setDeleteModal({ open: true, title: `Delete "${item.name}"`, message: "Delete this division?", warning: cc > 0 ? `Has ${cc} categories. Delete those first.` : undefined, onConfirm: async () => { setDeleting(true); await handleClassDelete("division", item.id); setDeleting(false); setDeleteModal(m => ({ ...m, open: false })); } }); }}
                    emptyLabel="No divisions" />
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                  {selectedDiv ? <ClassPanel title={`Categories`} items={filteredCategories.map(c => ({ id: c.id, name: c.name, slug: c.slug, description: c.description }))} selectedId={selectedCat} onSelect={(id) => setSelectedCat(id)} childCounts={subCounts} productCounts={prodCounts.byCategory}
                    logoMap={catLogos}
                    onAdd={() => setClassModal({ open: true, type: "category", editItem: null })}
                    onEdit={(item) => setClassModal({ open: true, type: "category", editItem: item })}
                    onDelete={(item) => { const sc = subCounts[item.id] || 0; setDeleteModal({ open: true, title: `Delete "${item.name}"`, message: "Delete this category?", warning: sc > 0 ? `Has ${sc} subcategories.` : undefined, onConfirm: async () => { setDeleting(true); await handleClassDelete("category", item.id); setDeleting(false); setDeleteModal(m => ({ ...m, open: false })); } }); }}
                    emptyLabel="No categories" />
                  : <div className="flex flex-col items-center justify-center py-16 text-center px-6"><div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3"><LayersIcon className="h-5 w-5 text-[var(--text-dim)]" /></div><p className="text-[12px] text-[var(--text-dim)]">Select a division</p></div>}
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                  {selectedCat ? <ClassPanel title={`Subcategories`} items={filteredSubcategories.map(s => ({ id: s.id, name: s.name, slug: s.slug, description: s.description }))} selectedId={null} onSelect={() => {}} childCounts={{}} productCounts={prodCounts.bySubcategory}
                    logoMap={subLogos}
                    onAdd={() => setClassModal({ open: true, type: "subcategory", editItem: null })}
                    onEdit={(item) => setClassModal({ open: true, type: "subcategory", editItem: item })}
                    onDelete={(item) => { setDeleteModal({ open: true, title: `Delete "${item.name}"`, message: "Delete this subcategory?", onConfirm: async () => { setDeleting(true); await handleClassDelete("subcategory", item.id); setDeleting(false); setDeleteModal(m => ({ ...m, open: false })); } }); }}
                    emptyLabel="No subcategories" />
                  : <div className="flex flex-col items-center justify-center py-16 text-center px-6"><div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3"><FolderTreeIcon className="h-5 w-5 text-[var(--text-dim)]" /></div><p className="text-[12px] text-[var(--text-dim)]">{selectedDiv ? "Select a category" : "Select a division first"}</p></div>}
                </div>
              </div>
            )}

            {/* ── BRANDS ── */}
            {activeTab === "brands" && (
              <BrandsTab brands={brandsList} onAdd={() => setAttrModal({ open: true, editValue: null, editImage: null })}
                onEdit={(b) => setAttrModal({ open: true, editValue: b.name, editImage: b.logoUrl })}
                onDelete={(b) => confirmDelete(b.name, b.productCount)} />
            )}

            {/* ── PLUG TYPES ── */}

          </div>
        )}

        {/* Bottom nav */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/divisions" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Divisions</Link>
          <Link href="/categories" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Categories</Link>
          <Link href="/subcategories" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Subcategories</Link>
          <Link href="/brands" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Brands</Link>
          <Link href="/products" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Products</Link>
        </div>
      </div>

      {/* Modals */}
      <BrandModal open={attrModal.open} onClose={() => setAttrModal(m => ({ ...m, open: false }))}
        editValue={attrModal.editValue} editImage={attrModal.editImage}
        existingValues={brandsList.map(b => b.name)}
        onSave={handleBrandSave} />

      <ClassificationModal open={classModal.open} onClose={() => { setClassModal(m => ({ ...m, open: false })); loadAll(); }} type={classModal.type} editItem={classModal.editItem}
        parentName={classModal.type === "category" ? selectedDivision?.name : classModal.type === "subcategory" ? selectedCategory?.name : undefined}
        onSave={handleClassSave}
        editLogoUrl={classModal.editItem ? (classModal.type === "division" ? divLogos[classModal.editItem.slug] : classModal.type === "category" ? catLogos[classModal.editItem.slug] : classModal.type === "subcategory" ? subLogos[classModal.editItem.slug] : null) : null}
        onUploadLogo={classModal.type === "division" ? uploadDivisionLogo : classModal.type === "category" ? uploadCategoryLogo : classModal.type === "subcategory" ? uploadSubcategoryLogo : undefined}
        onDeleteLogo={classModal.type === "division" ? deleteDivisionLogo : classModal.type === "category" ? deleteCategoryLogo : classModal.type === "subcategory" ? deleteSubcategoryLogo : undefined}
      />

      <DeleteModal open={deleteModal.open} onClose={() => setDeleteModal(m => ({ ...m, open: false }))} title={deleteModal.title} message={deleteModal.message} warning={deleteModal.warning}
        onConfirm={async () => { await deleteModal.onConfirm(); }} deleting={deleting} />
    </div>
  );
}

/* ═══════════════════════════════
   ── Brands Tab ──
   ═══════════════════════════════ */
function BrandsTab({ brands, onAdd, onEdit, onDelete }: {
  brands: { name: string; slug: string; logoUrl: string | null; productCount: number }[];
  onAdd: () => void;
  onEdit: (b: { name: string; slug: string; logoUrl: string | null; productCount: number }) => void;
  onDelete: (b: { name: string; slug: string; logoUrl: string | null; productCount: number }) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim() ? brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase())) : brands;

  return (
    <div>
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{brands.length}</span><span className="text-[11px] text-[var(--text-dim)]">brands</span></div>
        <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><PackageIcon className="h-3 w-3 text-[var(--text-dim)]" /><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{brands.reduce((s, b) => s + b.productCount, 0)}</span><span className="text-[11px] text-[var(--text-dim)]">products</span></div>
      </div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm"><SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands…" className="w-full h-9 pl-9 pr-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 transition-colors" /></div>
        <button onClick={onAdd} className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-1.5 transition-all shadow-lg shrink-0"><PlusIcon className="h-3.5 w-3.5" /> Add brand</button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-subtle)] rounded-xl"><p className="text-[13px] text-[var(--text-dim)]">{search ? "No match." : "No brands yet."}</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map(b => (
            <div key={b.name} className="group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--text-dim)] transition-all">
              <div className="shrink-0 w-12 h-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center overflow-hidden">
                {b.logoUrl ? <img src={b.logoUrl} alt={b.name} className="w-full h-full object-contain p-1.5" /> : <span className="text-[16px] font-bold text-[var(--text-dim)]">{b.name.charAt(0).toUpperCase()}</span>}
              </div>
              <div className="flex-1 min-w-0"><h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{b.name}</h3><p className="text-[10px] text-[var(--text-dim)] mt-0.5 flex items-center gap-1"><PackageIcon className="h-3 w-3" />{b.productCount} product{b.productCount !== 1 ? "s" : ""}</p></div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(b)} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><PencilIcon className="h-3 w-3" /></button>
                <button onClick={() => onDelete(b)} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors"><TrashIcon className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
