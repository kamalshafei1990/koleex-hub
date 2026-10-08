/* Contacts rollout gate — reuses the shared, resource-agnostic
   `shouldUseServerList` (see rollout-gate.ts) with no Contacts-specific
   branching. The only Contacts-specific piece is the cohort env var
   (KX_CONTACTS_SERVER_LIST_ACCOUNT_IDS, resolved server-side in
   src/lib/server/contacts-rollout.ts and surfaced as the trusted
   `contactsServerList` bootstrap flag). Precedence is identical to
   Customers/Suppliers: ?serverlist=0 legacy · =1 server · cohort server ·
   Preview host server · production legacy. */
export { shouldUseServerList } from "./rollout-gate";
