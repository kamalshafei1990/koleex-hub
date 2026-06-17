"use client";

/* ---------------------------------------------------------------------------
   ProductDocumentsSection (Phase 4) — structured industrial documents.
   Backed by product_documents (12 doc types) with title / version /
   language / file metadata. Files upload to Supabase Storage via
   uploadProductFile. This is the canonical Documents home (distinct from
   the visual Media slots).
   --------------------------------------------------------------------------- */

import { useState } from "react";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import { uploadProductFile } from "@/lib/products-admin";
import type { ProductDocumentFormState } from "@/types/product-form";

interface Props {
  documents: ProductDocumentFormState[];
  onChange: (d: ProductDocumentFormState[]) => void;
}

const DOC_TYPES: { value: string; label: string }[] = [
  { value: "user_manual", label: "User Manual" },
  { value: "spare_parts_list", label: "Spare Parts List" },
  { value: "exploded_view", label: "Exploded View" },
  { value: "wiring_diagram", label: "Wiring Diagram" },
  { value: "installation_guide", label: "Installation Guide" },
  { value: "brochure", label: "Brochure" },
  { value: "catalog", label: "Catalog" },
  { value: "certificate", label: "Certificate" },
  { value: "test_report", label: "Test Report" },
  { value: "packing_list", label: "Packing List" },
  { value: "dimension_drawing", label: "Dimension Drawing" },
  { value: "cad_3d", label: "3D CAD File" },
];
const LANGS = ["", "en", "zh", "ar"];

const lbl = "block text-[11px] font-medium text-[var(--text-faint)] mb-1";
const inp =
  "w-full h-9 px-3 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)]";

export default function ProductDocumentsSection({ documents, onChange }: Props) {
  const [uploading, setUploading] = useState<Record<string, boolean>>({});

  const add = () => onChange([...documents, {
    _tempId: crypto.randomUUID(),
    doc_type: "user_manual", title: "", file_url: "", file_name: "",
    language: "", version: "", model_ids: [],
  }]);
  const update = (id: string, patch: Partial<ProductDocumentFormState>) =>
    onChange(documents.map((d) => (d._tempId === id ? { ...d, ...patch } : d)));
  const remove = (id: string) => onChange(documents.filter((d) => d._tempId !== id));

  const onFile = async (id: string, file: File | undefined) => {
    if (!file) return;
    setUploading((p) => ({ ...p, [id]: true }));
    const res = await uploadProductFile(file);
    setUploading((p) => ({ ...p, [id]: false }));
    if (res) update(id, { file_url: res.url, file_name: file.name });
  };

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <p className="text-[12px] text-[var(--text-ghost)] py-5 text-center border border-dashed border-[var(--border-subtle)] rounded-xl">
          No documents yet. Add manuals, spare-parts lists, wiring diagrams, certificates, drawings and more.
        </p>
      ) : (
        <div className="space-y-3">
          {documents.map((d) => (
            <div key={d._tempId} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0 text-[var(--text-muted)]">
                  <DocumentIcon className="h-4 w-4 shrink-0" />
                  <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                    {DOC_TYPES.find((t) => t.value === d.doc_type)?.label || "Document"}
                  </span>
                </div>
                <button type="button" onClick={() => remove(d._tempId)} aria-label="Remove document"
                  className="h-7 w-7 flex items-center justify-center rounded-lg text-[var(--text-ghost)] hover:text-[var(--state-error,#FF3333)] border border-[var(--border-subtle)] transition-colors">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className={lbl}>Type</label>
                  <select className={inp} value={d.doc_type} onChange={(e) => update(d._tempId, { doc_type: e.target.value })}>
                    {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={lbl}>Title</label>
                  <input className={inp} value={d.title} placeholder="e.g. XSL-9500 Operation Manual"
                    onChange={(e) => update(d._tempId, { title: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Version</label>
                  <input className={inp} value={d.version} placeholder="e.g. v2.1"
                    onChange={(e) => update(d._tempId, { version: e.target.value })} />
                </div>
                <div>
                  <label className={lbl}>Language</label>
                  <select className={inp} value={d.language} onChange={(e) => update(d._tempId, { language: e.target.value })}>
                    {LANGS.map((l) => <option key={l} value={l}>{l ? l.toUpperCase() : "—"}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={lbl}>File</label>
                  <div className="flex items-center gap-2">
                    <label className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0">
                      <UploadIcon className="h-3.5 w-3.5" />
                      {uploading[d._tempId] ? "Uploading…" : (d.file_url ? "Replace" : "Upload")}
                      <input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.dwg,.dxf,.step,.stp,.igs,.zip,.png,.jpg,.jpeg"
                        onChange={(e) => onFile(d._tempId, e.target.files?.[0])} />
                    </label>
                    <span className="text-[11px] text-[var(--text-ghost)] truncate">
                      {d.file_name || (d.file_url ? d.file_url.split("/").pop() : "No file uploaded")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={add}
        className="h-9 px-3 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] inline-flex items-center gap-1.5 transition-colors">
        <PlusIcon className="h-3.5 w-3.5" /> Add document
      </button>
    </div>
  );
}
