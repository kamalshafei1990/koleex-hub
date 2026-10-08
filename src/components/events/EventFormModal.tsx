"use client";

/* ---------------------------------------------------------------------------
   EventFormModal — create / edit an event, on the kds FormModal (the kit's
   chromed heavy-form dialog): header with subtitle, grouped sections,
   scrollable body and a pinned right-aligned footer. One form, two callers:
   the dashboard's "New Event" and the workspace's "Edit".

   The brief holds the BASICS; guests/agenda/budget/check-in live in the
   event's own tabs — the form says so in its subtitle so nobody hunts for
   them here.
   --------------------------------------------------------------------------- */

import { useEffect, useState } from "react";
import { useTranslation } from "@/lib/i18n";
import { eventsT } from "@/lib/translations/events";
import {
  EVENT_STATUSES,
  EVENT_TYPES,
  type EventStatus,
  type EventType,
  type KxEventRow,
} from "@/lib/events/types";
import FormModal from "@/components/kds/FormModal";
import Button from "@/components/ui/Button";
import {
  SelectField,
  TextAreaField,
  TextField,
  DateTimeField,
  CountryField,
  CityField,
} from "@/components/events/fields";
import { COUNTRIES } from "@/lib/commercial-policy/countries";

function toInputValue(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface EventFormValues {
  title: string;
  type: EventType;
  status: EventStatus;
  start_at: string | null;
  end_at: string | null;
  location: string;
  city: string;
  country: string;
  booth: string;
  expected_guests: string;
  website: string;
  description: string;
}

export function emptyFormValues(): EventFormValues {
  return {
    title: "",
    type: "exhibition",
    status: "idea",
    start_at: null,
    end_at: null,
    location: "",
    city: "",
    country: "",
    booth: "",
    expected_guests: "",
    website: "",
    description: "",
  };
}

export function formValuesFromEvent(ev: KxEventRow): EventFormValues {
  return {
    title: ev.title,
    type: ev.type,
    status: ev.status,
    start_at: ev.start_at,
    end_at: ev.end_at,
    location: ev.location ?? "",
    city: ev.city ?? "",
    country: ev.country ?? "",
    booth: ev.booth ?? "",
    expected_guests: ev.expected_guests != null ? String(ev.expected_guests) : "",
    website: ev.website ?? "",
    description: ev.description ?? "",
  };
}

/** Small uppercase section divider inside the form body. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="col-span-full mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)] first:mt-0">
      {children}
    </p>
  );
}

export default function EventFormModal({
  open,
  onClose,
  event,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  /** Present = edit mode; absent = create. */
  event?: KxEventRow | null;
  onSaved: () => void;
}) {
  const { t, lang } = useTranslation(eventsT);
  const [values, setValues] = useState<EventFormValues>(emptyFormValues());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /* Reset whenever the modal opens (with the event to edit, or blank). */
  useEffect(() => {
    if (!open) return;
    setValues(event ? formValuesFromEvent(event) : emptyFormValues());
    setError(null);
  }, [open, event]);

  const set = <K extends keyof EventFormValues>(key: K, v: EventFormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const save = async () => {
    if (!values.title.trim()) {
      setError(t("form.titleRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = {
        title: values.title,
        type: values.type,
        status: values.status,
        start_at: toInputValue(values.start_at),
        end_at: toInputValue(values.end_at),
        location: values.location || null,
        city: values.city || null,
        country: values.country || null,
        booth: values.booth || null,
        expected_guests: values.expected_guests === "" ? null : Number(values.expected_guests),
        website: values.website || null,
        description: values.description || null,
      };
      const res = event
        ? await fetch(`/api/events/${event.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (res.ok) {
        onClose();
        onSaved();
        return;
      }
      const bodyJson = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(bodyJson?.error ?? `HTTP ${res.status}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={event ? t("form.editTitle") : t("form.newTitle")}
      subtitle={t("form.subtitle")}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" loading={busy} onClick={save}>
            {event ? t("common.save") : t("form.create")}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SectionTitle>{t("form.section.details")}</SectionTitle>
        <TextField
          label={t("form.title")}
          value={values.title}
          onChange={(v) => set("title", v)}
          placeholder={t("form.titlePh")}
          wide
        />
        <SelectField<EventType>
          label={t("form.type")}
          value={values.type}
          onChange={(v) => set("type", v)}
          options={EVENT_TYPES.map((tp) => ({ value: tp, label: t(`type.${tp}`) }))}
        />
        <SelectField<EventStatus>
          label={t("form.status")}
          value={values.status}
          onChange={(v) => set("status", v)}
          options={EVENT_STATUSES.map((s) => ({ value: s, label: t(`status.${s}`) }))}
        />

        <SectionTitle>{t("form.section.when")}</SectionTitle>
        <DateTimeField
          label={t("form.starts")}
          value={values.start_at}
          onChange={(iso) => set("start_at", iso)}
          lang={lang}
        />
        <DateTimeField
          label={t("form.ends")}
          value={values.end_at}
          onChange={(iso) => set("end_at", iso)}
          lang={lang}
        />

        <SectionTitle>{t("form.section.where")}</SectionTitle>
        <TextField
          label={t("form.location")}
          value={values.location}
          onChange={(v) => set("location", v)}
          placeholder={t("form.locationPh")}
          wide
        />
        <CountryField
          label={t("form.country")}
          value={values.country}
          onChange={(v) => set("country", v)}
          placeholder={t("form.countryPh")}
          searchPlaceholder={t("form.countrySearchPh")}
          emptyLabel={t("form.countryEmpty")}
        />
        <CityField
          label={t("form.city")}
          value={values.city}
          onChange={(v) => set("city", v)}
          countryCode={COUNTRIES.find((c) => c.name === values.country)?.code ?? null}
          placeholder={t("form.cityPh")}
          searchPlaceholder={t("form.citySearchPh")}
          emptyLabel={t("form.cityEmpty")}
          loadingLabel={t("form.cityLoading")}
          hint={t("form.cityHint")}
        />

        <SectionTitle>{t("form.section.more")}</SectionTitle>
        <TextField
          label={t("form.booth")}
          value={values.booth}
          onChange={(v) => set("booth", v)}
          placeholder={t("form.boothPh")}
          hint={t("form.boothHint")}
        />
        <TextField
          label={t("form.expectedGuests")}
          value={values.expected_guests}
          onChange={(v) => set("expected_guests", v.replace(/[^\d]/g, ""))}
          hint={t("form.expectedGuestsHint")}
        />
        <TextField
          label={t("form.website")}
          value={values.website}
          onChange={(v) => set("website", v)}
          placeholder={t("form.websitePh")}
        />
        <TextAreaField
          label={t("form.description")}
          value={values.description}
          onChange={(v) => set("description", v)}
        />
      </div>
      {error && <p className="mt-3 text-[12px] text-rose-400">{error}</p>}
    </FormModal>
  );
}
