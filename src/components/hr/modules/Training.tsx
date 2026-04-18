"use client";

/* ---------------------------------------------------------------------------
   Training — Course catalog and employee training records module.
   Handles viewing courses, enrolling employees, and tracking progress.
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
  TRAINING_STATUS_MAP,
  makeTranslationHelpers,
} from "@/components/hr/shared";
import {
  fetchCourses,
  createCourse,
  fetchTrainingRecords,
  enrollInCourse,
  type TrainingRecordWithCourse,
} from "@/lib/hr-admin";
import type { CourseRow } from "@/types/supabase";

/* ── Icons ── */
import PlusIcon from "@/components/icons/ui/PlusIcon";
import UserIcon from "@/components/icons/ui/UserIcon";
import BookOpenIcon from "@/components/icons/ui/BookOpenIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

/* ═══════════════════════════════════════════════════
   TRAINING MODULE
   ═══════════════════════════════════════════════════ */

export default function Training({ employees, t, lang }: HRModuleProps) {
  /* ── Translation helpers ── */
  const { tStatus } = makeTranslationHelpers(t);

  /* ── State ── */
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecordWithCourse[]>([]);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseForm, setCourseForm] = useState({
    name: "",
    description: "",
    provider: "",
    duration_hours: "",
    is_mandatory: false,
  });
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ employee_id: "", course_id: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ── Data loading ── */
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [cs, recs] = await Promise.all([fetchCourses(), fetchTrainingRecords()]);
      if (!cancelled) {
        setCourses(cs);
        setTrainingRecords(recs);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Actions ── */
  const reloadCourses = async () => {
    const cs = await fetchCourses();
    setCourses(cs);
  };

  const reloadRecords = async () => {
    const recs = await fetchTrainingRecords();
    setTrainingRecords(recs);
  };

  const handleCreateCourse = async () => {
    if (!courseForm.name) return;
    setSaving(true);
    await createCourse({
      name: courseForm.name,
      description: courseForm.description || null,
      provider: courseForm.provider || null,
      duration_hours: courseForm.duration_hours ? Number(courseForm.duration_hours) : null,
      is_mandatory: courseForm.is_mandatory,
      department_id: null,
      is_active: true,
    });
    await reloadCourses();
    setCourseForm({ name: "", description: "", provider: "", duration_hours: "", is_mandatory: false });
    setShowCourseModal(false);
    setSaving(false);
  };

  const handleEnroll = async () => {
    if (!enrollForm.employee_id || !enrollForm.course_id) return;
    setSaving(true);
    await enrollInCourse(enrollForm.employee_id, enrollForm.course_id);
    await reloadRecords();
    setEnrollForm({ employee_id: "", course_id: "" });
    setShowEnrollModal(false);
    setSaving(false);
  };

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
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)]">
          {t("hr.training")}
        </h2>
        <div className="flex items-center gap-2">
          <button className={cancelBtnCls + " flex items-center gap-2"} onClick={() => setShowEnrollModal(true)}>
            <PlusIcon size={14} />
            {t("hr.enroll")}
          </button>
          <button className={primaryBtnCls + " flex items-center gap-2"} onClick={() => setShowCourseModal(true)}>
            <PlusIcon size={14} />
            {t("hr.addCourse")}
          </button>
        </div>
      </div>

      {/* ── Courses section ── */}
      <div>
        <h3 className="text-[13px] font-semibold text-[var(--text-muted)] mb-3">
          {t("hr.courses")}
        </h3>
        {courses.length === 0 ? (
          <EmptyState icon={BookOpenIcon} title={t("hr.noCourses")} subtitle={t("hr.addFirstCourse")} />
        ) : (
          <div className="space-y-2">
            {courses.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <BookOpenIcon size={16} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {c.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    {c.provider || t("hr.internal")}
                    {c.duration_hours ? ` · ${c.duration_hours}h` : ""}
                  </div>
                </div>
                {c.is_mandatory && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border bg-amber-500/15 text-amber-400 border-amber-500/20">
                    {t("hr.mandatory")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Training Records section ── */}
      <div>
        <h3 className="text-[13px] font-semibold text-[var(--text-muted)] mb-3">
          {t("hr.trainingRecords")}
        </h3>
        {trainingRecords.length === 0 ? (
          <EmptyState icon={UserIcon} title={t("hr.noTrainingRecords")} />
        ) : (
          <div className="space-y-2">
            {trainingRecords.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border-subtle)] hover:border-[var(--border-focus)] transition-colors"
              >
                <div className="h-9 w-9 rounded-xl bg-[var(--bg-surface)] flex items-center justify-center shrink-0">
                  <UserIcon size={16} className="text-[var(--text-dim)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium text-[var(--text-primary)] truncate">
                    {r.employee_name}
                  </div>
                  <div className="text-[11px] text-[var(--text-dim)]">
                    {r.course_name}
                    {r.enrolled_at ? ` · ${t("hr.enrolled")} ${fmtDate(r.enrolled_at)}` : ""}
                    {r.completed_at ? ` · ${t("hr.completed")} ${fmtDate(r.completed_at)}` : ""}
                    {r.score != null ? ` · ${t("hr.scoreLabel")} ${r.score}` : ""}
                  </div>
                </div>
                <StatusBadge status={r.status} map={TRAINING_STATUS_MAP} label={tStatus(r.status)} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add Course Modal ── */}
      <ModalShell
        open={showCourseModal}
        onClose={() => setShowCourseModal(false)}
        title={t("hr.addCourseTitle")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowCourseModal(false)}>
              {t("hr.cancel")}
            </button>
            <button className={primaryBtnCls} disabled={saving || !courseForm.name} onClick={handleCreateCourse}>
              {saving ? <SpinnerIcon size={14} className="animate-spin" /> : t("hr.create")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.name")}</FieldLabel>
          <input
            className={inputCls}
            placeholder={t("hr.courseName")}
            value={courseForm.name}
            onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.provider")}</FieldLabel>
          <input
            className={inputCls}
            placeholder={t("hr.provider")}
            value={courseForm.provider}
            onChange={(e) => setCourseForm({ ...courseForm, provider: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.durationHours")}</FieldLabel>
          <input
            className={inputCls}
            type="number"
            placeholder={t("hr.durationHours")}
            value={courseForm.duration_hours}
            onChange={(e) => setCourseForm({ ...courseForm, duration_hours: e.target.value })}
          />
        </div>
        <div>
          <FieldLabel>{t("hr.description")}</FieldLabel>
          <textarea
            className={textareaCls}
            rows={3}
            placeholder={t("hr.courseDescription")}
            value={courseForm.description}
            onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={courseForm.is_mandatory}
            onChange={(e) => setCourseForm({ ...courseForm, is_mandatory: e.target.checked })}
            className="rounded border-[var(--border-subtle)]"
          />
          <span className="text-[13px] text-[var(--text-primary)]">{t("hr.mandatory")}</span>
        </label>
      </ModalShell>

      {/* ── Enroll Modal ── */}
      <ModalShell
        open={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        title={t("hr.enrollEmployee")}
        footer={
          <>
            <button className={cancelBtnCls} onClick={() => setShowEnrollModal(false)}>
              {t("hr.cancel")}
            </button>
            <button
              className={primaryBtnCls}
              disabled={saving || !enrollForm.employee_id || !enrollForm.course_id}
              onClick={handleEnroll}
            >
              {saving ? <SpinnerIcon size={14} className="animate-spin" /> : t("hr.enroll")}
            </button>
          </>
        }
      >
        <div>
          <FieldLabel>{t("hr.employee")}</FieldLabel>
          <select
            className={selectCls}
            value={enrollForm.employee_id}
            onChange={(e) => setEnrollForm({ ...enrollForm, employee_id: e.target.value })}
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
          <FieldLabel>{t("hr.course")}</FieldLabel>
          <select
            className={selectCls}
            value={enrollForm.course_id}
            onChange={(e) => setEnrollForm({ ...enrollForm, course_id: e.target.value })}
          >
            <option value="">{t("hr.selectCourse")}</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </ModalShell>
    </div>
  );
}
