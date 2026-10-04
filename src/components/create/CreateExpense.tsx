"use client";

/* ---------------------------------------------------------------------------
   /create/expense — canonical SmartCreate example.

   Demonstrates every primitive:
     · Workflow rail (Supplier → Expense → Approve → Pay)
     · SmartSection grouping
     · SmartField with impact badges + required dots
     · InlineEntityPicker for supplier + category (inline create modals)
     · SmartHelpCard sidebar
     · SmartEmptyState fallback when no categories exist
     · Smart defaults: base currency + default category + today's date
   --------------------------------------------------------------------------- */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SmartCreatePage, SmartSection, SmartField, SmartHelpCard,
  SmartInput, SmartSelect, SmartTextarea,
  InlineEntityPicker, InlineCreateModal, SmartEmptyState,
  type PickerOption,
} from "@/components/ui/create/SmartCreate";
import { useDraftAutosave } from "@/lib/hooks/useDraftAutosave";
import { useBaseCurrencyOptional } from "@/lib/hooks/useBaseCurrency";
import { humanizeError } from "@/lib/ui/humanize-error";
import { useTranslation } from "@/lib/i18n";
import { CREATE_EXPENSE } from "@/lib/translations/create";
import { useToast } from "@/components/kds/useToast";

interface SmartDefaults {
  base_currency: string;
  default_warehouse_id: string | null;
  default_warehouse_label: string | null;
  default_payment_terms: string;
  default_expense_category_id: string | null;
  default_expense_category_label: string | null;
  default_supplier_country: string | null;
}

export default function CreateExpense() {
  const router = useRouter();
  const { t } = useTranslation(CREATE_EXPENSE);
  const { showToast, toastElement } = useToast();
  const WORKFLOW = [
    { key: "supplier", label: t("create.expense.wf.supplier", "Supplier"), icon: "id-badge" as const,    state: "done" as const,    hint: t("create.expense.wf.supplierHint", "Pick or add a party") },
    { key: "expense",  label: t("create.expense.wf.expense", "Expense"),   icon: "receipt" as const,     state: "current" as const, hint: t("create.expense.wf.here", "You are here") },
    { key: "approve",  label: t("create.expense.wf.approve", "Approve"),   icon: "badge-check" as const, state: "next" as const,    hint: t("create.expense.wf.approveHint", "Manager review") },
    { key: "pay",      label: t("create.expense.wf.pay", "Pay"),           icon: "money" as const,       state: "next" as const,    hint: t("create.expense.wf.payHint", "Settle in bank") },
  ];
  const [defaults, setDefaults] = useState<SmartDefaults | null>(null);
  const [categories, setCategories] = useState<PickerOption[]>([]);
  const [suppliers, setSuppliers]   = useState<PickerOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [busy, setBusy]             = useState(false);
  const [error, setError]           = useState<string | null>(null);

  /* Currency hydrates from the shared cached base-currency hook. The
     bootstrap useEffect below can still override it from the smart
     defaults response (e.g. supplier-specific default), but we no
     longer start from "CNY" baked in. */
  const resolvedBase = useBaseCurrencyOptional();
  /* Form state */
  const [title, setTitle]                 = useState("");
  const [amount, setAmount]               = useState("");
  const [currency, setCurrency]           = useState("USD");
  const [currencyTouched, setCurrencyTouched] = useState(false);
  useEffect(() => {
    if (resolvedBase && !currencyTouched) setCurrency(resolvedBase);
  }, [resolvedBase, currencyTouched]);
  const [date, setDate]                   = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]             = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid">("unpaid");
  const [categoryId, setCategoryId]       = useState<string | null>(null);
  const [supplierId, setSupplierId]       = useState<string | null>(null);
  const [notes, setNotes]                 = useState("");

  /* Draft autosave — restore on mount, clear on success. */
  const draftValue = useMemo(() => ({
    title, amount, currency, date, dueDate, paymentStatus, categoryId, supplierId, notes,
  }), [title, amount, currency, date, dueDate, paymentStatus, categoryId, supplierId, notes]);
  const draft = useDraftAutosave("expense:new", draftValue, {
    enabled: title.trim().length > 0 || amount.trim().length > 0 || notes.trim().length > 0,
  });
  const [resumePromptOpen, setResumePromptOpen] = useState(draft.hasDraft);

  /* Inline-create modals */
  const [catModalOpen, setCatModalOpen]   = useState(false);
  const [supModalOpen, setSupModalOpen]   = useState(false);
  const [newCatName, setNewCatName]       = useState("");
  const [newSupName, setNewSupName]       = useState("");
  const [newSupEmail, setNewSupEmail]     = useState("");
  const [creating, setCreating]           = useState(false);

  /* Bootstrap defaults + lookups */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [defRes, catRes, supRes] = await Promise.all([
          fetch("/api/create/defaults"),
          fetch("/api/finance/expense-categories"),
          fetch("/api/contacts?type=supplier"),
        ]);
        const def  = await defRes.json();
        const cats = await catRes.json().catch(() => ({ categories: [] }));
        const sups = await supRes.json().catch(() => ({ contacts: [] }));
        const d = def.defaults as SmartDefaults;
        setDefaults(d);
        /* Currency itself is handled by useBaseCurrencyOptional above —
           we only consume the OTHER smart defaults (category id, etc.). */
        if (d.default_expense_category_id) setCategoryId(d.default_expense_category_id);
        setCategories(
          ((cats.categories ?? cats.rows ?? []) as Array<{ id: string; name: string }>)
            .map((c) => ({ id: c.id, label: c.name }))
        );
        setSuppliers(
          ((sups.contacts ?? sups.suppliers ?? []) as Array<{ id: string; company_name: string | null; display_name: string | null }>)
            .map((s) => ({ id: s.id, label: s.company_name ?? s.display_name ?? s.id.slice(0, 8) }))
        );
      } catch (e) {
        setError(humanizeError(e));
      } finally { setLoading(false); }
    })();
  }, []);

  async function createCategory(): Promise<PickerOption | null> {
    setCatModalOpen(true);
    return null;       // handled by the modal's own submit
  }
  async function submitCategory() {
    if (!newCatName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/finance/expense-categories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      const created: PickerOption = { id: j.category?.id ?? j.id, label: j.category?.name ?? newCatName };
      setCategories((cs) => [...cs, created]);
      setCategoryId(created.id);
      setCatModalOpen(false);
      setNewCatName("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally { setCreating(false); }
  }

  async function createSupplier(): Promise<PickerOption | null> {
    setSupModalOpen(true);
    return null;
  }
  async function submitSupplier() {
    if (!newSupName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch("/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: newSupName.trim(),
          display_name: newSupName.trim(),
          email: newSupEmail || null,
          contact_type: "supplier",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      const id = j.contact?.id ?? j.id;
      const created: PickerOption = { id, label: newSupName.trim() };
      setSuppliers((s) => [...s, created]);
      setSupplierId(id);
      setSupModalOpen(false);
      setNewSupName(""); setNewSupEmail("");
    } catch (e) {
      showToast(e instanceof Error ? e.message : String(e), "error");
    } finally { setCreating(false); }
  }

  async function save() {
    if (!title.trim()) { setError(t("create.expense.err.title", "Title is required.")); return; }
    if (!amount || Number(amount) <= 0) { setError(t("create.expense.err.amount", "Amount must be greater than zero.")); return; }
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/finance/expenses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          amount: Number(amount),
          currency,
          expense_date: date,
          due_date: dueDate || null,
          payment_status: paymentStatus,
          category_id: categoryId,
          linked_supplier_id: supplierId,
          notes: notes.trim() || null,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(humanizeError(j.error || `HTTP ${r.status}`));
      const id = j.expense?.id ?? j.id;
      /* Smart-entry: success → wipe the saved draft so the form
         doesn't offer to "resume" it next time. */
      draft.clear();
      router.push(`/finance/expenses?id=${id ?? ""}`);
    } catch (e) {
      setError(humanizeError(e));
    } finally { setBusy(false); }
  }

  return (
    <SmartCreatePage
      title={t("create.expense.title", "New Expense")}
      kind={t("create.expense.kind", "Finance · Operating cost")}
      intro={t("create.expense.intro", "Record a cost. Submit it for approval, then settle in bank when paid.")}
      icon="receipt"
      backHref="/create"
      workflow={WORKFLOW}
      primaryAction={{ label: t("create.expense.save", "Save Expense"), onClick: save, busy }}
      secondaryAction={{ label: t("create.expense.cancel", "Cancel"), onClick: () => router.push("/create") }}
      side={
        <SmartHelpCard
          title={t("create.expense.help.title", "What is this?")}
          meaning={t("create.expense.help.meaning", "An operating cost incurred by the business. Could be a cash outflow today or a liability you'll pay later (Net 30 etc).")}
          required={[t("create.expense.help.req.title", "Title"), t("create.expense.help.req.amount", "Amount"), t("create.expense.help.req.currency", "Currency"), t("create.expense.help.req.date", "Date")]}
          accountingImpact={t("create.expense.help.impact", "When approved + posted, expense lands on the P&L; if unpaid, AP balance grows.")}
          nextStep={t("create.expense.help.next", "Submit for approval, then attach a payment when settled.")}
        />
      }
    >
      {toastElement}
      {loading && <div className="text-sm text-[var(--text-dim)]">{t("create.expense.loading", "Loading defaults…")}</div>}
      {error && <div className="rounded-md border border-rose-300/40 bg-rose-300/[0.06] px-3 py-2 text-[12px] text-rose-200">{error}</div>}

      {/* Resume Draft prompt — surfaced when a previous unsaved attempt
          exists in localStorage. One click to restore, one to discard. */}
      {resumePromptOpen && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300/40 bg-amber-300/[0.06] px-3 py-2 text-[12px] text-amber-100">
          <span>{t("create.expense.draft.resume", "You have an unsaved draft from a previous session. Resume?")}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const v = draft.restore();
                if (v) {
                  setTitle(v.title); setAmount(v.amount);
                  setCurrency(v.currency); setCurrencyTouched(true);
                  setDate(v.date); setDueDate(v.dueDate);
                  setPaymentStatus(v.paymentStatus); setCategoryId(v.categoryId);
                  setSupplierId(v.supplierId); setNotes(v.notes);
                }
                setResumePromptOpen(false);
              }}
              className="rounded-md border border-emerald-300/40 bg-emerald-300/[0.10] px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-300/[0.18]">
              {t("create.expense.draft.yes", "Resume")}
            </button>
            <button
              type="button"
              onClick={() => { draft.clear(); setResumePromptOpen(false); }}
              className="rounded-md border border-white/[0.10] bg-white/[0.04] px-2.5 py-1 text-[11px] hover:bg-white/[0.08]">
              {t("create.expense.draft.no", "Discard")}
            </button>
          </div>
        </div>
      )}

      {!loading && (
        <>
          <SmartSection title={t("create.expense.sec.id", "Identification")} subtitle={t("create.expense.sec.idSub", "What is the expense about?")}>
            <SmartField label={t("create.expense.f.title", "Title")} required hint={t("create.expense.f.titleHint", 'Short, scannable. E.g. "Office rent — May 2026".')}>
              <SmartInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("create.expense.f.titlePh", "Office rent — May 2026")} />
            </SmartField>

            {categories.length === 0 ? (
              <SmartEmptyState
                icon="flag-alt"
                title={t("create.expense.cat.emptyTitle", "No expense categories yet")}
                body={t("create.expense.cat.emptyBody", "Categories make reports useful. Add at least one to keep your books organised.")}
                actionLabel={t("create.expense.cat.add", "Add Expense Category")}
                onAction={() => setCatModalOpen(true)}
              />
            ) : (
              <InlineEntityPicker
                label={t("create.expense.f.category", "Category")}
                value={categoryId}
                onChange={setCategoryId}
                options={categories}
                onCreate={createCategory}
                createLabel={t("create.expense.f.categoryNew", "+ New category")}
                placeholder={t("create.expense.f.categoryPh", "Choose category…")}
                hint={defaults?.default_expense_category_label ? t("create.expense.f.categoryDefault", "Default: {name}").replace("{name}", defaults.default_expense_category_label) : undefined}
              />
            )}
            <InlineEntityPicker
              label={t("create.expense.f.supplier", "Supplier")}
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers}
              onCreate={createSupplier}
              createLabel={t("create.expense.f.supplierNew", "+ New supplier")}
              placeholder={t("create.expense.f.supplierPh", "Choose supplier (optional)…")}
              hint={t("create.expense.f.supplierHint", "Linking a supplier feeds AP and supplier ledger reports.")}
            />
          </SmartSection>

          <SmartSection title={t("create.expense.sec.amount", "Amount")} subtitle={t("create.expense.sec.amountSub", "Money side of the entry")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SmartField label={t("create.expense.f.amount", "Amount")} required impact={["accounting"]}>
                <SmartInput type="number" step="0.01" value={amount}
                            onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
              </SmartField>
              <SmartField label={t("create.expense.f.currency", "Currency")} required impact={["accounting"]}
                          hint={defaults ? t("create.expense.f.currencyHint", "Tenant base: {ccy}").replace("{ccy}", defaults.base_currency) : undefined}>
                <SmartSelect value={currency} onChange={(e) => { setCurrency(e.target.value); setCurrencyTouched(true); }}>
                  {["CNY", "USD", "EUR", "GBP", "AED", "SAR", "EGP"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </SmartSelect>
              </SmartField>
              <SmartField label={t("create.expense.f.payStatus", "Payment status")} hint={t("create.expense.f.payStatusHint", "Mark Paid only if money has already left.")}>
                <SmartSelect value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as "unpaid" | "paid")}>
                  <option value="unpaid">{t("create.expense.f.unpaid", "Unpaid (owed)")}</option>
                  <option value="paid">{t("create.expense.f.paid", "Paid")}</option>
                </SmartSelect>
              </SmartField>
            </div>
          </SmartSection>

          <SmartSection title={t("create.expense.sec.dates", "Dates")} subtitle={t("create.expense.sec.datesSub", "When did this happen?")}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SmartField label={t("create.expense.f.date", "Expense date")} required>
                <SmartInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </SmartField>
              <SmartField label={t("create.expense.f.due", "Due date")} hint={t("create.expense.f.dueHint", "Defaults to {terms} if you leave blank.").replace("{terms}", defaults?.default_payment_terms ?? "Net 30")}>
                <SmartInput type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </SmartField>
            </div>
          </SmartSection>

          <SmartSection title={t("create.expense.sec.notes", "Notes")} subtitle={t("create.expense.sec.notesSub", "Anything useful for an approver")}>
            <SmartField label={t("create.expense.f.notes", "Notes")} hint={t("create.expense.f.notesHint", "Optional. Shown on the activity log.")}>
              <SmartTextarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("create.expense.f.notesPh", "Receipt #4521 — for landlord.")} />
            </SmartField>
          </SmartSection>
        </>
      )}

      {/* Inline-create modals */}
      <InlineCreateModal
        open={catModalOpen}
        title={t("create.expense.modal.catTitle", "New Expense Category")}
        intro={t("create.expense.modal.catIntro", "Categories drive P&L grouping and reports.")}
        onClose={() => setCatModalOpen(false)}
        busy={creating}
        onSubmit={submitCategory}
      >
        <SmartField label={t("create.expense.modal.catName", "Category name")} required>
          <SmartInput autoFocus value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder={t("create.expense.modal.catPh", "Office rent")} />
        </SmartField>
      </InlineCreateModal>

      <InlineCreateModal
        open={supModalOpen}
        title={t("create.expense.modal.supTitle", "New Supplier")}
        intro={t("create.expense.modal.supIntro", "Used for bills, payments, and AP reports.")}
        onClose={() => setSupModalOpen(false)}
        busy={creating}
        onSubmit={submitSupplier}
      >
        <SmartField label={t("create.expense.modal.supName", "Company name")} required>
          <SmartInput autoFocus value={newSupName} onChange={(e) => setNewSupName(e.target.value)} placeholder={t("create.expense.modal.supPh", "Acme Logistics")} />
        </SmartField>
        <SmartField label={t("create.expense.modal.email", "Email")} hint={t("create.expense.modal.emailHint", "Optional. We won't email anyone without your action.")}>
          <SmartInput type="email" value={newSupEmail} onChange={(e) => setNewSupEmail(e.target.value)} placeholder="ops@acme.com" />
        </SmartField>
      </InlineCreateModal>
    </SmartCreatePage>
  );
}
