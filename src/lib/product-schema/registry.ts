import type {
  ProductSchemaDefinition,
  ProductSchemaResolution,
} from "@/types/product-schema";

/**
 * Internal registry of product schema definitions.
 *
 * Keys are composite strings of the form:
 *   "division|category|subcategory|machineKind"
 * where "*" acts as a wildcard for machineKind when omitted at registration
 * time. The pipe character is a literal separator.
 */
const schemas = new Map<string, ProductSchemaDefinition>();

/**
 * Build the composite key used for registry lookups.
 */
function makeKey(
  divisionCode: string,
  categoryCode: string,
  subcategoryCode: string,
  machineKindId: string | undefined,
): string {
  return `${divisionCode}|${categoryCode}|${subcategoryCode}|${machineKindId ?? "*"}`;
}

/**
 * Register a schema definition.
 *
 * Re-registering the SAME schema (matched by `id`) under the same composite
 * key is a no-op so that hot module reloads do not crash. Registering a
 * DIFFERENT schema under an already-taken key throws.
 */
export function registerSchema(def: ProductSchemaDefinition): void {
  const key = makeKey(
    def.divisionCode,
    def.categoryCode,
    def.subcategoryCode,
    def.machineKindId,
  );

  const existing = schemas.get(key);
  if (existing && existing.id !== def.id) {
    throw new Error(
      `Product schema key "${key}" is already registered to schema "${existing.id}"; cannot re-register as "${def.id}".`,
    );
  }

  schemas.set(key, def);
}

/**
 * Resolve a schema for the given tuple, walking the specificity ladder from
 * most to least specific. Always returns a ProductSchemaResolution; `schema`
 * is null when no rule matches.
 */
export function resolveSchema(args: {
  divisionCode: string;
  categoryCode: string;
  subcategoryCode: string;
  machineKindId?: string;
}): ProductSchemaResolution {
  const { divisionCode, categoryCode, subcategoryCode, machineKindId } = args;

  const ladder: Array<{
    key: string;
    source: ProductSchemaResolution["source"];
  }> = [];

  if (machineKindId) {
    ladder.push({
      key: makeKey(divisionCode, categoryCode, subcategoryCode, machineKindId),
      source: "exact",
    });
  }
  ladder.push({
    key: makeKey(divisionCode, categoryCode, subcategoryCode, undefined),
    source: "subcategory",
  });
  ladder.push({
    key: makeKey(divisionCode, categoryCode, "*", undefined),
    source: "category",
  });
  ladder.push({
    key: makeKey(divisionCode, "*", "*", undefined),
    source: "fallback",
  });
  ladder.push({
    key: makeKey("*", "*", "*", undefined),
    source: "fallback",
  });

  const appliedRules: string[] = [];
  for (const step of ladder) {
    appliedRules.push(step.key);
    const hit = schemas.get(step.key);
    if (hit) {
      return { schema: hit, source: step.source, appliedRules };
    }
  }

  return { schema: null, source: "fallback", appliedRules };
}

/**
 * List all registered schema definitions in insertion order.
 */
export function listSchemas(): ProductSchemaDefinition[] {
  return Array.from(schemas.values());
}

/**
 * Clear all registered schemas. Intended for use in tests.
 */
export function clearSchemas(): void {
  schemas.clear();
}

/**
 * Look up a schema by its stable id, or null if none is registered.
 */
export function getSchemaById(id: string): ProductSchemaDefinition | null {
  for (const def of schemas.values()) {
    if (def.id === id) return def;
  }
  return null;
}
