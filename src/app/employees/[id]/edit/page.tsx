"use client";

/* ---------------------------------------------------------------------------
   /employees/[id]/edit — edit an employee.

   This used to be a SEPARATE, smaller form: different layout, different field
   set, different save path. The same employee therefore looked like a
   different record depending on whether you were adding or editing, and any
   field that only existed on the add form could never be corrected afterwards.

   It now loads the profile, maps it into the create form's own state shape
   (wizardDataFromProfile), and renders that identical form in edit mode.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import EmployeeForm from "@/components/employees/EmployeeForm";
import {
  fetchEmployeeProfile,
  wizardDataFromProfile,
  type EmployeeWizardData,
} from "@/lib/employees-admin";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";

export default function EditEmployeePage() {
  const params = useParams();
  const id = String(params?.id ?? "");

  const [initial, setInitial] = useState<EmployeeWizardData | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const profile = await fetchEmployeeProfile(id);
      if (cancelled) return;
      if (!profile) { setNotFound(true); return; }
      setInitial(wizardDataFromProfile(profile));
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-[15px] font-semibold text-[var(--text-primary)] mb-1">
            Employee not found
          </div>
          <div className="text-[13px] text-[var(--text-dim)] mb-4">
            It may have been deleted.
          </div>
          <Link
            href="/employees"
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to employees
          </Link>
        </div>
      </div>
    );
  }

  /* Hold the form back until the record is in hand. Mounting it empty and
     filling it afterwards would fight every controlled input, and a blank
     field would read as "this employee has no value" rather than "loading". */
  if (!initial) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <SpinnerIcon size={22} className="animate-spin text-[var(--text-dim)]" />
      </div>
    );
  }

  return <EmployeeForm mode="edit" employeeId={id} initial={initial} />;
}
