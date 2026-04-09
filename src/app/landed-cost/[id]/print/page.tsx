"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer } from "lucide-react";
import { fetchSimulation } from "@/lib/landed-cost-admin";
import { sumExportCosts, sumShippingCosts, sumImportFixed, sumInlandCosts, sumFinancialCosts } from "@/lib/landed-cost-calc";
import type { SimulationRow, SimulationResults } from "@/lib/landed-cost-types";

function fmt(n: number, d = 2) {
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function Row({ label, value, currency, bold, indent }: { label: string; value: number; currency: string; bold?: boolean; indent?: boolean }) {
  return (
    <tr className={bold ? "font-semibold bg-gray-50" : ""}>
      <td className={`py-1.5 pr-4 text-[12px] ${indent ? "pl-6" : ""} ${bold ? "text-gray-900" : "text-gray-600"}`}>{label}</td>
      <td className={`py-1.5 text-right text-[12px] font-mono ${bold ? "text-gray-900" : "text-gray-700"}`}>{currency} {fmt(value)}</td>
    </tr>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <tr>
      <td colSpan={2} className="pt-5 pb-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">{title}</td>
    </tr>
  );
}

export default function PrintReportPage() {
  const { id } = useParams<{ id: string }>();
  const [sim, setSim] = useState<SimulationRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) fetchSimulation(id).then(data => { setSim(data); setLoading(false); });
  }, [id]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>;
  }
  if (!sim) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Simulation not found</div>;
  }

  const r: SimulationResults = sim.results || {} as SimulationResults;
  const c = sim.currency || "USD";
  const e = sim.export_costs;
  const s = sim.shipping;
  const i = sim.import_costs;
  const d = sim.inland_delivery;
  const f = sim.financial;

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Print button (hidden in print) */}
      <div className="print:hidden fixed top-4 right-4 z-50">
        <button onClick={() => window.print()} className="h-10 px-5 rounded-xl bg-gray-900 text-white text-[13px] font-semibold flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-lg">
          <Printer className="h-4 w-4" /> Print Report
        </button>
      </div>

      <div className="max-w-[800px] mx-auto px-8 py-10 print:px-0 print:py-0">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-6 border-b-2 border-gray-900">
          <div>
            <h1 className="text-[22px] font-bold tracking-tight">{sim.name}</h1>
            <p className="text-[12px] text-gray-500 mt-1">
              Landed Cost Report · Generated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="text-right">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              sim.status === "completed"
                ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                : "bg-amber-100 text-amber-700 border border-amber-200"
            }`}>{sim.status}</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-8 text-[12px]">
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Customer</span>
            <span className="font-medium">{sim.customer_company || sim.customer_name || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Country / City</span>
            <span className="font-medium">{[sim.customer_country, sim.customer_city].filter(Boolean).join(", ") || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Product</span>
            <span className="font-medium">{sim.product_name || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Model / SKU</span>
            <span className="font-medium">{[sim.model_name, sim.sku].filter(Boolean).join(" · ") || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">HS Code</span>
            <span className="font-medium">{sim.hs_code || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Country of Origin</span>
            <span className="font-medium">{sim.country_of_origin || "—"}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Quantity</span>
            <span className="font-medium">{sim.quantity}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Unit Price</span>
            <span className="font-medium">{c} {fmt(Number(sim.unit_price))}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Price Basis</span>
            <span className="font-medium">{sim.price_basis}</span>
          </div>
          <div className="flex justify-between border-b border-gray-100 py-1.5">
            <span className="text-gray-500">Currency</span>
            <span className="font-medium">{c}</span>
          </div>
        </div>

        {/* ══════════ Executive Summary ══════════ */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-4">Executive Summary</h2>
          <div className="text-center mb-5">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Total Landed Cost</p>
            <p className="text-[32px] font-bold font-mono tracking-tight">{c} {fmt(r.totalLandedCost || 0)}</p>
            {f?.exchangeRate > 1 && (
              <p className="text-[13px] text-gray-500 mt-1">Local currency: {fmt(r.finalWarehouseCostLocal || 0)}</p>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4 text-center border-t border-gray-200 pt-4">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-400">Per Unit</p>
              <p className="text-[16px] font-bold font-mono">{fmt(r.landedCostPerUnit || 0)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-400">Per Carton</p>
              <p className="text-[16px] font-bold font-mono">{fmt(r.landedCostPerCarton || 0)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-400">Per CBM</p>
              <p className="text-[16px] font-bold font-mono">{fmt(r.landedCostPerCbm || 0)}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-gray-400">Per KG</p>
              <p className="text-[16px] font-bold font-mono">{fmt(r.landedCostPerKg || 0)}</p>
            </div>
          </div>
        </div>

        {/* ══════════ Cost Breakdown Bars ══════════ */}
        <div className="mb-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">Cost Distribution</h2>
          <div className="space-y-2">
            {[
              { label: "Product Cost", val: r.productTotal || 0, pct: r.pctProduct || 0, color: "bg-blue-500" },
              { label: "Export Costs", val: r.exportTotal || 0, pct: r.pctExport || 0, color: "bg-amber-500" },
              { label: "Shipping", val: r.shippingTotal || 0, pct: r.pctShipping || 0, color: "bg-cyan-500" },
              { label: "Import Costs", val: r.importTotal || 0, pct: r.pctImport || 0, color: "bg-purple-500" },
              { label: "Inland Delivery", val: r.inlandTotal || 0, pct: r.pctInland || 0, color: "bg-emerald-500" },
              { label: "Financial", val: r.financialTotal || 0, pct: r.pctFinancial || 0, color: "bg-pink-500" },
            ].map(row => (
              <div key={row.label} className="flex items-center gap-3">
                <span className="text-[11px] text-gray-500 w-28 shrink-0">{row.label}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${row.color}`} style={{ width: `${Math.min(row.pct, 100)}%` }} />
                </div>
                <span className="text-[11px] font-mono text-gray-700 w-28 text-right">{c} {fmt(row.val)}</span>
                <span className="text-[10px] text-gray-400 w-12 text-right">{row.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════ Detailed Line Items ══════════ */}
        <div className="mb-8">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-3">Detailed Cost Breakdown</h2>
          <table className="w-full">
            <tbody>
              {/* Product */}
              <SectionTitle title="Product Cost" />
              <Row label={`${sim.quantity} × ${c} ${fmt(Number(sim.unit_price))} per unit`} value={r.productTotal || 0} currency={c} bold />

              {/* Export */}
              {(r.exportTotal || 0) > 0 && (
                <>
                  <SectionTitle title="Export Side Costs" />
                  {e?.factoryToPort > 0 && <Row label="Factory to Port" value={e.factoryToPort} currency={c} indent />}
                  {e?.localTrucking > 0 && <Row label="Local Trucking" value={e.localTrucking} currency={c} indent />}
                  {e?.exportCustomsFee > 0 && <Row label="Export Customs Fee" value={e.exportCustomsFee} currency={c} indent />}
                  {e?.portCharges > 0 && <Row label="Port Charges" value={e.portCharges} currency={c} indent />}
                  {e?.terminalHandling > 0 && <Row label="Terminal Handling" value={e.terminalHandling} currency={c} indent />}
                  {e?.documentationFee > 0 && <Row label="Documentation Fee" value={e.documentationFee} currency={c} indent />}
                  {e?.inspectionFee > 0 && <Row label="Inspection Fee" value={e.inspectionFee} currency={c} indent />}
                  {e?.fumigationFee > 0 && <Row label="Fumigation Fee" value={e.fumigationFee} currency={c} indent />}
                  {e?.palletizationFee > 0 && <Row label="Palletization Fee" value={e.palletizationFee} currency={c} indent />}
                  {e?.extraPackingCost > 0 && <Row label="Extra Packing Cost" value={e.extraPackingCost} currency={c} indent />}
                  {e?.loadingFee > 0 && <Row label="Loading Fee" value={e.loadingFee} currency={c} indent />}
                  {e?.exportAgentFee > 0 && <Row label="Export Agent Fee" value={e.exportAgentFee} currency={c} indent />}
                  {e?.bankCharges > 0 && <Row label="Bank Charges" value={e.bankCharges} currency={c} indent />}
                  {e?.certificateOfOriginFee > 0 && <Row label="Certificate of Origin" value={e.certificateOfOriginFee} currency={c} indent />}
                  {e?.formCertificateFee > 0 && <Row label="Form / Certificate Fee" value={e.formCertificateFee} currency={c} indent />}
                  {e?.otherExportCharges > 0 && <Row label="Other Export Charges" value={e.otherExportCharges} currency={c} indent />}
                  <Row label="Total Export Costs" value={r.exportTotal || 0} currency={c} bold />
                </>
              )}

              {/* Shipping */}
              {(r.shippingTotal || 0) > 0 && (
                <>
                  <SectionTitle title="Shipping Costs" />
                  {s?.freightCost > 0 && <Row label="Freight Cost" value={s.freightCost} currency={c} indent />}
                  {s?.insuranceCost > 0 && <Row label="Insurance" value={s.insuranceCost} currency={c} indent />}
                  {s?.baf > 0 && <Row label="BAF" value={s.baf} currency={c} indent />}
                  {s?.caf > 0 && <Row label="CAF" value={s.caf} currency={c} indent />}
                  {s?.gri > 0 && <Row label="GRI" value={s.gri} currency={c} indent />}
                  {s?.peakSeasonSurcharge > 0 && <Row label="Peak Season Surcharge" value={s.peakSeasonSurcharge} currency={c} indent />}
                  {s?.amsEnsIsf > 0 && <Row label="AMS/ENS/ISF" value={s.amsEnsIsf} currency={c} indent />}
                  {s?.blAwbFee > 0 && <Row label="BL/AWB Fee" value={s.blAwbFee} currency={c} indent />}
                  {s?.telexReleaseFee > 0 && <Row label="Telex Release" value={s.telexReleaseFee} currency={c} indent />}
                  <Row label="Total Shipping Costs" value={r.shippingTotal || 0} currency={c} bold />
                </>
              )}

              {/* Import */}
              {(r.importTotal || 0) > 0 && (
                <>
                  <SectionTitle title="Import Costs" />
                  {i?.customsDutyPct > 0 && <Row label={`Customs Duty (${i.customsDutyPct}%)`} value={(r.productTotal || 0) * i.customsDutyPct / 100} currency={c} indent />}
                  {i?.importVatPct > 0 && <Row label={`Import VAT (${i.importVatPct}%)`} value={((r.productTotal || 0) + (r.productTotal || 0) * (i?.customsDutyPct || 0) / 100) * i.importVatPct / 100} currency={c} indent />}
                  {i?.additionalTaxPct > 0 && <Row label={`Additional Tax (${i.additionalTaxPct}%)`} value={(r.productTotal || 0) * i.additionalTaxPct / 100} currency={c} indent />}
                  {i?.antiDumpingDuty > 0 && <Row label="Anti-Dumping Duty" value={i.antiDumpingDuty} currency={c} indent />}
                  {i?.portCharges > 0 && <Row label="Port Charges" value={i.portCharges} currency={c} indent />}
                  {i?.terminalHandling > 0 && <Row label="Terminal Handling" value={i.terminalHandling} currency={c} indent />}
                  {i?.customsClearanceFee > 0 && <Row label="Customs Clearance" value={i.customsClearanceFee} currency={c} indent />}
                  {i?.customsBrokerFee > 0 && <Row label="Customs Broker" value={i.customsBrokerFee} currency={c} indent />}
                  {i?.inspectionFee > 0 && <Row label="Inspection Fee" value={i.inspectionFee} currency={c} indent />}
                  {i?.certificateVerificationFee > 0 && <Row label="Certificate Verification" value={i.certificateVerificationFee} currency={c} indent />}
                  {i?.storageFee > 0 && <Row label="Storage Fee" value={i.storageFee} currency={c} indent />}
                  {i?.demurrage > 0 && <Row label="Demurrage" value={i.demurrage} currency={c} indent />}
                  {i?.detention > 0 && <Row label="Detention" value={i.detention} currency={c} indent />}
                  {i?.deliveryOrderFee > 0 && <Row label="Delivery Order Fee" value={i.deliveryOrderFee} currency={c} indent />}
                  {i?.portSecurityFee > 0 && <Row label="Port Security" value={i.portSecurityFee} currency={c} indent />}
                  {i?.scanningFee > 0 && <Row label="Scanning Fee" value={i.scanningFee} currency={c} indent />}
                  {i?.municipalityFee > 0 && <Row label="Municipality Fee" value={i.municipalityFee} currency={c} indent />}
                  {i?.translationLegalizationFee > 0 && <Row label="Translation / Legalization" value={i.translationLegalizationFee} currency={c} indent />}
                  {i?.otherImportCharges > 0 && <Row label="Other Import Charges" value={i.otherImportCharges} currency={c} indent />}
                  <Row label="Total Import Costs" value={r.importTotal || 0} currency={c} bold />
                </>
              )}

              {/* Inland */}
              {(r.inlandTotal || 0) > 0 && (
                <>
                  <SectionTitle title="Inland Delivery" />
                  {d?.localTruckingToWarehouse > 0 && <Row label="Local Trucking" value={d.localTruckingToWarehouse} currency={c} indent />}
                  {d?.unloadingFee > 0 && <Row label="Unloading Fee" value={d.unloadingFee} currency={c} indent />}
                  {d?.craneForkliftFee > 0 && <Row label="Crane / Forklift" value={d.craneForkliftFee} currency={c} indent />}
                  {d?.warehouseReceivingCharges > 0 && <Row label="Warehouse Receiving" value={d.warehouseReceivingCharges} currency={c} indent />}
                  {d?.lastMileHandling > 0 && <Row label="Last Mile Handling" value={d.lastMileHandling} currency={c} indent />}
                  {d?.remoteAreaSurcharge > 0 && <Row label="Remote Area Surcharge" value={d.remoteAreaSurcharge} currency={c} indent />}
                  {d?.restrictedAreaSurcharge > 0 && <Row label="Restricted Area Surcharge" value={d.restrictedAreaSurcharge} currency={c} indent />}
                  {d?.appointmentDeliveryFee > 0 && <Row label="Appointment Delivery" value={d.appointmentDeliveryFee} currency={c} indent />}
                  {d?.nightDeliveryFee > 0 && <Row label="Night Delivery" value={d.nightDeliveryFee} currency={c} indent />}
                  {d?.otherLocalDeliveryCharges > 0 && <Row label="Other Local Delivery" value={d.otherLocalDeliveryCharges} currency={c} indent />}
                  <Row label="Total Inland Delivery" value={r.inlandTotal || 0} currency={c} bold />
                </>
              )}

              {/* Financial */}
              {(r.financialTotal || 0) !== 0 && (
                <>
                  <SectionTitle title="Financial & Commercial" />
                  {f?.bankTransferCost > 0 && <Row label="Bank Transfer Cost" value={f.bankTransferCost} currency={c} indent />}
                  {f?.financingCost > 0 && <Row label="Financing Cost" value={f.financingCost} currency={c} indent />}
                  {f?.creditInsurance > 0 && <Row label="Credit Insurance" value={f.creditInsurance} currency={c} indent />}
                  {f?.unexpectedReserve > 0 && <Row label="Unexpected Reserve" value={f.unexpectedReserve} currency={c} indent />}
                  {f?.includeCommissionInFinal && f?.agentCommission > 0 && <Row label="Agent Commission" value={f.agentCommission} currency={c} indent />}
                  {f?.includeCommissionInFinal && f?.salesCommission > 0 && <Row label="Sales Commission" value={f.salesCommission} currency={c} indent />}
                  {f?.contingencyPct > 0 && <Row label={`Contingency (${f.contingencyPct}%)`} value={(r.productTotal + r.exportTotal + r.shippingTotal + r.importTotal + r.inlandTotal) * f.contingencyPct / 100} currency={c} indent />}
                  {f?.margin > 0 && <Row label={`Margin (${f.margin}%)`} value={r.productTotal * f.margin / 100} currency={c} indent />}
                  {f?.discount > 0 && <Row label={`Discount (${f.discount}%)`} value={-(r.productTotal * f.discount / 100)} currency={c} indent />}
                  <Row label="Total Financial" value={r.financialTotal || 0} currency={c} bold />
                </>
              )}

              {/* Grand total */}
              <tr>
                <td colSpan={2} className="pt-6 pb-2 border-t-2 border-gray-900" />
              </tr>
              <tr className="font-bold text-[14px]">
                <td className="py-2 text-gray-900">TOTAL LANDED COST</td>
                <td className="py-2 text-right font-mono text-gray-900">{c} {fmt(r.totalLandedCost || 0)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notes */}
        {sim.notes && (
          <div className="mb-8">
            <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2">Notes</h2>
            <p className="text-[12px] text-gray-600 whitespace-pre-wrap">{sim.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="border-t border-gray-200 pt-4 text-center">
          <p className="text-[10px] text-gray-400">
            Koleex Hub · Landed Cost Simulation Report · {sim.name} · ID: {sim.id?.slice(0, 8)}
          </p>
        </div>
      </div>
    </div>
  );
}
