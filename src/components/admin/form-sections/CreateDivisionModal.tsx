"use client";

import { useState } from "react";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import Modal from "./Modal";
import { createDivision } from "@/lib/products-admin";
import type { DivisionRow } from "@/types/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (row: DivisionRow) => void;
  existingCount: number;
}

export default function CreateDivisionModal({ open, onClose, onCreated, existingCount }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const autoSlug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const reset = () => {
    setName(""); setSlug(""); setSlugEdited(false);
    setTagline(""); setDescription(""); setError("");
  };

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    const finalSlug = slug || autoSlug(name);
    setSaving(true);
    setError("");
    const row = await createDivision({
      name: name.trim(),
      slug: finalSlug,
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      order: existingCount,
    });
    setSaving(false);
    if (!row) { setError("Failed to create division. The slug might already exist."); return; }
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
      title="Create New Division"
      subtitle="Add a new product division to the catalog"
      footer={
        <>
          <button onClick={handleClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !name.trim()} className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Creating..." : "Create Division"}
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
          <label className={lbl}>Division Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); if (!slugEdited) setSlug(autoSlug(e.target.value)); }}
            placeholder="e.g. Industrial Automation"
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
          <label className={lbl}>Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="e.g. Smart solutions for modern factories"
            className={inp}
          />
        </div>

        <div>
          <label className={lbl}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this division covers..."
            rows={3}
            className={`${inp} h-auto py-3 resize-none`}
          />
        </div>
      </div>
    </Modal>
  );
}
