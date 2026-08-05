/* ===========================================================================
   validate:ai-platform — Phase 0 gate for the Intelligence Platform core.

   Pure-function checks over contracts + policy resolver + permission guard.
   Run: npm run validate:ai-platform
   =========================================================================== */

import {
  BLAST_RADII,
  BUDGETS,
  MAX_INHERITANCE_DEPTH,
  MEMORY_TIER_RULES,
  PLATFORM_DEFAULT_POLICY,
  POLICY_FIELD_SEMANTICS,
  V1_EXECUTION_CAP,
  blastRadiusRank,
} from "../src/lib/ai-platform/contracts";
import { resolveEffectivePolicy } from "../src/lib/ai-platform/policy-resolver";
import { guardBlastRadius, intersectPermissions } from "../src/lib/ai-platform/permissions";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}`); }
}

console.log("— contracts —");
check("blast radii are ordered read<suggest<write<irreversible",
  blastRadiusRank("read") < blastRadiusRank("suggest") &&
  blastRadiusRank("suggest") < blastRadiusRank("write") &&
  blastRadiusRank("write") < blastRadiusRank("irreversible"));
check("v1 execution cap is write (Non-Goal 6)", V1_EXECUTION_CAP === "write");
check("inheritance depth capped at 3 (ADR-002)", MAX_INHERITANCE_DEPTH === 3);
check("hop budget ≤3 for class S (P9)", BUDGETS.S.maxSequentialHops <= 3);
check("every policy field has merge semantics declared",
  Object.keys(PLATFORM_DEFAULT_POLICY).every((k) => k in POLICY_FIELD_SEMANTICS));
check("no memory tier auto-promotes to shared tiers (ADR-007)",
  MEMORY_TIER_RULES.instance.writePath === "review" && MEMORY_TIER_RULES.org.writePath === "review");
check("user memory tier writes directly (personal, user-erasable)",
  MEMORY_TIER_RULES.user.writePath === "direct");

console.log("— policy resolver: precedence & narrowing —");
{
  // parent (write, en+zh) → package tries to WIDEN to irreversible: must be ignored
  const r = resolveEffectivePolicy([
    { blastRadius: "write", languages: ["en", "zh"] },
    { blastRadius: "irreversible", outputStyle: "formal" },
  ]);
  check("child cannot widen blast radius", r.policy.blastRadius === "write");
  check("widen attempt produces a warning", r.warnings.some((w) => w.includes("WIDEN")));
  check("style field: most specific (last) wins", r.policy.outputStyle === "formal");
  check("provenance records the deciding layer", r.provenance.outputStyle === 1);
}
{
  // language intersection narrows across layers
  const r = resolveEffectivePolicy([
    { languages: ["en", "zh", "ar"] },
    { languages: ["zh", "ar"] },
    { languages: ["ar"] },
  ]);
  check("languages intersect across layers", r.policy.languages.length === 1 && r.policy.languages[0] === "ar");
}
{
  // empty intersection ⇒ viability warning (R-10)
  const r = resolveEffectivePolicy([{ languages: ["en"] }, { languages: ["zh"] }]);
  check("empty language intersection warns (R-10)", r.warnings.some((w) => w.includes("EMPTY")));
}
{
  // permissions: first layer sets universe; later layers can only remove
  const r = resolveEffectivePolicy([
    { requestedPermissions: ["HR:view", "Quotations:view", "Quotations:create"] },
    { requestedPermissions: ["Quotations:view", "Quotations:create", "Products:view"] },
  ]);
  check("later layer cannot ADD permissions",
    !r.policy.requestedPermissions.includes("Products:view"));
  check("intersection keeps the common grants",
    r.policy.requestedPermissions.includes("Quotations:view") &&
    r.policy.requestedPermissions.includes("Quotations:create") &&
    !r.policy.requestedPermissions.includes("HR:view"));
}
{
  // confidence floor: highest wins; budget: smallest wins; refusal: true wins
  const r = resolveEffectivePolicy([
    { confidenceFloor: 0.3, budgetClass: "L", refuseOutOfScope: false },
    { confidenceFloor: 0.6, budgetClass: "M" },
  ]);
  check("confidence floor takes the maximum", r.policy.confidenceFloor === 0.6);
  check("budget class takes the smallest", r.policy.budgetClass === "M");
  check("refuseOutOfScope stays true once true (platform default)", r.policy.refuseOutOfScope === true);
}
{
  // stripped-inert package warns
  const r = resolveEffectivePolicy([
    { blastRadius: "write", requestedPermissions: ["Quotations:create"] },
    { requestedPermissions: [] },
  ]);
  check("write-radius with zero permissions warns (inert package)",
    r.warnings.some((w) => w.includes("act on nothing")));
}
{
  // no layers ⇒ platform defaults, no warnings
  const r = resolveEffectivePolicy([]);
  check("empty layers yield platform defaults",
    r.policy.blastRadius === "read" && r.policy.budgetClass === "S" && r.warnings.length === 0);
  check("safety rules union & dedupe",
    resolveEffectivePolicy([{ safetyRules: ["a", "b"] }, { safetyRules: ["b", "c"] }])
      .policy.safetyRules.length === 3);
}

console.log("— permission intersection (ADR-008) —");
check("effective = requested ∩ tenant ∩ user",
  JSON.stringify(intersectPermissions(
    ["HR:view", "Quotations:create", "Products:view"],
    ["HR:view", "Quotations:create"],
    ["Quotations:create", "Products:view"],
  )) === JSON.stringify(["Quotations:create"]));
check("duplicates collapse",
  intersectPermissions(["A:view", "A:view"], ["A:view"], ["A:view"]).length === 1);
check("empty user grants ⇒ empty effective set",
  intersectPermissions(["A:view"], ["A:view"], []).length === 0);

console.log("— blast-radius guard —");
check("read proceeds", guardBlastRadius("read", "read").action === "proceed");
check("suggest is draft-only", guardBlastRadius("suggest", "suggest").action === "draft_only");
check("write requires confirmation", guardBlastRadius("write", "write").action === "require_confirmation");
check("irreversible is blocked in v1", guardBlastRadius("irreversible", "irreversible").action === "block");
check("operation wider than package declaration is blocked",
  guardBlastRadius("write", "read").action === "block");
check("package radius does not unlock ops beyond the v1 cap",
  BLAST_RADII.every((op) =>
    blastRadiusRank(op) <= blastRadiusRank(V1_EXECUTION_CAP) ||
    guardBlastRadius(op, "irreversible").action === "block"));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
