"use client";

/* ---------------------------------------------------------------------------
   The invitation form — /travel/new and /travel/[id]

   All 28 fields. Every one is editable even when it was filled automatically,
   because the record is a snapshot of what the letter should say, not a live
   mirror of the customer row.

   Fill paths, in order of how much typing they save:
     1. Pick a customer  → name, company, position, nationality, passport.
     2. Read a passport scan → the MRZ, with check digits verified.
     3. Type it.

   Requests on open: TWO — the settings (for the preview) and, when editing,
   the letter itself. Picking a customer costs one more. No polling.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { travelT } from "@/lib/translations/travel";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import TravelIcon from "@/components/icons/TravelIcon";
import {
  ChipsField,
  DateField,
  SegmentField,
  SelectField,
  Section,
  TextAreaField,
  TextField,
} from "@/components/travel/fields";
import CustomerPicker from "@/components/travel/CustomerPicker";
import PassportScanBox from "@/components/travel/PassportScanBox";
import {
  COMMON_CITIES,
  PURPOSES,
  durationDays,
  type Gender,
  type InvitationLetter,
  type InvitationPurpose,
  type VisaType,
} from "@/lib/invitations/types";

/** The form's own state. Strings throughout — an empty string is "not set",
 *  which the API maps back to NULL. */
type FormState = {
  contactId: string | null;
  name: string;
  gender: Gender | null;
  dob: string;
  nationality: string;
  nationalityCode: string;
  passportNo: string;
  passportIssue: string;
  passportExpiry: string;
  company: string;
  position: string;
  country: string;
  countryCode: string;
  purpose: InvitationPurpose | "";
  exhibitionName: string;
  extraNote: string;
  arrivalCity: string;
  arrivalDate: string;
  departureDate: string;
  cities: string[];
  visaType: VisaType;
  letterDate: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY: FormState = {
  contactId: null,
  name: "", gender: null, dob: "", nationality: "", nationalityCode: "",
  passportNo: "", passportIssue: "", passportExpiry: "",
  company: "", position: "", country: "", countryCode: "",
  purpose: "", exhibitionName: "", extraNote: "",
  arrivalCity: "", arrivalDate: "", departureDate: "",
  cities: [], visaType: "multi", letterDate: today(),
};

function fromLetter(l: InvitationLetter): FormState {
  return {
    contactId: l.contactId,
    name: l.visitor.name,
    gender: l.visitor.gender,
    dob: l.visitor.dob ?? "",
    nationality: l.visitor.nationality ?? "",
    nationalityCode: l.visitor.nationalityCode ?? "",
    passportNo: l.visitor.passportNo ?? "",
    passportIssue: l.visitor.passportIssue ?? "",
    passportExpiry: l.visitor.passportExpiry ?? "",
    company: l.visitor.company ?? "",
    position: l.visitor.position ?? "",
    country: l.visitor.country ?? "",
    countryCode: l.visitor.countryCode ?? "",
    purpose: l.visit.purpose,
    exhibitionName: l.visit.exhibitionName ?? "",
    extraNote: l.visit.extraNote ?? "",
    arrivalCity: l.visit.arrivalCity ?? "",
    arrivalDate: l.visit.arrivalDate,
    departureDate: l.visit.departureDate,
    cities: l.visit.cities,
    visaType: l.visit.visaType,
    letterDate: l.letterDate,
  };
}

function toPayload(f: FormState) {
  return {
    contactId: f.contactId,
    visitor: {
      name: f.name, gender: f.gender, dob: f.dob,
      nationality: f.nationality, nationalityCode: f.nationalityCode,
      passportNo: f.passportNo, passportIssue: f.passportIssue,
      passportExpiry: f.passportExpiry, company: f.company,
      position: f.position, country: f.country, countryCode: f.countryCode,
    },
    visit: {
      purpose: f.purpose, exhibitionName: f.exhibitionName,
      extraNote: f.extraNote, arrivalCity: f.arrivalCity,
      arrivalDate: f.arrivalDate, departureDate: f.departureDate,
      cities: f.cities, visaType: f.visaType,
    },
    letterDate: f.letterDate,
  };
}

export default function InvitationForm({ id }: { id?: string }) {
  const { t } = useTranslation(travelT);
  const router = useRouter();

  const isNew = !id;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [letter, setLetter] = useState<InvitationLetter | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReExport, setConfirmReExport] = useState(false);

  /* Guards a slow response from an earlier edit overwriting a newer one. */
  const loadSeq = useRef(0);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);

  /* ── load an existing letter ─────────────────────────────────────────── */
  useEffect(() => {
    if (!id) return;
    const seq = ++loadSeq.current;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/invitations/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const l = (await res.json()) as InvitationLetter;
        if (seq !== loadSeq.current) return;
        setLetter(l);
        setForm(fromLetter(l));
      } catch {
        if (seq === loadSeq.current) setErrors(["Could not load this invitation."]);
      } finally {
        if (seq === loadSeq.current) setLoading(false);
      }
    })();
  }, [id]);

  /* ── derived ─────────────────────────────────────────────────────────── */
  const days = useMemo(
    () =>
      form.arrivalDate && form.departureDate
        ? durationDays(form.arrivalDate, form.departureDate)
        : 0,
    [form.arrivalDate, form.departureDate],
  );

  /* ── save ────────────────────────────────────────────────────────────── */
  const save = useCallback(async () => {
    setSaving(true);
    setErrors([]);
    try {
      const res = await fetch(isNew ? "/api/invitations" : `/api/invitations/${id}`, {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const body = (await res.json()) as {
        letter?: InvitationLetter;
        warnings?: string[];
        error?: string;
        errors?: string[];
      };
      if (!res.ok) {
        setErrors(body.errors ?? [body.error ?? "Could not save."]);
        return;
      }
      setWarnings(body.warnings ?? []);
      if (isNew && body.letter) {
        router.replace(`/travel/${body.letter.id}`);
      } else if (body.letter) {
        setLetter(body.letter);
      }
    } catch {
      setErrors(["Could not save — check your connection and try again."]);
    } finally {
      setSaving(false);
    }
  }, [form, id, isNew, router]);

  /* Editing a letter that was already exported invalidates the PDF. The owner
     asked to be asked at the time rather than have either behaviour assumed. */
  const onSave = useCallback(() => {
    if (!isNew && letter?.pdfUrl) {
      setConfirmReExport(true);
      return;
    }
    void save();
  }, [isNew, letter?.pdfUrl, save]);

  const duplicate = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        /* An exact copy, by the owner's instruction — only the reference
           number and the dates the system owns differ. */
        body: JSON.stringify(toPayload(form)),
      });
      const body = (await res.json()) as { letter?: InvitationLetter; error?: string };
      if (res.ok && body.letter) router.push(`/travel/${body.letter.id}`);
      else setErrors([body.error ?? "Could not duplicate."]);
    } catch {
      setErrors(["Could not duplicate."]);
    } finally {
      setSaving(false);
    }
  }, [form, router]);

  const remove = useCallback(async () => {
    if (!id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
      if (res.ok) router.push("/travel");
      else setErrors(["Could not delete."]);
    } catch {
      setErrors(["Could not delete."]);
    } finally {
      setSaving(false);
      setConfirmDelete(false);
    }
  }, [id, router]);

  /* ── fill from a customer ────────────────────────────────────────────── */
  const applyCustomer = useCallback((c: {
    id: string; name: string | null; gender: string | null; dob: string | null;
    nationality: string | null; nationalityCode: string | null;
    country: string | null; countryCode: string | null;
    company: string | null; position: string | null;
    passportNo: string | null; passportIssue: string | null; passportExpiry: string | null;
  }) => {
    setForm((f) => ({
      ...f,
      contactId: c.id,
      /* Only fill what is empty is WRONG here: picking a customer is an
         explicit "use this person", so it replaces the identity fields. The
         visit fields are untouched — those belong to the trip, not the person. */
      name: c.name ?? "",
      gender: c.gender === "male" || c.gender === "female" ? c.gender : null,
      dob: c.dob ?? "",
      nationality: c.nationality ?? "",
      nationalityCode: c.nationalityCode ?? "",
      country: c.country ?? "",
      countryCode: c.countryCode ?? "",
      company: c.company ?? "",
      position: c.position ?? "",
      passportNo: c.passportNo ?? "",
      passportIssue: c.passportIssue ?? "",
      passportExpiry: c.passportExpiry ?? "",
    }));
  }, []);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        <SpinnerIcon size={28} />
      </div>
    );
  }

  return (
    /* min-h-full, NOT h-full + overflow-y-auto.

       Owning an internal scroller froze the Hub's own scroller
       (#main-scroll-container) — the page scrolled inside itself while the
       shell stayed still, which is why the frosted header ramp never passed
       over the content and the action buttons sat under it permanently.
       These are flowing form/list pages, so they belong IN the Hub scroller
       exactly like Expenses. h-full is for a page that genuinely owns its
       internal panes; this is not one. */
    <div className="min-h-full">
      {/* pt-12 = 3rem. NOT a round number picked by eye — it is exactly the
          `+ 3rem` in the frosted ramp's own height,
          `calc(var(--kx-header-h) + 3rem)` (globals.css). The shell already
          offsets content by --kx-header-h (56 px), so without this the page
          starts at 56 and the ramp reaches 104: measured, the Save / Export
          PDF / Preview / Duplicate row sat from 56 to 88 — entirely inside
          the frost, before any scrolling. The ramp is pointer-events:none, so
          the buttons still worked; they were just permanently veiled, which
          is worse than broken because nothing looks wrong enough to report.

          Notes, which is fine, starts its first control at 136. */}
      <div className="mx-auto w-full max-w-5xl px-4 pt-12 pb-24 sm:px-6">
        <PageHeader
          title={isNew ? t("action.new") : (letter?.reference ?? t("app.title"))}
          subtitle={isNew ? t("app.subtitle") : form.name}
          icon={<TravelIcon size={16} />}
          backHref="/travel"
          showTabs={false}
          action={
            <div className="flex items-center gap-2">
              {!isNew && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => void duplicate()}>
                    {t("act.duplicate")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/travel/${id}/print`)}
                  >
                    {t("act.preview")}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    /* A plain navigation, not fetch+blob: the response is an
                       attachment, so the browser saves it directly and a
                       60-second render never sits in JS memory. */
                    onClick={() => {
                      window.location.href = `/api/invitations/${id}/pdf`;
                    }}
                  >
                    {t("act.pdf")}
                  </Button>
                </>
              )}
              <Button onClick={onSave} disabled={saving}>
                {saving ? t("act.saving") : t("act.save")}
              </Button>
            </div>
          }
        />

        {errors.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--state-error)] bg-[var(--state-error)]/10 p-4">
            <ul className="list-inside list-disc text-sm text-[var(--text-primary)]">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--state-warning)] bg-[var(--state-warning)]/10 p-4">
            <p className="text-sm font-medium">{t("warn.title")}</p>
            <ul className="mt-1 list-inside list-disc text-sm text-[var(--text-secondary)]">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-4">
          {/* ── who ── */}
          <Section title={t("sec.visitor")}>
            <div className="sm:col-span-2">
              <CustomerPicker
                contactId={form.contactId}
                label={t("f.customer")}
                onPick={applyCustomer}
              />
            </div>

            <TextField
              label={t("f.name")}
              hint={t("f.name.hint")}
              value={form.name}
              onChange={(v) => set("name", v)}
              uppercase
              wide
            />
            <SegmentField<Gender>
              label={t("f.gender")}
              value={form.gender}
              onChange={(v) => set("gender", v)}
              options={[
                { value: "male", label: t("f.male") },
                { value: "female", label: t("f.female") },
              ]}
            />
            <DateField label={t("f.dob")} value={form.dob} onChange={(v) => set("dob", v)} />
            <TextField
              label={t("f.nationality")}
              value={form.nationality}
              onChange={(v) => set("nationality", v)}
            />
            <TextField
              label="ISO code"
              hint="Two letters — decides the Chinese wording"
              value={form.nationalityCode}
              onChange={(v) => set("nationalityCode", v.slice(0, 2).toUpperCase())}
            />
            {/* Passport number takes the full row so the two dates below it
                pair up. An empty grid cell used to do this, which measured as
                a dead gap on the rendered page. */}
            <TextField
              label={t("f.passportNo")}
              value={form.passportNo}
              onChange={(v) => set("passportNo", v)}
              uppercase
              wide
            />
            <DateField
              label={t("f.issue")}
              value={form.passportIssue}
              onChange={(v) => set("passportIssue", v)}
            />
            <DateField
              label={t("f.expiry")}
              value={form.passportExpiry}
              onChange={(v) => set("passportExpiry", v)}
            />

            <div className="sm:col-span-2">
              <PassportScanBox
                contactId={form.contactId}
                onRead={(m) =>
                  setForm((f) => ({
                    ...f,
                    name: m.name || f.name,
                    gender: m.sex ?? f.gender,
                    dob: m.dob ?? f.dob,
                    nationalityCode: m.nationalityCode ?? f.nationalityCode,
                    passportNo: m.passportNo || f.passportNo,
                    passportExpiry: m.expiry ?? f.passportExpiry,
                  }))
                }
              />
            </div>
          </Section>

          {/* ── their company ── */}
          <Section title={t("sec.company")}>
            <TextField
              label={t("f.company")}
              value={form.company}
              onChange={(v) => set("company", v)}
              wide
            />
            <TextField
              label={t("f.position")}
              hint={t("f.position.hint")}
              value={form.position}
              onChange={(v) => set("position", v)}
            />
            <TextField
              label={t("f.country")}
              value={form.country}
              onChange={(v) => set("country", v)}
            />
          </Section>

          {/* ── the visit ── */}
          <Section title={t("sec.visit")}>
            <SelectField<InvitationPurpose>
              label={t("f.purpose")}
              value={form.purpose}
              onChange={(v) => set("purpose", v)}
              options={PURPOSES.map((p) => ({ value: p.value, label: p.en }))}
              wide
            />
            {form.purpose === "exhibition" && (
              <TextField
                label={t("f.exhibition")}
                value={form.exhibitionName}
                onChange={(v) => set("exhibitionName", v)}
                wide
              />
            )}
            <TextField
              label={t("f.arrivalCity")}
              value={form.arrivalCity}
              onChange={(v) => set("arrivalCity", v)}
            />
            <SegmentField<VisaType>
              label={t("f.visaType")}
              value={form.visaType}
              onChange={(v) => set("visaType", v)}
              options={[
                { value: "multi", label: t("f.multi") },
                { value: "single", label: t("f.single") },
              ]}
            />
            <DateField
              label={t("f.arrival")}
              value={form.arrivalDate}
              onChange={(v) => set("arrivalDate", v)}
            />
            <DateField
              label={t("f.departure")}
              value={form.departureDate}
              onChange={(v) => set("departureDate", v)}
            />

            {/* Duration is DERIVED, never typed — that is what stops a letter
                claiming a length its own dates contradict. */}
            <div>
              <span className="block text-xs font-medium text-[var(--text-secondary)]">
                {t("f.duration")}
              </span>
              <p className="mt-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm tabular-nums text-[var(--text-secondary)]">
                {days > 0 ? `${days} ${t("f.days")}` : "—"}
              </p>
              <p className="mt-1 min-h-[1rem] text-[11px] leading-4 text-[var(--text-dim)]">
                {t("f.duration.hint")}
              </p>
            </div>

            <ChipsField
              label={t("f.cities")}
              selected={form.cities}
              options={COMMON_CITIES.map((c) => c.en)}
              onToggle={(city) =>
                setForm((f) => ({
                  ...f,
                  cities: f.cities.includes(city)
                    ? f.cities.filter((c) => c !== city)
                    : [...f.cities, city],
                }))
              }
            />

            <TextAreaField
              label={t("f.note")}
              hint={t("f.note.hint")}
              value={form.extraNote}
              onChange={(v) => set("extraNote", v)}
            />
          </Section>

          {/* ── the letter ── */}
          <Section title={t("sec.letter")}>
            <DateField
              label={t("f.letterDate")}
              value={form.letterDate}
              onChange={(v) => set("letterDate", v)}
            />
            <div>
              <span className="block text-xs font-medium text-[var(--text-secondary)]">
                {t("f.reference")}
              </span>
              <p className="mt-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] px-3 py-2 text-sm tabular-nums text-[var(--text-secondary)]">
                {letter?.reference ?? "—"}
              </p>
              <p className="mt-1 min-h-[1rem] text-[11px] leading-4 text-[var(--text-dim)]" />
            </div>
          </Section>

          {!isNew && (
            <div className="flex justify-end">
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                {t("act.delete")}
              </Button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("del.title")}
        /* Naming the visitor AND the reference: the owner asked for permanent
           deletion, so the confirmation has to be specific enough that a
           mis-click on the wrong row is visible before it is irreversible. */
        description={`${form.name || "—"} · ${letter?.reference ?? ""}. ${t("del.body")}`}
        confirmLabel={t("act.delete")}
        cancelLabel={t("act.cancel")}
        destructive
        busy={saving}
        onConfirm={() => void remove()}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        open={confirmReExport}
        title="This letter has already been exported"
        description="Saving replaces the stored PDF, so it no longer matches the copy the customer has. Duplicate instead to keep the exported version and start a new one."
        confirmLabel="Update this version"
        cancelLabel="Duplicate instead"
        busy={saving}
        onConfirm={() => {
          setConfirmReExport(false);
          void save();
        }}
        onCancel={() => {
          setConfirmReExport(false);
          void duplicate();
        }}
      />
    </div>
  );
}
