"use client";

import PolicyPage, { Section, StepFlow, CardGrid, InfoCard, Callout } from "@/components/commercial-policy/PolicyPage";

export default function CommercialFlowOverviewPage() {
  return (
    <PolicyPage title="Commercial Flow" subtitle="The end-to-end commercial process from customer inquiry to order completion — covering pricing, margin, commission, credit, and approval." badge="Commercial Flow">
      <Section title="The 12-Step Commercial Process">
        <StepFlow steps={[
          { label: "Customer Inquiry", description: "Customer contacts KOLEEX or partner with product interest" },
          { label: "Product Selection", description: "Identify products, quantities, and specifications" },
          { label: "Price Calculation", description: "System calculates price: Cost → Level → Band → Channel → Customer" },
          { label: "Discount Decision", description: "Apply any applicable discount within approval limits" },
          { label: "Margin Check", description: "Verify final price meets minimum margin requirements" },
          { label: "Quotation", description: "Generate formal quotation with terms and conditions" },
          { label: "Customer Acceptance", description: "Customer confirms the order" },
          { label: "Credit Check", description: "Verify credit availability (if credit customer)" },
          { label: "Approval", description: "Route for approval if any thresholds exceeded" },
          { label: "Order Confirmation", description: "Order entered into production/shipping queue" },
          { label: "Invoice & Payment", description: "Invoice issued, payment collected" },
          { label: "Commission", description: "Commission calculated on payment and disbursed" },
        ]} />
      </Section>

      <Section title="Six Interconnected Systems">
        <CardGrid cols={3}>
          <InfoCard title="Price Flow" description="How cost transforms into customer price" color="#007AFF" />
          <InfoCard title="Margin & Discount" description="How discounts interact with margin protection" color="#34C759" />
          <InfoCard title="Commission Flow" description="How commission is triggered and calculated" color="#FF9500" />
          <InfoCard title="Credit Check" description="How credit availability is verified" color="#AF52DE" />
          <InfoCard title="Approval Flow" description="How decisions are routed for authorization" color="#7BA1C2" />
          <InfoCard title="Decision Tree" description="Business rules that determine outcomes" color="#4FC3F7" />
        </CardGrid>
      </Section>

      <Callout>Every commercial transaction passes through all six systems. They work together as an integrated process — not as independent silos.</Callout>
    </PolicyPage>
  );
}
