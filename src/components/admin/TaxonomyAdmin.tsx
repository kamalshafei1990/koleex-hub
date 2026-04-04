"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Trash2, Pencil, ArrowLeft, X, Save, Loader2, ChevronUp, ChevronDown, FolderTree } from "lucide-react";
import { slugify } from "@/types/product-form";

/* ---------------------------------------------------------------------------
   TaxonomyAdmin — Reusable CRUD admin for divisions, categories, subcategories.
   Supports inline modal editing, search, ordering, and parent relationships.
   --------------------------------------------------------------------------- */

interface TaxonomyItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  order: number;
  parent_id?: string;      // division_id or category_id
  created_at: string;
}

interface ParentOption {
  id: string;
  name: string;
}

interface Props {
  title: string;
  singular: string;
  backHref: string;
  parentLabel?: string;             // e.g. "Division" for categories
  parentOptions?: ParentOption[];   // parent dropdown options
  items: TaxonomyItem[];
  parentMap?: Record<string, string>; // parent_id -> parent name (for display)
  childCounts?: Record<string, number>;
  childLabel?: string;               // e.g. "Categories" for divisions
  loading: boolean;
  onRefresh: () => void;
  onCreate: (data: { name: string; slug: string; description: string; order: number; parent_id?: string }) => Promise<boolean>;
  onUpdate: (id: string, data: { name: string; slug: string; description: string; order: number; parent_id?: string }) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
  onReorder: (id: string, newOrder: number) => Promise<boolean>;
}

interface FormData {
  name: string;
  slug: string;
  description: string;
  order: string;
  parent_id: string;
}

const EMPTY_FORM: FormData = { name: "", slug: "", description: "", order: "0", parent_id: "" };

export default function TaxonomyAdmin({
  title, singular, backHref, parentLabel, parentOptions,
  items, parentMap, childCounts, childLabel,
  loading, onRefresh, onCreate, onUpdate, onDelete, onReorder,
}: Props) {
  const [search, setSearch] = useState("");
  const [filterParent, setFilterParent] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...EMPTY_FORM });
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    return items.filter(item => {
      if (filterParent && item.parent_id !== filterParent) return false;
      if (search && !item.name.toLowerCase().includes(search.toLowerCase()) && !item.slug.includes(search.toLowerCase())) return false;
      return true;
    }).sort((a, b) => a.order - b.order);
  }, [items, filterParent, search]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM, order: String(items.length) });
    setSlugEdited(false);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (item: TaxonomyItem) => {
    setEditId(item.id);
    setForm({
      name: item.name,
      slug: item.slug,
      description: item.description || "",
      order: String(item.order),
      parent_id: item.parent_id || "",
    });
    setSlugEdited(true);
    setError("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError(`${singular} name is required`); return; }
    if (!form.slug.trim()) { setError("Slug is required"); return; }
    if (parentLabel && parentOptions && !form.parent_id) { setError(`${parentLabel} is required`); return; }

    setSaving(true);
    setError("");

    const data: { name: string; slug: string; description: string; order: number; parent_id?: string } = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      order: parseInt(form.order) || 0,
    };
    if (parentLabel && form.parent_id) data.parent_id = form.parent_id;

    let ok: boolean;
    if (editId) {
      ok = await onUpdate(editId, data);
    } else {
      ok = await onCreate(data);
    }

    setSaving(false);
    if (ok) {
      setModalOpen(false);
      onRefresh();
    } else {
      setError("Save failed. Check for duplicate slugs.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    const count = childCounts?.[id] || 0;
    const warn = count > 0 ? ` This will also delete ${count} ${childLabel?.toLowerCase() || "children"}.` : "";
    if (!confirm(`Delete "${name}"?${warn}`)) return;
    const ok = await onDelete(id);
    if (ok) onRefresh();
  };

  const handleMoveUp = async (item: TaxonomyItem, idx: number) => {
    if (idx === 0) return;
    const prev = filtered[idx - 1];
    await onReorder(item.id, prev.order);
    await onReorder(prev.id, item.order);
    onRefresh();
  };

  const handleMoveDown = async (item: TaxonomyItem, idx: number) => {
    if (idx === filtered.length - 1) return;
    const next = filtered[idx + 1];
    await onReorder(item.id, next.order);
    await onReorder(next.id, item.order);
    onRefresh();
  };

  const inp = "w-full h-10 px-4 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/20";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-[900px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="h-9 w-9 flex items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.08] text-white/40 hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-xl md:text-[24px] font-bold text-white flex items-center gap-2">
                <FolderTree className="h-5 w-5 md:h-6 md:w-6 text-white/40" />
                {title}
              </h1>
              <p className="text-[12px] md:text-[13px] text-white/30">{items.length} {title.toLowerCase()} total</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="h-9 md:h-10 px-4 md:px-5 rounded-lg bg-white text-black text-[12px] md:text-[13px] font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add {singular}</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>

        {/* Search + filter */}
        <div className="bg-[#141414] rounded-xl border border-white/[0.06] p-4 mb-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/25" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white placeholder:text-white/25 outline-none focus:border-white/20"
              />
            </div>
            {parentLabel && parentOptions && (
              <select
                value={filterParent}
                onChange={(e) => setFilterParent(e.target.value)}
                className="h-10 px-3 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[13px] text-white/70 outline-none focus:border-white/20 min-w-[180px]"
              >
                <option value="">All {parentLabel}s</option>
                {parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#141414] rounded-xl border border-white/[0.06] overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-white/30 text-[14px]">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <FolderTree className="h-10 w-10 text-white/10 mx-auto mb-3" />
              <p className="text-white/30 text-[14px]">
                {items.length === 0 ? `No ${title.toLowerCase()} yet.` : "No matches."}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  <th className="text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25 w-[60px]">Order</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Name</th>
                  <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">Slug</th>
                  {parentLabel && <th className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">{parentLabel}</th>}
                  {childLabel && <th className="text-center px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25">{childLabel}</th>}
                  <th className="text-right px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-white/25 w-[140px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => (
                  <tr key={item.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-3 py-3 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <button onClick={() => handleMoveUp(item, idx)} disabled={idx === 0} className="text-white/15 hover:text-white/50 disabled:opacity-20 transition-colors">
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                        <span className="text-[11px] text-white/25 font-mono">{item.order}</span>
                        <button onClick={() => handleMoveDown(item, idx)} disabled={idx === filtered.length - 1} className="text-white/15 hover:text-white/50 disabled:opacity-20 transition-colors">
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="text-[14px] font-medium text-white">{item.name}</div>
                      {item.description && <div className="text-[11px] text-white/25 mt-0.5 line-clamp-1">{item.description}</div>}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-white/40 font-mono">{item.slug}</td>
                    {parentLabel && (
                      <td className="px-5 py-3 text-[13px] text-white/50">
                        {item.parent_id && parentMap ? parentMap[item.parent_id] || "—" : "—"}
                      </td>
                    )}
                    {childLabel && (
                      <td className="px-5 py-3 text-center">
                        <span className="inline-flex items-center justify-center h-6 min-w-[24px] px-2 rounded-full bg-white/[0.06] text-[11px] font-medium text-white/50">
                          {childCounts?.[item.id] || 0}
                        </span>
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEdit(item)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/70 hover:bg-white/[0.06] transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id, item.name)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400/70 hover:bg-red-400/[0.06] transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Navigation links */}
        <div className="mt-6 flex gap-3">
          <Link href="/divisions" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Divisions
          </Link>
          <Link href="/categories" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Categories
          </Link>
          <Link href="/subcategories" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Subcategories
          </Link>
          <Link href="/products" className="h-9 px-4 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[12px] text-white/40 hover:text-white/70 flex items-center gap-1.5 transition-colors">
            Products
          </Link>
        </div>
      </div>

      {/* ── Modal ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-[480px] bg-[#141414] rounded-2xl border border-white/[0.08] shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
              <h2 className="text-[16px] font-semibold text-white">
                {editId ? `Edit ${singular}` : `New ${singular}`}
              </h2>
              <button onClick={() => setModalOpen(false)} className="h-8 w-8 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">{error}</div>
              )}

              {parentLabel && parentOptions && (
                <div>
                  <label className="block text-[12px] font-medium text-white/50 mb-1.5">{parentLabel} *</label>
                  <select
                    value={form.parent_id}
                    onChange={(e) => setForm(f => ({ ...f, parent_id: e.target.value }))}
                    className={inp}
                  >
                    <option value="">Select {parentLabel.toLowerCase()}...</option>
                    {parentOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[12px] font-medium text-white/50 mb-1.5">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => {
                    const updates: Partial<FormData> = { name: e.target.value };
                    if (!slugEdited) updates.slug = slugify(e.target.value);
                    setForm(f => ({ ...f, ...updates }));
                  }}
                  placeholder={`${singular} name`}
                  className={inp}
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-white/50 mb-1.5">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => { setSlugEdited(true); setForm(f => ({ ...f, slug: e.target.value })); }}
                  className={`${inp} font-mono text-white/60`}
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-white/50 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/[0.05] border border-white/[0.08] text-[14px] text-white placeholder:text-white/25 outline-none focus:border-white/20 resize-y"
                />
              </div>

              <div>
                <label className="block text-[12px] font-medium text-white/50 mb-1.5">Sort Order</label>
                <input
                  type="number"
                  value={form.order}
                  onChange={(e) => setForm(f => ({ ...f, order: e.target.value }))}
                  className={`${inp} w-[100px]`}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => setModalOpen(false)}
                className="h-10 px-5 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[13px] text-white/50 hover:text-white/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-10 px-6 rounded-lg bg-white text-black text-[13px] font-semibold flex items-center gap-2 hover:bg-white/90 transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? "Saving..." : editId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
