"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, Pencil, Trash2, X, Loader2,
  Layers, Award, Tag, Plug, Palette, Zap, Activity,
  Package, ChevronRight, FolderTree, RefreshCw, Settings,
  ImageIcon, Bookmark,
} from "lucide-react";
import {
  fetchDivisions, fetchCategories, fetchSubcategories,
  createDivision, updateDivision, deleteDivision,
  createCategory, updateCategory, deleteCategory,
  createSubcategory, updateSubcategory, deleteSubcategory,
  fetchCategoryCounts, fetchSubcategoryCounts,
  fetchBrandLogos, uploadBrandLogo, deleteBrandLogo,
  fetchDivisionLogos, uploadDivisionLogo, deleteDivisionLogo,
  fetchCategoryLogos, uploadCategoryLogo, deleteCategoryLogo,
} from "@/lib/products-admin";
import {
  fetchAttributeConfig, saveAttributeConfig, fetchAttributeUsage,
  mergeConfigWithUsage, renameAttributeInProducts, deleteAttributeFromProducts,
  fetchProductCountsByClassification, uploadAttributeImage, deleteAttributeImage,
} from "@/lib/product-attributes";
import type { AttributeConfig, AttributeUsage, AttributeItem } from "@/lib/product-attributes";
import type { DivisionRow, CategoryRow, SubcategoryRow } from "@/types/supabase";

/* ── Tabs ── */
const TABS = [
  { id: "classifications", label: "Classifications", icon: FolderTree },
  { id: "brands", label: "Brands", icon: Bookmark },
  { id: "levels", label: "Level", icon: Award },
  { id: "tags", label: "Tags", icon: Tag },
  { id: "plug_types", label: "Plug Types", icon: Plug },
  { id: "colors", label: "Colors", icon: Palette },
  { id: "watt", label: "Watt", icon: Zap },
  { id: "voltage", label: "Voltage", icon: Activity },
] as const;
type TabId = (typeof TABS)[number]["id"];

/* ── Color Map ── */
const COLOR_HEX: Record<string, string> = {
  black: "#111", white: "#FFF", silver: "#C0C0C0", gray: "#888", grey: "#888",
  red: "#EF4444", blue: "#3B82F6", green: "#22C55E", yellow: "#EAB308",
  orange: "#F97316", purple: "#A855F7", pink: "#EC4899", brown: "#92400E",
  gold: "#D4AF37", navy: "#1E3A5F", teal: "#14B8A6", maroon: "#7F1D1D",
  coral: "#FF6B6B", beige: "#F5F5DC", cyan: "#06B6D4", indigo: "#6366F1",
  lime: "#84CC16", olive: "#808000", bronze: "#CD7F32", rose: "#F43F5E",
  charcoal: "#36454F", champagne: "#F7E7CE", burgundy: "#800020", slate: "#64748B",
};
const LEVEL_COLORS: Record<string, string> = { entry: "bg-blue-500", mid: "bg-emerald-500", premium: "bg-amber-500", enterprise: "bg-purple-500" };
function getColorHex(n: string) { return COLOR_HEX[n.toLowerCase().trim()] || null; }
function toSlug(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function countryFlag(code: string): string {
  if (code === "EU") return "\u{1F1EA}\u{1F1FA}";
  return code.toUpperCase().split("").map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join("");
}

/* Plug type defaults imported from product-attributes.ts */

/* ═══════════════════════════════════════════════
   ── Attribute Edit Modal (with image upload) ──
   ═══════════════════════════════════════════════ */
const TAG_COLORS = [
  { name: "Gray", hex: "#6b7280" },
  { name: "Red", hex: "#ef4444" },
  { name: "Orange", hex: "#f97316" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Yellow", hex: "#eab308" },
  { name: "Lime", hex: "#84cc16" },
  { name: "Green", hex: "#22c55e" },
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Cyan", hex: "#06b6d4" },
  { name: "Sky", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Rose", hex: "#f43f5e" },
];

function AttributeModal({
  open, onClose, attrType, editValue, editImage, editColor, existingValues, onSave, showImage,
}: {
  open: boolean;
  onClose: () => void;
  attrType: string;
  editValue: string | null;
  editImage?: string | null;
  editColor?: string | null;
  existingValues: string[];
  onSave: (oldValue: string | null, newValue: string, imageFile?: File | null, removeImage?: boolean, color?: string | null) => Promise<void>;
  showImage?: boolean;
}) {
  const [value, setValue] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [tagColor, setTagColor] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(editValue || "");
      setImageFile(null);
      setImagePreview(editImage || null);
      setRemoveImage(false);
      setTagColor(editColor || null);
      setError("");
    }
  }, [open, editValue, editImage, editColor]);

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
    await onSave(editValue, trimmed, imageFile, removeImage, attrType === "tags" ? tagColor : undefined);
    setSaving(false);
    onClose();
  };

  if (!open) return null;

  const labels: Record<string, { title: string; placeholder: string }> = {
    tags: { title: "Tag", placeholder: "e.g. Industrial, Premium" },
    plug_types: { title: "Plug Type", placeholder: "e.g. Type C, Type A" },
    colors: { title: "Color", placeholder: "e.g. Silver, Matte Black" },
    voltage: { title: "Voltage", placeholder: "e.g. 220V, 110V" },
    watt: { title: "Wattage", placeholder: "e.g. 500W, 1000W" },
    levels: { title: "Level", placeholder: "e.g. Entry, Premium" },
    brands: { title: "Brand", placeholder: "e.g. FANUC, ABB, Koleex" },
  };
  const l = labels[attrType] || { title: "Value", placeholder: "" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">{editValue ? `Edit ${l.title}` : `New ${l.title}`}</h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><X className="h-4 w-4" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">{error}</div>}

          <div className="flex gap-4 items-start">
            {/* Image upload area */}
            {showImage && (
              <div className="shrink-0">
                <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5">Image</label>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e.target.files)} />
                {imagePreview && !removeImage ? (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-bright)]">
                    <img src={imagePreview} alt="" className="w-full h-full object-contain p-1.5" />
                    <button type="button" onClick={() => { setImageFile(null); setImagePreview(null); setRemoveImage(true); if (fileRef.current) fileRef.current.value = ""; }}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-[var(--bg-surface-active)] flex items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-surface-bright)] transition-colors"><X className="h-2.5 w-2.5" /></button>
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
          {attrType === "tags" && (
            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-2">Tag Color</label>
              <div className="flex flex-wrap gap-1.5">
                {TAG_COLORS.map(c => (
                  <button key={c.hex} type="button" onClick={() => setTagColor(tagColor === c.hex ? null : c.hex)}
                    className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${tagColor === c.hex ? "border-white shadow-lg scale-110" : "border-transparent"}`}
                    style={{ background: c.hex }}
                    title={c.name}
                  />
                ))}
                {tagColor && (
                  <button type="button" onClick={() => setTagColor(null)}
                    className="h-7 px-2 rounded-lg border border-[var(--border-subtle)] text-[10px] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1">
                    <X className="h-2.5 w-2.5" /> Clear
                  </button>
                )}
              </div>
              {tagColor && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-4 h-4 rounded" style={{ background: tagColor }} />
                  <span className="text-[11px] text-[var(--text-dim)]">{TAG_COLORS.find(c => c.hex === tagColor)?.name || tagColor}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !value.trim()} className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
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
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><X className="h-4 w-4" /></button>
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
                    <Plus className="h-2.5 w-2.5" />{logoPreview && !removeLogo ? "Replace" : "Upload"}
                  </button>
                  {logoPreview && !removeLogo && (
                    <button type="button" onClick={() => { setLogoFile(null); setLogoPreview(null); setRemoveLogo(true); }} className="h-7 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] font-medium text-red-400/70 hover:text-red-400 flex items-center gap-1 transition-colors">
                      <Trash2 className="h-2.5 w-2.5" />Remove
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
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? "Saving..." : editItem ? "Save" : "Create"}
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
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">Cancel</button>
          <button onClick={onConfirm} disabled={deleting} className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500/30 transition-all disabled:opacity-40">
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}{deleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═════════════════════════════════
   ── Classification Panel Column ──
   ═════════════════════════════════ */
function ClassPanel({ title, items, selectedId, onSelect, childCounts, productCounts, onAdd, onEdit, onDelete, emptyLabel, logoMap }: {
  title: string; items: { id: string; name: string; slug: string; description?: string | null }[];
  selectedId: string | null; onSelect: (id: string) => void;
  childCounts: Record<string, number>; productCounts: Record<string, number>;
  onAdd: () => void; onEdit: (item: { id: string; name: string; slug: string; description: string }) => void;
  onDelete: (item: { id: string; name: string; slug: string }) => void; emptyLabel: string;
  logoMap?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim() ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div className="flex flex-col h-full min-h-[300px]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-[12px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">{title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-[var(--text-dim)] tabular-nums">{items.length}</span>
          <button onClick={onAdd} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {items.length > 5 && (
        <div className="px-3 py-2 border-b border-[var(--border-subtle)]">
          <div className="relative"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="w-full h-7 pl-7 pr-3 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-subtle)]" />
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
                      {logoMap?.[item.slug] ? (
                        <img src={logoMap[item.slug]} alt="" className="w-5 h-5 object-contain" />
                      ) : (
                        <span className="text-[12px] font-bold">{item.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
              <div className="flex-1 min-w-0"><p className={`text-[13px] font-medium truncate ${isActive ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>{item.name}</p>
                <div className="flex items-center gap-2 mt-0.5">{cc > 0 && <span className="text-[10px] text-[var(--text-dim)]">{cc} sub</span>}{pc > 0 && <span className="text-[10px] text-[var(--text-dim)]">{pc} prod</span>}{!cc && !pc && <span className="text-[10px] text-[var(--text-dim)] font-mono">{item.slug}</span>}</div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); onEdit({ id: item.id, name: item.name, slug: item.slug, description: item.description || "" }); }} className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><Pencil className="h-3 w-3" /></button>
                <button onClick={(e) => { e.stopPropagation(); onDelete({ id: item.id, name: item.name, slug: item.slug }); }} className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors"><Trash2 className="h-3 w-3" /></button>
              </div>
              {cc > 0 && isActive && <ChevronRight className="h-3.5 w-3.5 text-blue-400/60 shrink-0" />}
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
export default function ProductSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("classifications");
  const [loading, setLoading] = useState(true);

  // Attribute config + usage
  const [config, setConfig] = useState<AttributeConfig>({ tags: [], tag_colors: {}, plug_types: [], colors: [], voltage: [], watt: [], levels: [] });
  const [usage, setUsage] = useState<AttributeUsage>({ tags: {}, plug_types: {}, colors: {}, voltage: {}, watt: {}, levels: {}, brands: {} });

  // Brand data
  const [brandLogos, setBrandLogos] = useState<Record<string, string>>({});
  // Taxonomy logos
  const [divLogos, setDivLogos] = useState<Record<string, string>>({});
  const [catLogos, setCatLogos] = useState<Record<string, string>>({});

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
  const [attrModal, setAttrModal] = useState<{ open: boolean; type: string; editValue: string | null; editImage?: string | null; editColor?: string | null }>({ open: false, type: "tags", editValue: null });
  const [classModal, setClassModal] = useState<{ open: boolean; type: "division" | "category" | "subcategory"; editItem: { id: string; name: string; slug: string; description: string } | null }>({ open: false, type: "division", editItem: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; title: string; message: string; warning?: string; onConfirm: () => Promise<void> }>({ open: false, title: "", message: "", onConfirm: async () => {} });
  const [deleting, setDeleting] = useState(false);

  // ── Load ──
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [divs, cats, subs, cc, sc, pc, cfg, usg, logos, dLogos, cLogos] = await Promise.all([
      fetchDivisions(), fetchCategories(), fetchSubcategories(),
      fetchCategoryCounts(), fetchSubcategoryCounts(), fetchProductCountsByClassification(),
      fetchAttributeConfig(), fetchAttributeUsage(), fetchBrandLogos(),
      fetchDivisionLogos(), fetchCategoryLogos(),
    ]);
    setDivisions(divs); setCategories(cats); setSubcategories(subs);
    setCatCounts(cc); setSubCounts(sc); setProdCounts(pc);
    setBrandLogos(logos); setDivLogos(dLogos); setCatLogos(cLogos);
    const merged = mergeConfigWithUsage(cfg, usg);
    setConfig(merged); setUsage(usg);
    if (JSON.stringify(merged) !== JSON.stringify(cfg)) await saveAttributeConfig(merged);
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

  // ── Attribute CRUD (simple string types) ──
  const handleSimpleAttrSave = async (type: string, oldValue: string | null, newValue: string, imageFile?: File | null, removeImage?: boolean, color?: string | null) => {
    const nc = { ...config };

    if (type === "plug_types") {
      const arr = [...nc.plug_types];
      const slug = toSlug(newValue);
      let imageUrl: string | null = null;

      if (imageFile) {
        imageUrl = await uploadAttributeImage("plug_types", slug, imageFile);
      } else if (removeImage && oldValue) {
        await deleteAttributeImage("plug_types", toSlug(oldValue));
      }

      if (oldValue) {
        const idx = arr.findIndex(a => a.name === oldValue);
        if (idx >= 0) {
          arr[idx] = { name: newValue, image: imageFile ? imageUrl : (removeImage ? null : arr[idx].image) };
          // Rename old image if slug changed
          if (toSlug(oldValue) !== slug && !imageFile && arr[idx].image) {
            // re-upload would be needed, keep existing for now
          }
        }
        nc.plug_types = arr;
        if (oldValue !== newValue) await renameAttributeInProducts("plug_types", oldValue, newValue);
      } else {
        arr.push({ name: newValue, image: imageUrl });
        nc.plug_types = arr;
      }
    } else if (type === "brands") {
      // Brand CRUD
      const slug = toSlug(newValue);
      if (imageFile) {
        await uploadBrandLogo(slug, imageFile);
      } else if (removeImage && oldValue) {
        await deleteBrandLogo(toSlug(oldValue));
      }
      if (oldValue && oldValue !== newValue) {
        await renameAttributeInProducts("brands", oldValue, newValue);
      }
      // If creating new brand, just update logos — brand exists when assigned to a product
    } else {
      // Simple string arrays
      const key = type as keyof AttributeConfig;
      if (key in nc && Array.isArray(nc[key])) {
        const arr = [...(nc[key] as string[])];
        if (oldValue) {
          const idx = arr.indexOf(oldValue);
          if (idx >= 0) arr[idx] = newValue;
          if (oldValue !== newValue) await renameAttributeInProducts(type, oldValue, newValue);
        } else {
          arr.push(newValue);
        }
        (nc as Record<string, unknown>)[key] = arr;
      }
    }

    // Handle tag color
    if (type === "tags" && color !== undefined) {
      const tc = { ...nc.tag_colors };
      if (oldValue && oldValue !== newValue) delete tc[oldValue];
      if (color) tc[newValue] = color;
      else if (color === null) delete tc[newValue];
      nc.tag_colors = tc;
    }

    setConfig(nc);
    await saveAttributeConfig(nc);
    const usg = await fetchAttributeUsage();
    setUsage(usg);
    if (type === "brands") {
      const logos = await fetchBrandLogos();
      setBrandLogos(logos);
    }
  };

  const handleAttrDelete = async (type: string, value: string) => {
    if (type === "plug_types") {
      const nc = { ...config, plug_types: config.plug_types.filter(p => p.name !== value) };
      setConfig(nc);
      await deleteAttributeFromProducts("plug_types", value);
      await deleteAttributeImage("plug_types", toSlug(value));
      await saveAttributeConfig(nc);
    } else if (type === "brands") {
      await deleteAttributeFromProducts("brands", value);
      await deleteBrandLogo(toSlug(value));
    } else {
      const key = type as keyof AttributeConfig;
      const nc = { ...config };
      if (key in nc && Array.isArray(nc[key])) {
        (nc as Record<string, unknown>)[key] = (nc[key] as string[]).filter(v => v !== value);
      }
      if (type === "tags") {
        const tc = { ...nc.tag_colors };
        delete tc[value];
        nc.tag_colors = tc;
      }
      setConfig(nc);
      await deleteAttributeFromProducts(type, value);
      await saveAttributeConfig(nc);
    }
    const usg = await fetchAttributeUsage();
    setUsage(usg);
    if (type === "brands") {
      const logos = await fetchBrandLogos();
      setBrandLogos(logos);
    }
  };

  // ── Tab counts ──
  const tabCounts: Record<string, number> = {
    classifications: divisions.length,
    brands: brandsList.length,
    levels: config.levels.length,
    tags: config.tags.length,
    plug_types: config.plug_types.length,
    colors: config.colors.length,
    watt: config.watt.length,
    voltage: config.voltage.length,
  };

  // ── Helper: open delete confirm ──
  const confirmDelete = (type: string, value: string, count: number) => {
    setDeleteModal({
      open: true,
      title: `Delete "${value}"`,
      message: "Are you sure you want to delete this?",
      warning: count > 0 ? `Used by ${count} product${count !== 1 ? "s" : ""}. It will be removed.` : undefined,
      onConfirm: async () => { setDeleting(true); await handleAttrDelete(type, value); setDeleting(false); setDeleteModal(m => ({ ...m, open: false })); },
    });
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/products" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="flex items-center gap-2"><Settings className="h-5 w-5 text-[var(--text-dim)]" /><h1 className="text-xl md:text-[26px] font-bold tracking-tight">Product Control Panel</h1></div>
        </div>
        <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mb-6 md:mb-8 ml-11">Manage classifications, brands, attributes, and options</p>

        {/* Tab Bar */}
        <div className="flex items-center flex-wrap gap-1.5 mb-6">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12px] font-semibold transition-all border ${isActive ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)] border-[var(--bg-inverted)] shadow-lg shadow-[var(--border-subtle)]" : "bg-[var(--bg-surface)] text-[var(--text-dim)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-secondary)]"}`}>
                <Icon className="h-3.5 w-3.5" /><span className="hidden sm:inline">{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold tabular-nums ${isActive ? "bg-[var(--bg-surface)] text-[var(--text-dim)]" : "bg-[var(--bg-surface-hover)] text-[var(--text-dim)]"}`}>{tabCounts[tab.id] || 0}</span>
              </button>
            );
          })}
          <button onClick={loadAll} disabled={loading} className="h-9 w-9 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors ml-auto"><RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /></button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="h-5 w-5 animate-spin text-[var(--text-dim)]" /></div>
        ) : (
          <div className="min-h-[500px]">

            {/* ── CLASSIFICATIONS ── */}
            {activeTab === "classifications" && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                  <ClassPanel title="Divisions" items={divisions.map(d => ({ id: d.id, name: d.name, slug: d.slug, description: d.tagline || d.description }))} selectedId={selectedDiv} onSelect={(id) => { setSelectedDiv(id); setSelectedCat(null); }} childCounts={catCounts} productCounts={prodCounts.byDivision}
                    logoMap={divLogos}
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
                  : <div className="flex flex-col items-center justify-center py-16 text-center px-6"><div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3"><Layers className="h-5 w-5 text-[var(--text-dim)]" /></div><p className="text-[12px] text-[var(--text-dim)]">Select a division</p></div>}
                </div>
                <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                  {selectedCat ? <ClassPanel title={`Subcategories`} items={filteredSubcategories.map(s => ({ id: s.id, name: s.name, slug: s.slug, description: s.description }))} selectedId={null} onSelect={() => {}} childCounts={{}} productCounts={prodCounts.bySubcategory}
                    onAdd={() => setClassModal({ open: true, type: "subcategory", editItem: null })}
                    onEdit={(item) => setClassModal({ open: true, type: "subcategory", editItem: item })}
                    onDelete={(item) => { setDeleteModal({ open: true, title: `Delete "${item.name}"`, message: "Delete this subcategory?", onConfirm: async () => { setDeleting(true); await handleClassDelete("subcategory", item.id); setDeleting(false); setDeleteModal(m => ({ ...m, open: false })); } }); }}
                    emptyLabel="No subcategories" />
                  : <div className="flex flex-col items-center justify-center py-16 text-center px-6"><div className="w-12 h-12 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-3"><FolderTree className="h-5 w-5 text-[var(--text-dim)]" /></div><p className="text-[12px] text-[var(--text-dim)]">{selectedDiv ? "Select a category" : "Select a division first"}</p></div>}
                </div>
              </div>
            )}

            {/* ── BRANDS ── */}
            {activeTab === "brands" && (
              <BrandsTab brands={brandsList} brandLogos={brandLogos} onAdd={() => setAttrModal({ open: true, type: "brands", editValue: null, editImage: null })}
                onEdit={(b) => setAttrModal({ open: true, type: "brands", editValue: b.name, editImage: b.logoUrl })}
                onDelete={(b) => confirmDelete("brands", b.name, b.productCount)} />
            )}

            {/* ── PLUG TYPES ── */}
            {activeTab === "plug_types" && (
              <PlugTypesTab items={config.plug_types} counts={usage.plug_types}
                onAdd={() => setAttrModal({ open: true, type: "plug_types", editValue: null, editImage: null })}
                onEdit={(p) => setAttrModal({ open: true, type: "plug_types", editValue: p.name, editImage: p.image })}
                onDelete={(p) => confirmDelete("plug_types", p.name, usage.plug_types[p.name] || 0)} />
            )}

            {/* ── SIMPLE ATTRIBUTE TABS ── */}
            {activeTab === "levels" && <SimpleTab type="levels" items={config.levels} counts={usage.levels} onAdd={() => setAttrModal({ open: true, type: "levels", editValue: null })} onEdit={(v) => setAttrModal({ open: true, type: "levels", editValue: v })} onDelete={(v) => confirmDelete("levels", v, usage.levels[v] || 0)} />}
            {activeTab === "tags" && <SimpleTab type="tags" items={config.tags} counts={usage.tags} tagColors={config.tag_colors} onAdd={() => setAttrModal({ open: true, type: "tags", editValue: null })} onEdit={(v) => setAttrModal({ open: true, type: "tags", editValue: v, editColor: config.tag_colors[v] || null })} onDelete={(v) => confirmDelete("tags", v, usage.tags[v] || 0)} />}
            {activeTab === "colors" && <SimpleTab type="colors" items={config.colors} counts={usage.colors} onAdd={() => setAttrModal({ open: true, type: "colors", editValue: null })} onEdit={(v) => setAttrModal({ open: true, type: "colors", editValue: v })} onDelete={(v) => confirmDelete("colors", v, usage.colors[v] || 0)} />}
            {activeTab === "watt" && <VisualValueTab type="watt" items={config.watt} counts={usage.watt} onAdd={() => setAttrModal({ open: true, type: "watt", editValue: null })} onEdit={(v) => setAttrModal({ open: true, type: "watt", editValue: v })} onDelete={(v) => confirmDelete("watt", v, usage.watt[v] || 0)} />}
            {activeTab === "voltage" && <VisualValueTab type="voltage" items={config.voltage} counts={usage.voltage} onAdd={() => setAttrModal({ open: true, type: "voltage", editValue: null })} onEdit={(v) => setAttrModal({ open: true, type: "voltage", editValue: v })} onDelete={(v) => confirmDelete("voltage", v, usage.voltage[v] || 0)} />}
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
      <AttributeModal open={attrModal.open} onClose={() => setAttrModal(m => ({ ...m, open: false }))} attrType={attrModal.type} editValue={attrModal.editValue} editImage={attrModal.editImage} editColor={attrModal.editColor} existingValues={
        attrModal.type === "plug_types" ? config.plug_types.map(p => p.name)
        : attrModal.type === "brands" ? brandsList.map(b => b.name)
        : (config[attrModal.type as keyof AttributeConfig] as string[]) || []
      } onSave={(oldV, newV, imgFile, rmImg, color) => handleSimpleAttrSave(attrModal.type, oldV, newV, imgFile, rmImg, color)}
        showImage={["plug_types", "brands"].includes(attrModal.type)} />

      <ClassificationModal open={classModal.open} onClose={() => { setClassModal(m => ({ ...m, open: false })); loadAll(); }} type={classModal.type} editItem={classModal.editItem}
        parentName={classModal.type === "category" ? selectedDivision?.name : classModal.type === "subcategory" ? selectedCategory?.name : undefined}
        onSave={handleClassSave}
        editLogoUrl={classModal.editItem ? (classModal.type === "division" ? divLogos[classModal.editItem.slug] : classModal.type === "category" ? catLogos[classModal.editItem.slug] : null) : null}
        onUploadLogo={classModal.type === "division" ? uploadDivisionLogo : classModal.type === "category" ? uploadCategoryLogo : undefined}
        onDeleteLogo={classModal.type === "division" ? deleteDivisionLogo : classModal.type === "category" ? deleteCategoryLogo : undefined}
      />

      <DeleteModal open={deleteModal.open} onClose={() => setDeleteModal(m => ({ ...m, open: false }))} title={deleteModal.title} message={deleteModal.message} warning={deleteModal.warning}
        onConfirm={async () => { await deleteModal.onConfirm(); }} deleting={deleting} />
    </div>
  );
}

/* ═══════════════════════════════
   ── Brands Tab ──
   ═══════════════════════════════ */
function BrandsTab({ brands, brandLogos, onAdd, onEdit, onDelete }: {
  brands: { name: string; slug: string; logoUrl: string | null; productCount: number }[];
  brandLogos: Record<string, string>;
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
        <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><Package className="h-3 w-3 text-[var(--text-dim)]" /><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{brands.reduce((s, b) => s + b.productCount, 0)}</span><span className="text-[11px] text-[var(--text-dim)]">products</span></div>
      </div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands..." className="w-full h-9 pl-9 pr-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 transition-colors" /></div>
        <button onClick={onAdd} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors shrink-0"><Plus className="h-3.5 w-3.5" /> Add brand</button>
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
              <div className="flex-1 min-w-0"><h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{b.name}</h3><p className="text-[10px] text-[var(--text-dim)] mt-0.5 flex items-center gap-1"><Package className="h-3 w-3" />{b.productCount} product{b.productCount !== 1 ? "s" : ""}</p></div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => onEdit(b)} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><Pencil className="h-3 w-3" /></button>
                <button onClick={() => onDelete(b)} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors"><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   ── Plug Types Tab (Card Grid) ──
   ═══════════════════════════════ */
function PlugTypesTab({ items, counts, onAdd, onEdit, onDelete }: {
  items: AttributeItem[];
  counts: Record<string, number>;
  onAdd: () => void;
  onEdit: (p: AttributeItem) => void;
  onDelete: (p: AttributeItem) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex gap-3">
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{items.length}</span><span className="text-[11px] text-[var(--text-dim)]">plug types</span></div>
        </div>
        <button onClick={onAdd} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors shrink-0"><Plus className="h-3.5 w-3.5" /> Add plug type</button>
      </div>
      {items.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-subtle)] rounded-xl"><p className="text-[13px] text-[var(--text-dim)]">No plug types yet.</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items.map(item => {
            const count = counts[item.name] || 0;
            return (
              <div key={item.name} className="group relative flex flex-col items-center p-4 pb-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] transition-all">
                {/* Socket illustration */}
                <div className="w-full aspect-square flex items-center justify-center overflow-hidden mb-3">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="plug-icon w-full h-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <Plug className="h-10 w-10 text-[var(--text-dim)]" />
                    </div>
                  )}
                </div>

                {/* Type name */}
                <h3 className="text-[14px] font-bold text-[var(--text-primary)] text-center tracking-tight">{item.name}</h3>

                {/* Description */}
                {item.description && (
                  <p className="text-[9px] text-[var(--text-dim)] text-center mt-0.5 leading-snug line-clamp-2">{item.description}</p>
                )}

                {/* Country flags */}
                {item.countries && item.countries.length > 0 && (
                  <div className="flex items-center justify-center flex-wrap gap-0.5 mt-2">
                    {item.countries.slice(0, 6).map(code => (
                      <span key={code} className="text-[13px] leading-none" title={code}>{countryFlag(code)}</span>
                    ))}
                    {item.countries.length > 6 && <span className="text-[9px] text-[var(--text-dim)] ml-0.5">+{item.countries.length - 6}</span>}
                  </div>
                )}

                {/* Product count */}
                <p className="text-[10px] text-[var(--text-dim)] mt-2 tabular-nums">{count} product{count !== 1 ? "s" : ""}</p>

                {/* Actions on hover */}
                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(item)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--bg-surface-active)] backdrop-blur-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => onDelete(item)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--bg-surface-active)] backdrop-blur-sm text-[var(--text-secondary)] hover:text-red-400 transition-colors"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   ── Visual Value Tab (Watt / Voltage) ──
   Premium card design matching plug-type system:
   - #fafafa white card, clean line-art
   - Voltage → semicircular gauge arc with dot marker
   - Watt → ascending power-level bars
   - HTML text overlay for crisp rendering
   ═══════════════════════════════ */

function VisualValueTab({ type, items, counts, onAdd, onEdit, onDelete }: {
  type: "voltage" | "watt";
  items: string[];
  counts: Record<string, number>;
  onAdd: () => void;
  onEdit: (v: string) => void;
  onDelete: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim() ? items.filter(i => i.toLowerCase().includes(search.toLowerCase())) : items;
  const label = type === "voltage" ? "voltage" : "wattage";
  const totalUsages = items.reduce((s, i) => s + (counts[i] || 0), 0);
  const parseNum = (s: string) => { const m = s.match(/[\d,.]+/); return m ? parseFloat(m[0].replace(",", "")) : 0; };

  /* ── Voltage: semicircular gauge arc ── */
  const renderVoltageVisual = (num: number) => {
    const maxV = 480;
    const pct = Math.min(num / maxV, 1);
    const toRad = (d: number) => (d * Math.PI) / 180;
    const r = 28, cx = 50, cy = 42;
    const startDeg = 210, sweepDeg = 120;
    const currentDeg = startDeg + pct * sweepDeg;
    const pt = (deg: number) => ({ x: cx + r * Math.cos(toRad(deg)), y: cy + r * Math.sin(toRad(deg)) });
    const s = pt(startDeg), e = pt(startDeg + sweepDeg), c = pt(currentDeg);
    const ticks = [0, 0.25, 0.5, 0.75, 1].map(p => {
      const deg = startDeg + p * sweepDeg;
      const a = toRad(deg);
      return { x1: cx + (r - 2) * Math.cos(a), y1: cy + (r - 2) * Math.sin(a), x2: cx + (r + 4) * Math.cos(a), y2: cy + (r + 4) * Math.sin(a) };
    });
    return (
      <div className="relative w-full aspect-square rounded-xl bg-[#fafafa] overflow-hidden mb-3 shadow-sm border border-black/[0.06]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" fill="none" strokeLinecap="round">
          <path d={`M${s.x} ${s.y} A${r} ${r} 0 0 1 ${e.x} ${e.y}`} stroke="#e5e7eb" strokeWidth="3" />
          {ticks.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#ddd" strokeWidth="1.2" />)}
          {pct > 0 && <path d={`M${s.x} ${s.y} A${r} ${r} 0 0 1 ${c.x} ${c.y}`} stroke="#222" strokeWidth="3" />}
          <circle cx={c.x} cy={c.y} r="4" fill="#222" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: "28%" }}>
          <span className="text-[30px] font-extrabold text-[#222] tracking-tight leading-none tabular-nums">{num}</span>
          <span className="text-[9px] font-semibold text-[#bbb] uppercase tracking-[0.18em] mt-1">volts</span>
        </div>
      </div>
    );
  };

  /* ── Watt: ascending power bars ── */
  const renderWattVisual = (num: number) => {
    const maxW = 5000;
    const pct = Math.min(num / maxW, 1);
    const totalBars = 5;
    const filled = Math.max(1, Math.ceil(pct * totalBars));
    const barData = [
      { x: 26, h: 10 }, { x: 36, h: 17 }, { x: 46, h: 24 }, { x: 56, h: 31 }, { x: 66, h: 38 },
    ];
    const baseY = 54;
    return (
      <div className="relative w-full aspect-square rounded-xl bg-[#fafafa] overflow-hidden mb-3 shadow-sm border border-black/[0.06]">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" fill="none" strokeLinecap="round">
          {barData.map((bar, i) => (
            <rect key={i} x={bar.x} y={baseY - bar.h} width="8" height={bar.h} rx="2" fill={i < filled ? "#222" : "#e5e7eb"} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: "36%" }}>
          <span className="text-[30px] font-extrabold text-[#222] tracking-tight leading-none tabular-nums">{num}</span>
          <span className="text-[9px] font-semibold text-[#bbb] uppercase tracking-[0.18em] mt-1">watts</span>
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="flex gap-3">
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{items.length}</span><span className="text-[11px] text-[var(--text-dim)]">{label}s</span></div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><Package className="h-3 w-3 text-[var(--text-dim)]" /><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{totalUsages}</span><span className="text-[11px] text-[var(--text-dim)]">usages</span></div>
        </div>
        <button onClick={onAdd} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors shrink-0"><Plus className="h-3.5 w-3.5" /> Add {label}</button>
      </div>
      {items.length > 4 && (
        <div className="relative max-w-sm mb-4"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${label}s...`} className="w-full h-9 pl-9 pr-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 transition-colors" /></div>
      )}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-subtle)] rounded-xl"><p className="text-[13px] text-[var(--text-dim)]">{search ? "No match." : `No ${label}s yet.`}</p></div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map(value => {
            const count = counts[value] || 0;
            const num = parseNum(value);
            return (
              <div key={value} className="group relative flex flex-col items-center p-4 pb-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--text-dim)] hover:bg-[var(--bg-surface-hover)] transition-all">
                {type === "voltage" ? renderVoltageVisual(num) : renderWattVisual(num)}
                <h3 className="text-[14px] font-bold text-[var(--text-primary)] text-center tracking-tight">{value}</h3>
                <p className="text-[10px] text-[var(--text-dim)] mt-1.5 tabular-nums">{count} product{count !== 1 ? "s" : ""}</p>
                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(value)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--bg-surface-active)] backdrop-blur-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => onDelete(value)} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--bg-surface-active)] backdrop-blur-sm text-[var(--text-secondary)] hover:text-red-400 transition-colors"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════
   ── Simple Attribute Tab ──
   ═══════════════════════════════ */
function SimpleTab({ type, items, counts, tagColors, onAdd, onEdit, onDelete }: {
  type: string; items: string[]; counts: Record<string, number>;
  tagColors?: Record<string, string>;
  onAdd: () => void; onEdit: (v: string) => void; onDelete: (v: string) => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = search.trim() ? items.filter(i => i.toLowerCase().includes(search.toLowerCase())) : items;
  const labels: Record<string, string> = { tags: "tag", plug_types: "plug type", colors: "color", voltage: "voltage", watt: "wattage", levels: "level" };
  const label = labels[type] || "item";

  return (
    <div>
      <div className="flex gap-3 mb-5">
        <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{items.length}</span><span className="text-[11px] text-[var(--text-dim)]">{label}s</span></div>
        <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]"><Package className="h-3 w-3 text-[var(--text-dim)]" /><span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{items.reduce((s, i) => s + (counts[i] || 0), 0)}</span><span className="text-[11px] text-[var(--text-dim)]">usages</span></div>
      </div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" /><input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${label}s...`} className="w-full h-9 pl-9 pr-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 transition-colors" /></div>
        <button onClick={onAdd} className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors shrink-0"><Plus className="h-3.5 w-3.5" /> Add {label}</button>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[var(--border-subtle)] rounded-xl"><p className="text-[13px] text-[var(--text-dim)]">{search ? "No match." : `No ${label}s yet.`}</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map(value => {
            const count = counts[value] || 0;
            const hex = type === "colors" ? getColorHex(value) : null;
            const levelColor = type === "levels" ? LEVEL_COLORS[value.toLowerCase()] : null;
            return (
              <div key={value} className="group flex items-center gap-3 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--text-dim)] transition-all">
                {type === "colors" && <div className="shrink-0 w-8 h-8 rounded-lg border border-[var(--border-subtle)]" style={{ background: hex || "linear-gradient(135deg, #444, #666)" }} />}
                {type === "levels" && <div className={`shrink-0 w-2 h-8 rounded-full ${levelColor || "bg-[var(--bg-surface-bright)]"}`} />}
                {type === "tags" && tagColors?.[value] ? (
                  <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: tagColors[value] + "20" }}>
                    <div className="w-3.5 h-3.5 rounded-full" style={{ background: tagColors[value] }} />
                  </div>
                ) : type !== "colors" && type !== "levels" && (
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center"><span className="text-[11px] font-bold text-[var(--text-dim)]">{value.charAt(0).toUpperCase()}</span></div>
                )}
                <div className="flex-1 min-w-0"><p className="text-[13px] font-medium text-[var(--text-primary)] truncate">{value}</p><p className="text-[10px] text-[var(--text-dim)] mt-0.5">{count > 0 ? `${count} product${count !== 1 ? "s" : ""}` : "Not used"}</p></div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(value)} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><Pencil className="h-3 w-3" /></button>
                  <button onClick={() => onDelete(value)} className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors"><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
