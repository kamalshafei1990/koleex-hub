"use client";

import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

const roles = ["Super Admin", "CEO", "GM", "Commercial Mgr", "Regional Mgr", "Sales Mgr", "Sales", "Finance", "Agent", "Customer"];

const dataFields = [
  { field: "Product Cost", access: ["✓", "✓", "✓", "✓", "✓", "—", "—", "✓", "—", "—"] },
  { field: "Internal Margin", access: ["✓", "✓", "✓", "✓", "✓", "—", "—", "✓", "—", "—"] },
  { field: "Base Price", access: ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "—", "—"] },
  { field: "Channel Prices", access: ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "—"] },
  { field: "Customer Price", access: ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓"] },
  { field: "Discount Details", access: ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "—", "—"] },
  { field: "Commission Rates", access: ["✓", "✓", "✓", "✓", "—", "✓", "✓", "✓", "—", "—"] },
  { field: "Commission Amounts", access: ["✓", "✓", "✓", "—", "—", "✓", "Own", "✓", "—", "—"] },
  { field: "Credit Limits", access: ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "Own", "Own"] },
  { field: "Credit Outstanding", access: ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "Own", "Own"] },
  { field: "Overdue Status", access: ["✓", "✓", "✓", "✓", "✓", "✓", "✓", "✓", "Own", "Own"] },
  { field: "All Customer Data", access: ["✓", "✓", "✓", "✓", "✓", "✓", "Own", "✓", "Own", "Own"] },
  { field: "Approval History", access: ["✓", "✓", "✓", "✓", "✓", "✓", "—", "✓", "—", "—"] },
  { field: "System Settings", access: ["✓", "✓", "—", "—", "—", "—", "—", "—", "—", "—"] },
  { field: "RBAC Configuration", access: ["✓", "—", "—", "—", "—", "—", "—", "—", "—", "—"] },
];

export default function AccessControlPage() {
  return (
    <PolicyPage title="Access Control" subtitle="Role-based data visibility matrix defining what each role can see across the commercial system." badge="System">
      <Section title="10 Roles">
        <div className="flex flex-wrap gap-2 mb-6">
          {roles.map((r) => (
            <span key={r} className="rounded-full px-3 py-1.5 text-[12px] font-medium" style={{ background: "var(--bg-surface)", color: "var(--text-secondary)" }}>{r}</span>
          ))}
        </div>
      </Section>

      <Section title="Data Visibility Matrix">
        <div className="overflow-x-auto rounded-xl border" style={{ borderColor: "var(--border-subtle)" }}>
          <table className="w-full text-[11px]">
            <thead>
              <tr style={{ background: "var(--bg-surface)" }}>
                <th className="px-3 py-2 text-left font-semibold sticky left-0" style={{ color: "var(--text-secondary)", background: "var(--bg-surface)" }}>Data Field</th>
                {roles.map((r) => (
                  <th key={r} className="px-2 py-2 text-center font-semibold" style={{ color: "var(--text-muted)" }}>{r.split(" ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dataFields.map((d) => (
                <tr key={d.field} style={{ borderTop: "1px solid var(--border-faint)" }}>
                  <td className="px-3 py-2 font-medium sticky left-0" style={{ color: "var(--text-primary)", background: "var(--bg-primary)" }}>{d.field}</td>
                  {d.access.map((a, i) => (
                    <td key={i} className="px-2 py-2 text-center" style={{ color: a === "✓" ? "#34C759" : a === "Own" ? "#FF9500" : "var(--text-ghost)" }}>{a}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex gap-4 text-[11px]" style={{ color: "var(--text-faint)" }}>
          <span><span style={{ color: "#34C759" }}>✓</span> = Full access</span>
          <span><span style={{ color: "#FF9500" }}>Own</span> = Own data only</span>
          <span><span style={{ color: "var(--text-ghost)" }}>—</span> = No access</span>
        </div>
      </Section>

      <Callout title="Critical Rule">Sales personnel cannot see KOLEEX product cost or internal margins. This is enforced at the system level and cannot be overridden. Commission is always calculated on invoice amount only.</Callout>
    </PolicyPage>
  );
}
