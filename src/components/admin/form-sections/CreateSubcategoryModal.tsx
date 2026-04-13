"use client";

import { useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import Modal from "./Modal";
import { createSubcategory } from "@/lib/products-admin";
import type { SubcategoryRow } from "@/types/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (row: SubcategoryRow) => void;
  categoryId: string;
  categoryName: string;
  divisionName: string;
  existingCount: number;
}

export default function CreateSubcategoryModal({ open, onClose, onCreated, categoryId, categoryName, divisionName, existingCount }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const autoSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const reset = () => {
    setName(""); setSlug(""); setSlugEdited(false);
    setDescription(""); setError("");
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    const finalSlug = slug || autoSlug(name);
    setSaving(true);
    setError("");
    const row = await createSubcategory({
      name: name.trim(),
      slug: finalSlug,
      category_id: categoryId,
      description: description.trim() || null,
      order: existingCount,
    });
    setSaving(false);
    if (!row) { setError("Failed to create subcategory. The slug might already exist."); return; }
    onCreated(row);
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
      title="Create New Subcategory"
      subtitle={`Under: ${divisionName} → ${categoryName}`}
      footer={
        <>
          <button onClick={handleClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Creating..." : "Create Subcategory"}
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
        {/* Parent info */}
        <div className="px-4 py-3 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
          <div className="flex gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)] mb-1">Division</p>
              <p className="text-[13px] font-medium text-[var(--text-primary)]">{divisionName}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-ghost)] mb-1">Category</p>
              <p className="text-[13px] font-medium text-[var(--text-primary)]">{categoryName}</p>
            </div>
          </div>
        </div>

        <div>
          <label className={lbl}>Subcategory Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(autoSlug(e.target.value)); }}
            placeholder="e.g. Desktop Cobots"
            className={inp}
            autoFocus
          />
        </div>

        <div>
          <label className={lbl}>Slug (URL path)</label>
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlug(e.target.value); setSlugEdited(true); }}
            placeholder="auto-generated-from-name"
            className={`${inp} font-mono text-[var(--text-muted)]`}
          />
          <p className="text-[10px] text-[var(--text-ghost)] mt-1">Used in URLs. Auto-generated from name if left empty.</p>
        </div>

        <div>
          <label className={lbl}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this subcategory covers..."
            rows={3}
            className={`${inp} h-auto py-3 resize-none`}
          />
        </div>
      </div>
    </Modal>
  );
}
