import "server-only";

/* Who may approve a space's posts — and so publish them (owner, 27/09/2026):
   · company (Social Marketing): the super admins, and any role given
     «Social Marketing Approvals» in Roles & Permissions — the marketing
     manager's role. Either one approving is enough.
   · ceo (CEO Brand): only the CEO. Until CEO Brand exists, the super admins.
   A route still refuses the action itself under view-as (requireModuleAction
   with "edit"); this answers the question for the screen too. */

import { requireModuleAccess, type ServerAuthContext } from "@/lib/server/auth";
import { SOCIAL_APPROVALS_MODULE } from "@/lib/permission-modules";
import type { MarketingSpace } from "@/lib/marketing/spaces";

export async function canApprovePosts(auth: ServerAuthContext, space: MarketingSpace): Promise<boolean> {
  if (auth.is_super_admin) return true;
  if (space !== "company") return false;
  return (await requireModuleAccess(auth, SOCIAL_APPROVALS_MODULE)) === null;
}
