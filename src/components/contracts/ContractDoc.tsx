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
/* The sheet geometry (210 × 270 mm), the print page-breaks and the rules that
   hide the toolbar on paper all live here. Without it the contract had NO
   `.quot-a4-doc` definition at all — which is why it was carrying its own
   inline `297mm` and printing wherever the browser felt like cutting. Same
   import PackingListDoc uses. */
import { PRINT_AND_DOC_STYLES } from "@/components/quotations/Quotations";
import OrdersIcon from "@/components/icons/OrdersIcon";
import ScaleIcon from "@/components/icons/ui/ScaleIcon";
import { checkContract, blocksSignature, type Finding } from "@/lib/contracts/contradictions";
import type { ContractRef, ContractRow, ContractTerms, InvoiceLite } from "./types";
import {
  ArrowLeftIcon,
  ContractIcon,
  LockIcon,
  PrintIcon,
  TrashIcon,
  TriangleWarningIcon,
} from "@/components/icons/ui";

/* ── Small building blocks ────────────────────────────────────────────────── */

/* The label + input shapes the Invoices and Quotations editors use for their
   dark field row. Copied deliberately rather than invented: three documents
   edited side by side in one week should not each have their own idea of what
   a form field looks like. */
const FIELD_LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#666",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 4,
  display: "block",
};

const INPUT =
  "w-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder-gray-600 focus:outline-none focus:border-white/40 transition";

function Field({
  label,
  width = 200,
  grow = 1,
  hint,
  flagged,
  children,
}: {
  label: string;
  /** Minimum width before the row wraps — the invoice row's own mechanism. */
  width?: number;
  grow?: number;
  hint?: string;
  flagged?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ flex: `${grow} 1 ${width}px`, minWidth: width }}>
      <label style={FIELD_LABEL}>
        {label}
        {flagged ? <span style={{ color: "#fbbf24", marginInlineStart: 6 }}>•</span> : null}
      </label>
      {children}
      {hint ? <div style={{ fontSize: 10.5, color: "var(--text-faint)", marginTop: 3 }}>{hint}</div> : null}
    </div>
  );
}

/** One dark band of related fields, above the paper — the same arrangement
    the invoice uses for its customer row, repeated per group because a
    contract negotiates more than an invoice does. */
function FieldRow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="no-print kx-glass"
      style={{
        padding: "10px 16px 12px",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          color: "var(--text-faint)",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{children}</div>
    </div>
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
  /* Where this contract sits in the amendment chain. */
  const [amends, setAmends] = useState<ContractRef | null>(null);
  const [replacedBy, setReplacedBy] = useState<ContractRef | null>(null);
  const [amending, setAmending] = useState(false);
  /* The negotiated terms live in a modal, not in bands above the paper.
     Four stacked bands pushed the document below the fold and made the screen
     read as a form with a preview attached — the owner's word was
     "horrible… not organized". Invoices put their commercial terms behind a
     modal for the same reason: the DOCUMENT is what the screen is for. */
  const [termsOpen, setTermsOpen] = useState(false);

  /* The tenant's saved seal and signature — they belong to the COMPANY, not
     to this contract, so they load once when the screen mounts. Same endpoint
     the quotation and invoice editors use. */
  const [savedStampUrl, setSavedStampUrl] = useState<string | null>(null);
  const [savedSignatureUrl, setSavedSignatureUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/quotations/saved-assets", { credentials: "include" });
        if (!res.ok) return;
        const json = (await res.json()) as { stampUrl: string | null; signatureUrl: string | null };
        if (cancelled) return;
        setSavedStampUrl(json.stampUrl);
        setSavedSignatureUrl(json.signatureUrl);
      } catch {
        /* Non-fatal — the buttons degrade to upload-only. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* Uploading REPLACES the tenant's saved asset and attaches it here, exactly
     as the invoice editor behaves. */
  const uploadAsset = useCallback(async (kind: "stamp" | "signature", file: File) => {
    const form = new FormData();
    form.append("kind", kind);
    form.append("file", file);
    try {
      const res = await fetch("/api/quotations/saved-assets", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!res.ok) return;
      const json = (await res.json()) as { url?: string };
      if (!json.url) return;
      const url = json.url;
      if (kind === "stamp") {
        setSavedStampUrl(url);
        setTerms((t) => ({ ...t, stampUrl: url }));
      } else {
        setSavedSignatureUrl(url);
        setTerms((t) => ({ ...t, signatureUrl: url }));
      }
      setSaveState("idle");
    } catch {
      /* Non-fatal. */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/sales-contracts/${id}`, { cache: "no-store" });
        const json = (await res.json()) as {
          contract?: ContractRow;
          invoice?: InvoiceLite;
          amends?: ContractRef | null;
          replacedBy?: ContractRef | null;
          error?: string;
        };
        if (!alive) return;
        if (!res.ok || !json.contract) {
          setLoadError(json.error ?? "Could not load this contract.");
          return;
        }
        setRow(json.contract);
        setInvoice(json.invoice ?? null);
        setTerms(json.contract.terms ?? {});
        setAmends(json.amends ?? null);
        setReplacedBy(json.replacedBy ?? null);
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
  /* The goods go IN to the checker. Without them it cannot see that the
     articles promise 12 months while every line of the schedule says
     "Warranty: 5 YEARS" — a contradiction on one page that reading the terms
     object alone can never find. Taken from the same place the paper takes
     them, so what is checked is what prints. */
  const goodsForCheck = useMemo(
    () => {
      const raw = (invoice?.doc as { items?: unknown } | undefined)?.items;
      return Array.isArray(raw)
        ? (raw as { description?: string }[]).map((it) => ({ description: it.description }))
        : [];
    },
    [invoice],
  );

  const findings = useMemo(
    () => (signed ? [] : checkContract({ ...terms, goods: goodsForCheck })),
    [terms, goodsForCheck, signed],
  );
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

  /* Amending does not touch this contract — it raises the replacement and
     leaves this one in force until that replacement is signed. */
  const handleAmend = useCallback(async () => {
    if (!row) return;
    setAmending(true);
    try {
      const res = await fetch(`/api/sales-contracts/${row.id}/amend`, { method: "POST" });
      const json = (await res.json()) as { contract?: { id: string }; error?: string };
      if (!res.ok || !json.contract) throw new Error(json.error ?? "Could not raise the amendment.");
      router.push(`/contracts/${json.contract.id}`);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not raise the amendment.");
      setSaveState("error");
      setAmending(false);
    }
  }, [row, router]);

  /* ── Print / PDF ──────────────────────────────────────────────────────
     Through a HIDDEN IFRAME pointing at /contracts/<id>/print, never
     window.print() on this window. Printing the editor drags the whole Hub
     layout into the print pass; even with .no-print on the chrome the
     surviving wrappers impose their own heights on the page box, which is
     the "pages don't fit, lots of empty pages" the owner saw. Invoices hit
     exactly this and solved it the same way. */
  const handlePrint = useCallback(() => {
    if (!row) return;
    const FRAME_ID = "koleex-contract-print-frame";
    let frame = document.getElementById(FRAME_ID) as HTMLIFrameElement | null;
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = FRAME_ID;
      frame.style.position = "fixed";
      frame.style.left = "-10000px";
      frame.style.top = "0";
      frame.style.width = "210mm";
      frame.style.height = "297mm";
      frame.style.border = "none";
      /* Off-screen by position, never visibility:hidden — some browsers skip
         invisible iframes when printing. */
      document.body.appendChild(frame);
    }
    /* Cache-bust so a second print always reloads fresh server data. */
    frame.src = `/contracts/${encodeURIComponent(row.id)}/print?_t=${Date.now()}`;
    const onLoad = () => {
      frame!.removeEventListener("load", onLoad);
      const ready = () => {
        const win = frame!.contentWindow as (Window & { __quotation_pdf_ready__?: boolean }) | null;
        if (win?.__quotation_pdf_ready__) {
          win.focus();
          win.print();
        } else {
          setTimeout(ready, 100);
        }
      };
      ready();
    };
    frame.addEventListener("load", onLoad);
  }, [row]);

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
      <style>{PRINT_AND_DOC_STYLES}</style>

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

        {/* The deal this contract belongs to. Every document of an order can
            be reached from every other; a contract that only knew its invoice
            would be a dead end. */}
        {row.order_id ? (
          <button
            onClick={() => router.push(`/orders/${row.order_id}`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.1] transition"
            title="Open the order and every document raised against it"
          >
            <OrdersIcon size={13} />
            <span className="font-mono">KL-{row.deal_no}</span>
          </button>
        ) : null}

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
            {/* Opens the terms. The finding count rides ON the button so
                moving the fields into a modal cannot hide a contradiction —
                a checker you have to go looking for is a checker nobody
                reads. Red when something blocks signature. */}
            <button
              onClick={() => setTermsOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-secondary)] bg-[var(--bg-surface)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-inverted)]/[0.1] rounded-lg transition"
            >
              <ScaleIcon size={14} />
              Terms
              {findings.length > 0 && (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                    cannotSign
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : "bg-amber-500/18 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {findings.length}
                </span>
              )}
            </button>
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

        {signed && !replacedBy && (
          <button
            onClick={handleAmend}
            disabled={amending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--bg-inverted)] hover:opacity-90 text-[var(--text-inverted)] rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Raise a replacement contract. This one stays in force until the replacement is signed."
          >
            <ContractIcon size={13} />
            {amending ? "Raising…" : "Amend"}
          </button>
        )}

        <button
          onClick={handlePrint}
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

      {/* ── Where this contract sits in the chain ──
          A reader who opens a retired contract must not have to work out that
          it is retired, and a reader of an amendment must be able to see what
          it changes. Both states say so on the page, above everything else. */}
      {(replacedBy || amends) && (
        <div className="no-print px-4 pt-3 flex flex-col gap-2">
          {replacedBy && (
            <ChainBanner
              tone="retired"
              text={
                replacedBy.status === "signed"
                  ? `Superseded by ${replacedBy.contract_no}. That contract is the one in force.`
                  : `${replacedBy.contract_no} is being drafted to replace this. This contract stays in force until that one is signed.`
              }
              action={{ label: `Open ${replacedBy.contract_no}`, href: `/contracts/${replacedBy.id}` }}
            />
          )}
          {amends && (
            <ChainBanner
              tone="amendment"
              text={
                signed
                  ? `This amendment replaced ${amends.contract_no}.`
                  : `Amends ${amends.contract_no}, which stays in force until this is signed.`
              }
              action={{ label: `Open ${amends.contract_no}`, href: `/contracts/${amends.id}` }}
            />
          )}
        </div>
      )}

      {/* ── The negotiated terms, above the paper ──
          Not a side panel. The Invoices and Quotations editors both put their
          editable fields in a dark band directly above the A4 and let the
          document have the width; a contract that arranged itself differently
          would read as a different application. */}
      {!signed && termsOpen && (
        <div
          className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-auto p-4 sm:p-6"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(10px)" }}
          onClick={() => setTermsOpen(false)}
        >
          <div
            className="kx-pop-clear w-full"
            style={{
              maxWidth: 980,
              borderRadius: 16,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-subtle)]">
              <h2 className="text-[14px] font-semibold text-[var(--text-primary)]">
                Negotiated terms — {row.contract_no}
              </h2>
              <button
                onClick={() => setTermsOpen(false)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--bg-inverted)] text-[var(--text-inverted)] hover:opacity-90 transition"
              >
                Done
              </button>
            </div>
          <FieldRow title="Delivery">
            <Field label="Incoterms 2020 rule" width={150} flagged={flaggedFields.has("incoterm")}>
              <select className={INPUT} value={terms.incoterm ?? ""} onChange={(e) => set("incoterm", e.target.value || undefined)}>
                <option value="">— none —</option>
                {["EXW", "FCA", "FAS", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Named place" hint="The rule is incomplete without one — “FOB Ningbo”, not “FOB”." flagged={flaggedFields.has("incotermPlace")}>
              <input className={INPUT} value={terms.incotermPlace ?? ""} onChange={(e) => set("incotermPlace", e.target.value || undefined)} placeholder="e.g. Ningbo, China" />
            </Field>
            <Field label="Port of loading" flagged={flaggedFields.has("loadingPort")}>
              <input className={INPUT} value={terms.loadingPort ?? ""} onChange={(e) => set("loadingPort", e.target.value || undefined)} placeholder="—" />
            </Field>
            <Field label="Port of discharge" flagged={flaggedFields.has("dischargePort")}>
              <input className={INPUT} value={terms.dischargePort ?? ""} onChange={(e) => set("dischargePort", e.target.value || undefined)} placeholder="—" />
            </Field>
          </FieldRow>

          <FieldRow title="Payment and timing">
            <Field label="Payment shape" width={210} hint="Decides which articles print." flagged={flaggedFields.has("paymentTermId")}>
              <select className={INPUT} value={terms.paymentKind ?? ""} onChange={(e) => set("paymentKind", (e.target.value || undefined) as ContractTerms["paymentKind"])}>
                <option value="">— none —</option>
                <option value="tt">T/T — telegraphic transfer</option>
                <option value="lc">L/C — documentary credit</option>
                <option value="dp">D/P — documents against payment</option>
                <option value="da">D/A — documents against acceptance</option>
                <option value="open">Open account</option>
                <option value="mixed">Mixed / staged</option>
              </select>
            </Field>
            <Field label="Payment term as printed" grow={2} width={260}>
              <input className={INPUT} value={terms.paymentLabel ?? ""} onChange={(e) => set("paymentLabel", e.target.value || undefined)} placeholder="e.g. 30% T/T deposit, 70% before shipment" />
            </Field>
            <Field label="Production (days)" width={130} grow={0} flagged={flaggedFields.has("leadTimeDays")}>
              <input className={INPUT} type="number" min={0} value={terms.leadTimeDays ?? ""} onChange={(e) => set("leadTimeDays", e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Counted from" width={190} flagged={flaggedFields.has("leadTimeBasis")}>
              <select className={INPUT} value={terms.leadTimeBasis ?? ""} onChange={(e) => set("leadTimeBasis", (e.target.value || undefined) as ContractTerms["leadTimeBasis"])}>
                <option value="after_deposit">the advance payment</option>
                <option value="after_lc_opening">the operative credit</option>
                <option value="after_order">the contract date</option>
              </select>
            </Field>
          </FieldRow>

          <FieldRow title="Quality, cover and documents">
            <Field label="Warranty (months)" width={140} grow={0} flagged={flaggedFields.has("warrantyMonths")}>
              <input className={INPUT} type="number" min={0} value={terms.warrantyMonths ?? ""} onChange={(e) => set("warrantyMonths", e.target.value ? Number(e.target.value) : undefined)} />
            </Field>
            <Field label="Inspection" width={190}>
              <select className={INPUT} value={terms.inspection ?? "seller"} onChange={(e) => set("inspection", e.target.value as ContractTerms["inspection"])}>
                <option value="none">none agreed</option>
                <option value="seller">by the Seller</option>
                <option value="buyer">by the Buyer</option>
                <option value="third_party">independent third party</option>
              </select>
            </Field>
            <Field label="Documents provided" grow={3} width={300} hint="One per line. Under a credit the bank pays against this list." flagged={flaggedFields.has("documents")}>
              <textarea className={INPUT} rows={3} value={(terms.documents ?? []).join("\n")} onChange={(e) => set("documents", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
            </Field>
          </FieldRow>

          <FieldRow title="Law, special conditions and execution">
            <Field label="Governing law and forum" grow={2} width={300} hint="Name both — the law that applies and where a claim is brought." flagged={flaggedFields.has("governingLaw")}>
              <textarea className={INPUT} rows={3} value={terms.governingLaw ?? ""} onChange={(e) => set("governingLaw", e.target.value || undefined)} />
            </Field>
            <Field label="Special conditions" grow={2} width={300} hint="One per line. These outrank the general articles, and print after them." flagged={flaggedFields.has("specialConditions")}>
              <textarea className={INPUT} rows={3} value={(terms.specialConditions ?? []).join("\n")} onChange={(e) => set("specialConditions", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} />
            </Field>
            <Field label="Place of signing" width={180}>
              <input className={INPUT} value={row.place_of_signing ?? ""} onChange={(e) => setRow((r) => (r ? { ...r, place_of_signing: e.target.value } : r))} onBlur={(e) => void patch({ place_of_signing: e.target.value || null })} placeholder="e.g. Taizhou" />
            </Field>
            <Field label="Contract date" width={160} grow={0}>
              <input className={INPUT} type="date" value={row.contract_date ?? ""} onChange={(e) => setRow((r) => (r ? { ...r, contract_date: e.target.value } : r))} onBlur={(e) => void patch({ contract_date: e.target.value || null })} />
            </Field>
          </FieldRow>

          {/* The checker's findings sit with the fields they are about. */}
          {findings.length > 0 && (
            <div
              className="no-print"
              style={{ padding: "10px 16px 14px" }}
            >
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {findings.map((f) => (
                  <div key={f.id} style={{ flex: "1 1 300px", minWidth: 280 }}>
                    <FindingCard f={f} />
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* ── The paper ── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="quot-a4-stack" style={{ padding: "20px 0 40px" }}>
          <ContractA4
            contractNo={row.contract_no}
            status={row.status}
            dealNo={row.deal_no}
            contractDate={row.contract_date}
            placeOfSigning={row.place_of_signing}
            currency={row.currency}
            total={row.total}
            terms={terms}
            invoice={invoice}
            snapshot={row.snapshot}
            amendsNo={amends?.contract_no ?? null}
            /* A signed contract is read-only: its seal is part of the frozen
               record and must not gain a Clear button. */
            isEditable={!signed}
            savedStampUrl={savedStampUrl}
            savedSignatureUrl={savedSignatureUrl}
            onAttachSavedStamp={() => savedStampUrl && set("stampUrl", savedStampUrl)}
            onAttachSavedSignature={() => savedSignatureUrl && set("signatureUrl", savedSignatureUrl)}
            onUploadStamp={(f) => void uploadAsset("stamp", f)}
            onUploadSignature={(f) => void uploadAsset("signature", f)}
            onClearStamp={() => set("stampUrl", undefined)}
            onClearSignature={() => set("signatureUrl", undefined)}
          />
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

function ChainBanner({
  tone,
  text,
  action,
}: {
  tone: "retired" | "amendment";
  text: string;
  action: { label: string; href: string };
}) {
  const router = useRouter();
  const retired = tone === "retired";
  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border px-3.5 py-2.5"
      style={{
        background: retired ? "rgba(244,63,94,0.09)" : "rgba(96,165,250,0.09)",
        borderColor: retired ? "rgba(244,63,94,0.32)" : "rgba(96,165,250,0.30)",
      }}
    >
      <span className="text-[12.5px] text-[var(--text-primary)]">{text}</span>
      <button
        onClick={() => router.push(action.href)}
        className="ms-auto text-[12px] font-semibold underline underline-offset-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
      >
        {action.label}
      </button>
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
