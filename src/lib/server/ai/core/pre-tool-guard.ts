import "server-only";

/* ---------------------------------------------------------------------------
   ai/core/pre-tool-guard — rejects clearly-invalid tool calls before dispatch.

   Phase 2E, moved verbatim. Runs AFTER the model emits tool_calls and BEFORE
   dispatchTool(), so a call with a missing customer, missing product or a
   hallucinated id never reaches the database and never burns an audit row.

   Phase 6 replaces this with declared per-tool schemas; until then it covers
   7 of the 45 tools, which is worth knowing when reading it.
   --------------------------------------------------------------------------- */

/* ─── Pre-tool guard ────────────────────────────────────────────────
   Runs AFTER the model emits tool_calls but BEFORE dispatchTool().
   Rejects calls that are clearly invalid — missing customer, missing
   product, missing quantity — so we never hit the DB with junk and
   never burn the audit trail on ghost calls.

   Importantly, guard failures are INTERNAL:
     · no `tool-call` step is pushed (no chip shown)
     · no `tool-result` step is pushed (no red "denied" chip either)
     · the rejection is fed only to the model via the tool-role
       message that the outer loop emits for every toolRuns entry
     · the next model iteration sees the guard message and rephrases
       it as a natural question to the user

   Missing input is NOT a permission denial. The user just sees the
   assistant asking for the info it needs, in the same bubble style
   as any other reply. No red lock chip, no "denied" state.
   ───────────────────────────────────────────────────────────────── */

/** Canonical v4 UUID shape. Blocks stub/hallucinated ids like
 *  "customer-1", "CUSTOMER", "00000000" that small models occasionally
 *  invent to satisfy a required field. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type GuardResult = { ok: true } | { ok: false; message: string };

export function preToolGuard(
  name: string,
  args: Record<string, unknown>,
): GuardResult {
  switch (name) {
    /* Whitelisted — "list products" / counts / catalogue stats must
       keep working with no args. */
    case "searchProducts":
    case "countProducts":
    case "getCatalogStats":
      return { ok: true };

    case "getCustomerByName": {
      const q = String(args.query ?? "").trim();
      if (!q) {
        return {
          ok: false,
          message:
            "Which customer should I look up? You can send a name or customer code.",
        };
      }
      return { ok: true };
    }

    case "getCustomerByCode": {
      const code = String(args.code ?? "").trim();
      if (!code) {
        return { ok: false, message: "Which customer code should I use?" };
      }
      return { ok: true };
    }

    case "getProductByCode": {
      const code = String(args.code ?? "").trim();
      if (!code) {
        return {
          ok: false,
          message: "Which product code should I look up?",
        };
      }
      return { ok: true };
    }

    case "getProductDetails": {
      const id = String(args.productId ?? "").trim();
      if (!id || !UUID_RE.test(id)) {
        return {
          ok: false,
          message: "I need a product first. Which product should I use?",
        };
      }
      return { ok: true };
    }

    /* Quotation workflow — strictest gate.
       Require (a) a syntactically-valid customerId UUID AND
               (b) at least one line with a valid product UUID + qty > 0.
       Both tools share the same arg shape, so the guard is identical. */
    case "calculateQuotationPricing":
    case "createQuotationDraft": {
      const customerId = String(args.customerId ?? "").trim();
      const rawLines = Array.isArray(args.lines) ? args.lines : [];
      const validLines = rawLines.filter((l) => {
        const rec = l as { productId?: unknown; qty?: unknown };
        const pid = String(rec.productId ?? "").trim();
        const qty = Number(rec.qty ?? 0);
        return pid && UUID_RE.test(pid) && qty > 0;
      });
      const customerOk = customerId && UUID_RE.test(customerId);
      const linesOk = validLines.length > 0;

      if (!customerOk && !linesOk) {
        /* Nothing usable at all — fully-generic ask. */
        return {
          ok: false,
          message:
            "To prepare a quotation, I need the customer name or code, plus the product and quantity.",
        };
      }
      if (!customerOk) {
        return {
          ok: false,
          message:
            "Who is this quotation for? Please send the customer name or code.",
        };
      }
      if (!linesOk) {
        return {
          ok: false,
          message:
            "Which product and quantity should I include in the quotation?",
        };
      }
      return { ok: true };
    }

    default:
      /* Unknown tool names fall through — the registry dispatcher is
         still the enforcement point for unknown-tool and permission
         checks. We only gate the specific arg shapes we know about. */
      return { ok: true };
  }
}
