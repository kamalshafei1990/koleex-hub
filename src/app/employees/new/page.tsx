"use client";

/* ---------------------------------------------------------------------------
   /employees/new — add an employee.

   Thin wrapper. The form itself lives in components/employees/EmployeeForm so
   the edit route renders the exact same thing; see that file for why.
   --------------------------------------------------------------------------- */

import EmployeeForm from "@/components/employees/EmployeeForm";

export default function AddEmployeePage() {
  return <EmployeeForm mode="create" />;
}
