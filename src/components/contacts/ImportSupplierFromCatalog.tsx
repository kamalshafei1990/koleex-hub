"use client";

/* ---------------------------------------------------------------------------
   ImportSupplierFromCatalog — upload a supplier PDF catalog, auto-extract the
   company identity + brand + full contact info, pick the logo from the cover
   images, review/edit, then create the supplier AND file the catalog into the
   Catalogs app (linked via contact_id).

   Pipeline:
     1. Browser reads the PDF (text + OCR fallback) and pulls cover images
        (src/lib/catalog-client.ts).
     2. POST /api/suppliers/import-catalog → AI structures it into a draft.
     3. User reviews/edits the draft and picks a logo.
     4. Upload logo → createContact() → uploadCatalogFile() + createCatalog().

   Brand: monochrome surfaces, blue (#0066FF) only for functional accents.
   Only columns proven to exist on `contacts` (see formToRow) are written, and
   the create falls back to a minimal core payload if the rich one is rejected.
   --------------------------------------------------------------------------- */

import { useCallback, useRef, useState } from "react";
import { extractCatalogText, extractCoverImages, renderCoverPages, type CoverImage } from "@/lib/catalog-client";
import { createContact } from "@/lib/contacts-admin";
import { uploadCatalogFile, createCatalog } from "@/lib/catalogs-admin";
import { uploadToStorage } from "@/lib/storage-client";
import type { SupplierDraft } from "@/lib/server/catalog-extract";
import type { ContactForm } from "@/components/contacts/Contacts";

const ACCENT = "#0066FF";

type Phase = "pick" | "reading" | "review" | "creating" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated?: (supplierId: string) => void;
}

const EMPTY: SupplierDraft = {
  company_name_en: null, company_name_cn: null,
  brand_en: null, brand_cn: null,
  website: null, email: null,
  mobile: null, tel: null, fax: null,
  wechat: null, qq: null,
  address: null, postal_code: null,
  year_established: null, business_type: null,
  main_products: [],
  contact_persons: [],
  confidence: "low", notes: null,
};

export default function ImportSupplierFromCatalog({ open, onClose, onCreated }: Props) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState("");
  const [usedOcr, setUsedOcr] = useState(false);
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY);
  const [logos, setLogos] = useState<CoverImage[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  /** Manually-uploaded logo data URLs (added to the picker alongside detected). */
  const [manualLogos, setManualLogos] = useState<string[]>([]);
  /** Rendered cover pages, for cropping a logo out of vector/scanned covers. */
  const [coverPages, setCoverPages] = useState<string[]>([]);
  /** Images currently open in the square cropper (cover pages OR an upload). */
  const [cropImages, setCropImages] = useState<string[]>([]);
  const cropOpen = cropImages.length > 0;

  // Uploading a screenshot/logo opens the SAME square cropper so the result is
  // always a clean square logo.
  const onPickLogo = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || "");
      if (url) setCropImages([url]);
    };
    reader.readAsDataURL(f);
    e.target.value = "";
  }, []);

  const reset = useCallback(() => {
    setPhase("pick"); setFile(null); setProgress(""); setUsedOcr(false);
    setDraft(EMPTY); setLogos([]); setLogo(null); setManualLogos([]); setCoverPages([]); setCropImages([]); setError(null); setCreatedId(null);
  }, []);

  const close = useCallback(() => { reset(); onClose(); }, [reset, onClose]);

  const analyze = useCallback(async (f: File) => {
    setFile(f); setError(null); setPhase("reading"); setProgress("Reading PDF…");
    // Cover images + rendered cover pages load in parallel with the text.
    extractCoverImages(f).then(setLogos).catch(() => setLogos([]));
    renderCoverPages(f, 2).then(setCoverPages).catch(() => setCoverPages([]));
    try {
      const { text, usedOcr: ocr } = await extractCatalogText(f, setProgress);
      setUsedOcr(ocr);
      setProgress("Extracting supplier details…");
      const res = await fetch("/api/suppliers/import-catalog", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: f.name }),
      });
      const j = (await res.json().catch(() => ({}))) as { draft?: SupplierDraft; error?: string };
      if (!res.ok || !j.draft) {
        setError(j.error || "Couldn't auto-read this catalog. Fill the details in manually.");
        setDraft(EMPTY);
      } else {
        setDraft({ ...EMPTY, ...j.draft });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read the PDF. Fill the details in manually.");
      setDraft(EMPTY);
    }
    setPhase("review");
  }, []);

  const onPick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void analyze(f);
  }, [analyze]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.type === "application/pdf") void analyze(f);
  }, [analyze]);

  const uploadLogo = useCallback(async (dataUrl: string): Promise<string | null> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const id = crypto.randomUUID();
      const res = await uploadToStorage("media", `suppliers/logos/${id}.png`, blob, {
        contentType: "image/png", upsert: true,
      });
      return res.ok ? res.data.publicUrl : null;
    } catch { return null; }
  }, []);

  const create = useCallback(async () => {
    if (!file) return;
    const nameEn = (draft.company_name_en || "").trim();
    const nameCn = (draft.company_name_cn || "").trim();
    const displayName = nameEn || nameCn || file.name.replace(/\.pdf$/i, "");
    if (!nameEn && !nameCn) { setError("Add at least the English or Chinese company name before creating."); return; }
    setError(null); setPhase("creating"); setProgress("Preparing…");

    let logoUrl: string | null = null;
    if (logo) { setProgress("Uploading logo…"); logoUrl = await uploadLogo(logo); }

    setProgress("Creating supplier…");
    // Build the supplier with the SAME mapper the manual "New Supplier" form
    // uses (formToRow over EMPTY_FORM), so an imported supplier is identical in
    // shape to a hand-entered one — Company Profile, Contact Data and Contact
    // Persons all land in the exact same fields/format.
    const { EMPTY_FORM, formToRow } = await import("@/components/contacts/Contacts");
    const brands = [draft.brand_cn, draft.brand_en].map((b) => (b || "").trim()).filter(Boolean);
    const persons = draft.contact_persons.map((p, i) => ({
      name: (p.full_name || "").trim(),
      name_cn: "",
      position: (p.role || "").trim(),
      department: "",
      phone: "",
      mobile: (p.mobile || "").trim(),
      email: (p.email || "").trim(),
      notes: "",
      wechat_id: (p.wechat || "").trim(),
      is_primary: i === 0,
    }));
    const form: ContactForm = {
      ...EMPTY_FORM,
      contact_type: "supplier",
      entity_type: "company",
      company_name_en: nameEn,
      company_name_cn: nameCn,
      brand_names: brands,
      supplier_type: draft.business_type || "",
      year_established: draft.year_established || "",
      product_categories: draft.main_products,
      supplier_email: draft.email || "",
      supplier_tel: draft.tel || "",
      supplier_mobile: draft.mobile || "",
      supplier_website: draft.website || "",
      supplier_address: draft.address || "",
      supplier_postal_code: draft.postal_code || "",
      wechat_id: draft.wechat || "",
      messaging_channels: draft.qq
        ? [...EMPTY_FORM.messaging_channels, { platform: "QQ", value: draft.qq }]
        : EMPTY_FORM.messaging_channels,
      contact_persons: persons as ContactForm["contact_persons"],
      photo_url: logoUrl || "",
      notes: draft.fax ? `Fax: ${draft.fax}` : EMPTY_FORM.notes,
    };

    let { data, error: cErr } = await createContact(formToRow(form));
    if (!data?.id) {
      // supplier_type may carry a CHECK/enum constraint; retry once without it
      // so a bad value never costs the whole import.
      ({ data, error: cErr } = await createContact(formToRow({ ...form, supplier_type: "" })));
    }
    if (!data?.id) { setError(cErr || "Failed to create the supplier."); setPhase("review"); return; }

    const supplierId = data.id;
    setCreatedId(supplierId);

    // File the catalog (best-effort — the supplier exists regardless).
    try {
      setProgress("Filing the catalog…");
      const up = await uploadCatalogFile(file);
      if (up) {
        await createCatalog({
          title: displayName, title_cn: nameCn || null, description: null,
          contact_id: supplierId, contact_name: displayName,
          company_name_en: nameEn || null, company_name_cn: nameCn || null,
          contact_type: "supplier", contact_photo_url: logoUrl,
          division_slug: null, division_name: null, category_slug: null, category_name: null,
          file_name: file.name, file_path: up.path, file_url: up.url,
          file_type: file.type || "application/pdf", file_size: file.size,
          cover_url: null, cover_path: null, tags: ["supplier-catalog"],
        });
      }
    } catch { /* non-fatal */ }

    setProgress(""); setPhase("done"); onCreated?.(supplierId);
  }, [file, draft, logo, uploadLogo, onCreated]);

  if (!open) return null;
  const set = (patch: Partial<SupplierDraft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => { if (e.target === e.currentTarget && phase !== "creating") close(); }}
    >
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{ background: "var(--bg-card, #fff)", border: "1px solid var(--border-subtle, #e0e0e0)", color: "var(--text-primary, #111)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: "var(--bg-card, #fff)", borderBottom: "1px solid var(--border-subtle, #e0e0e0)" }}>
          <div>
            <h2 className="text-[15px] font-semibold">Import supplier from catalog</h2>
            <p className="text-[12px]" style={{ color: "var(--text-dim, #888)" }}>
              Upload a PDF — we read the company, brand, logo &amp; contacts.
            </p>
          </div>
          <button onClick={close} disabled={phase === "creating"}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:opacity-70 disabled:opacity-40"
            style={{ border: "1px solid var(--border-subtle, #e0e0e0)" }} aria-label="Close">
            <span className="text-[18px] leading-none">×</span>
          </button>
        </div>

        <div className="p-5">
          {/* ── Pick ── */}
          {phase === "pick" && (
            <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-xl px-6 py-12 text-center transition-colors"
              style={{ border: "1.5px dashed var(--border-subtle, #ccc)" }}>
              <div className="text-[14px] font-medium">Drop a PDF catalog here</div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--text-dim, #888)" }}>or click to choose a file</div>
              <div className="mt-3 text-[11px]" style={{ color: "var(--text-dim, #999)" }}>
                Scanned catalogs are read with on-device OCR (English + 中文).
              </div>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={onPick} />
            </div>
          )}

          {/* ── Reading ── */}
          {phase === "reading" && (
            <div className="py-12 text-center">
              <Spinner />
              <div className="mt-4 text-[13px] font-medium">{progress || "Working…"}</div>
              {usedOcr && <div className="mt-1 text-[11px]" style={{ color: "var(--text-dim, #999)" }}>First OCR run downloads the language model — this can take a moment.</div>}
            </div>
          )}

          {/* ── Review ── */}
          {phase === "review" && (
            <div className="space-y-4">
              {error && (
                <div className="rounded-lg px-3 py-2 text-[12px]"
                  style={{ background: "rgba(255,51,51,0.10)", color: "#cc2b2b", border: "1px solid rgba(255,51,51,0.25)" }}>{error}</div>
              )}
              {!error && (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-dim, #888)" }}>
                  <ConfidenceDot level={draft.confidence} />
                  {usedOcr ? "Read via OCR" : "Read from text"} · confidence {draft.confidence}. Review before creating.
                </div>
              )}

              {/* Logo picker */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: "var(--text-dim, #888)" }}>
                  Logo <span className="font-normal lowercase">— {logos.length > 0 ? "pick one from the cover, or upload" : "none auto-detected — upload one"}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setLogo(null)}
                    className="h-16 w-16 rounded-lg text-[11px] flex items-center justify-center"
                    style={{ border: `2px solid ${logo === null ? ACCENT : "var(--border-subtle, #e0e0e0)"}`, color: "var(--text-dim, #888)" }}>
                    None
                  </button>
                  {[...manualLogos, ...logos.map((c) => c.dataUrl)].map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt={`logo ${i + 1}`} onClick={() => setLogo(src)}
                      className="h-16 w-16 rounded-lg object-contain cursor-pointer bg-white p-1"
                      style={{ border: `2px solid ${logo === src ? ACCENT : "var(--border-subtle, #e0e0e0)"}` }} />
                  ))}
                  <button onClick={() => logoInputRef.current?.click()}
                    className="h-16 w-16 rounded-lg text-[11px] flex flex-col items-center justify-center gap-0.5"
                    style={{ border: "2px dashed var(--border-subtle, #ccc)", color: "var(--text-dim, #888)" }}>
                    <span className="text-[16px] leading-none">+</span>Upload
                  </button>
                  {coverPages.length > 0 && (
                    <button onClick={() => setCropImages(coverPages)}
                      className="h-16 w-16 rounded-lg text-[10px] leading-tight px-1 flex flex-col items-center justify-center gap-0.5"
                      style={{ border: "2px dashed var(--border-subtle, #ccc)", color: "var(--text-dim, #888)" }}>
                      <span className="text-[15px] leading-none">✂</span>Crop from cover
                    </button>
                  )}
                  <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={onPickLogo} />
                </div>
              </div>

              {/* Identity */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Company (English)" value={draft.company_name_en} onChange={(v) => set({ company_name_en: v })} />
                <Field label="Company (中文)" value={draft.company_name_cn} onChange={(v) => set({ company_name_cn: v })} />
                <Field label="Brand (Latin)" value={draft.brand_en} onChange={(v) => set({ brand_en: v })} />
                <Field label="Brand (中文)" value={draft.brand_cn} onChange={(v) => set({ brand_cn: v })} />
                <Field label="Business type" value={draft.business_type} onChange={(v) => set({ business_type: v })} />
                <Field label="Year established" value={draft.year_established} onChange={(v) => set({ year_established: v })} />
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Website" value={draft.website} onChange={(v) => set({ website: v })} />
                <Field label="Email" value={draft.email} onChange={(v) => set({ email: v })} />
                <Field label="Mobile" value={draft.mobile} onChange={(v) => set({ mobile: v })} />
                <Field label="Landline (Tel)" value={draft.tel} onChange={(v) => set({ tel: v })} />
                <Field label="Fax" value={draft.fax} onChange={(v) => set({ fax: v })} />
                <Field label="WeChat" value={draft.wechat} onChange={(v) => set({ wechat: v })} />
                <Field label="QQ" value={draft.qq} onChange={(v) => set({ qq: v })} />
                <Field label="Postal code" value={draft.postal_code} onChange={(v) => set({ postal_code: v })} />
                <div className="col-span-2">
                  <Field label="Address" value={draft.address} onChange={(v) => set({ address: v })} />
                </div>
                <div className="col-span-2">
                  <Field label="Main products (comma-separated)"
                    value={draft.main_products.join(", ")}
                    onChange={(v) => set({ main_products: (v || "").split(",").map((s) => s.trim()).filter(Boolean) })} />
                </div>
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim, #888)" }}>Contact persons</label>
                  <button onClick={() => set({ contact_persons: [...draft.contact_persons, { full_name: "", role: "", email: "", mobile: "", wechat: "" }] })}
                    className="text-[12px] font-medium" style={{ color: ACCENT }}>+ Add</button>
                </div>
                <div className="space-y-2">
                  {draft.contact_persons.length === 0 && <div className="text-[12px]" style={{ color: "var(--text-dim, #999)" }}>None detected.</div>}
                  {draft.contact_persons.map((p, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 rounded-lg p-2" style={{ border: "1px solid var(--border-subtle, #eee)" }}>
                      <MiniInput placeholder="Name" value={p.full_name} onChange={(v) => updatePerson(setDraft, i, { full_name: v })} />
                      <MiniInput placeholder="Role" value={p.role} onChange={(v) => updatePerson(setDraft, i, { role: v })} />
                      <MiniInput placeholder="Email" value={p.email} onChange={(v) => updatePerson(setDraft, i, { email: v })} />
                      <MiniInput placeholder="Mobile" value={p.mobile} onChange={(v) => updatePerson(setDraft, i, { mobile: v })} />
                      <MiniInput placeholder="WeChat" value={p.wechat} onChange={(v) => updatePerson(setDraft, i, { wechat: v })} />
                      <button onClick={() => set({ contact_persons: draft.contact_persons.filter((_, j) => j !== i) })}
                        className="text-left text-[11px] hover:opacity-70 self-center" style={{ color: "var(--text-dim, #999)" }}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={close} className="px-3 py-2 text-[13px] rounded-lg hover:opacity-70" style={{ color: "var(--text-dim, #888)" }}>Cancel</button>
                <button onClick={() => void create()} className="px-4 py-2 text-[13px] font-semibold rounded-lg"
                  style={{ background: "var(--bg-inverted, #111)", color: "var(--text-inverted, #fff)" }}>Create supplier</button>
              </div>
            </div>
          )}

          {/* ── Creating ── */}
          {phase === "creating" && (
            <div className="py-12 text-center">
              <Spinner />
              <div className="mt-4 text-[13px] font-medium">{progress || "Creating…"}</div>
            </div>
          )}

          {/* ── Done ── */}
          {phase === "done" && (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,204,102,0.12)", color: "#0a8a4a" }}><span className="text-[22px] leading-none">✓</span></div>
              <div className="text-[14px] font-semibold">Supplier created</div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--text-dim, #888)" }}>The catalog was filed under this supplier and in the Catalogs app.</div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button onClick={() => { if (createdId) onCreated?.(createdId); close(); }}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg" style={{ background: "var(--bg-inverted, #111)", color: "var(--text-inverted, #fff)" }}>Open supplier</button>
                <button onClick={reset} className="px-3 py-2 text-[13px] rounded-lg hover:opacity-70" style={{ color: "var(--text-dim, #888)" }}>Import another</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {cropOpen && (
        <CropOverlay
          images={cropImages}
          onCancel={() => setCropImages([])}
          onCrop={(dataUrl) => { setManualLogos((m) => [dataUrl, ...m]); setLogo(dataUrl); setCropImages([]); }}
        />
      )}
    </div>
  );
}

/* ── square logo cropper (cover page OR uploaded screenshot) ──
   The selection is LOCKED to a square — you can move it and resize it (drag the
   corner handle) but it always stays 1:1, so the saved logo is always square. */
function CropOverlay({ images, onCancel, onCrop }: { images: string[]; onCancel: () => void; onCrop: (dataUrl: string) => void }) {
  const [page, setPage] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [disp, setDisp] = useState<{ w: number; h: number } | null>(null);
  const [sel, setSel] = useState<{ x: number; y: number; size: number } | null>(null);
  const mode = useRef<null | { type: "move" | "resize"; px: number; py: number; ox: number; oy: number; os: number }>(null);

  // Center a square (~70% of the shorter side) once the image lays out.
  const initSquare = (w: number, h: number) => {
    const size = Math.round(Math.min(w, h) * 0.7);
    setDisp({ w, h });
    setSel({ x: Math.round((w - size) / 2), y: Math.round((h - size) / 2), size });
  };
  const onImgLoad = () => {
    const img = imgRef.current;
    if (img) initSquare(img.clientWidth, img.clientHeight);
  };

  const startMove = (e: React.PointerEvent) => {
    if (!sel) return;
    e.stopPropagation();
    mode.current = { type: "move", px: e.clientX, py: e.clientY, ox: sel.x, oy: sel.y, os: sel.size };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const startResize = (e: React.PointerEvent) => {
    if (!sel) return;
    e.stopPropagation();
    mode.current = { type: "resize", px: e.clientX, py: e.clientY, ox: sel.x, oy: sel.y, os: sel.size };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const m = mode.current;
    if (!m || !sel || !disp) return;
    const dx = e.clientX - m.px, dy = e.clientY - m.py;
    if (m.type === "move") {
      setSel({ size: m.os, x: clamp(m.ox + dx, 0, disp.w - m.os), y: clamp(m.oy + dy, 0, disp.h - m.os) });
    } else {
      const maxS = Math.min(disp.w - m.ox, disp.h - m.oy);
      const size = clamp(m.os + Math.max(dx, dy), 40, maxS);
      setSel({ x: m.ox, y: m.oy, size });
    }
  };
  const onUp = () => { mode.current = null; };

  const doCrop = () => {
    const img = imgRef.current;
    if (!img || !sel) return;
    const s = img.naturalWidth / img.clientWidth; // square pixels → sx == sy
    const side = Math.round(sel.size * s);
    const canvas = document.createElement("canvas");
    canvas.width = side; canvas.height = side;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sel.x * s, sel.y * s, sel.size * s, sel.size * s, 0, 0, side, side);
    onCrop(canvas.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-[210] flex flex-col items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.8)" }}>
      <div className="mb-3 text-[13px] text-white/90">Move the square over the logo · drag the corner to resize · it stays square.</div>
      <div ref={wrapRef} className="relative inline-block touch-none select-none" style={{ maxHeight: "68vh" }} onPointerMove={onMove} onPointerUp={onUp}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={images[page]} alt="source" draggable={false} onLoad={onImgLoad} style={{ maxHeight: "68vh", maxWidth: "86vw", display: "block" }} />
        {sel && (
          <div className="absolute" onPointerDown={startMove}
            style={{ left: sel.x, top: sel.y, width: sel.size, height: sel.size, border: `2px solid ${ACCENT}`, boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)", cursor: "move" }}>
            <div onPointerDown={startResize}
              className="absolute -right-2 -bottom-2 h-5 w-5 rounded-full"
              style={{ background: ACCENT, border: "2px solid #fff", cursor: "nwse-resize" }} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2">
        {images.length > 1 && images.map((_, i) => (
          <button key={i} onClick={() => { setPage(i); setSel(null); setDisp(null); }}
            className="px-3 py-1.5 text-[12px] rounded-lg"
            style={{ background: i === page ? ACCENT : "rgba(255,255,255,0.12)", color: "#fff" }}>Page {i + 1}</button>
        ))}
        <div className="w-3" />
        <button onClick={onCancel} className="px-3 py-1.5 text-[13px] rounded-lg text-white/80 hover:text-white">Cancel</button>
        <button onClick={doCrop} className="px-4 py-1.5 text-[13px] font-semibold rounded-lg" style={{ background: "#fff", color: "#111" }}>Use square</button>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(v, max)); }

/* ── helpers ── */
function updatePerson(
  setDraft: React.Dispatch<React.SetStateAction<SupplierDraft>>,
  i: number,
  patch: Partial<SupplierDraft["contact_persons"][number]>,
) {
  setDraft((d) => ({ ...d, contact_persons: d.contact_persons.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
}

function Field({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim, #888)" }}>{label}</label>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2"
        style={{ border: "1px solid var(--border-subtle, #e0e0e0)", ["--tw-ring-color" as string]: "rgba(0,102,255,0.25)" }} />
    </div>
  );
}

function MiniInput({ placeholder, value, onChange }: { placeholder: string; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <input placeholder={placeholder} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md px-2 py-1.5 text-[12px] bg-transparent outline-none focus:ring-2"
      style={{ border: "1px solid var(--border-subtle, #e0e0e0)", ["--tw-ring-color" as string]: "rgba(0,102,255,0.25)" }} />
  );
}

function Spinner() {
  return (
    <svg className="mx-auto h-8 w-8 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="var(--border-subtle, #ddd)" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke={ACCENT} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ConfidenceDot({ level }: { level: SupplierDraft["confidence"] }) {
  const color = level === "high" ? "#0a8a4a" : level === "low" ? "#cc8a00" : ACCENT;
  return <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />;
}
