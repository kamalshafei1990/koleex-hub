"use client";

/* The review queue for "Become Koleex Member".

   Before this screen a request was a mail message and nothing else. There was
   no way to tell a handled one from an untouched one, no way to see that the
   same company had applied three times, and two reviewers could each spend an
   afternoon on the same application without knowing.

   Approving does NOT create an account — the owner's rule. Who gets in, with
   which role and which prices, is decided by a person in Roles & Permissions
   and Commercial Policy. What this screen does is carry the decision and hand
   the reviewer to the account form with the applicant's details already in
   the query string, so nobody retypes a name and an email that are sitting
   right there. */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import { flagOf } from "@/lib/countries-dial";

type Status = "pending" | "approved" | "rejected";

interface Doc { path: string; name: string; mime: string; bytes: number }

interface RequestRow {
  id: string;
  ref: string | null;
  full_name: string;
  email: string;
  company: string | null;
  message: string | null;
  status: Status;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  created_at: string;
  applications_from_this_email: number;
  metadata: Record<string, unknown>;
}

const TABS: Array<{ id: Status | "all"; label: string }> = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Refused" },
  { id: "all", label: "All" },
];

/* Free-mail domains are flagged for the reviewer, never rejected. Plenty of
   real traders in Egypt and China run their business from one. */
const FREE_MAIL = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
  "qq.com", "163.com", "126.com", "foxmail.com", "live.com", "aol.com",
]);

function domainOf(email: string): string {
  return email.split("@")[1]?.toLowerCase() ?? "";
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });
}

const label =
  "text-[10px] font-semibold uppercase tracking-[0.09em] text-[var(--text-faint)]";

export default function MembershipRequests() {
  const [tab, setTab] = useState<Status | "all">("pending");
  const [rows, setRows] = useState<RequestRow[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch(`/api/membership-requests?status=${tab}`, {
        credentials: "include",
      });
      const json = (await res.json()) as
        | { requests: RequestRow[]; counts: Record<string, number> }
        | { error: string };
      if (!res.ok || "error" in json) {
        setErr("error" in json ? json.error : `Failed (${res.status})`);
        setRows([]);
        return;
      }
      setRows(json.requests);
      setCounts(json.counts);
    } catch {
      setErr("Network problem.");
      setRows([]);
    }
  }, [tab]);

  useEffect(() => { void load(); }, [load]);

  async function decide(row: RequestRow, status: Status) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/membership-requests/${row.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    setBusy(false);
    if (!res.ok) { setErr(json?.error ?? `Failed (${res.status})`); return; }
    setNote("");
    setOpenId(null);
    void load();
  }

  const open = rows?.find((r) => r.id === openId) ?? null;

  return (
    <div className="p-5 md:p-7 max-w-[1100px] mx-auto">
      <header className="mb-5">
        <h1 className="text-[19px] font-bold text-[var(--text-primary)] tracking-tight">
          Membership requests
        </h1>
        <p className="text-[12px] text-[var(--text-dim)] mt-1">
          Applications from the sign-in screen. Approving records the decision —
          the account is still created by hand, with the role and access it should have.
        </p>
      </header>

      <div className="flex gap-1 mb-4 border-b border-[var(--border-subtle)]">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            onClick={() => { setTab(tb.id); setOpenId(null); }}
            className={`relative h-9 px-3.5 text-[12px] font-semibold transition-colors ${
              tab === tb.id
                ? "text-[var(--text-primary)]"
                : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
            }`}
          >
            {tb.label}
            {tb.id !== "all" && counts[tb.id] != null && (
              <span className="ms-1.5 text-[11px] tabular-nums text-[var(--text-faint)]">
                {counts[tb.id]}
              </span>
            )}
            {tab === tb.id && (
              <span aria-hidden className="absolute bottom-0 inset-x-2 h-[2px] rounded-full bg-[var(--text-primary)]" />
            )}
          </button>
        ))}
      </div>

      {err && (
        <p className="mb-3 flex items-center gap-2 text-[12px] text-red-400">
          <ExclamationIcon className="h-3.5 w-3.5 shrink-0" /> {err}
        </p>
      )}

      {rows === null ? (
        <p className="text-[12px] text-[var(--text-dim)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-[13px] text-[var(--text-dim)] py-10 text-center">
          Nothing here.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const m = r.metadata ?? {};
            const country = String(m.country ?? "");
            const isOpen = openId === r.id;
            const docs = (m.documents ?? []) as Doc[];
            const free = FREE_MAIL.has(domainOf(r.email));
            return (
              <li
                key={r.id}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => { setOpenId(isOpen ? null : r.id); setNote(""); }}
                  className="w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-[var(--bg-surface-subtle)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold text-[var(--text-primary)] truncate">
                        {r.full_name}
                      </span>
                      {r.company && (
                        <span className="text-[12px] text-[var(--text-dim)] truncate">
                          · {r.company}
                        </span>
                      )}
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--bg-surface-subtle)] text-[var(--text-dim)]">
                        {String(m.relationship_label ?? "—")}
                      </span>
                      {r.applications_from_this_email > 1 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                          {r.applications_from_this_email} applications
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-faint)] mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="tabular-nums">{r.ref ?? "—"}</span>
                      <span>· {fmtDate(r.created_at)}</span>
                      {country && <span>· {flagOf(country)} {country}</span>}
                      {docs.length > 0 && (
                        <span className="inline-flex items-center gap-1">
                          · <PaperclipIcon className="h-3 w-3" /> {docs.length}
                        </span>
                      )}
                      {r.status !== "pending" && (
                        <span>
                          · {r.status === "approved" ? "Approved" : "Refused"}
                          {r.reviewed_by_name ? ` by ${r.reviewed_by_name}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--border-subtle)] px-4 py-4 space-y-4">
                    <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-3">
                      <Field k="Email" v={r.email} warn={free ? "personal address" : undefined} />
                      <Field k="Phone" v={String(m.phone ?? "")} />
                      <Field k="Job title" v={String(m.job_title ?? "")} />
                      <Field k="Contact at Koleex" v={String(m.koleex_contact ?? "")} />
                      <Field k="Customer code" v={String(m.customer_code ?? "")} />
                      <Field k="Partnership" v={String(m.partner_type ?? "")} />
                      <Field k="Territory" v={String(m.territory ?? "")} />
                      <Field k="Supplies" v={String(m.supplies ?? "")} />
                      <Field k="Website" v={String(m.website ?? "")} />
                      <Field k="Heard from" v={String(m.heard_from ?? "")} />
                      <Field k="Language" v={String(m.language ?? "")} />
                    </dl>

                    {r.message && (
                      <div>
                        <div className={label}>Message</div>
                        <p className="text-[12.5px] text-[var(--text-primary)] mt-1 whitespace-pre-wrap leading-relaxed">
                          {r.message}
                        </p>
                      </div>
                    )}

                    <div>
                      <div className={label}>Proof documents</div>
                      {docs.length === 0 ? (
                        <p className="text-[12px] text-amber-400 mt-1">
                          None attached — a company license is required.
                        </p>
                      ) : (
                        <ul className="mt-1.5 space-y-1.5">
                          {docs.map((d) => (
                            <li key={d.path}>
                              {/* Signed for five minutes, minted server-side.
                                  There is no public URL to this bucket. */}
                              <a
                                href={`/api/membership-requests/${r.id}/document?path=${encodeURIComponent(d.path)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-[12px] text-[var(--text-primary)] underline decoration-[var(--border-subtle)] underline-offset-4 hover:decoration-current"
                              >
                                <PaperclipIcon className="h-3.5 w-3.5" />
                                {d.name}
                                <span className="text-[var(--text-faint)] tabular-nums">
                                  {Math.max(1, Math.round(d.bytes / 1024))} KB
                                </span>
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <label className={label} htmlFor={`note-${r.id}`}>
                        Decision note {r.status === "pending" ? "(required to refuse)" : ""}
                      </label>
                      <textarea
                        id={`note-${r.id}`}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                        placeholder="Why, in one line — the next person to read this row will not have your context."
                        className="mt-1.5 w-full rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] px-3 py-2 text-[12.5px] text-[var(--text-primary)] outline-none focus:border-[var(--text-faint)] resize-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(r, "approved")}
                        className="h-9 px-3.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[12px] font-semibold inline-flex items-center gap-2 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                      >
                        {busy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void decide(r, "rejected")}
                        className="h-9 px-3.5 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-[12px] font-semibold inline-flex items-center gap-2 hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        <CrossIcon className="h-3 w-3" />
                        Refuse
                      </button>

                      {/* The hand-off. Approving records a decision; somebody
                          still has to create the account, and everything they
                          need to type is already on this row. */}
                      <Link
                        href={`/accounts/new?username=${encodeURIComponent(r.email.split("@")[0])}&login_email=${encodeURIComponent(r.email)}&company=${encodeURIComponent(r.company ?? "")}&from_request=${encodeURIComponent(r.ref ?? "")}`}
                        className="h-9 px-3.5 rounded-lg border border-[var(--border-subtle)] text-[var(--text-primary)] text-[12px] font-semibold inline-flex items-center gap-2 hover:bg-[var(--bg-surface-subtle)] transition-colors"
                      >
                        <UserPlusIcon className="h-3.5 w-3.5" />
                        Create the account
                      </Link>

                      {/* No external mail provider is wired, so we do not
                          pretend to send one — this opens the reviewer's own
                          client with the reference already in the subject. */}
                      <a
                        href={`mailto:${encodeURIComponent(r.email)}?subject=${encodeURIComponent(`Koleex Hub · your request ${r.ref ?? ""}`)}`}
                        className="h-9 px-3.5 rounded-lg text-[var(--text-dim)] text-[12px] font-semibold inline-flex items-center hover:text-[var(--text-primary)] transition-colors"
                      >
                        Email the applicant
                      </a>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ k, v, warn }: { k: string; v: string; warn?: string }) {
  if (!v) return null;
  return (
    <div className="min-w-0">
      <div className={label}>{k}</div>
      <div className="text-[12.5px] text-[var(--text-primary)] break-words">{v}</div>
      {warn && <div className="text-[11px] text-amber-400 mt-0.5">{warn}</div>}
    </div>
  );
}
