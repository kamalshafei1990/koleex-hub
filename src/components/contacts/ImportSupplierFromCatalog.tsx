"use client";

/* ---------------------------------------------------------------------------
   ImportSupplierFromCatalog — upload a supplier PDF catalog, auto-extract the
   company identity + contact info, review/edit it, then create the supplier
   AND file the catalog into the Catalogs app (linked to the new supplier).

   Pipeline:
     1. Browser reads the PDF (selectable text + OCR fallback) → text
        (src/lib/catalog-client.ts).
     2. POST /api/suppliers/import-catalog → AI structures it into a draft.
     3. User reviews/edits the draft.
     4. createContact() → supplier row; uploadCatalogFile() + createCatalog()
        → catalog filed and linked via contact_id.

   Brand: monochrome surfaces, blue (#0066FF) only for functional accents.
   Themed entirely with the app's CSS vars so it matches light/dark.
   --------------------------------------------------------------------------- */

import { useCallback, useRef, useState } from "react";
import { extractCatalogText } from "@/lib/catalog-client";
import { createContact } from "@/lib/contacts-admin";
import { uploadCatalogFile, createCatalog } from "@/lib/catalogs-admin";
import type { SupplierDraft } from "@/lib/server/catalog-extract";

const ACCENT = "#0066FF";

type Phase = "pick" | "reading" | "review" | "creating" | "done";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a supplier is created so the caller can refresh + open it. */
  onCreated?: (supplierId: string) => void;
}

const EMPTY: SupplierDraft = {
  company_name_en: null,
  company_name_cn: null,
  brand: null,
  website: null,
  email: null,
  phone: null,
  address: null,
  contact_persons: [],
  confidence: "low",
  notes: null,
};

export default function ImportSupplierFromCatalog({ open, onClose, onCreated }: Props) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState("");
  const [usedOcr, setUsedOcr] = useState(false);
  const [draft, setDraft] = useState<SupplierDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setPhase("pick");
    setFile(null);
    setProgress("");
    setUsedOcr(false);
    setDraft(EMPTY);
    setError(null);
    setCreatedId(null);
  }, []);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const analyze = useCallback(async (f: File) => {
    setFile(f);
    setError(null);
    setPhase("reading");
    setProgress("Reading PDF…");
    try {
      const { text, usedOcr: ocr } = await extractCatalogText(f, setProgress);
      setUsedOcr(ocr);
      setProgress("Extracting supplier details…");
      const res = await fetch("/api/suppliers/import-catalog", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, filename: f.name }),
      });
      const j = (await res.json().catch(() => ({}))) as { draft?: SupplierDraft; error?: string };
      if (!res.ok || !j.draft) {
        // Soft-fail: let the user fill the form manually rather than dead-end.
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

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) void analyze(f);
    },
    [analyze],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files?.[0];
      if (f && f.type === "application/pdf") void analyze(f);
    },
    [analyze],
  );

  const create = useCallback(async () => {
    if (!file) return;
    const nameEn = (draft.company_name_en || "").trim();
    const nameCn = (draft.company_name_cn || "").trim();
    const displayName = nameEn || nameCn || file.name.replace(/\.pdf$/i, "");
    if (!nameEn && !nameCn) {
      setError("Add at least the English or Chinese company name before creating.");
      return;
    }
    setError(null);
    setPhase("creating");
    setProgress("Creating supplier…");

    // Store contact persons with both key conventions used across the app
    // (role/mobile for the directory quick-look, position/phone for the form).
    const persons = draft.contact_persons.map((p, i) => ({
      full_name: p.full_name || null,
      role: p.role || null,
      position: p.role || null,
      email: p.email || null,
      mobile: p.mobile || null,
      phone: p.mobile || null,
      is_primary: i === 0,
    }));

    const supplier: Record<string, unknown> = {
      contact_type: "supplier",
      entity_type: "company",
      company_name_en: nameEn || null,
      company_name_cn: nameCn || null,
      display_name: displayName,
      supplier_email: draft.email || null,
      email: draft.email || null,
      supplier_website: draft.website || null,
      website: draft.website || null,
      supplier_tel: draft.phone || null,
      phone: draft.phone || null,
      supplier_address: draft.address || null,
      contact_persons: persons,
      notes: draft.brand ? `Brand: ${draft.brand}` : null,
    };

    const { data, error: cErr } = await createContact(supplier);
    if (!data?.id) {
      setError(cErr || "Failed to create the supplier.");
      setPhase("review");
      return;
    }
    const supplierId = data.id;
    setCreatedId(supplierId);

    // File the catalog (best-effort — supplier is already created either way).
    try {
      setProgress("Filing the catalog…");
      const up = await uploadCatalogFile(file);
      if (up) {
        await createCatalog({
          title: displayName,
          title_cn: nameCn || null,
          description: null,
          contact_id: supplierId,
          contact_name: displayName,
          company_name_en: nameEn || null,
          company_name_cn: nameCn || null,
          contact_type: "supplier",
          division_slug: null,
          division_name: null,
          category_slug: null,
          category_name: null,
          file_name: file.name,
          file_path: up.path,
          file_url: up.url,
          file_type: file.type || "application/pdf",
          file_size: file.size,
          cover_url: null,
          cover_path: null,
          tags: ["supplier-catalog"],
        });
      }
    } catch {
      /* non-fatal — the supplier exists; catalog filing can be retried */
    }

    setProgress("");
    setPhase("done");
    onCreated?.(supplierId);
  }, [file, draft, onCreated]);

  if (!open) return null;

  const set = (patch: Partial<SupplierDraft>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(2px)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && phase !== "creating") close();
      }}
    >
      <div
        className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-2xl shadow-2xl"
        style={{
          background: "var(--bg-surface, #fff)",
          border: "1px solid var(--border-subtle, #e0e0e0)",
          color: "var(--text-primary, #111)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 sticky top-0"
          style={{ background: "var(--bg-surface, #fff)", borderBottom: "1px solid var(--border-subtle, #e0e0e0)" }}
        >
          <div>
            <h2 className="text-[15px] font-semibold">Import supplier from catalog</h2>
            <p className="text-[12px]" style={{ color: "var(--text-dim, #888)" }}>
              Upload a PDF — we read the company name, brand &amp; contacts.
            </p>
          </div>
          <button
            onClick={close}
            disabled={phase === "creating"}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:opacity-70 disabled:opacity-40"
            style={{ border: "1px solid var(--border-subtle, #e0e0e0)" }}
            aria-label="Close"
          >
            <span className="text-[18px] leading-none">×</span>
          </button>
        </div>

        <div className="p-5">
          {/* ── Pick ── */}
          {phase === "pick" && (
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className="cursor-pointer rounded-xl px-6 py-12 text-center transition-colors"
              style={{ border: "1.5px dashed var(--border-subtle, #ccc)" }}
            >
              <div className="text-[14px] font-medium">Drop a PDF catalog here</div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--text-dim, #888)" }}>
                or click to choose a file
              </div>
              <div className="mt-3 text-[11px]" style={{ color: "var(--text-dim, #999)" }}>
                Scanned catalogs are read with on-device OCR (English + 中文).
              </div>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" hidden onChange={onPick} />
            </div>
          )}

          {/* ── Reading / analyzing ── */}
          {phase === "reading" && (
            <div className="py-12 text-center">
              <Spinner />
              <div className="mt-4 text-[13px] font-medium">{progress || "Working…"}</div>
              {usedOcr && (
                <div className="mt-1 text-[11px]" style={{ color: "var(--text-dim, #999)" }}>
                  First OCR run downloads the language model — this can take a moment.
                </div>
              )}
            </div>
          )}

          {/* ── Review ── */}
          {phase === "review" && (
            <div className="space-y-4">
              {error && (
                <div
                  className="rounded-lg px-3 py-2 text-[12px]"
                  style={{ background: "rgba(255,51,51,0.10)", color: "#cc2b2b", border: "1px solid rgba(255,51,51,0.25)" }}
                >
                  {error}
                </div>
              )}
              {!error && (
                <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text-dim, #888)" }}>
                  <ConfidenceDot level={draft.confidence} />
                  {usedOcr ? "Read via OCR" : "Read from text"} · confidence {draft.confidence}. Review before creating.
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Field label="Company (English)" value={draft.company_name_en} onChange={(v) => set({ company_name_en: v })} />
                <Field label="Company (中文)" value={draft.company_name_cn} onChange={(v) => set({ company_name_cn: v })} />
                <Field label="Brand" value={draft.brand} onChange={(v) => set({ brand: v })} />
                <Field label="Website" value={draft.website} onChange={(v) => set({ website: v })} />
                <Field label="Email" value={draft.email} onChange={(v) => set({ email: v })} />
                <Field label="Phone" value={draft.phone} onChange={(v) => set({ phone: v })} />
                <div className="col-span-2">
                  <Field label="Address" value={draft.address} onChange={(v) => set({ address: v })} />
                </div>
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-dim, #888)" }}>
                    Contact persons
                  </label>
                  <button
                    onClick={() =>
                      set({ contact_persons: [...draft.contact_persons, { full_name: "", role: "", email: "", mobile: "" }] })
                    }
                    className="text-[12px] font-medium"
                    style={{ color: ACCENT }}
                  >
                    + Add
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.contact_persons.length === 0 && (
                    <div className="text-[12px]" style={{ color: "var(--text-dim, #999)" }}>None detected.</div>
                  )}
                  {draft.contact_persons.map((p, i) => (
                    <div key={i} className="grid grid-cols-2 gap-2 rounded-lg p-2" style={{ border: "1px solid var(--border-subtle, #eee)" }}>
                      <MiniInput placeholder="Name" value={p.full_name} onChange={(v) => updatePerson(setDraft, i, { full_name: v })} />
                      <MiniInput placeholder="Role" value={p.role} onChange={(v) => updatePerson(setDraft, i, { role: v })} />
                      <MiniInput placeholder="Email" value={p.email} onChange={(v) => updatePerson(setDraft, i, { email: v })} />
                      <MiniInput placeholder="Mobile" value={p.mobile} onChange={(v) => updatePerson(setDraft, i, { mobile: v })} />
                      <button
                        onClick={() => set({ contact_persons: draft.contact_persons.filter((_, j) => j !== i) })}
                        className="col-span-2 text-left text-[11px] hover:opacity-70"
                        style={{ color: "var(--text-dim, #999)" }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={close} className="px-3 py-2 text-[13px] rounded-lg hover:opacity-70" style={{ color: "var(--text-dim, #888)" }}>
                  Cancel
                </button>
                <button
                  onClick={() => void create()}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg"
                  style={{ background: "var(--bg-inverted, #111)", color: "var(--text-inverted, #fff)" }}
                >
                  Create supplier
                </button>
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
              <div
                className="mx-auto mb-3 h-12 w-12 rounded-full flex items-center justify-center"
                style={{ background: "rgba(0,204,102,0.12)", color: "#0a8a4a" }}
              >
                <span className="text-[22px] leading-none">✓</span>
              </div>
              <div className="text-[14px] font-semibold">Supplier created</div>
              <div className="mt-1 text-[12px]" style={{ color: "var(--text-dim, #888)" }}>
                The catalog was filed under this supplier and in the Catalogs app.
              </div>
              <div className="mt-5 flex items-center justify-center gap-2">
                <button
                  onClick={() => {
                    if (createdId) onCreated?.(createdId);
                    close();
                  }}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg"
                  style={{ background: "var(--bg-inverted, #111)", color: "var(--text-inverted, #fff)" }}
                >
                  Open supplier
                </button>
                <button onClick={reset} className="px-3 py-2 text-[13px] rounded-lg hover:opacity-70" style={{ color: "var(--text-dim, #888)" }}>
                  Import another
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── helpers ── */

function updatePerson(
  setDraft: React.Dispatch<React.SetStateAction<SupplierDraft>>,
  i: number,
  patch: Partial<SupplierDraft["contact_persons"][number]>,
) {
  setDraft((d) => ({
    ...d,
    contact_persons: d.contact_persons.map((p, j) => (j === i ? { ...p, ...patch } : p)),
  }));
}

function Field({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--text-dim, #888)" }}>
        {label}
      </label>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full rounded-lg px-3 py-2 text-[13px] bg-transparent outline-none focus:ring-2"
        style={{ border: "1px solid var(--border-subtle, #e0e0e0)", ["--tw-ring-color" as string]: "rgba(0,102,255,0.25)" }}
      />
    </div>
  );
}

function MiniInput({ placeholder, value, onChange }: { placeholder: string; value: string | null | undefined; onChange: (v: string) => void }) {
  return (
    <input
      placeholder={placeholder}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md px-2 py-1.5 text-[12px] bg-transparent outline-none focus:ring-2"
      style={{ border: "1px solid var(--border-subtle, #e0e0e0)", ["--tw-ring-color" as string]: "rgba(0,102,255,0.25)" }}
    />
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
