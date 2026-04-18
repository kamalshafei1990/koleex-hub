"use client";

import PolicyPage, { Section, DataTable, Callout, StepFlow } from "@/components/commercial-policy/PolicyPage";

export default function DiscountApprovalPage() {
  return (
    <PolicyPage title="Discount Approval Rules" subtitle="The approval matrix that determines who can authorize discounts at each level." badge="Discount System">
      <Section title="Approval Matrix">
        <DataTable
          headers={["Range", "Approver", "Response", "Documentation"]}
          rows={[
            ["0-3%", "Sales Person", "Immediate", "System log only"],
            ["3-5%", "Sales Manager", "Same day", "Written justification"],
            ["5-10%", "Commercial Manager", "24 hours", "Business case required"],
            ["10-15%", "General Manager", "48 hours", "Full analysis + margin impact"],
            ["15%+", "CEO", "Case by case", "Strategic proposal with P&L impact"],
          ]}
        />
      </Section>

      <Section title="Approval Process">
        <StepFlow steps={[
          { label: "Sales identifies discount need", description: "Customer request or competitive situation" },
          { label: "Check discount type and percentage", description: "Determine which category and level applies" },
          { label: "Verify margin protection", description: "Ensure minimum margin is maintained" },
          { label: "Submit to appropriate approver", description: "Based on discount percentage range" },
          { label: "Approver reviews and decides", description: "Approve, modify, or reject" },
          { label: "Apply to quotation", description: "Discount applied in system with audit trail" },
        ]} />
      </Section>

      <Callout title="Rule">Every discount above 3% must include written justification. No verbal approvals. The system logs all discount decisions for quarterly audit.</Callout>
    </PolicyPage>
  );
}
