import "server-only";

/* ---------------------------------------------------------------------------
   Semantic-relationship field governance. Validates the controlled vocab
   (relationship_type, status) and coerces confidence (0–100).
   --------------------------------------------------------------------------- */

import { RELATIONSHIP_TYPES, RELATIONSHIP_STATUSES, REVERSE_TYPE, type RelationshipType } from "./types";

export const RELATIONSHIP_TYPE_SET = new Set<string>(RELATIONSHIP_TYPES);
export const RELATIONSHIP_STATUS_SET = new Set<string>(RELATIONSHIP_STATUSES);

export function isRelationshipType(v: unknown): v is RelationshipType {
  return typeof v === "string" && RELATIONSHIP_TYPE_SET.has(v);
}

export function reverseOf(type: RelationshipType): RelationshipType | null {
  return REVERSE_TYPE[type] ?? null;
}

/** Clamp/validate a confidence score to 0–100; default 100. */
export function coerceConfidence(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Validate a relationship status string. */
export function validStatus(v: unknown): boolean {
  return typeof v === "string" && RELATIONSHIP_STATUS_SET.has(v);
}
