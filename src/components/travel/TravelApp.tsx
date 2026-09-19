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
import { CARD, SELECTED_CHIP } from "@/components/travel/fields";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import PencilIcon from "@/components/icons/ui/PencilIcon";
import CopyIcon from "@/components/icons/ui/CopyIcon";
import TrashIcon from "@/components/icons/ui/TrashIcon";
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
  /** The letter a Delete press is asking about; the dialog names the visitor
   *  and the reference, per the agreed rule — delete is permanent. */
  const [pendingDelete, setPendingDelete] = useState<InvitationLetter | null>(null);
  const [rowBusy, setRowBusy] = useState(false);

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

  /** Exact copy, the owner's rule — only the reference differs. The list row
   *  already carries the whole letter, so this needs no extra fetch. */
  const duplicate = useCallback(
    async (r: InvitationLetter) => {
      setRowBusy(true);
      try {
        const res = await fetch("/api/invitations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactId: r.contactId,
            visitor: r.visitor,
            visit: r.visit,
            letterDate: r.letterDate,
          }),
        });
        const body = (await res.json()) as { letter?: InvitationLetter };
        if (res.ok && body.letter) router.push(`/travel/${body.letter.id}`);
      } finally {
        setRowBusy(false);
      }
    },
    [router],
  );

  const confirmDelete = useCallback(async () => {
    if (!pendingDelete) return;
    setRowBusy(true);
    try {
      const res = await fetch(`/api/invitations/${pendingDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        setPendingDelete(null);
        await load();
      }
    } finally {
      setRowBusy(false);
    }
  }, [pendingDelete, load]);

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
      <div className="mx-auto w-full max-w-6xl px-4 pt-12 pb-16 sm:px-6">
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
          <div className={`${CARD} p-6 text-center`}>
            <p className="text-[var(--text-secondary)]">{error}</p>
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          </div>
        ) : visible.length === 0 ? (
          <div className={`${CARD} px-6 py-14 text-center`}>
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
                {/* The row is a CARD holding a big "open the letter" button
                    and three sibling action buttons — siblings, never nested,
                    because a button inside a button is invalid HTML and the
                    inner clicks would bubble into navigation. Pressing the
                    row shows the INVITATION itself (the print view, which
                    carries its own Back button); editing is one of the
                    explicit actions beside it — the owner's call. */}
                <div
                  className={`${CARD} flex flex-col gap-2 px-4 py-3 transition-colors
                             hover:bg-[var(--bg-surface-hover)] sm:flex-row sm:items-center sm:gap-4`}
                >
                  <button
                    type="button"
                    onClick={() => router.push(`/travel/${r.id}/print`)}
                    /* data-kx-keep-hover: a whole-row button would otherwise
                       get Aurora's hard blue control-box on hover. */
                    data-kx-keep-hover=""
                    className="min-w-0 flex-1 text-start"
                  >
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
                  </button>

                  <div className="flex items-center gap-3 sm:shrink-0">
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
                      className={`rounded-full border px-2 py-0.5 text-xs ${
                        r.status === "issued"
                          ? SELECTED_CHIP
                          : "border-[var(--border-subtle)] text-[var(--text-secondary)]"
                      }`}
                    >
                      {r.status === "issued" ? t("status.issued") : t("status.draft")}
                    </span>

                    {/* The three actions the owner asked for, right on the
                        row. Icon buttons with tooltips; each disabled while
                        any row action is in flight so a double-press cannot
                        duplicate twice or delete during a duplicate. */}
                    <div className="flex items-center gap-1.5 border-s border-[var(--border-subtle)] ps-3">
                      <button
                        type="button"
                        title={t("act.edit")}
                        aria-label={t("act.edit")}
                        disabled={rowBusy}
                        onClick={() => router.push(`/travel/${r.id}`)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                      >
                        <PencilIcon size={14} />
                      </button>
                      <button
                        type="button"
                        title={t("act.duplicate")}
                        aria-label={t("act.duplicate")}
                        disabled={rowBusy}
                        onClick={() => void duplicate(r)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
                      >
                        <CopyIcon size={14} />
                      </button>
                      <button
                        type="button"
                        title={t("act.delete")}
                        aria-label={t("act.delete")}
                        disabled={rowBusy}
                        onClick={() => setPendingDelete(r)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 disabled:opacity-50"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={t("del.title")}
        description={
          pendingDelete
            ? `${pendingDelete.visitor.name} · ${pendingDelete.reference} — ${t("del.body")}`
            : ""
        }
        confirmLabel={t("act.delete")}
        destructive
        busy={rowBusy}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
