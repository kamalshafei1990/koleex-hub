"use client";

import PolicyPage, {
  Section,
  SectionDesc,
  CardGrid,
  InfoCard,
  DataTable,
  StepFlow,
  Callout,
} from "@/components/commercial-policy/PolicyPage";

/* ===== Landed Cost Components (from pricing-config.ts) ===== */
const COST_COMPONENTS = [
  { label: "Machine / FOB Value", type: "Base", defaultValue: "$10,000", description: "The base FOB price of the equipment at origin" },
  { label: "Freight", type: "Fixed", defaultValue: "$800", description: "Shipping cost from origin to destination port" },
  { label: "Insurance", type: "0.5% of FOB", defaultValue: "$50", description: "Marine insurance as percentage of FOB value" },
  { label: "Import Duty", type: "5% of CIF", defaultValue: "$543", description: "Customs duty as percentage of CIF value" },
  { label: "VAT / Tax", type: "14% of CIF+Duty", defaultValue: "$1,595", description: "VAT on CIF plus Duty value" },
  { label: "Bank Charges", type: "1.5% of FOB", defaultValue: "$150", description: "LC / banking fees as percentage of FOB" },
  { label: "Clearance & Handling", type: "Fixed", defaultValue: "$500", description: "Customs clearance and port handling" },
  { label: "Local Transport", type: "Fixed", defaultValue: "$300", description: "Domestic trucking and delivery" },
];

/* ===== Formula Steps ===== */
const FORMULA_STEPS = [
  { label: "FOB Price", description: "Starting price at the port of origin (factory gate + local transport to port)" },
  { label: "CIF = FOB + Freight + Insurance", description: "Cost, Insurance, and Freight value at the destination port" },
  { label: "Duty = CIF x Duty Rate", description: "Import duty calculated as a percentage of the CIF value" },
  { label: "VAT = (CIF + Duty) x VAT Rate", description: "Value-added tax applied to the duty-inclusive value" },
  { label: "Bank = FOB x Bank Rate", description: "Banking and letter of credit charges based on FOB value" },
  { label: "Landed Cost = CIF + Duty + VAT + Bank + Clearance + Transport", description: "Total cost of the product delivered to the warehouse" },
];

/* ===== Example Calculation ===== */
const EXAMPLE_ROWS = [
  ["FOB Value", "$10,000.00", "Base equipment price"],
  ["Freight", "$800.00", "Sea freight to destination"],
  ["Insurance (0.5%)", "$50.00", "0.5% of FOB"],
  ["CIF Value", "$10,850.00", "FOB + Freight + Insurance"],
  ["Import Duty (5%)", "$542.50", "5% of CIF"],
  ["Sub-total", "$11,392.50", "CIF + Duty"],
  ["VAT (14%)", "$1,594.95", "14% of sub-total"],
  ["Bank Charges (1.5%)", "$150.00", "1.5% of FOB"],
  ["Clearance", "$500.00", "Customs clearance"],
  ["Local Transport", "$300.00", "Trucking to warehouse"],
  ["Total Landed Cost", "$13,937.45", "All-inclusive cost"],
];

/* ===== Key Metrics ===== */
const METRICS = [
  { title: "FOB Base", value: "$10,000", description: "Starting price at origin", color: "#007AFF" },
  { title: "Landed Cost", value: "$13,937", description: "Total delivered cost", color: "#FF9500" },
  { title: "Cost Uplift", value: "39.4%", description: "Total cost increase over FOB", color: "#FF3B30" },
  { title: "Duty + Tax", value: "$2,137", description: "Combined government charges", color: "#5856D6" },
];

export default function LandedCostPage() {
  return (
    <PolicyPage
      title="Landed Cost."
      subtitle="Understanding the full cost of getting a product from factory to warehouse. Every component from FOB to final delivery."
      badge="Pricing Engine"
    >
      {/* Key Metrics */}
      <Section title="Cost Summary.">
        <SectionDesc>
          Example landed cost breakdown for a $10,000 FOB shipment to a typical
          Band B market.
        </SectionDesc>
        <CardGrid cols={4}>
          {METRICS.map((m) => (
            <InfoCard key={m.title} title={m.title} value={m.value} description={m.description} color={m.color} />
          ))}
        </CardGrid>
      </Section>

      {/* Formula */}
      <Section title="Calculation Formula.">
        <SectionDesc>
          The landed cost builds up from FOB through each cost layer.
        </SectionDesc>
        <StepFlow steps={FORMULA_STEPS} />
      </Section>

      {/* Cost Components */}
      <Section title="Cost Components.">
        <SectionDesc>
          Each component of the landed cost structure with its default calculation
          basis.
        </SectionDesc>
        <DataTable
          headers={["Component", "Calculation Basis", "Example Value", "Description"]}
          rows={COST_COMPONENTS.map((c) => [c.label, c.type, c.defaultValue, c.description])}
        />
      </Section>

      {/* Example */}
      <Section title="Worked Example.">
        <SectionDesc>
          Complete landed cost calculation for a $10,000 FOB equipment shipment.
        </SectionDesc>
        <DataTable
          headers={["Line Item", "Amount", "Notes"]}
          rows={EXAMPLE_ROWS}
        />
      </Section>

      <Callout title="Country-Specific Rates">
        Duty rates, VAT, and local charges vary significantly by destination
        country. Always confirm current rates with the finance team before
        quoting. The example uses typical rates for a Band B market.
      </Callout>
    </PolicyPage>
  );
}
