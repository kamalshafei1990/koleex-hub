"use client";

import { humanizeError } from "@/lib/ui/humanize-error";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SmartCreatePage, SmartSection, SmartField, SmartHelpCard,
  SmartInput, SmartSelect, SmartTextarea,
} from "@/components/ui/create/SmartCreate";

const WORKFLOW = [
  { key: "buy",      label: "Purchase",     icon: "shipping-fast" as const,   state: "done" as const,    hint: "Money out" },
  { key: "asset",    label: "Asset record", icon: "briefcase" as const,       state: "current" as const, hint: "You are here" },
  { key: "deprec",   label: "Depreciate",   icon: "clock" as const,           state: "next" as const,    hint: "Periodic posting" },
  { key: "dispose",  label: "Dispose",      icon: "trash" as const,           state: "next" as const,    hint: "Remove from books" },
];

export default function CreateAsset() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [value, setValue] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<"straight_line" | "declining_balance" | "none">("straight_line");
  const [years, setYears] = useState("5");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/create/defaults").then((r) => r.json()).then((j) => {
      if (j.defaults?.base_currency) setCurrency(j.defaults.base_currency);
    }).catch(() => {});
  }, []);

  async function save() {
    if (!name.trim()) { setError("Asset name is required."); return; }
    if (!value || Number(value) <= 0) { setError("Purchase value must be > 0."); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/finance/setup/assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim() || null,
          purchase_value: Number(value),
          purchase_date: purchaseDate || null,
          depreciation_method: method,
          useful_life_years: method === "none" ? null : Number(years) || null,
          currency,
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      router.push("/finance/setup?card=assets");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <SmartCreatePage
      title="New Asset"
      kind="Finance · Capital purchase"
      intro="A fixed asset (laptop, vehicle, machinery). It depreciates over time instead of expensing immediately."
      icon="briefcase"
      backHref="/create"
      workflow={WORKFLOW}
      primaryAction={{ label: "Save Asset", onClick: save, busy }}
      secondaryAction={{ label: "Cancel", onClick: () => router.push("/create") }}
      side={
        <SmartHelpCard
          title="What is this?"
          meaning="A long-life item capitalised on the balance sheet rather than expensed."
          required={["Name", "Purchase value", "Currency"]}
          accountingImpact="Sits on the balance sheet at cost. Depreciation lands on P&L periodically (manual posting in current phase)."
          nextStep="Record a payment if not already done; set a depreciation schedule."
        />
      }
    >
      {error && <div className="rounded-md border border-rose-300/40 bg-rose-300/[0.06] px-3 py-2 text-[12px] text-rose-200">{error}</div>}

      <SmartSection title="Identification">
        <SmartField label="Asset name" required>
          <SmartInput value={name} onChange={(e) => setName(e.target.value)} placeholder="MacBook Pro 14, Sales team" />
        </SmartField>
        <SmartField label="Category" hint="Free-text grouping for asset register.">
          <SmartInput value={category} onChange={(e) => setCategory(e.target.value)} placeholder="IT equipment" />
        </SmartField>
      </SmartSection>

      <SmartSection title="Money">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SmartField label="Purchase value" required impact={["accounting"]}>
            <SmartInput type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0.00" />
          </SmartField>
          <SmartField label="Currency" required impact={["accounting"]}>
            <SmartSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["CNY", "USD", "EUR", "GBP", "AED", "SAR", "EGP"].map((c) => <option key={c} value={c}>{c}</option>)}
            </SmartSelect>
          </SmartField>
          <SmartField label="Purchase date" required>
            <SmartInput type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </SmartField>
        </div>
      </SmartSection>

      <SmartSection title="Depreciation">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SmartField label="Method" impact={["accounting"]}>
            <SmartSelect value={method} onChange={(e) => setMethod(e.target.value as "straight_line" | "declining_balance" | "none")}>
              <option value="straight_line">Straight line</option>
              <option value="declining_balance">Declining balance</option>
              <option value="none">None (not depreciated)</option>
            </SmartSelect>
          </SmartField>
          {method !== "none" && (
            <SmartField label="Useful life (years)" hint="E.g. 3 for laptops, 5 for vehicles, 10 for machinery.">
              <SmartInput type="number" min="1" value={years} onChange={(e) => setYears(e.target.value)} />
            </SmartField>
          )}
        </div>
        <SmartField label="Notes">
          <SmartTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Serial #, purchase invoice ref, …" />
        </SmartField>
      </SmartSection>
    </SmartCreatePage>
  );
}
