"use client";

import PolicyPage, { Section, DataTable, Callout } from "@/components/commercial-policy/PolicyPage";

export default function QuickReferencePage() {
  return (
    <PolicyPage title="Quick Reference" subtitle="One-page condensed reference with all key numbers, thresholds, and rules from the KOLEEX commercial system." badge="Quick Reference">
      <Section title="Product Levels & Margins">
        <DataTable headers={["Level", "Products", "Target Margin", "Min Margin"]} rows={[
          ["L1 Entry", "Basic machines, manual equipment", "15-25%", "2%"],
          ["L2 Standard", "Direct-drive, digital systems", "25-35%", "5%"],
          ["L3 Advanced", "Programmable, CNC, smart systems", "35-45%", "8%"],
          ["L4 Premium", "Automation lines, turnkey factories", "45-60%", "15%"],
        ]} />
      </Section>

      <Section title="Customer Levels">
        <DataTable headers={["Level", "Credit", "Days", "Pricing", "Upgrade Threshold"]} rows={[
          ["End User", "No", "0", "Retail", "—"],
          ["Silver", "No", "0", "Silver", "First order $15K+"],
          ["Gold", "Avg×3", "90", "Gold", "$500K lifetime"],
          ["Platinum", "Avg×4", "120", "Platinum", "$3M lifetime"],
          ["Diamond", "Contract", "Annual", "Best", "Contract + Approval"],
        ]} />
      </Section>

      <Section title="Market Bands">
        <DataTable headers={["Band", "Adjustment", "Regions"]} rows={[
          ["Band A", "×0.90", "Africa, South Asia, CIS"],
          ["Band B", "×0.95", "Middle East, Latin America, SE Asia"],
          ["Band C", "×1.00", "Europe, North America, Oceania"],
          ["Band D", "×1.05", "Strategic / Projects"],
        ]} />
      </Section>

      <Section title="Discount Approval">
        <DataTable headers={["Range", "Approver", "Response"]} rows={[
          ["0-3%", "Sales Person", "Immediate"],
          ["3-5%", "Sales Manager", "Same day"],
          ["5-10%", "Commercial Manager", "24h"],
          ["10-15%", "General Manager", "48h"],
          ["15%+", "CEO", "Case by case"],
        ]} />
      </Section>

      <Section title="Commission Rates">
        <DataTable headers={["Tier", "Rate", "Trigger"]} rows={[
          ["Standard (Junior)", "3%", "Invoice payment"],
          ["Senior", "4%", "Invoice payment"],
          ["Lead", "5%", "Invoice payment"],
        ]} />
      </Section>

      <Section title="Overdue Escalation">
        <DataTable headers={["Period", "Action"]} rows={[
          ["0-30 days", "Reminder / Warning"],
          ["30-60 days", "No new orders"],
          ["60-90 days", "Credit hold"],
          ["90+ days", "Account blocked"],
          ["120+ days", "Legal / Collection"],
        ]} />
      </Section>

      <Section title="Channel Pricing Ladder">
        <DataTable headers={["Channel", "Multiplier", "Builds On"]} rows={[
          ["Platinum", "×0.97", "KOLEEX Cost"],
          ["Gold", "×1.08", "Platinum Price"],
          ["Silver", "×1.08", "Gold Price"],
          ["Retail SRP", "×1.20", "Silver Price"],
        ]} />
      </Section>

      <Callout>This is a quick reference only. For complete details, navigate to the relevant section using the sidebar.</Callout>
    </PolicyPage>
  );
}
