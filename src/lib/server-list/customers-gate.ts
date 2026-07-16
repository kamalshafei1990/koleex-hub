/* Customers rollout gate — the decision logic is the shared, resource-agnostic
   `shouldUseServerList` (see rollout-gate.ts). Re-exported here so existing
   Customers imports (customers/page.tsx, validate:customers-gate) keep working
   unchanged. Precedence: ?serverlist=0 legacy · =1 server · cohort server ·
   Preview host server · production legacy. */
export { shouldUseServerList } from "./rollout-gate";
