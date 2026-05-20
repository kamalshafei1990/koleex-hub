"use client";

import { humanizeError } from "@/lib/ui/humanize-error";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SmartCreatePage, SmartSection, SmartField, SmartHelpCard,
  SmartInput, SmartSelect, SmartTextarea,
} from "@/components/ui/create/SmartCreate";
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";

const WORKFLOW = [
  { key: "customer", label: "Customer", icon: "users" as const,                 state: "current" as const, hint: "You are here" },
  { key: "so",       label: "Sales Order", icon: "file-invoice-dollar" as const, state: "next" as const,    hint: "Take an order" },
  { key: "ship",     label: "Ship",     icon: "shipping-fast" as const,           state: "next" as const,    hint: "Fulfil + reduce stock" },
  { key: "invoice",  label: "Invoice",  icon: "receipt" as const,                 state: "next" as const,    hint: "Bill + book revenue" },
  { key: "pay",      label: "Payment",  icon: "money" as const,                   state: "next" as const,    hint: "Collect" },
];

export default function CreateCustomer() {
  const router = useRouter();
  const [name, setName]         = useState("");
  const [company, setCompany]   = useState("");
  const [email, setEmail]       = useState("");
  const [phone, setPhone]       = useState("");
  const [country, setCountry]   = useState("");
  const [terms, setTerms]       = useState("Net 30");
  /* Currency pre-select hydrates from the tenant base via the shared
     cached hook. Until it resolves we leave the select on USD so the
     form is always submittable; a useEffect below snaps it to the
     resolved value unless the operator has already picked one. */
  const resolvedBase = useBaseCurrencyOptional();
  const [ccy, setCcy]           = useState("USD");
  const [ccyTouched, setCcyTouched] = useState(false);
  useEffect(() => {
    if (resolvedBase && !ccyTouched) setCcy(resolvedBase);
  }, [resolvedBase, ccyTouched]);
  const [type, setType]         = useState<"retail" | "wholesale" | "distributor">("wholesale");
  const [notes, setNotes]       = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function save() {
    if (!name.trim()) { setError("Name is required."); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/customers", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          company_name: company.trim() || null,
          email: email || null,
          phone: phone || null,
          country: country || null,
          payment_terms: terms || null,
          currency_code: ccy,
          customer_type: type,
          notes: notes.trim() || null,
          status: "active",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      const id = j.customer?.id ?? j.id;
      router.push(id ? `/customers/${id}` : "/customers");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <SmartCreatePage
      title="New Customer"
      kind="CRM · A party you sell to"
      intro="A customer record powers sales orders, invoices, AR aging, and the customer ledger."
      icon="users"
      backHref="/create"
      workflow={WORKFLOW}
      primaryAction={{ label: "Save Customer", onClick: save, busy }}
      secondaryAction={{ label: "Cancel", onClick: () => router.push("/create") }}
      side={
        <SmartHelpCard
          title="What is this?"
          meaning="A unique party you sell to. Used throughout sales, invoicing, and accounting."
          required={["Name"]}
          nextStep="Open the customer record and take a sales order."
          accountingImpact="Customer balance shown in AR aging once you issue invoices."
        />
      }
    >
      {error && <div className="rounded-md border border-rose-300/40 bg-rose-300/[0.06] px-3 py-2 text-[12px] text-rose-200">{error}</div>}

      <SmartSection title="Identification">
        <SmartField label="Display name" required hint="Shown across SOs and reports.">
          <SmartInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Trading Co." />
        </SmartField>
        <SmartField label="Legal company name" hint="If different from the display name.">
          <SmartInput value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Trading Ltd." />
        </SmartField>
        <SmartField label="Customer type">
          <SmartSelect value={type} onChange={(e) => setType(e.target.value as "retail" | "wholesale" | "distributor")}>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="distributor">Distributor</option>
          </SmartSelect>
        </SmartField>
      </SmartSection>

      <SmartSection title="Contact" subtitle="Optional — fill in what you have">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SmartField label="Email"><SmartInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></SmartField>
          <SmartField label="Phone"><SmartInput value={phone} onChange={(e) => setPhone(e.target.value)} /></SmartField>
          <SmartField label="Country" hint="Drives the Top Markets ranking."><SmartInput value={country} onChange={(e) => setCountry(e.target.value)} placeholder="China" /></SmartField>
        </div>
      </SmartSection>

      <SmartSection title="Commercial" subtitle="Defaults used on every new SO">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SmartField label="Default currency" impact={["accounting"]}>
            <SmartSelect value={ccy} onChange={(e) => { setCcy(e.target.value); setCcyTouched(true); }}>
              {["CNY", "USD", "EUR", "GBP", "AED", "SAR", "EGP"].map((c) => <option key={c} value={c}>{c}</option>)}
            </SmartSelect>
          </SmartField>
          <SmartField label="Default payment terms"><SmartInput value={terms} onChange={(e) => setTerms(e.target.value)} placeholder="Net 30" /></SmartField>
        </div>
        <SmartField label="Notes"><SmartTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VIP — same-day shipping." /></SmartField>
      </SmartSection>
    </SmartCreatePage>
  );
}
