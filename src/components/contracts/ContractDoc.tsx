"use client";

/* ---------------------------------------------------------------------------
   The sales-contract screen.

   Two panes: what was negotiated on the left, the document it produces on the
   right. Editing on the left and reading the result on the right is the whole
   interaction — there is no separate "preview" mode to forget to open.

   ── Why the terms are a form and the articles are not ──────────────────────
   Only a handful of things actually differ between two deals: the delivery
   term, the payment shape, the clock, the warranty, the inspection, the law,
   and whatever was specially agreed. Those are the form. The twenty articles
   that follow from them are generated, not typed, because a contract that
   people retype is a contract that drifts.

   ── Signing ───────────────────────────────────────────────────────────────
   Signature is one-way and the UI says so before it happens. Afterwards the
   left pane is gone: there is nothing left to negotiate.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ContractA4 from "./ContractA4";
import { checkContract, blocksSignature, type Finding } from "@/lib/contracts/contradictions";
import type { ContractRow, ContractTerms, InvoiceLite } from "./types";
import {
  ArrowLeftIcon,
  ContractIcon,
  LockIcon,
  PrintIcon,
  TrashIcon,
  TriangleWarningIcon,
} from "@/components/icons/ui";

/* ── Small building blocks ────────────────────────────────────────────────── */

const FIELD_LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "var(--text-secondary)",
  marginBottom: 4,
};

const INPUT =
  "w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-[13px] text-[var(--text-primary)] outline-none transition focus:border-[var(--border-strong)]";

function Field({
  label,
  hint,
  flagged,
  children,
}: {
  label: string;
  hint?: string;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={FIELD_LABEL}>
        {label}
        {flagged ? <span style={{ color: "var(--kx-warn, #f59e0b)", marginInlineStart: 6 }}>•</span> : null}
      </label>
      {children}
      {hint ? (
        <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>{hint}</div>
      ) : null}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 20 }}>
      <h3
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          marginBottom: 10,
          paddingBottom: 6,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        {title}
      </h3>
      <div style={{ display: "grid", gap: 12 }}>{children}</div>
    </section>
  );
}

const SEVERITY_STYLE: Record<Finding["severity"], { bg: string; fg: string; border: string; label: string }> = {
  error: { bg: "rgba(244,63,94,0.10)", fg: "#fb7185", border: "rgba(244,63,94,0.35)", label: "Contradiction" },
  warn: { bg: "rgba(245,158,11,0.10)", fg: "#fbbf24", border: "rgba(245,158,11,0.35)", label: "Check" },
  note: { bg: "rgba(96,165,250,0.10)", fg: "#93c5fd", border: "rgba(96,165,250,0.32)", label: "Note" },
};

function FindingCard({ f }: { f: Finding }) {
  const s = SEVERITY_STYLE[f.severity];
  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 10,
        padding: "9px 11px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <TriangleWarningIcon size={12} style={{ color: s.fg }} />
        <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em", color: s.fg, textTransform: "uppercase" }}>
          {s.label}
        </span>
      </div>
      <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.5 }}>{f.message}</div>
      <div style={{ fontSize: 11.5, color: "var(--text-secondary)", marginTop: 4, lineHeight: 1.5 }}>{f.fix}</div>
    </div>
  );
}

/* ── The screen ───────────────────────────────────────────────────────────── */

export default function ContractDoc({ id }: { id: string }) {
  const router = useRouter();
  const [row, setRow] = useState<ContractRow | null>(null);
  const [invoice, setInvoice] = useState<InvoiceLite | null>(null);
  const [terms, setTerms] = useState<ContractTerms>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmSign, setConfirmSign] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/sales-contracts/${id}`, { cache: "no-store" });
        const json = (await res.json()) as { contract?: ContractRow; invoice?: InvoiceLite; error?: string };
        if (!alive) return;
        if (!res.ok || !json.contract) {
          setLoadError(json.error ?? "Could not load this contract.");
          return;
        }
        setRow(json.contract);
        setInvoice(json.invoice ?? null);
        setTerms(json.contract.terms ?? {});
      } catch (e) {
        if (alive) setLoadError(e instanceof Error ? e.message : "Could not load this contract.");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const signed = row?.status === "signed";

  /* Runs on every keystroke — pure, no I/O, and the whole point is that the
     warning appears while the mistake is being made, not at signature. */
  const findings = useMemo(() => (signed ? [] : checkContract(terms)), [terms, signed]);
  const flaggedFields = useMemo(() => new Set(findings.map((f) => f.field).filter(Boolean) as string[]), [findings]);
  const cannotSign = blocksSignature(findings);

  const set = useCallback(<K extends keyof ContractTerms>(k: K, v: ContractTerms[K]) => {
    setTerms((t) => ({ ...t, [k]: v }));
    setSaveState("idle");
  }, []);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch(`/api/sales-contracts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { contract?: ContractRow; error?: string };
        if (!res.ok || !json.contract) throw new Error(json.error ?? "Save failed.");
        setRow(json.contract);
        setTerms(json.contract.terms ?? {});
        setSaveState("saved");
        return json.contract;
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Save failed.");
        setSaveState("error");
        return null;
      }
    },
    [id],
  );

  const handleSave = useCallback(() => void patch({ terms }), [patch, terms]);

  const handleSign = useCallback(async () => {
    setConfirmSign(false);
    await patch({ terms, status: "signed" });
  }, [patch, terms]);

  const handleDelete = useCallback(async () => {
    if (!row) return;
    if (!window.confirm(`Delete ${row.contract_no}? This cannot be undone.`)) return;
    const res = await fetch(`/api/sales-contracts/${id}`, { method: "DELETE" });
    if (res.ok) router.push(row.invoice_id ? "/invoices" : "/");
    else {
      const json = (await res.json()) as { error?: string };
      setSaveError(json.error ?? "Could not delete.");
      setSaveState("error");
    }
  }, [id, row, router]);

  if (loadError) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-[var(--text-primary)] font-semibold mb-2">{loadError}</div>
          <button
            onClick={() => router.push("/invoices")}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
          >
            Back to Invoices
          </button>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[var(--text-faint)] text-sm">Loading contract…</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* ── Toolbar ── */}
      <div
        className="no-print kx-glass"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-subtle)",
          flexWrap: "wrap",
        }}
      >
        <button
          onClick={() => router.push(row.invoice_id ? "/invoices" : "/")}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
        >
          <ArrowLeftIcon size={15} />
          Invoice
        </button>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)]">
          <ContractIcon size={14} className="text-[var(--text-secondary)]" />
          <span className="text-[13px] font-semibold tracking-tight text-[var(--text-primary)] font-mono">
            {row.contract_no}
          </span>
        </div>

        <StatusPill status={row.status} />

        <div style={{ flex: 1 }} />

        {saveState !== "idle" && (
          <span
            className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
              saveState === "saving"
                ? "bg-blue-500/15 text-blue-300 border-blue-500/40"
                : saveState === "saved"
                  ? "bg-emerald-500/12 text-emerald-400 border-emerald-500/35"
                  : "bg-rose-500/12 text-rose-400 border-rose-500/35"
            }`}
            title={saveError || undefined}
          >
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "✓ Saved"}
            {saveState === "error" && "✕ Save failed"}
          </span>
        )}

        {!signed && (
          <>
            <button
              onClick={handleSave}
              disabled={saveState === "saving"}
              className="px-4 py-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition disabled:opacity-50"
            >
              Save
            </button>
            <button
              onClick={() => setConfirmSign(true)}
              disabled={cannotSign || saveState === "saving"}
              title={
                cannotSign
                  ? "The contract contradicts itself — resolve the red findings first."
                  : "Freeze this contract as signed. It cannot be edited afterwards."
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--bg-inverted)] hover:opacity-90 text-[var(--text-inverted)] rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <LockIcon size={13} />
              Sign
            </button>
          </>
        )}

        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
        >
          <PrintIcon size={14} />
          Print
        </button>

        {!signed && (
          <button
            onClick={handleDelete}
            className="inline-flex items-center gap-1 px-3 py-2 text-sm text-red-400 bg-[var(--bg-surface)] hover:bg-red-500/20 rounded-lg transition"
            title="Delete this draft contract"
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>

      {/* ── Body: terms left, document right ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 20,
            padding: 20,
            flexWrap: "wrap",
          }}
        >
          {!signed && (
            <aside
              className="no-print kx-glass"
              style={{
                width: 360,
                flex: "1 1 320px",
                maxWidth: 420,
                borderRadius: 14,
                border: "1px solid var(--border-subtle)",
                padding: 16,
                position: "sticky",
                top: 0,
              }}
            >
              {findings.length > 0 && (
                <div style={{ display: "grid", gap: 8, marginBottom: 20 }}>
                  {findings.map((f) => (
                    <FindingCard key={f.id} f={f} />
                  ))}
                </div>
              )}

              <Group title="Delivery">
                <Field label="Incoterms 2020 rule" flagged={flaggedFields.has("incoterm")}>
                  <select
                    className={INPUT}
                    value={terms.incoterm ?? ""}
                    onChange={(e) => set("incoterm", e.target.value || undefined)}
                  >
                    <option value="">— none —</option>
                    {["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Named place"
                  hint="The rule is incomplete without one — “FOB Ningbo”, not “FOB”."
                  flagged={flaggedFields.has("incotermPlace")}
                >
                  <input
                    className={INPUT}
                    value={terms.incotermPlace ?? ""}
                    onChange={(e) => set("incotermPlace", e.target.value || undefined)}
                  />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <Field label="Port of loading" flagged={flaggedFields.has("loadingPort")}>
                    <input
                      className={INPUT}
                      value={terms.loadingPort ?? ""}
                      onChange={(e) => set("loadingPort", e.target.value || undefined)}
                    />
                  </Field>
                  <Field label="Port of discharge" flagged={flaggedFields.has("dischargePort")}>
                    <input
                      className={INPUT}
                      value={terms.dischargePort ?? ""}
                      onChange={(e) => set("dischargePort", e.target.value || undefined)}
                    />
                  </Field>
                </div>
              </Group>

              <Group title="Payment and timing">
                <Field
                  label="Payment shape"
                  hint="Inherited from the invoice. It decides which articles print."
                  flagged={flaggedFields.has("paymentTermId")}
                >
                  <select
                    className={INPUT}
                    value={terms.paymentKind ?? ""}
                    onChange={(e) => set("paymentKind", (e.target.value || undefined) as ContractTerms["paymentKind"])}
                  >
                    <option value="">— none —</option>
                    <option value="tt">T/T — telegraphic transfer</option>
                    <option value="lc">L/C — documentary credit</option>
                    <option value="dp">D/P — documents against payment</option>
                    <option value="da">D/A — documents against acceptance</option>
                    <option value="open">Open account</option>
                    <option value="mixed">Mixed / staged</option>
                  </select>
                </Field>
                <Field label="Payment term as printed">
                  <input
                    className={INPUT}
                    value={terms.paymentLabel ?? ""}
                    onChange={(e) => set("paymentLabel", e.target.value || undefined)}
                  />
                </Field>
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10 }}>
                  <Field label="Production" flagged={flaggedFields.has("leadTimeDays")}>
                    <input
                      className={INPUT}
                      type="number"
                      min={0}
                      value={terms.leadTimeDays ?? ""}
                      onChange={(e) => set("leadTimeDays", e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </Field>
                  <Field label="Days counted from" flagged={flaggedFields.has("leadTimeBasis")}>
                    <select
                      className={INPUT}
                      value={terms.leadTimeBasis ?? ""}
                      onChange={(e) =>
                        set("leadTimeBasis", (e.target.value || undefined) as ContractTerms["leadTimeBasis"])
                      }
                    >
                      <option value="after_deposit">the advance payment</option>
                      <option value="after_lc_opening">the operative credit</option>
                      <option value="after_order">the contract date</option>
                    </select>
                  </Field>
                </div>
              </Group>

              <Group title="Quality and cover">
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 10 }}>
                  <Field label="Warranty (months)" flagged={flaggedFields.has("warrantyMonths")}>
                    <input
                      className={INPUT}
                      type="number"
                      min={0}
                      value={terms.warrantyMonths ?? ""}
                      onChange={(e) => set("warrantyMonths", e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </Field>
                  <Field label="Inspection">
                    <select
                      className={INPUT}
                      value={terms.inspection ?? "seller"}
                      onChange={(e) => set("inspection", e.target.value as ContractTerms["inspection"])}
                    >
                      <option value="none">none agreed</option>
                      <option value="seller">by the Seller</option>
                      <option value="buyer">by the Buyer</option>
                      <option value="third_party">independent third party</option>
                    </select>
                  </Field>
                </div>
                <Field
                  label="Documents provided"
                  hint="One per line. Under a credit the bank pays against this list."
                  flagged={flaggedFields.has("documents")}
                >
                  <textarea
                    className={INPUT}
                    rows={4}
                    value={(terms.documents ?? []).join("\n")}
                    onChange={(e) =>
                      set(
                        "documents",
                        e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                      )
                    }
                  />
                </Field>
              </Group>

              <Group title="Law and special conditions">
                <Field
                  label="Governing law and forum"
                  hint="Name both — the law that applies and where a claim is brought."
                  flagged={flaggedFields.has("governingLaw")}
                >
                  <textarea
                    className={INPUT}
                    rows={3}
                    value={terms.governingLaw ?? ""}
                    onChange={(e) => set("governingLaw", e.target.value || undefined)}
                  />
                </Field>
                <Field
                  label="Special conditions"
                  hint="One per line. These outrank the general articles, and print after them."
                  flagged={flaggedFields.has("specialConditions")}
                >
                  <textarea
                    className={INPUT}
                    rows={4}
                    value={(terms.specialConditions ?? []).join("\n")}
                    onChange={(e) =>
                      set(
                        "specialConditions",
                        e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                      )
                    }
                  />
                </Field>
              </Group>

              <Group title="Execution">
                <Field label="Place of signing">
                  <input
                    className={INPUT}
                    value={row.place_of_signing ?? ""}
                    onChange={(e) => setRow((r) => (r ? { ...r, place_of_signing: e.target.value } : r))}
                    onBlur={(e) => void patch({ place_of_signing: e.target.value || null })}
                  />
                </Field>
                <Field label="Contract date">
                  <input
                    className={INPUT}
                    type="date"
                    value={row.contract_date ?? ""}
                    onChange={(e) => setRow((r) => (r ? { ...r, contract_date: e.target.value } : r))}
                    onBlur={(e) => void patch({ contract_date: e.target.value || null })}
                  />
                </Field>
              </Group>
            </aside>
          )}

          <div className="quot-a4-stack" style={{ flex: "1 1 210mm", minWidth: 0, display: "flex", justifyContent: "center" }}>
            <ContractA4
              contractNo={row.contract_no}
              status={row.status}
              contractDate={row.contract_date}
              placeOfSigning={row.place_of_signing}
              currency={row.currency}
              total={row.total}
              terms={terms}
              invoice={invoice}
              snapshot={row.snapshot}
            />
          </div>
        </div>
      </div>

      {/* ── Signature confirmation ── */}
      {confirmSign && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
          onClick={() => setConfirmSign(false)}
        >
          <div
            className="kx-pop-clear"
            style={{
              maxWidth: 460,
              width: "100%",
              borderRadius: 16,
              border: "1px solid var(--border-subtle)",
              padding: 22,
              background: "var(--bg-secondary)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-3">
              <LockIcon size={16} className="text-[var(--text-secondary)]" />
              <h2 className="text-[15px] font-semibold text-[var(--text-primary)]">Sign {row.contract_no}?</h2>
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] mb-2">
              Signing freezes the contract exactly as it reads now — the terms, the goods and prices from the invoice,
              and the articles as they currently print. It will not follow later changes to any of them.
            </p>
            <p className="text-[13px] leading-relaxed text-[var(--text-secondary)] mb-5">
              After this it cannot be edited. A change is made by raising an amendment, which takes its own number
              beside this one.
            </p>
            {findings.length > 0 && (
              <p className="text-[12px] text-[var(--text-faint)] mb-4">
                {findings.length} finding{findings.length === 1 ? "" : "s"} left unresolved — none of them blocking.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmSign(false)}
                className="px-4 py-2 text-sm rounded-lg text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition"
              >
                Not yet
              </button>
              <button
                onClick={handleSign}
                className="px-4 py-2 text-sm rounded-lg font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 transition"
              >
                Sign and freeze
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)]",
    ready: "bg-blue-500/12 text-blue-300 border-blue-500/35",
    signed: "bg-emerald-500/12 text-emerald-400 border-emerald-500/35",
    cancelled: "bg-rose-500/12 text-rose-400 border-rose-500/35",
    superseded: "bg-[var(--bg-surface)] text-[var(--text-faint)] border-[var(--border-subtle)]",
  };
  return (
    <span
      className={`inline-flex items-center h-[24px] px-2.5 rounded-full border text-[11px] font-semibold capitalize ${map[status] ?? map.draft}`}
    >
      {status}
    </span>
  );
}
