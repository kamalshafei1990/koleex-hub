"use client";

/* ---------------------------------------------------------------------------
   Membership requests — the review queue for "Become Koleex Member".

   LAYOUT. The Hub's page shell, the same one Accounts uses: max-w-[1500px],
   back arrow → icon tile → title. Then master–detail, because the first
   version put a 1100px column on a 1500px page and then hid everything in an
   accordion, so a reviewer read one request at a time through a keyhole and
   every field carried the same visual weight.

   On lg and up the list sits beside the detail. Below lg there is only ever
   ONE of them on screen — picking a request replaces the list and a back
   button returns. Nothing is ever wider than its column: every grid track is
   minmax(0,…), every flex child that holds text has min-w-0, and long values
   wrap rather than push. The page scrolls down and never sideways.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import UserPlusIcon from "@/components/icons/ui/UserPlusIcon";
import CheckCircleIcon from "@/components/icons/ui/CheckCircleIcon";
import CrossIcon from "@/components/icons/ui/CrossIcon";
import PaperclipIcon from "@/components/icons/ui/PaperclipIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import ExclamationIcon from "@/components/icons/ui/ExclamationIcon";
import EnvelopeIcon from "@/components/icons/ui/EnvelopeIcon";
import UserPlus2Icon from "@/components/icons/ui/UserPlusIcon";
import BrandGlyph from "@/components/icons/brands/BrandGlyph";
import { flagOf, countryName, COUNTRY_DIALS } from "@/lib/countries-dial";

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

/* Raw column values are not labels. "agent" and "en" are what we store; a
   reviewer should read "Agent" and "English". */
const PARTNER_LABEL: Record<string, string> = {
  distributor: "Distributor", agent: "Agent", service: "Service partner", other: "Other",
};
const LANG_LABEL: Record<string, string> = {
  en: "English", zh: "中文", ar: "العربية",
};
const CHANNEL_LABEL: Record<string, string> = {
  email: "Email", whatsapp: "WhatsApp", wechat: "WeChat", telegram: "Telegram",
  messenger: "Messenger", sms: "SMS", phone: "Phone call", other: "Other",
};
const HEARD_LABEL: Record<string, string> = {
  linkedin: "LinkedIn", google: "Google or search", referral: "A colleague recommended us",
  existing_customer: "A Koleex customer recommended us", sales_rep: "A Koleex sales rep",
  partner: "A Koleex partner", exhibition: "Trade show", event: "Event or conference",
  website: "Koleex website", marketplace: "Alibaba / B2B marketplace", wechat: "WeChat",
  social: "Instagram / Facebook / YouTube", press: "Industry press", email: "Email from Koleex",
  other: "Somewhere else",
};
const CHANNEL_BRAND: Record<string, string> = {
  whatsapp: "whatsapp", wechat: "wechat", telegram: "telegram", messenger: "messenger",
};

const STATUS_STYLE: Record<Status, string> = {
  pending: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  approved: "bg-emerald-500/12 text-emerald-400 border-emerald-500/25",
  rejected: "bg-red-500/10 text-red-400 border-red-500/25",
};
const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending", approved: "Approved", rejected: "Refused",
};

/* Flagged for the reviewer, never refused — plenty of real traders in Egypt
   and China run a business from one of these. */
const FREE_MAIL = new Set([
  "gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com",
  "qq.com", "163.com", "126.com", "foxmail.com", "live.com", "aol.com",
]);

const KNOWN_COUNTRY = new Set(COUNTRY_DIALS.map((c) => c.code));

function domainOf(email: string) { return email.split("@")[1]?.toLowerCase() ?? ""; }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return fmtDate(iso);
}
function countryLabel(code: string) {
  if (!code) return "";
  const row = COUNTRY_DIALS.find((c) => c.code === code);
  return row ? `${flagOf(code)}  ${countryName(row, "en")}` : code;
}

/* THREE weights, deliberately different, because the first version gave the
   section heading and the field label the same one and the card read as an
   undifferentiated wall of grey capitals. */
const sectionCls =
  "text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--text-dim)]";
const cardCls =
  "rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)]";

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
      const res = await fetch(`/api/membership-requests?status=${tab}`, { credentials: "include" });
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
    void load();
  }

  const open = rows?.find((r) => r.id === openId) ?? null;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* Header — the Hub's shell, same as every other page in this app. */}
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Link
            href="/accounts"
            className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
              <UserPlus2Icon className="h-4 w-4" />
            </div>
            <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
              Membership requests
            </h1>
          </div>
        </div>
        <p className="text-[12.5px] text-[var(--text-dim)] mb-5 ms-11">
          Approving records the decision. The account is still created by hand,
          with the role and access it should have.
        </p>

        {err && (
          <p className="mb-3 flex items-center gap-2 text-[12px] text-red-400">
            <ExclamationIcon className="h-3.5 w-3.5 shrink-0" /> {err}
          </p>
        )}

        {/* Master–detail. One column below lg, and only one pane visible. */}
        <div className="grid lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-4 items-start">

          {/* ── List ── */}
          <div className={`${open ? "hidden lg:block" : "block"} min-w-0`}>
            {/* Tightens below sm so all four fit a 320px screen without the strip
                needing to scroll at all. overflow-x-auto stays as the safety
                net for a future fifth tab — the STRIP may scroll, the page
                never may. */}
            <div className="flex gap-0 sm:gap-1 mb-3 border-b border-[var(--border-subtle)] overflow-x-auto">
              {TABS.map((tb) => (
                <button
                  key={tb.id}
                  type="button"
                  onClick={() => { setTab(tb.id); setOpenId(null); }}
                  className={`relative h-9 px-2 sm:px-3 text-[11.5px] sm:text-[12px] font-semibold whitespace-nowrap transition-colors ${
                    tab === tb.id
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-dim)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tb.label}
                  {tb.id !== "all" && counts[tb.id] != null && (
                    <span className="ms-1 sm:ms-1.5 text-[11px] tabular-nums text-[var(--text-faint)]">
                      {counts[tb.id]}
                    </span>
                  )}
                  {tab === tb.id && (
                    <span aria-hidden className="absolute bottom-0 inset-x-1.5 sm:inset-x-2 h-[2px] rounded-full bg-[var(--text-primary)]" />
                  )}
                </button>
              ))}
            </div>

            {rows === null ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`${cardCls} h-[74px] animate-pulse`} />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className={`${cardCls} px-4 py-10 text-center text-[13px] text-[var(--text-dim)]`}>
                Nothing here.
              </p>
            ) : (
              <ul className="space-y-2">
                {rows.map((r) => {
                  const m = r.metadata ?? {};
                  const selected = openId === r.id;
                  const docs = (m.documents ?? []) as Doc[];
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => { setOpenId(r.id); setNote(""); }}
                        className={`w-full text-start px-3.5 py-3 rounded-2xl border transition-colors min-w-0 ${
                          selected
                            ? "border-[var(--text-faint)] bg-[var(--bg-surface-subtle)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-subtle)]"
                        }`}
                      >
                        <div className="flex items-start gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-semibold truncate">{r.full_name}</div>
                            <div className="text-[11.5px] text-[var(--text-dim)] truncate">
                              {r.company || r.email}
                            </div>
                          </div>
                          <StatusPill status={r.status} />
                        </div>
                        <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-[var(--text-faint)]">
                          <span className="tabular-nums">{r.ref ?? "—"}</span>
                          <span>·</span>
                          <span>{ago(r.created_at)}</span>
                          {String(m.relationship_label ?? "") && (
                            <>
                              <span>·</span>
                              <span className="truncate">{String(m.relationship_label)}</span>
                            </>
                          )}
                          {docs.length > 0 && (
                            <span className="inline-flex items-center gap-1">
                              · <PaperclipIcon className="h-3 w-3" />{docs.length}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Detail ── */}
          <div className={`${open ? "block" : "hidden lg:block"} min-w-0`}>
            {!open ? (
              <div className={`${cardCls} px-6 py-16 text-center`}>
                <p className="text-[13px] text-[var(--text-dim)]">
                  Pick a request to review it.
                </p>
              </div>
            ) : (
              <Detail
                row={open}
                busy={busy}
                note={note}
                onNote={setNote}
                onBack={() => setOpenId(null)}
                onDecide={(s) => void decide(open, s)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return (
    <span
      className={`shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/* ── Detail ────────────────────────────────────────────────────────────────
   Rebuilt because the first version had no hierarchy: `Group` titles and
   `Field` labels used the SAME class, so "HOW TO REACH THEM" and "EMAIL" were
   typographically identical and the eye had nothing to climb. Eleven fields
   stacked as label-above-value in a three-column grid also left a third of
   every row empty and read as a spreadsheet.

   Now: a header band that anchors on a monogram, facts as tight
   label-then-value rows in a two-column body, and the things a reviewer reads
   rather than scans — message, documents, history — in their own column. */

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function Detail({
  row, busy, note, onNote, onBack, onDecide,
}: {
  row: RequestRow;
  busy: boolean;
  note: string;
  onNote: (v: string) => void;
  onBack: () => void;
  onDecide: (s: Status) => void;
}) {
  const m = row.metadata ?? {};
  const docs = (m.documents ?? []) as Doc[];
  const country = String(m.country ?? "");
  const free = FREE_MAIL.has(domainOf(row.email));
  const partner = String(m.partner_type ?? "");
  const lang = String(m.language ?? "");
  const channel = String(m.contact_via ?? "");
  const handle = String(m.contact_handle ?? "");
  const heard = String(m.heard_from ?? "");
  const decisions = (m.decisions ?? []) as Array<{ status: string; note: string | null; at: string }>;

  return (
    <div className={`${cardCls} overflow-hidden`}>

      {/* ── Header band ── */}
      <div className="px-4 sm:px-5 py-4 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-subtle)]">
        <div className="flex items-start gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-dim)]"
            aria-label="Back to the list"
          >
            <ArrowLeftIcon className="h-4 w-4" />
          </button>

          {/* A monogram, not an avatar: an applicant has no account and so no
              photo, and a grey circle would be a placeholder for nothing. */}
          <div
            aria-hidden
            className="hidden sm:flex h-11 w-11 shrink-0 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] items-center justify-center text-[13px] font-bold text-[var(--text-dim)]"
          >
            {initialsOf(row.full_name)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[17px] font-bold tracking-tight break-words">{row.full_name}</h2>
              <StatusPill status={row.status} />
              {String(m.relationship_label ?? "") && (
                <span className="shrink-0 text-[10.5px] font-semibold px-2 py-0.5 rounded-full border border-[var(--border-subtle)] text-[var(--text-dim)]">
                  {String(m.relationship_label)}
                </span>
              )}
            </div>
            {(String(m.job_title ?? "") || row.company) && (
              <p className="text-[12.5px] text-[var(--text-dim)] mt-1 break-words">
                {[String(m.job_title ?? ""), row.company].filter(Boolean).join(" · ")}
              </p>
            )}
            {/* No em-dash placeholder for a missing reference — an old row
                simply shows its date. */}
            <p className="text-[11px] text-[var(--text-faint)] mt-1.5 flex items-center gap-1.5 flex-wrap">
              {row.ref && <span className="tabular-nums font-semibold">{row.ref}</span>}
              {row.ref && <span aria-hidden>·</span>}
              <span>{fmtDate(row.created_at)}</span>
              {country && (
                <>
                  <span aria-hidden>·</span>
                  <span>{countryLabel(country)}</span>
                </>
              )}
              {row.status !== "pending" && row.reviewed_by_name && (
                <>
                  <span aria-hidden>·</span>
                  <span>{STATUS_LABEL[row.status].toLowerCase()} by {row.reviewed_by_name}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {row.applications_from_this_email > 1 && (
          <p className="mt-3 text-[11.5px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
            {row.applications_from_this_email} applications have come from this email address.
          </p>
        )}
      </div>

      {/* ── Body: facts on the left, prose on the right ── */}
      <div className="grid xl:grid-cols-2">
        <div className="px-4 sm:px-5 py-4 space-y-5 xl:border-e border-[var(--border-subtle)] min-w-0">
          <Block title="Contact">
            <Row k="Email" v={row.email} note={free ? "personal address" : undefined} />
            <Row k="Phone" v={String(m.phone ?? "")} />
            {channel && (
              <Row
                k="Prefers"
                v={`${CHANNEL_LABEL[channel] ?? channel}${handle ? ` · ${handle}` : ""}`}
                brand={CHANNEL_BRAND[channel]}
              />
            )}
            <Row k="Language" v={LANG_LABEL[lang] ?? lang} />
          </Block>

          <Block title="Business">
            <Row k="Company" v={row.company ?? ""} />
            <Row k="Country" v={countryLabel(country)}
                 note={country && !KNOWN_COUNTRY.has(country) ? "unrecognised code" : undefined} />
            <Row k="Website" v={String(m.website ?? "")} />
            <Row k="Customer code" v={String(m.customer_code ?? "")} />
            <Row k="Contact at Koleex" v={String(m.koleex_contact ?? "")} />
            <Row k="Partnership" v={PARTNER_LABEL[partner] ?? partner} />
            <Row k="Territory" v={String(m.territory ?? "")} />
            <Row k="Supplies" v={String(m.supplies ?? "")} />
            <Row k="Heard about us" v={HEARD_LABEL[heard] ?? heard} />
          </Block>
        </div>

        <div className="px-4 sm:px-5 py-4 space-y-5 border-t xl:border-t-0 border-[var(--border-subtle)] min-w-0">
          <Block title="Proof documents">
            {docs.length === 0 ? (
              <p className="flex items-start gap-2 text-[12px] text-amber-400">
                <ExclamationIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>None attached — a company license is required.</span>
              </p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {docs.map((d) => (
                  <li key={d.path} className="min-w-0">
                    {/* Signed for five minutes, minted server-side. There is
                        no public URL to this bucket. */}
                    <a
                      href={`/api/membership-requests/${row.id}/document?path=${encodeURIComponent(d.path)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 max-w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)] px-3 py-2 text-[12px] hover:border-[var(--text-faint)] transition-colors"
                    >
                      <PaperclipIcon className="h-3.5 w-3.5 shrink-0 text-[var(--text-faint)]" />
                      <span className="truncate">{d.name}</span>
                      <span className="text-[var(--text-faint)] tabular-nums shrink-0">
                        {Math.max(1, Math.round(d.bytes / 1024))} KB
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Block>

          {row.message && (
            <Block title="Their message">
              <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap break-words text-[var(--text-secondary)]">
                {row.message}
              </p>
            </Block>
          )}

          {decisions.length > 0 && (
            <Block title="History">
              <ul className="space-y-2">
                {decisions.map((d, i) => (
                  <li key={i} className="text-[12px] break-words flex gap-2">
                    <span
                      className={`shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full ${
                        d.status === "approved" ? "bg-emerald-400"
                        : d.status === "rejected" ? "bg-red-400" : "bg-amber-400"
                      }`}
                      aria-hidden
                    />
                    <span className="min-w-0">
                      <span className="font-semibold">
                        {STATUS_LABEL[d.status as Status] ?? d.status}
                      </span>
                      <span className="text-[var(--text-faint)]"> · {fmtDate(d.at)}</span>
                      {d.note && (
                        <span className="block text-[var(--text-dim)]">{d.note}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}
        </div>
      </div>

      {/* ── Decision ── */}
      <div className="px-4 sm:px-5 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-subtle)]">
        <label className={sectionCls} htmlFor={`note-${row.id}`}>
          Decision note {row.status === "pending" ? "· required to refuse" : ""}
        </label>
        <textarea
          id={`note-${row.id}`}
          value={note}
          onChange={(e) => onNote(e.target.value)}
          rows={2}
          placeholder="Why, in one line — whoever reads this row next will not have your context."
          className="mt-2 w-full rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] px-3 py-2 text-[12.5px] outline-none focus:border-[var(--text-faint)] resize-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide("approved")}
            className="h-10 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[12.5px] font-semibold inline-flex items-center gap-2 hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
          >
            {busy ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckCircleIcon className="h-3.5 w-3.5" />}
            Approve
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide("rejected")}
            className="h-10 px-4 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-[12.5px] font-semibold inline-flex items-center gap-2 hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            <CrossIcon className="h-3 w-3" />
            Refuse
          </button>

          <span className="hidden sm:block h-6 w-px bg-[var(--border-subtle)] mx-1" aria-hidden />

          {/* The hand-off: everything the account form needs is already here,
              so nobody retypes a name and an email off the screen above. */}
          <Link
            href={`/accounts/new?username=${encodeURIComponent(row.email.split("@")[0])}&login_email=${encodeURIComponent(row.email)}&company=${encodeURIComponent(row.company ?? "")}&from_request=${encodeURIComponent(row.ref ?? "")}`}
            className="h-10 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[12.5px] font-semibold inline-flex items-center gap-2 hover:border-[var(--text-faint)] transition-colors"
          >
            <UserPlusIcon className="h-3.5 w-3.5" />
            Create the account
          </Link>

          {/* No external mail provider is wired, so this opens the reviewer's
              own client rather than pretending to send anything. */}
          <a
            href={`mailto:${encodeURIComponent(row.email)}?subject=${encodeURIComponent(`Koleex Hub · your request ${row.ref ?? ""}`)}`}
            className="h-10 px-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-dim)] text-[12.5px] font-semibold inline-flex items-center gap-2 hover:text-[var(--text-primary)] hover:border-[var(--text-faint)] transition-colors"
          >
            <EnvelopeIcon className="h-3.5 w-3.5" />
            Email them
          </a>
        </div>
      </div>
    </div>
  );
}

/* A section — one step ABOVE a field label, which was the whole problem
   before: both were the same 10px uppercase grey. */
function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0">
      <h3 className={`${sectionCls} mb-2`}>{title}</h3>
      {children}
    </section>
  );
}

/* Label THEN value on one line, not label stacked above value in a grid cell.
   A spec sheet reads down a single column of aligned labels; a grid of
   stacked pairs makes the eye zig-zag and leaves a third of every row empty
   whenever a section has two facts instead of three. */
function Row({
  k, v, note, brand,
}: { k: string; v: string; note?: string; brand?: string }) {
  if (!v) return null;
  return (
    <div className="flex gap-3 py-[3px] min-w-0">
      <span className="w-[104px] sm:w-[124px] shrink-0 text-[11.5px] text-[var(--text-faint)]">
        {k}
      </span>
      <span className="min-w-0 flex-1 text-[12.5px] break-words">
        <span className="inline-flex items-center gap-1.5">
          {brand && <BrandGlyph name={brand} size={13} className="shrink-0" />}
          <span>{v}</span>
        </span>
        {note && <span className="block text-[11px] text-amber-400">{note}</span>}
      </span>
    </div>
  );
}
