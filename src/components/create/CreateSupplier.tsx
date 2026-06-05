"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { humanizeError } from "@/lib/ui/humanize-error";
import {
  SmartCreatePage, SmartSection, SmartField, SmartHelpCard,
  SmartInput, SmartSelect, SmartTextarea,
} from "@/components/ui/create/SmartCreate";
import ProfileCompletenessBar from "@/components/ui/ProfileCompletenessBar";

const WORKFLOW = [
  { key: "supplier", label: "Supplier",  icon: "id-badge" as const,         state: "current" as const, hint: "You are here" },
  { key: "po",       label: "Purchase",  icon: "shipping-fast" as const,    state: "next" as const,    hint: "Order goods" },
  { key: "receive",  label: "Receive",   icon: "box-circle-check" as const, state: "next" as const,    hint: "Goods in stock" },
  { key: "bill",     label: "Bill",      icon: "file-invoice" as const,     state: "next" as const,    hint: "Book AP" },
  { key: "pay",      label: "Payment",   icon: "money" as const,            state: "next" as const,    hint: "Settle" },
];

export default function CreateSupplier() {
  const router = useRouter();
  const [name, setName]       = useState("");
  const [email, setEmail]     = useState("");
  const [phone, setPhone]     = useState("");
  const [country, setCountry] = useState("");
  const [notes, setNotes]     = useState("");
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState<string | null>(null);

  /* ── Profile completeness ── */
  const isFilled = (v: unknown): boolean =>
    typeof v === "string" ? v.trim().length > 0 : v != null;
  const trackedValues: unknown[] = [name, email, phone, country, notes];
  const filledCount = trackedValues.reduce<number>((n, v) => n + (isFilled(v) ? 1 : 0), 0);
  const totalCount = trackedValues.length;

  async function save() {
    if (!name.trim()) { setError("Company name is required."); return; }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) { setError("Email isn't a valid address (e.g. name@company.com)."); return; }
    if (phone.trim() && phone.replace(/[^\d]/g, "").length < 6) { setError("Phone looks too short — enter a valid number."); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // entity_type is NOT NULL on contacts; a supplier is a company.
          entity_type: "company",
          company_name: name.trim(), company_name_en: name.trim(), display_name: name.trim(),
          email: email || null, phone: phone || null,
          country: country || null, notes: notes || null,
          contact_type: "supplier", is_active: true,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error ?? `HTTP ${r.status}`));
      const id = j.contact?.id ?? j.id;
      // Land on the Supplier 360 (Supplier Intelligence Platform) so the
      // operator can immediately enrich Factory, Contacts, QR, Strategic
      // Status, Classification, and watch Readiness build — not the legacy
      // contact card.
      router.push(id ? `/suppliers/${id}` : "/suppliers");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <SmartCreatePage
      title="New Supplier"
      kind="Procurement · A party you buy from"
      intro="A supplier record powers purchase orders, vendor bills, and AP aging."
      icon="id-badge"
      backHref="/create"
      workflow={WORKFLOW}
      primaryAction={{ label: "Save Supplier", onClick: save, busy }}
      secondaryAction={{ label: "Cancel", onClick: () => router.push("/create") }}
      side={
        <SmartHelpCard
          title="What is this?"
          meaning="A unique vendor you buy goods or services from. Used in POs, bills, payments, and AP — and the hub of its Supplier Intelligence 360."
          required={["Company name"]}
          nextStep="Save, then enrich Factory, Contacts & WeChat QR on the supplier 360 — Readiness builds as you go."
        />
      }
    >
      <ProfileCompletenessBar filled={filledCount} total={totalCount} />

      {error && <div className="rounded-md border border-rose-300/40 bg-rose-300/[0.06] px-3 py-2 text-[12px] text-rose-200">{error}</div>}
      <SmartSection title="Identification">
        <SmartField label="Company name" required hint="Used on POs and bills.">
          <SmartInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Logistics" />
        </SmartField>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SmartField label="Email"><SmartInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></SmartField>
          <SmartField label="Phone"><SmartInput value={phone} onChange={(e) => setPhone(e.target.value)} /></SmartField>
        </div>
        <SmartField label="Country"><SmartInput value={country} onChange={(e) => setCountry(e.target.value)} placeholder="China" /></SmartField>
      </SmartSection>
      <SmartSection title="Notes">
        <SmartField label="Notes" hint="Optional. Useful for terms or contact context.">
          <SmartTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </SmartField>
      </SmartSection>
    </SmartCreatePage>
  );
}
