"use client";

/* ---------------------------------------------------------------------------
   Recruitment — Job postings & applicant pipeline management.
   --------------------------------------------------------------------------- */

import { useState, useEffect } from "react";
import type { HRModuleProps } from "@/components/hr/HRApp";
import {
  ModalShell,
  FieldLabel,
  EmptyState,
  StatusBadge,
  inputCls,
  textareaCls,
  selectCls,
  primaryBtnCls,
  cancelBtnCls,
  fmtDate,
  makeTranslationHelpers,
  JOB_STATUS_MAP,
  STAGE_MAP,
} from "@/components/hr/shared";
import {
  fetchJobPostings,
  createJobPosting,
  fetchApplicants,
  createApplicant,
  updateApplicantStage,
  type JobPostingWithNames,
  type ApplicantWithJob,
} from "@/lib/hr-admin";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import BriefcaseIcon from "@/components/icons/ui/BriefcaseIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ── Stage list for pipeline buttons ── */
const STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"] as const;

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */

export default function RecruitmentModule({ employees, t, lang }: HRModuleProps) {
  /* ── state ── */
  const [jobPostings, setJobPostings] = useState<JobPostingWithNames[]>([]);
  const [selectedPosting, setSelectedPosting] = useState<JobPostingWithNames | null>(null);
  const [applicants, setApplicants] = useState<ApplicantWithJob[]>([]);
  const [showPostingModal, setShowPostingModal] = useState(false);
  const [showApplicantModal, setShowApplicantModal] = useState(false);
  const [postingForm, setPostingForm] = useState({
    title: "",
    department_id: "",
    description: "",
    requirements: "",
    location: "",
    employment_type: "full_time",
    salary_min: "",
    salary_max: "",
    salary_currency: "USD",
  });
  const [applicantForm, setApplicantForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    source: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── translation helpers ── */
  const { tStatus, tStage, tEmpType } = makeTranslationHelpers(t);

  /* ── data loading ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const postings = await fetchJobPostings();
        if (cancelled) return;
        setJobPostings(postings);
      } catch (err) {
        console.error("[Recruitment] Load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ── actions ── */

  async function handleCreatePosting() {
    setSaving(true);
    try {
      await createJobPosting({
        title: postingForm.title,
        department_id: postingForm.department_id || null,
        position_id: null,
        description: postingForm.description || null,
        requirements: postingForm.requirements || null,
        location: postingForm.location || null,
        employment_type: postingForm.employment_type,
        salary_min: postingForm.salary_min ? Number(postingForm.salary_min) : null,
        salary_max: postingForm.salary_max ? Number(postingForm.salary_max) : null,
        salary_currency: postingForm.salary_currency,
        status: "draft",
        published_at: null,
        closes_at: null,
        created_by: null,
      });
      const postings = await fetchJobPostings();
      setJobPostings(postings);
      setShowPostingModal(false);
      setPostingForm({
        title: "",
        department_id: "",
        description: "",
        requirements: "",
        location: "",
        employment_type: "full_time",
        salary_min: "",
        salary_max: "",
        salary_currency: "USD",
      });
    } catch (err) {
      console.error("[Recruitment] Create posting error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSelectPosting(p: JobPostingWithNames) {
    setSelectedPosting(p);
    try {
      const apps = await fetchApplicants(p.id);
      setApplicants(apps);
    } catch (err) {
      console.error("[Recruitment] Load applicants error:", err);
    }
  }

  async function handleCreateApplicant() {
    if (!selectedPosting) return;
    setSaving(true);
    try {
      await createApplicant({
        job_posting_id: selectedPosting.id,
        full_name: applicantForm.full_name,
        email: applicantForm.email || null,
        phone: applicantForm.phone || null,
        resume_url: null,
        cover_letter: null,
        source: applicantForm.source || null,
        stage: "new",
        rating: null,
        notes: null,
        assigned_to: null,
      });
      const apps = await fetchApplicants(selectedPosting.id);
      setApplicants(apps);
      setShowApplicantModal(false);
      setApplicantForm({ full_name: "", email: "", phone: "", source: "" });
    } catch (err) {
      console.error("[Recruitment] Create applicant error:", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStage(applicantId: string, stage: string) {
    if (!selectedPosting) return;
    try {
      await updateApplicantStage(applicantId, stage);
      const apps = await fetchApplicants(selectedPosting.id);
      setApplicants(apps);
    } catch (err) {
      console.error("[Recruitment] Update stage error:", err);
    }
  }

  /* ── loading spinner ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <SpinnerIcon size={28} className="text-[var(--text-dim)] animate-spin" />
      </div>
    );
  }

  /* ── render helpers ── */

  function renderStars(rating: number | null) {
    if (!rating) return null;
    return (
      <span className="text-[11px] text-amber-400">
        {"★".repeat(Math.min(rating, 5))}{"☆".repeat(Math.max(0, 5 - rating))}
      </span>
    );
  }

  /* ── render ── */
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {selectedPosting && (
            <button
              onClick={() => { setSelectedPosting(null); setApplicants([]); }}
              className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-surface)] transition-colors"
            >
              <ArrowLeftIcon size={16} className="text-[var(--text-dim)]" />
            </button>
          )}
          <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {selectedPosting ? selectedPosting.title : t("hr.jobPostings")}
          </h2>
        </div>

        <button
          className={`${primaryBtnCls} flex items-center gap-2`}
          onClick={() => selectedPosting ? setShowApplicantModal(true) : setShowPostingModal(true)}
        >
          <PlusIcon size={14} />
          {selectedPosting ? t("hr.newApplicant") : t("hr.newPosting")}
        </button>
      </div>

      {/* ── Content ── */}
      {!selectedPosting ? (
        /* ── Job Postings list ── */
        jobPostings.length === 0 ? (
          <EmptyState
            icon={BriefcaseIcon}
            title={t("hr.noJobPostings")}
            subtitle={t("hr.createFirstPosting")}
          />
        ) : (
          <div className="space-y-2">
            {jobPostings.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelectPosting(p)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-[var(--bg-surface)] transition-colors text-left"
              >
                <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <BriefcaseIcon size={16} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {p.title}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)] mt-0.5">
                    {p.department_name || t("hr.noDept")} &middot; {tEmpType(p.employment_type)}
                  </div>
                </div>
                <StatusBadge
                  status={p.status}
                  map={JOB_STATUS_MAP}
                  label={tStatus(p.status)}
                />
              </button>
            ))}
          </div>
        )
      ) : (
        /* ── Applicants list ── */
        applicants.length === 0 ? (
          <EmptyState
            icon={UserPlusIcon}
            title={t("hr.noApplicants")}
            subtitle={t("hr.addFirstApplicant")}
          />
        ) : (
          <div className="space-y-2">
            {applicants.map((a) => (
              <div
                key={a.id}
                className="px-4 py-3 rounded-xl hover:bg-[var(--bg-surface)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                    <UserIcon size={16} className="text-[var(--text-dim)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                      {a.full_name}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-[var(--text-dim)]">
                        {a.email}
                      </span>
                      {a.source && (
                        <>
                          <span className="text-[11px] text-[var(--text-dim)]">&middot;</span>
                          <span className="text-[11px] text-[var(--text-dim)]">{a.source}</span>
                        </>
                      )}
                      {renderStars(a.rating)}
                    </div>
                  </div>
                  <StatusBadge
                    status={a.stage}
                    map={STAGE_MAP}
                    label={tStage(a.stage)}
                  />
                </div>

                {/* ── Stage action buttons ── */}
                <div className="flex flex-wrap gap-1.5 mt-2 ml-12">
                  {STAGES.map((stage) => (
                    <button
                      key={stage}
                      disabled={a.stage === stage}
                      onClick={() => handleUpdateStage(a.id, stage)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition-colors ${
                        a.stage === stage
                          ? "opacity-40 cursor-default " + (STAGE_MAP[stage] || "")
                          : "border-[var(--border-subtle)] text-[var(--text-subtle)] hover:bg-[var(--bg-surface)]"
                      }`}
                    >
                      {tStage(stage)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Create Posting Modal ── */}
      <ModalShell
        open={showPostingModal}
        onClose={() => setShowPostingModal(false)}
        title={t("hr.newJobPosting")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowPostingModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={!postingForm.title || saving}
              onClick={handleCreatePosting}
            >
              {saving ? <SpinnerIcon size={14} className="animate-spin" /> : t("hr.create")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.title_field")}</FieldLabel>
          <input
            className={inputCls}
            value={postingForm.title}
            onChange={(e) => setPostingForm({ ...postingForm, title: e.target.value })}
          />
        </div>

        <div>
          <FieldLabel>{t("hr.employmentType")}</FieldLabel>
          <select
            className={selectCls}
            value={postingForm.employment_type}
            onChange={(e) => setPostingForm({ ...postingForm, employment_type: e.target.value })}
          >
            <option value="full_time">{t("hr.fullTime")}</option>
            <option value="part_time">{t("hr.partTime")}</option>
            <option value="contract">{t("hr.contract")}</option>
            <option value="intern">{t("hr.intern")}</option>
          </select>
        </div>

        <div>
          <FieldLabel>{t("hr.location")}</FieldLabel>
          <input
            className={inputCls}
            value={postingForm.location}
            onChange={(e) => setPostingForm({ ...postingForm, location: e.target.value })}
          />
        </div>

        <div>
          <FieldLabel>{t("hr.description")}</FieldLabel>
          <textarea
            className={textareaCls}
            rows={3}
            placeholder={t("hr.jobDescription")}
            value={postingForm.description}
            onChange={(e) => setPostingForm({ ...postingForm, description: e.target.value })}
          />
        </div>

        <div>
          <FieldLabel>{t("hr.requirements")}</FieldLabel>
          <textarea
            className={textareaCls}
            rows={3}
            placeholder={t("hr.jobRequirements")}
            value={postingForm.requirements}
            onChange={(e) => setPostingForm({ ...postingForm, requirements: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <FieldLabel>{t("hr.minSalary")}</FieldLabel>
            <input
              className={inputCls}
              type="number"
              value={postingForm.salary_min}
              onChange={(e) => setPostingForm({ ...postingForm, salary_min: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>{t("hr.maxSalary")}</FieldLabel>
            <input
              className={inputCls}
              type="number"
              value={postingForm.salary_max}
              onChange={(e) => setPostingForm({ ...postingForm, salary_max: e.target.value })}
            />
          </div>
          <div>
            <FieldLabel>{t("hr.currency")}</FieldLabel>
            <input
              className={inputCls}
              value={postingForm.salary_currency}
              onChange={(e) => setPostingForm({ ...postingForm, salary_currency: e.target.value })}
            />
          </div>
        </div>
      </ModalShell>

      {/* ── Create Applicant Modal ── */}
      <ModalShell
        open={showApplicantModal}
        onClose={() => setShowApplicantModal(false)}
        title={t("hr.newApplicant")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowApplicantModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={!applicantForm.full_name || saving}
              onClick={handleCreateApplicant}
            >
              {saving ? <SpinnerIcon size={14} className="animate-spin" /> : t("hr.add")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.fullName")}</FieldLabel>
          <input
            className={inputCls}
            value={applicantForm.full_name}
            onChange={(e) => setApplicantForm({ ...applicantForm, full_name: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.email")}</FieldLabel>
          <input
            className={inputCls}
            type="email"
            value={applicantForm.email}
            onChange={(e) => setApplicantForm({ ...applicantForm, email: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.phone")}</FieldLabel>
          <input
            className={inputCls}
            value={applicantForm.phone}
            onChange={(e) => setApplicantForm({ ...applicantForm, phone: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.source")}</FieldLabel>
          <input
            className={inputCls}
            placeholder={t("hr.direct")}
            value={applicantForm.source}
            onChange={(e) => setApplicantForm({ ...applicantForm, source: e.target.value })}
          />
        </div>
      </ModalShell>
    </div>
  );
}
