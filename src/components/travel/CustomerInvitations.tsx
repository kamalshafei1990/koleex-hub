"use client";

/* ---------------------------------------------------------------------------
   The invitation letters belonging to ONE customer — rendered inside the
   customer profile's Documents tab.

   The same record shown in two places, never a copy: this reads the same
   /api/invitations rows the Travel app lists, filtered by contact_id.
   Deleting here deletes the letter itself, which is the owner's rule — a
   letter removed from the customer must not survive in Travel.

   Loaded by the customer page with a dynamic import, and only when the tab is
   opened, so a profile visit that never touches Documents pays nothing.
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";
import { formatDateEn } from "@/lib/invitations/types";
import type { InvitationLetter } from "@/lib/invitations/types";

export default function CustomerInvitations({
  contactId,
  panelCls,
}: {
  contactId: string;
  /** The profile's own card recipe, passed in so this block matches the
   *  panels around it instead of inventing a second card style. */
  panelCls: string;
}) {
  const [rows, setRows] = useState<InvitationLetter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<InvitationLetter | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(
        `/api/invitations?contactId=${encodeURIComponent(contactId)}&pageSize=50`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        /* 403 is the normal answer for someone without the Travel module.
           Say so plainly rather than showing a broken-looking empty list. */
        setError(
          res.status === 403
            ? "You do not have access to invitation letters."
            : "Could not load invitation letters.",
        );
        setRows([]);
        return;
      }
      const body = (await res.json()) as { rows: InvitationLetter[] };
      setRows(body.rows ?? []);
    } catch {
      setError("Could not load invitation letters.");
      setRows([]);
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = useCallback(async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/invitations/${pendingDelete.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Could not delete.");
        return;
      }
      setRows((prev) => (prev ?? []).filter((r) => r.id !== pendingDelete.id));
    } catch {
      setError("Could not delete.");
    } finally {
      setBusy(false);
      setPendingDelete(null);
    }
  }, [pendingDelete]);

  if (rows === null) {
    return (
      <div className="flex items-center justify-center py-16">
        <SpinnerIcon size={20} className="text-[var(--text-dim)]" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium">Invitation letters</h3>
        <Link href="/travel/new">
          <Button variant="secondary" size="sm">
            New invitation
          </Button>
        </Link>
      </div>

      {error && <p className="text-[12px] text-[var(--state-error)]">{error}</p>}

      {rows.length === 0 && !error ? (
        <div className={`${panelCls} py-10 text-center`}>
          <p className="text-[13px] font-medium text-[var(--text-primary)]">
            No invitation letters yet
          </p>
          <p className="mt-1 text-[12px] text-[var(--text-dim)]">
            Letters created for this customer appear here.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className={`${panelCls} flex flex-wrap items-center gap-3 px-4 py-3`}>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="truncate text-[13px] font-medium">{r.visitor.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-dim)]">
                    {r.reference}
                  </span>
                </div>
                <p className="mt-0.5 text-[12px] tabular-nums text-[var(--text-dim)]">
                  {formatDateEn(r.visit.arrivalDate)} → {formatDateEn(r.visit.departureDate)}
                  {` · ${r.durationDays} days`}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Link href={`/travel/${r.id}/print`} target="_blank">
                  <Button variant="secondary" size="sm">
                    Preview
                  </Button>
                </Link>
                <Link href={`/travel/${r.id}`}>
                  <Button variant="secondary" size="sm">
                    Open
                  </Button>
                </Link>
                <Button variant="danger" size="sm" onClick={() => setPendingDelete(r)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this invitation?"
        /* Spells out that this is not just "remove from the customer" — the
           letter is gone from Travel too, permanently. */
        description={`${pendingDelete?.visitor.name ?? ""} · ${pendingDelete?.reference ?? ""}. This deletes the letter everywhere, including Travel. It cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        busy={busy}
        onConfirm={() => void remove()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
