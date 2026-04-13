"use client";

import { useState, useRef } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import Modal from "./Modal";
import { uploadBrandLogo } from "@/lib/products-admin";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (brandName: string, logoUrl: string | null) => void;
  existingBrands: string[];
}

export default function CreateBrandModal({ open, onClose, onCreated, existingBrands }: Props) {
  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(""); setLogoFile(null); setLogoPreview(null); setError("");
  };

  const handleLogoSelect = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Brand name is required"); return; }
    if (existingBrands.some(b => b.toLowerCase() === name.trim().toLowerCase())) {
      setError("This brand already exists");
      return;
    }

    setSaving(true);
    setError("");

    let logoUrl: string | null = null;
    if (logoFile) {
      const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      logoUrl = await uploadBrandLogo(slug, logoFile);
    }

    setSaving(false);
    onCreated(name.trim(), logoUrl);
    reset();
    onClose();
  };

  const handleClose = () => { reset(); onClose(); };

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-ghost)] outline-none focus:border-[var(--border-focus)] focus:ring-1 focus:ring-[var(--border-focus)] transition-all";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create New Brand"
      subtitle="Add a new brand with logo to the product catalog"
      footer={
        <>
          <button onClick={handleClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Creating..." : "Create Brand"}
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Logo + Name side by side */}
        <div className="flex gap-5 items-start">
          {/* Logo upload */}
          <div className="shrink-0">
            <label className={lbl}>Brand Logo</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleLogoSelect(e.target.files)}
            />
            {logoPreview ? (
              <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
                <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain p-2" />
                <button
                  type="button"
                  onClick={removeLogo}
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                >
                  <CrossIcon className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--border-focus)] bg-[var(--bg-surface-subtle)] flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group"
              >
                <PictureIcon className="h-6 w-6 text-[var(--text-ghost)] group-hover:text-[var(--text-dim)] transition-colors" />
                <span className="text-[10px] text-[var(--text-ghost)] group-hover:text-[var(--text-dim)]">Upload</span>
              </button>
            )}
          </div>

          {/* Brand name */}
          <div className="flex-1">
            <label className={lbl}>Brand Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSave(); } }}
              placeholder="e.g. Koleex, FANUC, ABB"
              className={inp}
              autoFocus
            />
            <p className="text-[10px] text-[var(--text-ghost)] mt-1.5">Logo is stored in Supabase Storage. Brand is saved when you save the product.</p>
          </div>
        </div>

        {existingBrands.length > 0 && (
          <div>
            <label className={lbl}>Existing Brands</label>
            <div className="flex flex-wrap gap-1.5">
              {existingBrands.map(b => (
                <span key={b} className="h-7 px-3 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-ghost)] flex items-center">
                  {b}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
