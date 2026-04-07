"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, Plus, Search, Pencil, Trash2, ImageIcon, X,
  Loader2, Package, RefreshCw,
} from "lucide-react";
import {
  fetchBrandsWithDetails, renameBrand, deleteBrand,
  uploadBrandLogo, deleteBrandLogo,
} from "@/lib/products-admin";

interface BrandItem {
  name: string;
  slug: string;
  logoUrl: string | null;
  productCount: number;
}

/* ── Edit/Create Modal ── */
function BrandModal({
  open, onClose, brand, existingNames, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  brand: BrandItem | null; // null = create new
  existingNames: string[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(brand?.name || "");
      setLogoFile(null);
      setLogoPreview(brand?.logoUrl || null);
      setRemoveLogo(false);
      setError("");
    }
  }, [open, brand]);

  const handleLogoSelect = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError("Brand name is required"); return; }

    // Check duplicates (case-insensitive), skip if same name as current
    const isDuplicate = existingNames.some(
      n => n.toLowerCase() === trimmed.toLowerCase() && n !== brand?.name
    );
    if (isDuplicate) { setError("A brand with this name already exists"); return; }

    setSaving(true);
    setError("");

    try {
      const slug = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      if (brand) {
        // ── Editing existing brand ──
        if (trimmed !== brand.name) {
          const ok = await renameBrand(brand.name, trimmed);
          if (!ok) { setError("Failed to rename brand"); setSaving(false); return; }
        }
        // Handle logo changes
        if (removeLogo && brand.logoUrl) {
          await deleteBrandLogo(brand.slug);
        }
        if (logoFile) {
          await uploadBrandLogo(slug, logoFile);
        }
      } else {
        // ── Creating new brand ──
        // Brand is created implicitly when assigned to a product,
        // but we can upload a logo for it now
        if (logoFile) {
          await uploadBrandLogo(slug, logoFile);
        }
      }

      setSaving(false);
      onSaved();
      onClose();
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  if (!open) return null;

  const inp = "w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-[13px] text-white placeholder:text-white/30 outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[480px] bg-[#141414] rounded-2xl border border-white/[0.08] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <h2 className="text-[16px] font-semibold text-white">
            {brand ? "Edit Brand" : "New Brand"}
          </h2>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/[0.06] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* Logo + Name side by side */}
          <div className="flex gap-5 items-start">
            {/* Logo */}
            <div className="shrink-0">
              <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Logo</label>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoSelect(e.target.files)}
              />
              {logoPreview && !removeLogo ? (
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.04]">
                  <img src={logoPreview} alt="" className="w-full h-full object-contain p-2" />
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-20 h-20 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-blue-500/30 bg-white/[0.02] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
                >
                  <ImageIcon className="h-5 w-5 text-white/20 group-hover:text-white/40 transition-colors" />
                  <span className="text-[9px] text-white/20 group-hover:text-white/40">Upload</span>
                </button>
              )}
            </div>

            {/* Name */}
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-wider mb-1.5">Brand Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
                placeholder="e.g. Koleex, FANUC, ABB"
                className={inp}
                autoFocus
              />
              <p className="text-[10px] text-white/20 mt-1.5">
                {brand
                  ? "Renaming will update all products using this brand."
                  : "Brand will appear in dropdowns once assigned to a product."}
              </p>
            </div>
          </div>

          {brand && (
            <div className="flex items-center gap-2 text-[11px] text-white/30">
              <Package className="h-3 w-3" />
              <span>Used by {brand.productCount} product{brand.productCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="h-10 px-6 rounded-xl bg-white text-black text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving..." : brand ? "Save Changes" : "Create Brand"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Delete Confirmation Modal ── */
function DeleteModal({
  open, brand, onClose, onConfirm, deleting,
}: {
  open: boolean;
  brand: BrandItem | null;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open || !brand) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-[#141414] rounded-2xl border border-white/[0.08] shadow-2xl">
        <div className="px-6 py-5">
          <h2 className="text-[16px] font-semibold text-white mb-2">Delete Brand</h2>
          <p className="text-[13px] text-white/50 leading-relaxed">
            Are you sure you want to delete <span className="text-white font-medium">{brand.name}</span>?
          </p>
          {brand.productCount > 0 && (
            <div className="mt-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[12px] text-amber-400">
              This brand is used by {brand.productCount} product{brand.productCount !== 1 ? "s" : ""}. The brand field will be cleared on those products.
            </div>
          )}
          <p className="text-[12px] text-white/30 mt-3">The brand logo will also be removed.</p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-white/[0.06]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-white/40 hover:text-white hover:bg-white/[0.04] transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold flex items-center gap-2 hover:bg-red-500/30 transition-all disabled:opacity-40"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {deleting ? "Deleting..." : "Delete Brand"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function BrandsPage() {
  const [brands, setBrands] = useState<BrandItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modal state
  const [editBrand, setEditBrand] = useState<BrandItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleteBrandItem, setDeleteBrandItem] = useState<BrandItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchBrandsWithDetails();
    setBrands(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? brands.filter(b => b.name.toLowerCase().includes(search.toLowerCase()))
    : brands;

  const handleEdit = (brand: BrandItem) => {
    setEditBrand(brand);
    setShowEditModal(true);
  };

  const handleCreate = () => {
    setEditBrand(null);
    setShowEditModal(true);
  };

  const handleDeleteClick = (brand: BrandItem) => {
    setDeleteBrandItem(brand);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteBrandItem) return;
    setDeleting(true);
    await deleteBrand(deleteBrandItem.name);
    setDeleting(false);
    setShowDeleteModal(false);
    setDeleteBrandItem(null);
    load();
  };

  const totalProducts = brands.reduce((sum, b) => sum + b.productCount, 0);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-[1100px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <Link href="/products" className="h-8 w-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-[28px] font-bold tracking-tight">Brands</h1>
        </div>
        <p className="text-[13px] text-white/40 mb-6 ml-11">
          Manage product brands and their logos. Brands are shared across products.
        </p>

        {/* Stats row */}
        <div className="flex gap-4 mb-6">
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <span className="text-[18px] font-bold text-white">{brands.length}</span>
            <span className="text-[11px] text-white/40">Brands</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <Package className="h-3.5 w-3.5 text-white/30" />
            <span className="text-[18px] font-bold text-white">{totalProducts}</span>
            <span className="text-[11px] text-white/40">Products</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brands..."
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white placeholder:text-white/30 outline-none focus:border-blue-500/50 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCreate}
              className="h-9 px-4 rounded-lg bg-white text-black text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New Brand
            </button>
          </div>
        </div>

        {/* Brands Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-white/[0.06] rounded-xl">
            <p className="text-[13px] text-white/30">
              {search ? "No brands match your search." : "No brands yet. Create your first brand or add one from the product form."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((brand) => (
              <div
                key={brand.name}
                className="group relative flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all"
              >
                {/* Logo */}
                <div className="shrink-0 w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden">
                  {brand.logoUrl ? (
                    <img src={brand.logoUrl} alt={brand.name} className="w-full h-full object-contain p-1.5" />
                  ) : (
                    <span className="text-[16px] font-bold text-white/20">
                      {brand.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-white truncate">{brand.name}</h3>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-white/30 font-mono">{brand.slug}</span>
                    <span className="text-[11px] text-white/30 flex items-center gap-1">
                      <Package className="h-3 w-3" /> {brand.productCount}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(brand)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(brand)}
                    className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400/70 hover:bg-red-400/[0.06] transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation links */}
        <div className="mt-8 flex gap-3">
          <Link href="/divisions" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Divisions
          </Link>
          <Link href="/categories" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Categories
          </Link>
          <Link href="/subcategories" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Subcategories
          </Link>
          <Link href="/brands" className="h-9 px-4 rounded-lg bg-white/[0.06] border border-white/[0.10] text-[12px] text-white/70 flex items-center gap-1.5 transition-colors">
            Brands
          </Link>
          <Link href="/products" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Products
          </Link>
        </div>
      </div>

      {/* Edit/Create Modal */}
      <BrandModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        brand={editBrand}
        existingNames={brands.map(b => b.name)}
        onSaved={load}
      />

      {/* Delete Modal */}
      <DeleteModal
        open={showDeleteModal}
        brand={deleteBrandItem}
        onClose={() => { setShowDeleteModal(false); setDeleteBrandItem(null); }}
        onConfirm={handleDeleteConfirm}
        deleting={deleting}
      />
    </div>
  );
}
