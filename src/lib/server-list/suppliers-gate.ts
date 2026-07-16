/* Suppliers rollout gate — reuses the shared, resource-agnostic
   `shouldUseServerList` (see rollout-gate.ts) with NO Suppliers-specific
   branching. The only Suppliers-specific piece is the cohort env var
   (KX_SUPPLIERS_SERVER_LIST_ACCOUNT_IDS, resolved server-side in
   src/lib/server/suppliers-rollout.ts and surfaced as the trusted
   `suppliersServerList` bootstrap flag). Precedence is identical to Customers:
   ?serverlist=0 legacy · =1 server · cohort server · Preview host server ·
   production legacy. */
export { shouldUseServerList } from "./rollout-gate";
