/* me-hr-types — the wire shape of /api/me/hr, shared by the route and the
 * page. Pure types: safe to import from either side. */

export interface MyLeaveType {
  id: string; code: string; name: string; defaultDays: number; requiresDoc: boolean; isPaid: boolean;
}
export interface MyLeaveBalance {
  leaveTypeId: string; code: string; year: number;
  entitled: number; used: number; carriedOver: number; adjustment: number; remaining: number;
  /** No hr_leave_balances row yet — shown from the type's default, never written. */
  virtual: boolean;
}
export interface MyLeaveRequest {
  id: string; leave_type_id: string; start_date: string; end_date: string; days: number;
  half_day: boolean; half_day_period: string | null; reason: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewed_at: string | null; review_notes: string | null; attachment_url: string | null; created_at: string;
}
export interface MyAttendanceRecord {
  id: string; date: string; clock_in: string | null; clock_out: string | null;
  break_minutes: number; total_hours: number | null; status: string;
}
export interface MyPayslip {
  id: string; period_start: string; period_end: string; gross_amount: number | null;
  deductions: Record<string, number> | null; net_amount: number | null; status: string; paid_at: string | null;
}
export interface MyDocument {
  id: string; name: string; category: string; file_url: string; file_type: string | null;
  expiry_date: string | null; created_at: string;
}
export interface MyEmergencyContact { name: string | null; phone: string | null; relationship: string | null }

export interface MyHrBundle {
  serverDate: string;
  employee: {
    id: string; employeeNumber: string | null; departmentName: string | null; positionTitle: string | null;
    hireDate: string | null; employmentStatus: string | null; employmentType: string | null;
    workLocation: string | null; managerName: string | null;
  };
  person: {
    fullName: string; nameAlt: string | null; email: string | null; phone: string | null; mobile: string | null;
    avatarUrl: string | null; addressLine1: string | null; addressLine2: string | null; city: string | null; country: string | null;
  };
  contacts: {
    workEmail: string | null; workPhone: string | null; wechatId: string | null;
    emergency1: MyEmergencyContact; emergency2: MyEmergencyContact;
  };
  leave: { types: MyLeaveType[]; balances: MyLeaveBalance[]; requests: MyLeaveRequest[] };
  attendance: { today: MyAttendanceRecord | null; month: MyAttendanceRecord[]; monthHours: number };
  payslips: MyPayslip[];
  documents: MyDocument[];
}

/** PATCH /api/me/hr/profile — the ONLY fields an employee may change about
 *  themselves. Everything else (name, bank, ID, salary, dates) is HR's. */
export const MY_PROFILE_PERSON_FIELDS = ["phone", "mobile", "address_line1", "address_line2", "city", "country"] as const;
export const MY_PROFILE_EMPLOYEE_FIELDS = [
  "wechat_id",
  "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relationship",
  "emergency_contact2_name", "emergency_contact2_phone", "emergency_contact2_relationship",
] as const;
export type MyProfilePatch = Partial<Record<
  (typeof MY_PROFILE_PERSON_FIELDS)[number] | (typeof MY_PROFILE_EMPLOYEE_FIELDS)[number], string | null
>>;
