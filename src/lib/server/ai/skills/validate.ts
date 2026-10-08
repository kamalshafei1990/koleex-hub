/* ---------------------------------------------------------------------------
   ai/skills/validate — check a tool's arguments against its OWN schema.

   Phase 6C. No `server-only`: it is a pure checker, and the suite imports it
   directly.

   WHY NOT ZOD, which the plan names. Zod would mean writing a second schema
   for each of 45 tools, beside the `parameters` schema the tool already
   declares and the model already sees. Two schemas for one contract is a
   parallel surface that must be kept in sync by hand, and its failure mode is
   the worst one available here: a zod schema that drifts from the advertised
   one rejects a call the model was explicitly TOLD to make. That is the same
   reasoning that kept the Hub connector from growing parallel methods in 2G,
   and it applies harder here because the drift would be invisible until a
   user hit it.

   So this reads `ToolParameterSchema` — the single source — and a new tool is
   validated the moment it is registered, with nothing to remember.

   WHAT IS CHECKED, and what deliberately is not:

     · a REQUIRED property is present and not null/undefined
     · a present property matches its declared type
     · an `enum` property holds one of its declared values
     · array items match their declared item type where one is given

     · UNKNOWN properties are reported but NEVER rejected. Models add stray
       keys, and a handler that does not read a key is unaffected by it.
       Rejecting them would break working calls to fix nothing.
     · nothing is COERCED. A validator that quietly turns "5" into 5 hides the
       model's mistake and makes the next one harder to find.

   IT IS LOG-ONLY BY DEFAULT, and that is a real limitation rather than a
   soft launch for its own sake. The schemas being checked have never been
   enforced, so the first enforcing release is also the first time anyone
   learns whether they describe the calls tools actually receive. Enforcing
   on day one would turn every inaccuracy in a 45-tool schema set into a
   user-visible failure. `AI_TOOL_VALIDATION=enforce` flips it once the logs
   are quiet.

   Until that flag is set this phase MEASURES rather than protects, and
   nothing here should be described as a guard.
   --------------------------------------------------------------------------- */

import type { ToolParameterSchema, ToolParameterProperty } from "@/lib/server/ai-agent/types";

export type ValidationMode = "off" | "log" | "enforce";

export interface ValidationIssue {
  /** Dotted path to the offending value, e.g. "lines[0].qty". */
  path: string;
  /** Machine-readable reason, for grouping in logs. */
  code: "missing_required" | "wrong_type" | "not_in_enum" | "unknown_property";
  detail: string;
}

export interface ValidationResult {
  /** True when nothing BLOCKING was found. Unknown properties do not block. */
  valid: boolean;
  issues: ValidationIssue[];
}

/** `unknown_property` is advisory. Everything else is a real defect in the
 *  call, and would be rejected under enforcement. */
export function isBlocking(issue: ValidationIssue): boolean {
  return issue.code !== "unknown_property";
}

export function validationMode(): ValidationMode {
  const raw = process.env.AI_TOOL_VALIDATION?.trim().toLowerCase();
  if (raw === "enforce" || raw === "off") return raw;
  /* Anything else, including unset and a typo, is log-only. A typo must not
     silently disable the checking OR silently start rejecting calls. */
  return "log";
}

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  return typeof v;
}

/** Does `value` satisfy the declared JSON-Schema-ish type? */
function matchesType(declared: ToolParameterProperty["type"] | string, value: unknown): boolean {
  switch (declared) {
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      /* An unrecognised declared type cannot be checked, so it PASSES. A
         checker that failed on schema it did not understand would reject
         valid calls to report its own gap. */
      return true;
  }
}

function checkProperty(
  path: string,
  prop: ToolParameterProperty,
  value: unknown,
  issues: ValidationIssue[],
): void {
  if (!matchesType(prop.type, value)) {
    issues.push({
      path,
      code: "wrong_type",
      detail: `expected ${prop.type}, got ${typeOf(value)}`,
    });
    /* Stop descending: the shape is already wrong, and every child would
       report a second, derived failure of the same root cause. */
    return;
  }

  if (prop.enum && prop.enum.length > 0 && typeof value === "string" && !prop.enum.includes(value)) {
    issues.push({
      path,
      code: "not_in_enum",
      /* The declared options are safe to name — they are OUR schema. The
         VALUE is not echoed: `detail` must never carry argument data, or a
         caller that logs the full issue list turns this into a data leak.
         The rule is absolute rather than case-by-case, so nobody has to
         judge which arguments are sensitive. */
      detail: `expected one of ${prop.enum.join(" | ")}`,
    });
  }

  if (prop.type === "array" && Array.isArray(value) && prop.items) {
    value.forEach((item, i) => {
      const itemPath = `${path}[${i}]`;
      if (!matchesType(prop.items!.type, item)) {
        issues.push({
          path: itemPath,
          code: "wrong_type",
          detail: `expected ${prop.items!.type}, got ${typeOf(item)}`,
        });
        return;
      }
      if (prop.items!.properties && typeof item === "object" && item !== null) {
        checkObject(itemPath, prop.items!.properties, prop.items!.required, item as Record<string, unknown>, issues);
      }
    });
  }

  if (prop.type === "object" && prop.properties && typeof value === "object" && value !== null) {
    checkObject(path, prop.properties, prop.required, value as Record<string, unknown>, issues);
  }
}

function checkObject(
  basePath: string,
  properties: Record<string, ToolParameterProperty>,
  required: string[] | undefined,
  value: Record<string, unknown>,
  issues: ValidationIssue[],
): void {
  for (const name of required ?? []) {
    const v = value[name];
    if (v === undefined || v === null) {
      issues.push({
        path: basePath ? `${basePath}.${name}` : name,
        code: "missing_required",
        detail: "required property is absent",
      });
    }
  }

  for (const [name, raw] of Object.entries(value)) {
    const prop = properties[name];
    const path = basePath ? `${basePath}.${name}` : name;
    if (!prop) {
      issues.push({ path, code: "unknown_property", detail: "not declared in the tool's schema" });
      continue;
    }
    /* An absent optional property is fine; a present one is checked. A
       required one that is absent was already reported above. */
    if (raw === undefined || raw === null) continue;
    checkProperty(path, prop, raw, issues);
  }
}

/** Validate one call's arguments against the tool's declared schema. Pure. */
export function validateArgs(
  schema: ToolParameterSchema,
  args: Record<string, unknown>,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  checkObject("", schema.properties ?? {}, schema.required, args ?? {}, issues);
  return { valid: !issues.some(isBlocking), issues };
}

/** One log line per invalid call. Numbers and paths only — never a VALUE.
 *
 *  Tool arguments carry customer names, product codes and free text; the
 *  standing rule against logging prompt or reply content applies to them just
 *  as much. The path and the reason are enough to fix a schema; the value is
 *  what would turn this log into a data leak. */
export function formatValidationLine(toolName: string, r: ValidationResult, mode: ValidationMode): string {
  const codes = r.issues.map((i) => `${i.path || "<root>"}:${i.code}`).join(",");
  const blocking = r.issues.filter(isBlocking).length;
  return `[ai.tool.validate] tool=${toolName} mode=${mode} blocking=${blocking} total=${r.issues.length} issues=${codes}`;
}
