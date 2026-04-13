"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import FileIcon from "@/components/icons/ui/FileIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import PlusIcon from "@/components/icons/ui/PlusIcon";
import SearchIcon from "@/components/icons/ui/SearchIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import PictureIcon from "@/components/icons/ui/PictureIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import PenToolIcon from "@/components/icons/ui/PenToolIcon";
import UploadIcon from "@/components/icons/ui/UploadIcon";
import Building2Icon from "@/components/icons/ui/Building2Icon";
import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";
import LayoutGridIcon from "@/components/icons/ui/LayoutGridIcon";
import ListIcon from "@/components/icons/ui/ListIcon";
import {
  fetchCatalogs, createCatalog, updateCatalog, deleteCatalog,
  uploadCatalogFile, uploadCatalogCover, replaceCatalogFile,
  fetchCatalogContacts, syncCatalogToContact, removeCatalogFromContact,
} from "@/lib/catalogs-admin";
import { createContact } from "@/lib/contacts-admin";
import CatalogsIcon from "@/components/icons/CatalogsIcon";
import { getDivisionIcon } from "@/components/icons/divisions";
import type { CatalogEntry } from "@/lib/catalogs-admin";
import {
  fetchDivisions, fetchCategories,
  fetchDivisionLogos, fetchCategoryLogos,
} from "@/lib/products-admin";
import type { DivisionRow, CategoryRow } from "@/types/supabase";

/* ── Helpers ── */
function getFileType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  if (["jpg", "jpeg"].includes(ext)) return "jpg";
  return ext;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isImageFile(type: string): boolean {
  return ["jpg", "jpeg", "png"].includes(type);
}

const FILE_TYPE_CONFIG: Record<string, { label: string; color: string; bgFrom: string; bgTo: string; icon: typeof DocumentIcon }> = {
  pdf: { label: "PDF", color: "text-red-400", bgFrom: "from-red-950", bgTo: "to-red-900/60", icon: DocumentIcon },
  jpg: { label: "JPG", color: "text-emerald-400", bgFrom: "from-emerald-950", bgTo: "to-emerald-900/60", icon: PictureIcon },
  jpeg: { label: "JPG", color: "text-emerald-400", bgFrom: "from-emerald-950", bgTo: "to-emerald-900/60", icon: PictureIcon },
  png: { label: "PNG", color: "text-blue-400", bgFrom: "from-blue-950", bgTo: "to-blue-900/60", icon: PictureIcon },
  psd: { label: "PSD", color: "text-indigo-400", bgFrom: "from-indigo-950", bgTo: "to-indigo-900/60", icon: LayersIcon },
  cdr: { label: "CDR", color: "text-orange-400", bgFrom: "from-orange-950", bgTo: "to-orange-900/60", icon: PenToolIcon },
};
const DEFAULT_FT = { label: "FILE", color: "text-zinc-400", bgFrom: "from-zinc-950", bgTo: "to-zinc-900/60", icon: FileIcon };

type ContactOption = {
  id: string;
  display_name: string;
  company_name_en: string | null;
  company_name_cn: string | null;
  contact_type: string;
  division: string | null;
  category: string | null;
  photo_url: string | null;
};

/* ── PDF first-page thumbnail generator ── */
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174";

let pdfjsLoaded = false;
function ensurePdfJs(): Promise<void> {
  if (pdfjsLoaded && (window as any).pdfjsLib) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = (window as any).pdfjsLib;
    if (existing) { pdfjsLoaded = true; resolve(); return; }
    const script = document.createElement("script");
    script.src = `${PDFJS_CDN}/pdf.min.js`;
    script.onload = () => {
      const lib = (window as any).pdfjsLib;
      if (!lib) { reject(new Error("pdfjsLib not on window")); return; }
      lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}/pdf.worker.min.js`;
      pdfjsLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load pdf.js from CDN"));
    document.head.appendChild(script);
  });
}

async function generatePdfThumbnail(file: File): Promise<Blob | null> {
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 30000));
  const generate = async (): Promise<Blob | null> => {
    try {
      await ensurePdfJs();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const pdfjsLib = (window as any).pdfjsLib;
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 0.75 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      const renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.85);
      });
    } catch (err) {
      console.error("[PDF Thumbnail] Error:", err);
      return null;
    }
  };
  return Promise.race([generate(), timeout]);
}

/* ═══════════════════════════════════════
   ── Quick Add Supplier / Company Modal ──
   ═══════════════════════════════════════ */
function QuickAddContactModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (contact: ContactOption) => void;
}) {
  const [contactType, setContactType] = useState<"supplier" | "company">("supplier");
  const [nameEn, setNameEn] = useState("");
  const [nameCn, setNameCn] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setContactType("supplier");
      setNameEn("");
      setNameCn("");
      setPhone("");
      setEmail("");
      setCountry("");
      setError("");
    }
  }, [open]);

  const handleSave = async () => {
    if (!nameEn.trim()) { setError("Company name (English) is required."); return; }
    setSaving(true);
    setError("");

    const obj: Record<string, unknown> = {
      contact_type: contactType,
      entity_type: "company",
      company_name_en: nameEn.trim(),
      company_name_cn: nameCn.trim() || null,
      display_name: nameEn.trim(),
      full_name: nameEn.trim(),
      company: nameEn.trim(),
      supplier_tel: phone.trim() || null,
      supplier_email: email.trim() || null,
      country: country.trim() || null,
      is_active: true,
      tags: [],
      phones: [],
      emails: email.trim() ? [{ label: "Work", email: email.trim() }] : [],
      addresses: [],
      websites: [],
      social_profiles: [],
      family_members: [],
      related_names: [],
      custom_fields: [],
      shipping_addresses: [],
      attachments: [],
      product_categories: [],
      brand_names: [],
      certifications: [],
      catalogues: [],
      documents: [],
      contact_persons: [],
      bank_accounts: [],
      additional_company_names: [],
      resume_lines: [],
      emergency_contacts: [],
      visa_documents: [],
      rating: 0,
    };

    const { data, error: err } = await createContact(obj);
    setSaving(false);

    if (err || !data) {
      setError(err || "Failed to create.");
      return;
    }

    onCreated({
      id: data.id,
      display_name: nameEn.trim(),
      company_name_en: nameEn.trim(),
      company_name_cn: nameCn.trim() || null,
      contact_type: contactType,
      division: null,
      category: null,
      photo_url: null,
    });
    onClose();
  };

  if (!open) return null;

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[440px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <Building2Icon className="h-4 w-4 text-[var(--text-dim)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Add New Supplier / Company</h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {error && <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">{error}</div>}

          {/* Type toggle */}
          <div>
            <label className={lbl}>Type</label>
            <div className="flex gap-2">
              <button onClick={() => setContactType("supplier")}
                className={`flex-1 h-10 rounded-xl text-[12px] font-semibold border transition-all ${contactType === "supplier" ? "bg-blue-500/15 border-blue-500/30 text-blue-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
                Supplier
              </button>
              <button onClick={() => setContactType("company")}
                className={`flex-1 h-10 rounded-xl text-[12px] font-semibold border transition-all ${contactType === "company" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-secondary)]"}`}>
                Company
              </button>
            </div>
          </div>

          {/* Company name EN */}
          <div>
            <label className={lbl}>Company Name (English) *</label>
            <input type="text" value={nameEn} onChange={(e) => setNameEn(e.target.value)}
              placeholder="e.g. Delta Engineering Ltd" className={inp} autoFocus />
          </div>

          {/* Company name CN */}
          <div>
            <label className={lbl}>Company Name (Chinese)</label>
            <input type="text" value={nameCn} onChange={(e) => setNameCn(e.target.value)}
              placeholder="e.g. 达美工程有限公司" className={inp} />
          </div>

          {/* Phone & Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Phone</label>
              <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+86 ..." className={inp} />
            </div>
            <div>
              <label className={lbl}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="info@..." className={inp} />
            </div>
          </div>

          {/* Country */}
          <div>
            <label className={lbl}>Country</label>
            <input type="text" value={country} onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. China" className={inp} />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose} className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !nameEn.trim()}
            className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
            {saving && <SpinnerIcon className="h-4 w-4 animate-spin" />}
            {saving ? "Creating..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   ── Upload / Edit Modal ──
   ═══════════════════════════════ */
function CatalogModal({
  open, onClose, editEntry, contacts, divisions, categories, divLogos, catLogos, onSave,
}: {
  open: boolean;
  onClose: () => void;
  editEntry: CatalogEntry | null;
  contacts: ContactOption[];
  divisions: DivisionRow[];
  categories: CategoryRow[];
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  onSave: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactId, setContactId] = useState<string>("");
  const [divisionSlug, setDivisionSlug] = useState<string>("");
  const [categorySlug, setCategorySlug] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");
  const [uploadPct, setUploadPct] = useState(0);
  const [error, setError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [localContacts, setLocalContacts] = useState<ContactOption[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Populate form
  useEffect(() => {
    if (open) {
      if (editEntry) {
        setTitle(editEntry.title);
        setDescription(editEntry.description || "");
        setContactId(editEntry.contact_id || "");
        setDivisionSlug(editEntry.division_slug || "");
        setCategorySlug(editEntry.category_slug || "");
        setThumbPreview(editEntry.cover_url || (isImageFile(editEntry.file_type) ? editEntry.file_url : null));
      } else {
        setTitle("");
        setDescription("");
        setContactId("");
        setDivisionSlug("");
        setCategorySlug("");
        setThumbPreview(null);
      }
      setFile(null);
      setThumbnailBlob(null);
      setGeneratingThumb(false);
      setError("");
      setProgress("");
      setUploadPct(0);
      setContactSearch("");
      setShowContactDropdown(false);
      setShowQuickAdd(false);
      setLocalContacts(contacts);
    }
  }, [open, editEntry, contacts]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false);
      }
    }
    if (showContactDropdown) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showContactDropdown]);

  const selectedContact = useMemo(() => localContacts.find(c => c.id === contactId), [localContacts, contactId]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch.trim()) return localContacts;
    const q = contactSearch.toLowerCase();
    return localContacts.filter(c =>
      c.display_name.toLowerCase().includes(q) ||
      c.company_name_en?.toLowerCase().includes(q) ||
      c.company_name_cn?.includes(q)
    );
  }, [localContacts, contactSearch]);

  const filteredCategories = useMemo(() => {
    if (!divisionSlug) return [];
    const div = divisions.find(d => d.slug === divisionSlug);
    if (!div) return [];
    return categories.filter(c => c.division_id === div.id);
  }, [divisionSlug, divisions, categories]);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files?.length) return;
    const f = files[0];
    const allowed = ["pdf", "jpg", "jpeg", "png", "psd", "cdr"];
    const ext = f.name.split(".").pop()?.toLowerCase() || "";
    if (!allowed.includes(ext)) {
      setError("Unsupported file type. Use PDF, JPG, PNG, PSD, or CDR.");
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setError("File is too large (" + Math.ceil(f.size / 1024 / 1024) + " MB). Maximum is 500 MB per file.");
      return;
    }
    setFile(f);
    setError("");
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));

    // Auto-generate cover
    if (isImageFile(ext)) {
      setThumbPreview(URL.createObjectURL(f));
      setThumbnailBlob(null); // image files use themselves as cover
    } else if (ext === "pdf") {
      setGeneratingThumb(true);
      setThumbPreview(null);
      setThumbnailBlob(null);
      const blob = await generatePdfThumbnail(f);
      if (blob) {
        setThumbnailBlob(blob);
        setThumbPreview(URL.createObjectURL(blob));
      } else {
        console.warn("[Catalogs] PDF thumbnail generation failed for:", f.name, f.size);
      }
      setGeneratingThumb(false);
    } else {
      setThumbPreview(null);
      setThumbnailBlob(null);
    }
  };

  const handleContactSelect = (c: ContactOption) => {
    setContactId(c.id);
    setContactSearch("");
    setShowContactDropdown(false);
    if (c.division && !divisionSlug) {
      const div = divisions.find(d => d.slug === c.division || d.name === c.division);
      if (div) setDivisionSlug(div.slug);
    }
    if (c.category && !categorySlug) {
      const cat = categories.find(ct => ct.slug === c.category || ct.name === c.category);
      if (cat) setCategorySlug(cat.slug);
    }
  };

  const handleSave = async () => {
    if (!editEntry && !file) { setError("Please select a file to upload."); return; }
    if (!title.trim()) { setError("Title is required."); return; }

    setSaving(true);
    setError("");
    setProgress("Uploading file...");

    try {
      const contact = contacts.find(c => c.id === contactId);
      const div = divisions.find(d => d.slug === divisionSlug);
      const cat = categories.find(c => c.slug === categorySlug);

      if (editEntry) {
        let fileUrl = editEntry.file_url;
        let filePath = editEntry.file_path;
        let fileName = editEntry.file_name;
        let fileType = editEntry.file_type;
        let fileSize = editEntry.file_size;

        if (file) {
          const result = await replaceCatalogFile(editEntry.file_path, file, (pct) => { setUploadPct(pct); setProgress(`Uploading... ${pct}%`); });
          if (!result) { setError("Failed to upload file."); setSaving(false); setProgress(""); return; }
          fileUrl = result.url;
          filePath = result.path;
          fileName = file.name;
          fileType = getFileType(file.name);
          fileSize = file.size;
        }

        // Auto cover + save + sync all in parallel
        setProgress("Saving...");
        let coverUrl = editEntry.cover_url;
        let coverPath = editEntry.cover_path;

        const coverPromise = (file && thumbnailBlob)
          ? uploadCatalogCover(editEntry.id, new window.File([thumbnailBlob], "cover.jpg", { type: "image/jpeg" }))
          : Promise.resolve(null);

        if (file && !thumbnailBlob && isImageFile(fileType)) {
          coverUrl = fileUrl;
          coverPath = null;
        }

        const coverResult = await coverPromise;
        if (coverResult) { coverUrl = coverResult.url; coverPath = coverResult.path; }

        // Save metadata + sync to contact in parallel
        const savePromises: Promise<unknown>[] = [
          updateCatalog(editEntry.id, {
            title: title.trim(),
            description: description.trim() || null,
            contact_id: contactId || null,
            contact_name: contact?.display_name || null,
            company_name_en: contact?.company_name_en || null,
            company_name_cn: contact?.company_name_cn || null,
            contact_type: contact?.contact_type || null,
            division_slug: divisionSlug || null,
            division_name: div?.name || null,
            category_slug: categorySlug || null,
            category_name: cat?.name || null,
            file_name: fileName,
            file_path: filePath,
            file_url: fileUrl,
            file_type: fileType,
            file_size: fileSize,
            cover_url: coverUrl,
            cover_path: coverPath,
          }),
        ];
        if (contactId) {
          savePromises.push(syncCatalogToContact(contactId, { name: fileName, url: fileUrl, type: fileType }));
        }
        if (editEntry.contact_id && editEntry.contact_id !== contactId) {
          savePromises.push(removeCatalogFromContact(editEntry.contact_id, editEntry.file_url));
        }
        await Promise.all(savePromises);
      } else {
        const uploaded = await uploadCatalogFile(file!, (pct) => { setUploadPct(pct); setProgress(`Uploading... ${pct}%`); });
        if (!uploaded) {
          setError("Failed to upload file.");
          setSaving(false); setProgress(""); return;
        }

        const ft = getFileType(file!.name);
        setProgress("Saving...");

        // Upload cover first (if generated), then create catalog with cover URL included
        let coverUrl: string | null = isImageFile(ft) ? uploaded.url : null;
        let coverPath: string | null = null;

        if (thumbnailBlob) {
          const coverResult = await uploadCatalogCover(uploaded.id, new window.File([thumbnailBlob], "cover.jpg", { type: "image/jpeg" }));
          if (coverResult) {
            coverUrl = coverResult.url;
            coverPath = coverResult.path;
          }
        }

        // Save metadata + sync in parallel
        const savePromises: Promise<unknown>[] = [
          createCatalog({
            title: title.trim(),
            description: description.trim() || null,
            contact_id: contactId || null,
            contact_name: contact?.display_name || null,
            company_name_en: contact?.company_name_en || null,
            company_name_cn: contact?.company_name_cn || null,
            contact_type: contact?.contact_type || null,
            division_slug: divisionSlug || null,
            division_name: div?.name || null,
            category_slug: categorySlug || null,
            category_name: cat?.name || null,
            file_name: file!.name,
            file_path: uploaded.path,
            file_url: uploaded.url,
            file_type: ft,
            file_size: file!.size,
            cover_url: coverUrl,
            cover_path: coverPath,
            tags: [],
          }),
        ];
        if (contactId) {
          savePromises.push(syncCatalogToContact(contactId, { name: file!.name, url: uploaded.url, type: ft }));
        }
        await Promise.all(savePromises);
      }

      setProgress("");
      setSaving(false);
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
      setError("Something went wrong.");
      setSaving(false);
    }
  };

  if (!open) return null;

  const inp = "w-full h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all";
  const lbl = "block text-[11px] font-semibold text-[var(--text-dim)] uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh] overflow-y-auto">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[560px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl mb-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2.5">
            <CatalogsIcon size={16} className="text-[var(--text-dim)]" />
            <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">
              {editEntry ? "Edit Catalog" : "Upload Catalog"}
            </h2>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            <CrossIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[12px] text-red-400">
              {error}
            </div>
          )}

          {/* File upload + auto thumbnail preview */}
          <div>
            <label className={lbl}>Catalog File *</label>
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.psd,.cdr" className="hidden"
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ""; }} />
            {file || editEntry ? (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                {/* Thumbnail preview */}
                <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface-bright)] flex items-center justify-center">
                  {thumbPreview ? (
                    <img src={thumbPreview} alt="" className="w-full h-full object-contain bg-white" />
                  ) : generatingThumb ? (
                    <SpinnerIcon className="h-4 w-4 animate-spin text-[var(--text-dim)]" />
                  ) : (
                    (() => { const Icon = (FILE_TYPE_CONFIG[getFileType(file?.name || editEntry?.file_name || "")]?.icon) || FileIcon; return <Icon className={`h-5 w-5 ${FILE_TYPE_CONFIG[getFileType(file?.name || editEntry?.file_name || "")]?.color || "text-zinc-400"}`} />; })()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {file?.name || editEntry?.file_name}
                  </p>
                  <p className="text-[10px] text-[var(--text-dim)]">
                    {formatFileSize(file?.size || editEntry?.file_size || 0)} &middot; {(FILE_TYPE_CONFIG[getFileType(file?.name || editEntry?.file_name || "")]?.label) || "FILE"}
                  </p>
                  {generatingThumb && <p className="text-[10px] text-blue-400/70 mt-0.5">Generating cover preview...</p>}
                </div>
                <button onClick={() => fileRef.current?.click()}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[11px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
                  Replace
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                className="w-full py-8 rounded-xl border-2 border-dashed border-[var(--border-subtle)] hover:border-blue-500/40 bg-[var(--bg-surface)] flex flex-col items-center gap-2 transition-all cursor-pointer group">
                <UploadIcon className="h-6 w-6 text-[var(--text-dim)] group-hover:text-blue-400 transition-colors" />
                <span className="text-[12px] text-[var(--text-dim)] group-hover:text-[var(--text-secondary)]">
                  Click to upload or drag file here
                </span>
                <span className="text-[10px] text-[var(--text-dim)]">PDF, JPG, PNG, PSD, CDR</span>
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label className={lbl}>Title *</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Catalog title" className={inp} />
          </div>

          {/* Supplier / Company */}
          <div ref={dropdownRef} className="relative">
            <label className={lbl}>Supplier / Company</label>
            {selectedContact ? (
              <div className="flex items-center gap-3 h-11 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                {selectedContact.photo_url ? (
                  <div className="shrink-0 w-6 h-6 rounded overflow-hidden bg-[var(--bg-surface-bright)]">
                    <img src={selectedContact.photo_url} alt="" className="w-full h-full object-contain" />
                  </div>
                ) : (
                  <Building2Icon className="h-3.5 w-3.5 text-[var(--text-dim)] shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-[13px] text-[var(--text-primary)] truncate block">
                    {selectedContact.company_name_en || selectedContact.display_name}
                  </span>
                  {selectedContact.company_name_cn && (
                    <span className="text-[10px] text-[var(--text-dim)] block truncate">{selectedContact.company_name_cn}</span>
                  )}
                </div>
                <span className="text-[9px] uppercase font-bold text-[var(--text-dim)] px-1.5 py-0.5 rounded bg-[var(--bg-surface-bright)]">
                  {selectedContact.contact_type}
                </span>
                <button onClick={() => setContactId("")} className="h-6 w-6 flex items-center justify-center rounded text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
                  <CrossIcon className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" />
                <input type="text" value={contactSearch}
                  onChange={(e) => { setContactSearch(e.target.value); setShowContactDropdown(true); }}
                  onFocus={() => setShowContactDropdown(true)}
                  placeholder="Search suppliers or companies..."
                  className={inp + " pl-9"} />
              </div>
            )}
            {showContactDropdown && !selectedContact && (
              <div className="absolute z-[60] left-0 right-0 top-full mt-1 max-h-[260px] overflow-y-auto rounded-xl bg-[#1a1a1a] border border-[#333] shadow-2xl shadow-black/50">
                {filteredContacts.length === 0 && !contactSearch ? (
                  <div className="px-4 py-6 text-center text-[11px] text-zinc-500">No suppliers or companies found.</div>
                ) : (
                  <>
                    {filteredContacts.map(c => (
                      <button key={c.id} onClick={() => handleContactSelect(c)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors text-left border-b border-[#2a2a2a] last:border-0">
                        <div className="shrink-0 w-8 h-8 rounded-lg bg-[#252525] border border-[#333] flex items-center justify-center overflow-hidden">
                          {c.photo_url ? (
                            <img src={c.photo_url} alt="" className="w-full h-full object-contain" />
                          ) : (
                            <Building2Icon className="h-3.5 w-3.5 text-zinc-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-zinc-200 truncate">
                            {c.company_name_en || c.display_name}
                          </p>
                          {c.company_name_cn && (
                            <p className="text-[10px] text-zinc-500 truncate">{c.company_name_cn}</p>
                          )}
                        </div>
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${c.contact_type === "supplier" ? "text-blue-400 bg-blue-500/15" : "text-emerald-400 bg-emerald-500/15"}`}>
                          {c.contact_type}
                        </span>
                      </button>
                    ))}
                    {contactSearch && filteredContacts.length === 0 && (
                      <div className="px-4 py-4 text-center text-[11px] text-zinc-500">No match found.</div>
                    )}
                  </>
                )}
                {/* Add new supplier button */}
                <button onClick={() => { setShowContactDropdown(false); setShowQuickAdd(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors text-left border-t border-[#333]">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <PlusIcon className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <span className="text-[12px] font-medium text-blue-400">Add new supplier / company</span>
                </button>
              </div>
            )}
          </div>

          {/* Division & Category with icons */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>Division</label>
              <div className="relative">
                <select value={divisionSlug} onChange={(e) => { setDivisionSlug(e.target.value); setCategorySlug(""); }}
                  className={inp + " appearance-none pr-9 cursor-pointer"}>
                  <option value="">Select division</option>
                  {divisions.map(d => <option key={d.id} value={d.slug}>{d.name}</option>)}
                </select>
                <AngleDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)] pointer-events-none" />
              </div>
              {divisionSlug && (() => {
                const DivIcon = getDivisionIcon(divisionSlug);
                const logo = divLogos[divisionSlug];
                if (!DivIcon && !logo) return null;
                return (
                  <div className="flex items-center gap-2 mt-1.5 px-1">
                    {DivIcon ? <DivIcon className="w-4 h-4 text-[var(--text-dim)]" /> : <img src={logo} alt="" className="w-4 h-4 object-contain" />}
                    <span className="text-[10px] text-[var(--text-dim)]">{divisions.find(d => d.slug === divisionSlug)?.name}</span>
                  </div>
                );
              })()}
            </div>
            <div>
              <label className={lbl}>Category</label>
              <div className="relative">
                <select value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}
                  className={inp + " appearance-none pr-9 cursor-pointer"} disabled={!divisionSlug}>
                  <option value="">Select category</option>
                  {filteredCategories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
                </select>
                <AngleDownIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)] pointer-events-none" />
              </div>
              {categorySlug && catLogos[categorySlug] && (
                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <img src={catLogos[categorySlug]} alt="" className="w-4 h-4 object-contain" />
                  <span className="text-[10px] text-[var(--text-dim)]">{categories.find(c => c.slug === categorySlug)?.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className={lbl}>Description <span className="font-normal normal-case">(optional)</span></label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this catalog"
              rows={2} className={inp + " h-auto py-3 resize-none"} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)]">
          {saving && uploadPct > 0 && uploadPct < 100 && (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[var(--text-dim)]">{progress}</span>
                <span className="text-[11px] font-semibold text-[var(--text-primary)]">{uploadPct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                <div className="h-full rounded-full bg-blue-500 transition-all duration-300 ease-out" style={{ width: `${uploadPct}%` }} />
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose}
              className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || (!file && !editEntry) || !title.trim()}
              className="h-10 px-6 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-all disabled:opacity-40">
              {saving && <SpinnerIcon className="h-4 w-4 animate-spin" />}
              {saving ? (progress || "Uploading...") : editEntry ? "Save Changes" : "Upload"}
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Supplier / Company */}
      <QuickAddContactModal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        onCreated={(newContact) => {
          setLocalContacts(prev => [newContact, ...prev]);
          setContactId(newContact.id);
          setContactSearch("");
        }}
      />
    </div>
  );
}

/* ═══════════════════════════
   ── Delete Confirm Modal ──
   ═══════════════════════════ */
function DeleteModal({ open, onClose, catalog, onConfirm, deleting }: {
  open: boolean;
  onClose: () => void;
  catalog: CatalogEntry | null;
  onConfirm: () => void;
  deleting: boolean;
}) {
  if (!open || !catalog) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-[400px] bg-[var(--bg-primary)] rounded-2xl border border-[var(--border-subtle)] shadow-2xl">
        <div className="px-6 py-5">
          <h2 className="text-[15px] font-semibold text-[var(--text-primary)] mb-2">Delete Catalog</h2>
          <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed">
            Delete &ldquo;{catalog.title}&rdquo;? The file will be permanently removed.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <button onClick={onClose}
            className="h-10 px-5 rounded-xl text-[13px] font-medium text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="h-10 px-6 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-[13px] font-semibold hover:bg-red-500/30 transition-all disabled:opacity-40 relative overflow-hidden whitespace-nowrap">
            <span className={`inline-flex items-center gap-2 transition-opacity duration-150 ${deleting ? "opacity-0" : "opacity-100"}`}>
              <TrashIcon className="h-3.5 w-3.5 shrink-0" />
              <span>Delete</span>
            </span>
            <span className={`absolute inset-0 inline-flex items-center justify-center gap-2 transition-opacity duration-150 ${deleting ? "opacity-100" : "opacity-0"}`}>
              <SpinnerIcon className="h-4 w-4 animate-spin shrink-0" />
              <span>Deleting...</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════
   ── Catalog Card ──
   ═══════════════════════════ */
function CatalogCard({ catalog, divLogos, catLogos, onPreview, onEdit, onDelete }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const coverUrl = catalog.cover_url || (isImageFile(catalog.file_type) ? catalog.file_url : null);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = catalog.file_url;
    a.download = catalog.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="group relative flex flex-col rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden hover:border-[var(--text-dim)] transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5">
      {/* Cover area */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {coverUrl ? (
          <img src={coverUrl} alt={catalog.title}
            className="w-full h-full object-contain bg-white transition-transform duration-300 group-hover:scale-[1.02]" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${ft.bgFrom} ${ft.bgTo} flex flex-col items-center justify-center gap-3 p-4`}>
            <Icon className={`h-12 w-12 ${ft.color} opacity-60`} />
            <span className={`text-[24px] font-black ${ft.color} opacity-40 tracking-wider`}>{ft.label}</span>
            <p className="text-[11px] text-white/30 text-center truncate max-w-full px-2">{catalog.file_name}</p>
          </div>
        )}

        {/* File type badge */}
        <div className={`absolute top-2.5 right-2.5 h-6 px-2 rounded-md ${ft.color} bg-black/60 backdrop-blur-md text-[10px] font-bold flex items-center gap-1`}>
          <Icon className="h-3 w-3" />{ft.label}
        </div>

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <button onClick={onPreview} title="Preview"
            className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
            <EyeIcon className="h-4.5 w-4.5" />
          </button>
          <button onClick={handleDownload} title="Download"
            className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
            <DownloadIcon className="h-4.5 w-4.5" />
          </button>
          <button onClick={onEdit} title="Edit"
            className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-md border border-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors">
            <PencilIcon className="h-4 w-4" />
          </button>
          <button onClick={onDelete} title="Delete"
            className="h-10 w-10 rounded-xl bg-red-500/30 backdrop-blur-md border border-red-500/30 text-red-300 flex items-center justify-center hover:bg-red-500/40 transition-colors">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-3.5 flex flex-col gap-1.5">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] leading-tight line-clamp-2">
          {catalog.title}
        </h3>
        {(catalog.company_name_en || catalog.contact_name) && (
          <div className="flex flex-col">
            <p className="text-[11px] text-[var(--text-secondary)] truncate">
              {catalog.company_name_en || catalog.contact_name}
            </p>
            {catalog.company_name_cn && (
              <p className="text-[11px] text-[var(--text-dim)] truncate">{catalog.company_name_cn}</p>
            )}
          </div>
        )}

        {/* Division / Category with icons */}
        {(catalog.division_name || catalog.category_name) && (
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {catalog.division_name && catalog.division_slug && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-[var(--bg-surface-bright)] text-[9px] font-semibold text-[var(--text-dim)] uppercase tracking-wide">
                {(() => {
                  const DivIcon = getDivisionIcon(catalog.division_slug);
                  if (DivIcon) return <DivIcon className="w-3 h-3" />;
                  if (divLogos[catalog.division_slug]) return <img src={divLogos[catalog.division_slug]} alt="" className="w-3 h-3 object-contain" />;
                  return null;
                })()}
                {catalog.division_name}
              </span>
            )}
            {catalog.category_name && catalog.category_slug && (
              <span className="inline-flex items-center gap-1 h-5 px-2 rounded-md bg-blue-500/10 text-[9px] font-semibold text-blue-400/70 tracking-wide">
                {catLogos[catalog.category_slug] && (
                  <img src={catLogos[catalog.category_slug]} alt="" className="w-3 h-3 object-contain" />
                )}
                {catalog.category_name}
              </span>
            )}
          </div>
        )}

        <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{formatFileSize(catalog.file_size)}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════
   ── List Row ──
   ═══════════════════════════ */
function CatalogRow({ catalog, divLogos, catLogos, onPreview, onEdit, onDelete }: {
  catalog: CatalogEntry;
  divLogos: Record<string, string>;
  catLogos: Record<string, string>;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const ft = FILE_TYPE_CONFIG[catalog.file_type] || DEFAULT_FT;
  const Icon = ft.icon;
  const coverUrl = catalog.cover_url || (isImageFile(catalog.file_type) ? catalog.file_url : null);

  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = catalog.file_url;
    a.download = catalog.file_name;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="group flex items-center gap-4 px-4 py-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--text-dim)] transition-all">
      <div className="shrink-0 w-12 h-16 rounded-lg overflow-hidden border border-[var(--border-subtle)]">
        {coverUrl ? (
          <img src={coverUrl} alt="" className="w-full h-full object-contain bg-white" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${ft.bgFrom} ${ft.bgTo} flex items-center justify-center`}>
            <Icon className={`h-5 w-5 ${ft.color} opacity-60`} />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{catalog.title}</h3>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {(catalog.company_name_en || catalog.contact_name) && (
            <span className="text-[11px] text-[var(--text-secondary)] truncate max-w-[200px]">
              {catalog.company_name_en || catalog.contact_name}
              {catalog.company_name_cn && <span className="text-[var(--text-dim)]"> ({catalog.company_name_cn})</span>}
            </span>
          )}
          {catalog.division_name && catalog.division_slug && (
            <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded bg-[var(--bg-surface-bright)] text-[9px] font-semibold text-[var(--text-dim)]">
              {(() => {
                const DivIcon = getDivisionIcon(catalog.division_slug);
                if (DivIcon) return <DivIcon className="w-2.5 h-2.5" />;
                if (divLogos[catalog.division_slug]) return <img src={divLogos[catalog.division_slug]} alt="" className="w-2.5 h-2.5 object-contain" />;
                return null;
              })()}
              {catalog.division_name}
            </span>
          )}
          {catalog.category_name && catalog.category_slug && (
            <span className="inline-flex items-center gap-1 h-4 px-1.5 rounded bg-blue-500/10 text-[9px] font-semibold text-blue-400/70">
              {catLogos[catalog.category_slug] && <img src={catLogos[catalog.category_slug]} alt="" className="w-2.5 h-2.5 object-contain" />}
              {catalog.category_name}
            </span>
          )}
        </div>
        <p className="text-[10px] text-[var(--text-dim)] mt-0.5">{ft.label} &middot; {formatFileSize(catalog.file_size)}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onPreview} title="Preview" className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><EyeIcon className="h-3.5 w-3.5" /></button>
        <button onClick={handleDownload} title="Download" className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><DownloadIcon className="h-3.5 w-3.5" /></button>
        <button onClick={onEdit} title="Edit" className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"><PencilIcon className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} title="Delete" className="h-8 w-8 flex items-center justify-center rounded-lg text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/[0.06] transition-colors"><TrashIcon className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════
   ── MAIN PAGE ──
   ═══════════════════════════════ */
export default function CatalogsPage() {
  const [catalogs, setCatalogs] = useState<CatalogEntry[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [divLogos, setDivLogos] = useState<Record<string, string>>({});
  const [catLogos, setCatLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const [search, setSearch] = useState("");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterDivision, setFilterDivision] = useState("all");
  const [filterType, setFilterType] = useState("all");

  const [uploadModal, setUploadModal] = useState<{ open: boolean; editEntry: CatalogEntry | null }>({ open: false, editEntry: null });
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; catalog: CatalogEntry | null }>({ open: false, catalog: null });
  const [deleting, setDeleting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [cats, conts, divs, catgs, dLogos, cLogos] = await Promise.all([
      fetchCatalogs(),
      fetchCatalogContacts(),
      fetchDivisions(),
      fetchCategories(),
      fetchDivisionLogos(),
      fetchCategoryLogos(),
    ]);
    setCatalogs(cats);
    setContacts(conts);
    setDivisions(divs);
    setCategories(catgs);
    setDivLogos(dLogos);
    setCatLogos(cLogos);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const filtered = useMemo(() => {
    let result = [...catalogs];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.company_name_en?.toLowerCase().includes(q) ||
        c.company_name_cn?.includes(q) ||
        c.contact_name?.toLowerCase().includes(q) ||
        c.file_name.toLowerCase().includes(q)
      );
    }
    if (filterSupplier !== "all") result = result.filter(c => c.contact_id === filterSupplier);
    if (filterDivision !== "all") result = result.filter(c => c.division_slug === filterDivision);
    if (filterType !== "all") result = result.filter(c => c.file_type === filterType);
    return result;
  }, [catalogs, search, filterSupplier, filterDivision, filterType]);

  const catalogSuppliers = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    catalogs.forEach(c => {
      if (c.contact_id && c.contact_name) map.set(c.contact_id, { id: c.contact_id, name: c.company_name_en || c.contact_name });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogs]);

  const catalogTypes = useMemo(() => [...new Set(catalogs.map(c => c.file_type))].sort(), [catalogs]);

  const catalogDivisions = useMemo(() => {
    const map = new Map<string, string>();
    catalogs.forEach(c => { if (c.division_slug && c.division_name) map.set(c.division_slug, c.division_name); });
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [catalogs]);

  const totalSize = useMemo(() => catalogs.reduce((s, c) => s + c.file_size, 0), [catalogs]);

  const handlePreview = (catalog: CatalogEntry) => {
    window.open(catalog.file_url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async () => {
    if (!deleteModal.catalog) return;
    setDeleting(true);
    const cat = deleteModal.catalog;
    await deleteCatalog(cat.id);
    // Remove from supplier/company contact
    if (cat.contact_id) {
      removeCatalogFromContact(cat.contact_id, cat.file_url);
    }
    setDeleting(false);
    setDeleteModal({ open: false, catalog: null });
    loadAll();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link href="/products" className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <CatalogsIcon size={16} />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight">Catalogs</h1>
          </div>
        </div>
        <p className="text-[12px] md:text-[13px] text-[var(--text-dim)] mb-6 md:mb-8 ml-11">Manage supplier and company catalogs</p>

        {/* Stats */}
        <div className="flex flex-wrap gap-2 mb-5">
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <CatalogsIcon size={12} className="text-[var(--text-dim)]" />
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{catalogs.length}</span>
            <span className="text-[11px] text-[var(--text-dim)]">catalogs</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <Building2Icon className="h-3 w-3 text-[var(--text-dim)]" />
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{catalogSuppliers.length}</span>
            <span className="text-[11px] text-[var(--text-dim)]">suppliers</span>
          </div>
          <div className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <span className="text-[16px] font-bold text-[var(--text-primary)] tabular-nums">{formatFileSize(totalSize)}</span>
            <span className="text-[11px] text-[var(--text-dim)]">total</span>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-dim)]" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search catalogs..."
              className="w-full h-9 pl-9 pr-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-blue-500/50 transition-colors" />
          </div>

          {catalogSuppliers.length > 0 && (
            <div className="relative">
              <select value={filterSupplier} onChange={(e) => setFilterSupplier(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">All Suppliers</option>
                {catalogSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          {catalogDivisions.length > 0 && (
            <div className="relative">
              <select value={filterDivision} onChange={(e) => setFilterDivision(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">All Divisions</option>
                {catalogDivisions.map(d => <option key={d.slug} value={d.slug}>{d.name}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          {catalogTypes.length > 1 && (
            <div className="relative">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                className="h-9 pl-3 pr-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] appearance-none cursor-pointer outline-none focus:border-blue-500/50">
                <option value="all">All Types</option>
                {catalogTypes.map(t => <option key={t} value={t}>{(FILE_TYPE_CONFIG[t]?.label || t).toUpperCase()}</option>)}
              </select>
              <AngleDownIcon className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[var(--text-dim)] pointer-events-none" />
            </div>
          )}

          <div className="flex items-center h-9 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] overflow-hidden">
            <button onClick={() => setViewMode("grid")} className={`h-full px-2.5 flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
              <LayoutGridIcon className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => setViewMode("list")} className={`h-full px-2.5 flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]" : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"}`}>
              <ListIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          <button onClick={() => setUploadModal({ open: true, editEntry: null })}
            className="h-9 px-4 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 hover:opacity-90 transition-colors shrink-0 ml-auto">
            <PlusIcon className="h-3.5 w-3.5" /> Upload Catalog
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><SpinnerIcon className="h-5 w-5 animate-spin text-[var(--text-dim)]" /></div>
        ) : catalogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-[var(--border-subtle)] rounded-2xl">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-surface)] flex items-center justify-center mb-4">
              <CatalogsIcon size={28} className="text-[var(--text-dim)]" />
            </div>
            <h3 className="text-[15px] font-semibold text-[var(--text-secondary)] mb-1">No catalogs yet</h3>
            <p className="text-[12px] text-[var(--text-dim)] mb-5">Upload your first supplier catalog to get started.</p>
            <button onClick={() => setUploadModal({ open: true, editEntry: null })}
              className="h-10 px-5 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center gap-2 hover:opacity-90 transition-colors">
              <UploadIcon className="h-4 w-4" /> Upload Catalog
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[var(--border-subtle)] rounded-xl">
            <p className="text-[13px] text-[var(--text-dim)]">No catalogs match your filters.</p>
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-5">
            {filtered.map(catalog => (
              <CatalogCard key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                onPreview={() => handlePreview(catalog)}
                onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                onDelete={() => setDeleteModal({ open: true, catalog })} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map(catalog => (
              <CatalogRow key={catalog.id} catalog={catalog} divLogos={divLogos} catLogos={catLogos}
                onPreview={() => handlePreview(catalog)}
                onEdit={() => setUploadModal({ open: true, editEntry: catalog })}
                onDelete={() => setDeleteModal({ open: true, catalog })} />
            ))}
          </div>
        )}

        {/* Bottom nav */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/products" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Products</Link>
          <Link href="/suppliers" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Suppliers</Link>
          <Link href="/contacts" className="h-9 px-4 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-dim)] hover:text-[var(--text-secondary)] flex items-center gap-1.5 transition-colors">Contacts</Link>
        </div>
      </div>

      {/* Modals */}
      <CatalogModal
        open={uploadModal.open}
        onClose={() => setUploadModal({ open: false, editEntry: null })}
        editEntry={uploadModal.editEntry}
        contacts={contacts}
        divisions={divisions}
        categories={categories}
        divLogos={divLogos}
        catLogos={catLogos}
        onSave={loadAll}
      />

      <DeleteModal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, catalog: null })}
        catalog={deleteModal.catalog}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </div>
  );
}
