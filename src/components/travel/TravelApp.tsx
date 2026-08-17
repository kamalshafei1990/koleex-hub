"use client";

/* ---------------------------------------------------------------------------
   Travel — /travel

   The invitation-letter list. One letter per visitor (never combined), each
   rendered as three A4 pages in a single PDF: English, Chinese, and the
   company's business licence.

   Layout follows the AppHomeMenu convention: navItems for the filters, and
   the create action in the header's `action` slot — never both a nav row and
   a hand-rolled nav, and never a second create button inside the nav.

   Requests on open: ONE. The list endpoint is paged and the filters are
   client-side over the loaded page, so switching between All / Drafts /
   Issued costs nothing. No poller.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { travelT } from "@/lib/translations/travel";
import PageHeader from "@/components/ui/PageHeader";
import AppHomeMenu from "@/components/ui/AppHomeMenu";
import Button from "@/components/ui/Button";
import TravelIcon from "@/components/icons/TravelIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { formatDateEn, PURPOSES } from "@/lib/invitations/types";
import type { InvitationLetter } from "@/lib/invitations/types";

type Filter = "all" | "draft" | "issued";

const PURPOSE_LABEL = new Map(PURPOSES.map((p) => [p.value, p.en]));

export default function TravelApp() {
  const { t } = useTranslation(travelT);
  const router = useRouter();

  const [rows, setRows] = useState<InvitationLetter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/invitations?pageSize=100", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { rows: InvitationLetter[] };
      setRows(body.rows ?? []);
    } catch {
      setError("Could not load invitations.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const list = rows ?? [];
    return {
      all: list.length,
      draft: list.filter((r) => r.status === "draft").length,
      issued: list.filter((r) => r.status === "issued").length,
    };
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows ?? [];
    if (filter !== "all") list = list.filter((r) => r.status === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.visitor.name.toLowerCase().includes(q) ||
          (r.visitor.passportNo ?? "").toLowerCase().includes(q) ||
          r.reference.toLowerCase().includes(q) ||
          (r.visitor.company ?? "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [rows, filter, query]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <PageHeader
          title={t("app.title")}
          subtitle={t("app.subtitle")}
          icon={<TravelIcon size={16} />}
          showTabs={false}
          action={
            <Button onClick={() => router.push("/travel/new")}>{t("action.new")}</Button>
          }
        />

        <div className="mt-5 mb-3">
          <AppHomeMenu
            searchPlaceholder={t("search.placeholder")}
            onSearchSubmit={setQuery}
            navItems={[
              {
                key: "all",
                onClick: () => setFilter("all"),
                icon: "document",
                label: t("nav.all"),
                count: counts.all,
                active: filter === "all",
              },
              {
                key: "draft",
                onClick: () => setFilter("draft"),
                icon: "pencil",
                label: t("nav.draft"),
                count: counts.draft,
                active: filter === "draft",
              },
              {
                key: "issued",
                onClick: () => setFilter("issued"),
                icon: "check",
                label: t("nav.issued"),
                count: counts.issued,
                active: filter === "issued",
              },
              {
                key: "settings",
                href: "/travel/settings",
                icon: "cog",
                label: t("nav.settings"),
              },
            ]}
          />
        </div>

        {rows === null ? (
          /* The Hub's ONE loading shape — never a bespoke spinner. */
          <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
            <SpinnerIcon size={28} />
          </div>
        ) : error ? (
          <div className="kx-glass rounded-2xl p-6 text-center">
            <p className="text-[var(--text-secondary)]">{error}</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className="kx-glass rounded-2xl px-6 py-14 text-center">
            <p className="text-base font-medium">{t("empty.title")}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{t("empty.body")}</p>
            <div className="mt-4">
              <Button onClick={() => router.push("/travel/new")}>{t("action.new")}</Button>
            </div>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/travel/${r.id}`)}
                  /* data-kx-keep-hover: this is a <button> wrapping a whole
                     row, and Aurora's control-hover rule would otherwise
                     paint a hard blue box across it. Opting out lets the
                     row's own surface-hover show instead. */
                  data-kx-keep-hover=""
                  className="kx-glass w-full rounded-2xl px-4 py-3 text-start transition-colors
                             hover:bg-[var(--bg-surface-hover)] sm:flex sm:items-center sm:gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="truncate font-medium">{r.visitor.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-[var(--text-secondary)]">
                        {r.reference}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-[var(--text-secondary)]">
                      {[r.visitor.company, PURPOSE_LABEL.get(r.visit.purpose)]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="mt-2 flex items-center gap-3 sm:mt-0 sm:shrink-0">
                    <span className="text-sm tabular-nums text-[var(--text-secondary)]">
                      {formatDateEn(r.visit.arrivalDate)}
                      {" → "}
                      {formatDateEn(r.visit.departureDate)}
                      {/* The derived stay length, shown where the dates are —
                          it is the field a consulate cross-checks first. */}
                      {r.durationDays > 0 && (
                        <span className="text-[var(--text-dim)]">
                          {` · ${r.durationDays} ${t("f.days")}`}
                        </span>
                      )}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        r.status === "issued" ? "kx-chip-on" : "text-[var(--text-secondary)]"
                      }`}
                    >
                      {r.status === "issued" ? t("status.issued") : t("status.draft")}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
