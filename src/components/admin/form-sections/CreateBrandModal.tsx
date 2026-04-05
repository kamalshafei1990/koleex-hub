"use client";

import { useState } from "react";
import Modal from "./Modal";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (brandName: string) => void;
  existingBrands: string[];
}

export default function CreateBrandModal({ open, onClose, onCreated, existingBrands }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const reset = () => { setName(""); setError(""); };

  const handleSave = () => {
    if (!name.trim()) { setError("Brand name is required"); return; }
    if (existingBrands.some(b => b.toLowerCase() === name.trim().toLowerCase())) {
      setError("This brand already exists");
      return;
    }
    onCreated(name.trim());
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
      subtitle="Add a new brand to the product catalog. Brand is saved when you save the product."
      footer={
        <>
          <button onClick={handleClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!name.trim()} className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold hover:opacity-90 transition-all disabled:opacity-40">
            Create Brand
          </button>
        </>
      }
    >
      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
          {error}
        </div>
      )}

      <div className="space-y-5">
        <div>
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
