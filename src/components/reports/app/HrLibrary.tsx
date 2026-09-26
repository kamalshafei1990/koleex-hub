"use client";

/* ---------------------------------------------------------------------------
   The HR numbers inside the Reports Library — the SAME screen the HR app
   shows on its Reports tab (headcount, hires and leavers, turnover, tenure,
   expiring documents, birthdays and anniversaries, salary cost, workforce
   mix), not a second copy of it. Loaded only when the Library section is
   opened, and only offered to people with HR·view; the /api/hr/reports it
   reads is gated the same way on the server.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { hrT } from "@/lib/translations/hr";
import { cachedEmployeeList } from "@/lib/hr-admin";
import ReportsModule from "@/components/hr/modules/Reports";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Employees = Awaited<ReturnType<typeof cachedEmployeeList>>;

export default function HrLibrary() {
  const { t, lang } = useTranslation(hrT);
  const [employees, setEmployees] = useState<Employees | null>(null);
  useEffect(() => {
    let alive = true;
    cachedEmployeeList().then((list) => { if (alive) setEmployees(list); }).catch(() => { if (alive) setEmployees([]); });
    return () => { alive = false; };
  }, []);
  if (!employees) return <div className="grid place-items-center py-10"><SpinnerIcon size={18} /></div>;
  return <ReportsModule employees={employees} t={t} lang={lang} />;
}
