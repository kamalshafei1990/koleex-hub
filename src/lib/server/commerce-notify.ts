import "server-only";

/* ---------------------------------------------------------------------------
   commerce-notify — the notifications of sales and purchasing (phase E, the
   owner's picks, 26/09/2026): quotations, orders, contracts, CRM
   follow-ups, expense approvals and purchase receipts.

   One rule throughout: the person a document belongs to hears when SOMEONE
   ELSE moves it (notifyLite never tells the actor about their own act), in
   their own language (templates in translations/notif-templates/
   commerce.ts), and a notice that has stopped being true goes away (the
   lifecycle each type declares in lib/notification-types.ts).

   Fire-and-forget: every caller runs these after its response (next/server
   `after`), and nothing here can fail the change that triggered it.
   --------------------------------------------------------------------------- */

import { notifyLite } from "@/lib/server/notify-lite";
import { clearUnreadByMeta } from "@/lib/server/inbox-lifecycle";
import { superAdminAccountIds } from "@/lib/server/sa-notify";
import { supabaseServer } from "@/lib/server/supabase-server";
import { FINANCE_APPROVALS_MODULE } from "@/lib/permission-modules";

type Actor = { account_id: string; tenant_id: string; username?: string | null };

const who = (a: Actor) => a.username || "—";
const money = (amount: unknown, currency: unknown) => {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "—";
  return `${n.toLocaleString("en", { maximumFractionDigits: 2 })}${currency ? ` ${String(currency)}` : ""}`;
};

/** Nothing here may fail the change that triggered it: an error is logged
 *  and swallowed, so a caller's after() never sees a rejection. */
function quiet<A extends unknown[]>(name: string, fn: (...args: A) => Promise<void>): (...args: A) => Promise<void> {
  return async (...args: A) => {
    try {
      await fn(...args);
    } catch (e) {
      console.error(`[commerce-notify.${name}]`, e instanceof Error ? e.message : e);
    }
  };
}

/* ── Quotations ─────────────────────────────────────────────────────── */

/** A quotation's status moved. Its creator hears (when someone else moved
 *  it); leaving "sent" settles any expiry reminder, for everyone. */
export const notifyQuotationStatus = quiet("notifyQuotationStatus", async (
  a: Actor,
  q: { id: string; quote_no?: string | null; created_by?: string | null },
  from: string | null,
  to: string,
): Promise<void> => {
  if (from === to) return;
  if (from === "sent") await clearUnreadByMeta({ type: "quotation_expired", quotation_id: q.id });
  if (!q.created_by) return;
  await notifyLite({
    tenantId: a.tenant_id,
    recipients: [q.created_by],
    senderId: a.account_id,
    tpl: { k: "quotation_status_changed", p: { no: q.quote_no || "—", status: to, actor: who(a) } },
    link: `/quotations?doc=${encodeURIComponent(q.id)}`,
    type: "quotation_status_changed",
    metadata: { source: "quotations", quotation_id: q.id, status: to },
    tag: `quotation:${q.id}`,
    supersede: { type: "quotation_status_changed", quotation_id: q.id },
  });
});

/** A quotation was deleted: an expiry reminder about it has nothing left
 *  to act on. */
export const settleQuotationDeleted = quiet("settleQuotationDeleted", async (quotationId: string): Promise<void> => {
  await clearUnreadByMeta({ type: "quotation_expired", quotation_id: quotationId });
});

/* ── Orders ─────────────────────────────────────────────────────────── */

export const notifyOrderStatus = quiet("notifyOrderStatus", async (
  a: Actor,
  o: { id: string; order_no?: string | null; created_by?: string | null },
  from: string | null,
  to: string,
): Promise<void> => {
  if (from === to || !o.created_by) return;
  await notifyLite({
    tenantId: a.tenant_id,
    recipients: [o.created_by],
    senderId: a.account_id,
    tpl: { k: "order_status_changed", p: { no: o.order_no || "—", status: to, actor: who(a) } },
    link: `/orders/${encodeURIComponent(o.id)}`,
    type: "order_status_changed",
    metadata: { source: "orders", order_id: o.id, status: to },
    tag: `order:${o.id}`,
    supersede: { type: "order_status_changed", order_id: o.id },
  });
});

/* ── Contracts ──────────────────────────────────────────────────────── */

/** Ready to sign / signed. Leaving "ready" any way (signed, cancelled,
 *  back to draft) settles "ready to sign". */
export const notifyContractStatus = quiet("notifyContractStatus", async (
  a: Actor,
  c: { id: string; contract_no?: string | null; created_by?: string | null },
  from: string | null,
  to: string,
): Promise<void> => {
  if (from === to) return;
  if (from === "ready" || to === "signed" || to === "cancelled") await clearUnreadByMeta({ type: "contract_ready", contract_id: c.id });
  if (!c.created_by || (to !== "ready" && to !== "signed")) return;
  const type = to === "ready" ? "contract_ready" : "contract_signed";
  await notifyLite({
    tenantId: a.tenant_id,
    recipients: [c.created_by],
    senderId: a.account_id,
    tpl: to === "ready"
      ? { k: "contract_ready", p: { no: c.contract_no || "—", actor: who(a) } }
      : { k: "contract_signed", p: { no: c.contract_no || "—", actor: who(a) } },
    link: `/contracts/${encodeURIComponent(c.id)}`,
    type,
    metadata: { source: "contracts", contract_id: c.id },
    tag: `contract:${c.id}`,
  });
});

/** A contract was deleted (only an unsigned one can be): "ready to sign"
 *  about it has nothing left to sign. */
export const settleContractDeleted = quiet("settleContractDeleted", async (contractId: string): Promise<void> => {
  await clearUnreadByMeta({ type: "contract_ready", contract_id: contractId });
});

/* ── CRM follow-ups ─────────────────────────────────────────────────── */

/** A follow-up was done, moved or deleted: its "due" reminder is answered. */
export const settleFollowup = quiet("settleFollowup", async (activityId: string): Promise<void> => {
  await clearUnreadByMeta({ type: "crm_followup_due", activity_id: activityId });
});

/** A deal was deleted — its follow-ups went with it (ON DELETE CASCADE),
 *  and so do their reminders. */
export const settleDealFollowups = quiet("settleDealFollowups", async (opportunityId: string): Promise<void> => {
  await clearUnreadByMeta({ type: "crm_followup_due", opportunity_id: opportunityId });
});

/* ── Expenses ───────────────────────────────────────────────────────── */

/** Who may approve an expense — exactly who POST /api/approvals lets
 *  through: Super Admins, and active internal accounts holding «Finance
 *  Approvals» (view) AND Finance (create), per-account overrides winning
 *  over the role the way requireModuleAccess / requireModuleAction read
 *  them. Nobody is asked to decide what the server would refuse them. */
async function financeApproverIds(tenantId: string): Promise<string[]> {
  type Perm = { role_id?: string; account_id?: string; module_name?: string; module_key?: string; can_view?: boolean | null; can_create?: boolean | null };
  const ids = new Set(await superAdminAccountIds(tenantId));
  const [{ data: roleFa }, { data: ovFa }] = await Promise.all([
    supabaseServer.from("koleex_permissions").select("role_id").ilike("module_name", FINANCE_APPROVALS_MODULE).eq("can_view", true),
    supabaseServer.from("account_permission_overrides").select("account_id").ilike("module_key", FINANCE_APPROVALS_MODULE).eq("can_view", true),
  ]);
  const faRoles = [...new Set(((roleFa ?? []) as Perm[]).map((p) => p.role_id!))];
  const faAccounts = [...new Set(((ovFa ?? []) as Perm[]).map((p) => p.account_id!))];
  const or = [
    faRoles.length ? `role_id.in.(${faRoles.join(",")})` : null,
    faAccounts.length ? `id.in.(${faAccounts.join(",")})` : null,
  ].filter(Boolean).join(",");
  if (!or) return [...ids];
  const { data: accts } = await supabaseServer
    .from("accounts")
    .select("id, role_id")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .eq("user_type", "internal")
    .or(or)
    .limit(200);
  const cands = ((accts ?? []) as Array<{ id: string; role_id: string | null }>).filter((c) => !ids.has(c.id));
  if (!cands.length) return [...ids];
  const roleIds = [...new Set(cands.map((c) => c.role_id).filter((r): r is string => !!r))];
  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    roleIds.length
      ? supabaseServer.from("koleex_permissions").select("role_id, module_name, can_view, can_create").in("role_id", roleIds)
          .or(`module_name.ilike."${FINANCE_APPROVALS_MODULE}",module_name.ilike.Finance`)
      : Promise.resolve({ data: [] as Perm[] }),
    supabaseServer.from("account_permission_overrides").select("account_id, module_key, can_view, can_create").in("account_id", cands.map((c) => c.id))
      .or(`module_key.ilike."${FINANCE_APPROVALS_MODULE}",module_key.ilike.Finance`),
  ]);
  const norm = (m?: string) => (m ?? "").toLowerCase();
  const fa = norm(FINANCE_APPROVALS_MODULE);
  const pick = (rows: Perm[] | null, match: (r: Perm) => boolean) => (rows ?? []).find(match) ?? null;
  for (const c of cands) {
    const rFa = pick(rolePerms as Perm[], (r) => r.role_id === c.role_id && norm(r.module_name) === fa);
    const rFin = pick(rolePerms as Perm[], (r) => r.role_id === c.role_id && norm(r.module_name) === "finance");
    const oFa = pick(overrides as Perm[], (r) => r.account_id === c.id && norm(r.module_key) === fa);
    const oFin = pick(overrides as Perm[], (r) => r.account_id === c.id && norm(r.module_key) === "finance");
    const faView = typeof oFa?.can_view === "boolean" ? oFa.can_view : rFa?.can_view === true;
    const finHidden = oFin?.can_view === false;
    const finCreate = typeof oFin?.can_create === "boolean" ? oFin.can_create : rFin?.can_create === true;
    if (faView && !finHidden && finCreate) ids.add(c.id);
  }
  return [...ids];
}

type ExpenseLike = {
  id: string;
  title?: string | null;
  amount?: number | null;
  currency?: string | null;
  created_by_account_id?: string | null;
  submitted_by?: string | null;
};

/** An expense's approval state moved (either door: the expense's own
 *  approval route or the Approvals queue). Submitted → the approvers are
 *  asked; decided → the request clears for every approver and the person
 *  who submitted it hears the answer. */
export const notifyExpenseTransition = quiet("notifyExpenseTransition", async (
  a: Actor,
  e: ExpenseLike,
  to: string,
  note?: string | null,
): Promise<void> => {
  const amount = money(e.amount, e.currency);
  if (to === "submitted") {
    await notifyLite({
      tenantId: a.tenant_id,
      recipients: await financeApproverIds(a.tenant_id),
      senderId: a.account_id,
      tpl: { k: "expense_approval_request", p: { who: who(a), amount, what: e.title ?? undefined } },
      link: "/finance/approvals",
      type: "expense_approval_request",
      metadata: { source: "expenses", expense_id: e.id },
      tag: `expense:${e.id}`,
      supersede: { type: "expense_approval_request", expense_id: e.id },
    });
    return;
  }
  /* Withdrawn to draft: nothing left to decide, and nobody to tell. */
  if (to === "draft") {
    await clearUnreadByMeta({ type: "expense_approval_request", expense_id: e.id });
    return;
  }
  if (!["approved", "partially_approved", "rejected", "requires_changes"].includes(to)) return;
  await clearUnreadByMeta({ type: "expense_approval_request", expense_id: e.id });
  const owner = e.submitted_by ?? e.created_by_account_id ?? null;
  if (!owner) return;
  await notifyLite({
    tenantId: a.tenant_id,
    recipients: [owner],
    senderId: a.account_id,
    tpl: { k: "expense_decided", p: { decision: to, amount, note: note?.trim() || undefined } },
    link: "/expenses",
    type: "expense_decided",
    metadata: { source: "expenses", expense_id: e.id, decision: to },
    tag: `expense:${e.id}`,
    supersede: { type: "expense_decided", expense_id: e.id },
  });
});

/** The same, from the Approvals queue — which returns only the new status,
 *  so the expense is read here, after the response. */
export const notifyExpenseTransitionById = quiet("notifyExpenseTransitionById", async (
  a: Actor,
  expenseId: string,
  to: string,
  note?: string | null,
): Promise<void> => {
  const { data } = await supabaseServer
    .from("finance_expenses")
    .select("id, title, amount, currency, created_by_account_id, submitted_by")
    .eq("id", expenseId)
    .eq("tenant_id", a.tenant_id)
    .maybeSingle();
  if (data) await notifyExpenseTransition(a, data as ExpenseLike, to, note);
});

/* ── Purchases ──────────────────────────────────────────────────────── */

/** Goods arrived on a purchase order: whoever raised it hears — or, when
 *  the PO carries no creator, whoever raised the sales order it serves. */
export const notifyPurchaseReceived = quiet("notifyPurchaseReceived", async (a: Actor, poId: string, poStatus: string | undefined): Promise<void> => {
  const { data: po } = await supabaseServer
    .from("purchase_orders")
    .select("id, po_no, created_by_account_id, order_id")
    .eq("id", poId)
    .eq("tenant_id", a.tenant_id)
    .maybeSingle();
  const row = po as { id: string; po_no: string | null; created_by_account_id: string | null; order_id: string | null } | null;
  if (!row) return;
  let owner = row.created_by_account_id;
  if (!owner && row.order_id) {
    const { data: ord } = await supabaseServer.from("orders").select("created_by").eq("id", row.order_id).maybeSingle();
    owner = (ord as { created_by: string | null } | null)?.created_by ?? null;
  }
  if (!owner) return;
  const full = poStatus === "received" || poStatus === "closed";
  await notifyLite({
    tenantId: a.tenant_id,
    recipients: [owner],
    senderId: a.account_id,
    tpl: full
      ? { k: "purchase_received", p: { no: row.po_no || "—", actor: who(a) } }
      : { k: "purchase_received.partial", p: { no: row.po_no || "—", actor: who(a) } },
    link: "/purchase/orders",
    type: "purchase_received",
    metadata: { source: "purchase", purchase_order_id: row.id, status: poStatus ?? null },
    tag: `po:${row.id}`,
    supersede: { type: "purchase_received", purchase_order_id: row.id },
  });
});
