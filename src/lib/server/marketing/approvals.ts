import "server-only";

/* Who may approve a space's posts — and so publish them:
   · company (Social Marketing, owner 27/09/2026): the super admins, and any
     role given «Social Marketing Approvals» in Roles & Permissions — the
     marketing manager's role. Either one approving is enough.
   · ceo (CEO Brand, owner 29/09/2026): ONLY an account granted «CEO Brand
     Approvals» — the CEO grants it to himself. The super admins are NOT
     approvers here by default: these are the CEO's own posts, and three
     super admins share the tenant. Nobody approves until it is granted.
   A route still refuses the action itself under view-as (requireModuleAction
   with "edit"); this answers the question for the screen too. */

import { supabaseServer } from "@/lib/server/supabase-server";
import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { CEO_APPROVALS_MODULE, SOCIAL_APPROVALS_MODULE } from "@/lib/permission-modules";
import type { MarketingSpace } from "@/lib/marketing/spaces";

export async function canApprovePosts(auth: ServerAuthContext, space: MarketingSpace): Promise<boolean> {
  if (space === "ceo") return holdsGrant(auth, CEO_APPROVALS_MODULE);
  if (auth.is_super_admin) return true;
  return (await requireModuleAccess(auth, SOCIAL_APPROVALS_MODULE)) === null;
}

/** Whether the account is GRANTED a capability — its own override, else its
 *  role's permission (the override wins, both ways) — with no super admin
 *  bypass. Names match case-insensitively, like requireModuleAccess. Fails
 *  closed on a database error. */
async function holdsGrant(auth: ServerAuthContext, moduleName: string): Promise<boolean> {
  const [override, role] = await Promise.all([
    supabaseServer.from("account_permission_overrides").select("can_view").eq("account_id", auth.account_id).ilike("module_key", moduleName).maybeSingle(),
    auth.role_id
      ? supabaseServer.from("koleex_permissions").select("can_view").eq("role_id", auth.role_id).ilike("module_name", moduleName).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (override.error || role.error) {
    console.error("[marketing/approvals.holdsGrant]", override.error?.message ?? role.error?.message);
    return false;
  }
  const own = (override.data as { can_view?: boolean | null } | null)?.can_view;
  return typeof own === "boolean" ? own : (role.data as { can_view?: boolean | null } | null)?.can_view === true;
}
