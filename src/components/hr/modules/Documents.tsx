"use client";

/* ---------------------------------------------------------------------------
   Documents — Employee document vault module for the HR application.
   Handles uploading, filtering, viewing, and deleting HR documents.
   --------------------------------------------------------------------------- */

import { useState, useEffect, useMemo } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  ModalShell,
  FieldLabel,
  EmptyState,
  inputCls,
  selectCls,
  primaryBtnCls,
  cancelBtnCls,
  fmtDate,
  daysUntil,
  DOC_CATEGORY_MAP,
  makeTranslationHelpers,
} from "@/components/hr/shared";
import {
  fetchHrDocuments,
  createHrDocument,
  deleteHrDocument,
} from "@/lib/hr-admin";
import type { HrDocumentRow } from "@/types/supabase";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ═══════════════════════════════════════════════════
   DOCUMENTS MODULE
   ═══════════════════════════════════════════════════ */

export default function Documents({ employees, t, lang }: HRModuleProps) {
  /* ── Translation helpers ── */
  const { tCat } = makeTranslationHelpers(t);

  /* ── State ── */
  const [hrDocuments, setHrDocuments] = useState<HrDocumentRow[]>([]);
  const [docFilter, setDocFilter] = useState("all");
  const [showDocModal, setShowDocModal] = useState(false);
  const [docForm, setDocForm] = useState({
    employee_id: "",
    name: "",
    category: "other",
    file_url: "",
    expiry_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Data loading ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const docs = await fetchHrDocuments();
      if (!cancelled) {
        setHrDocuments(docs);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Filtering ── */
  const filteredDocs = useMemo(
    () => docFilter === "all" ? hrDocuments : hrDocuments.filter((d) => d.category === docFilter),
    [hrDocuments, docFilter],
  );

  /* ── Employee name map ── */
  const empNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of employees) m.set(e.id, e.person.full_name);
    return m;
  }, [employees]);

  /* ── Actions ── */
  const reloadDocs = async () => {
    const docs = await fetchHrDocuments();
    setHrDocuments(docs);
  };

  const handleCreateDoc = async () => {
    if (!docForm.employee_id || !docForm.name) return;
    setSaving(true);
    await createHrDocument({
      employee_id: docForm.employee_id,
      name: docForm.name,
      category: docForm.category,
      file_url: docForm.file_url,
      expiry_date: docForm.expiry_date || null,
      file_type: null,
      file_size: null,
      reminder_days: 30,
      notes: null,
      uploaded_by: null,
    });
    await reloadDocs();
    setDocForm({ employee_id: "", name: "", category: "other", file_url: "", expiry_date: "" });
    setShowDocModal(false);
    setSaving(false);
  };

  const handleDeleteDoc = async (id: string) => {
    setSaving(true);
    await deleteHrDocument(id);
    await reloadDocs();
    setSaving(false);
  };

  /* ── Category filter labels ── */
  const labelMap: Record<string, string> = {
    all: t("hr.allCategories"),
    identity: t("hr.identity"),
    contract: t("hr.contractCat"),
    certification: t("hr.certification"),
    medical: t("hr.medical"),
    other: t("hr.other"),
  };

  const filterKeys = ["all", "identity", "contract", "certification", "medical", "other"] as const;

  /* ── Loading state ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <SpinnerIcon size={24} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  /* ── Render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {t("hr.documents")}
        </h2>
        <button className={primaryBtnCls + " flex items-center gap-2"} onClick={() => setShowDocModal(true)}>
          <PlusIcon size={14} />
          {t("hr.upload")}
        </button>
      </div>

      {/* Category filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {filterKeys.map((key) => (
          <button
            key={key}
            onClick={() => setDocFilter(key)}
            className={`h-8 px-3 rounded-lg text-[12px] font-medium transition-colors ${
              docFilter === key
                ? "bg-[var(--bg-inverted)] text-[var(--text-inverted)]"
                : "text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
            }`}
          >
            {labelMap[key]}
          </button>
        ))}
      </div>

      {/* Document list */}
      {filteredDocs.length === 0 ? (
        <EmptyState icon={DocumentIcon} title={t("hr.noDocuments")} subtitle={t("hr.uploadDocSubtitle")} />
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((doc) => {
            const remaining = doc.expiry_date ? daysUntil(doc.expiry_date) : null;
            const urgencyCls =
              remaining != null && remaining <= 0
                ? "text-red-400"
                : remaining != null && remaining <= 30
                  ? "text-amber-400"
                  : "text-[var(--text-dim)]";

            return (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <DocumentIcon size={16} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {doc.name}
                    </span>
                    {doc.category && (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                          DOC_CATEGORY_MAP[doc.category] || DOC_CATEGORY_MAP.other
                        }`}
                      >
                        {tCat(doc.category)}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] flex items-center gap-2">
                    <span>{empNameMap.get(doc.employee_id) || "-"}</span>
                    {doc.file_type && (
                      <>
                        <span>·</span>
                        <span>{doc.file_type}</span>
                      </>
                    )}
                    {doc.expiry_date && (
                      <>
                        <span>·</span>
                        <span className={urgencyCls}>
                          {t("hr.expires")} {fmtDate(doc.expiry_date)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteDoc(doc.id)}
                  disabled={saving}
                  className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-red-500/15 text-[var(--text-dim)] hover:text-red-400 transition-colors shrink-0"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Upload Document Modal ── */}
      <ModalShell
        open={showDocModal}
        onClose={() => setShowDocModal(false)}
        title={t("hr.uploadDocument")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowDocModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={saving || !docForm.employee_id || !docForm.name}
              onClick={handleCreateDoc}
            >
              {saving ? <SpinnerIcon size={14} className="animate-spin" /> : t("hr.upload")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.employee")}</FieldLabel>
          <select
            className={selectCls}
            value={docForm.employee_id}
            onChange={(e) => setDocForm({ ...docForm, employee_id: e.target.value })}
          >
            <option value="">{t("hr.selectEmployee")}</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.person.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>{t("hr.name")}</FieldLabel>
          <input
            className={inputCls}
            placeholder={t("hr.docName")}
            value={docForm.name}
            onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.category")}</FieldLabel>
          <select
            className={selectCls}
            value={docForm.category}
            onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
          >
            <option value="identity">{t("hr.identityCat")}</option>
            <option value="contract">{t("hr.contractCatUpper")}</option>
            <option value="certification">{t("hr.certificationCat")}</option>
            <option value="medical">{t("hr.medicalCat")}</option>
            <option value="other">{t("hr.otherCat")}</option>
          </select>
        </div>
        <div>
          <FieldLabel>{t("hr.fileURL")}</FieldLabel>
          <input
            className={inputCls}
            placeholder={t("hr.fileURL")}
            value={docForm.file_url}
            onChange={(e) => setDocForm({ ...docForm, file_url: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.expiryDate")}</FieldLabel>
          <input
            className={inputCls}
            type="date"
            value={docForm.expiry_date}
            onChange={(e) => setDocForm({ ...docForm, expiry_date: e.target.value })}
          />
        </div>
      </ModalShell>
    </div>
  );
}
