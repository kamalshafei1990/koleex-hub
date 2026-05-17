"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SmartCreatePage, SmartSection, SmartField, SmartHelpCard,
  SmartInput, SmartSelect, SmartTextarea,
} from "@/components/ui/create/SmartCreate";

const WORKFLOW = [
  { key: "item",   label: "Item",     icon: "box-open" as const,         state: "current" as const, hint: "You are here" },
  { key: "stock",  label: "Stock In", icon: "box-circle-check" as const, state: "next" as const,    hint: "Receive / opening" },
  { key: "sell",   label: "Sell",     icon: "file-invoice-dollar" as const, state: "next" as const, hint: "Add to SO" },
  { key: "ship",   label: "Ship",     icon: "shipping-fast" as const,    state: "next" as const,    hint: "Stock out + COGS" },
];

interface ItemType { id: string; type_name: string }

export default function CreateInventoryItem() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [unit, setUnit] = useState("pcs");
  const [reorderPoint, setReorderPoint] = useState("");
  const [typeId, setTypeId] = useState<string>("");
  const [types, setTypes] = useState<ItemType[]>([]);
  const [costPrice, setCostPrice] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [tRes, dRes] = await Promise.all([
          fetch("/api/inventory/item-types"),
          fetch("/api/create/defaults"),
        ]);
        const t = await tRes.json().catch(() => ({ types: [] }));
        const d = await dRes.json().catch(() => ({ defaults: { base_currency: "CNY" } }));
        const list = (t.types ?? t.rows ?? []) as ItemType[];
        setTypes(list);
        if (list.length > 0) setTypeId(list[0].id);
        setCurrency(d.defaults?.base_currency ?? "CNY");
      } catch { /* ignore — bootstrap is best-effort */ }
    })();
  }, []);

  async function save() {
    if (!name.trim()) { setError("Item name is required."); return; }
    if (!typeId) { setError("Item type is required."); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/inventory/items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_name: name.trim(),
          item_code: code.trim() || null,
          brand: brand.trim() || null,
          sku: sku.trim() || null,
          unit,
          reorder_point: reorderPoint ? Number(reorderPoint) : null,
          item_type_id: typeId,
          cost_price: costPrice ? Number(costPrice) : null,
          currency,
          notes: notes.trim() || null,
          status: "active",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      const id = j.item?.id ?? j.id;
      router.push(id ? `/inventory/items/${id}` : "/inventory");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <SmartCreatePage
      title="New Inventory Item"
      kind="Inventory · Product or material"
      intro="An item is anything you receive into stock, ship, or sell. It carries cost (for valuation) and price (for sales)."
      icon="box-open"
      backHref="/create"
      workflow={WORKFLOW}
      primaryAction={{ label: "Save Item", onClick: save, busy }}
      secondaryAction={{ label: "Cancel", onClick: () => router.push("/create") }}
      side={
        <SmartHelpCard
          title="What is this?"
          meaning="A stock-tracked SKU. Pickable on POs, SOs, receipts, and shipments."
          required={["Item name", "Item type"]}
          accountingImpact="Cost feeds inventory valuation + COGS when shipped."
          inventoryImpact="Quantity moves in on receipts, out on shipments."
          nextStep="Open the item and record opening stock per warehouse."
        />
      }
    >
      {error && <div className="rounded-md border border-rose-300/40 bg-rose-300/[0.06] px-3 py-2 text-[12px] text-rose-200">{error}</div>}

      <SmartSection title="Identification">
        <SmartField label="Item name" required>
          <SmartInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Charging cable, USB-C, 1m" />
        </SmartField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SmartField label="Item code" hint="Auto-generated if left blank.">
            <SmartInput value={code} onChange={(e) => setCode(e.target.value)} placeholder="USB-C-001" />
          </SmartField>
          <SmartField label="Brand"><SmartInput value={brand} onChange={(e) => setBrand(e.target.value)} /></SmartField>
          <SmartField label="SKU"><SmartInput value={sku} onChange={(e) => setSku(e.target.value)} /></SmartField>
        </div>
        <SmartField label="Item type" required impact={["inventory"]} hint="Drives reporting + sub-classification.">
          <SmartSelect value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.length === 0 && <option value="">No types available</option>}
            {types.map((t) => <option key={t.id} value={t.id}>{t.type_name}</option>)}
          </SmartSelect>
        </SmartField>
      </SmartSection>

      <SmartSection title="Stock control">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SmartField label="Unit" impact={["inventory"]} hint="pcs, kg, m, …">
            <SmartInput value={unit} onChange={(e) => setUnit(e.target.value)} />
          </SmartField>
          <SmartField label="Reorder point" hint="Flagged in Low-Stock alerts when on-hand ≤ this.">
            <SmartInput type="number" step="1" value={reorderPoint} onChange={(e) => setReorderPoint(e.target.value)} placeholder="0" />
          </SmartField>
        </div>
      </SmartSection>

      <SmartSection title="Cost (optional)">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SmartField label="Standard cost" impact={["accounting", "inventory"]}
                      hint="Used for valuation until the first receipt resets WAC.">
            <SmartInput type="number" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0.00" />
          </SmartField>
          <SmartField label="Currency" impact={["accounting"]}>
            <SmartSelect value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {["CNY", "USD", "EUR", "GBP", "AED", "SAR", "EGP"].map((c) => <option key={c} value={c}>{c}</option>)}
            </SmartSelect>
          </SmartField>
        </div>
      </SmartSection>

      <SmartSection title="Notes">
        <SmartField label="Notes">
          <SmartTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Lead time, supplier, alternatives, …" />
        </SmartField>
      </SmartSection>
    </SmartCreatePage>
  );
}
