import "server-only";

/* ---------------------------------------------------------------------------
   getUserPermissions — introspection tool the LLM can call to know the
   shape of the caller's access rights. Used when the user asks "what
   can I do?" or "can I see salaries?" The tool itself requires no
   module — everyone is allowed to inspect their own permissions.

   This is a safe default for the first session because it lets us prove
   the end-to-end plumbing without touching any business data.
   --------------------------------------------------------------------------- */

import type { ToolDef, ToolResult } from "../types";

interface PermissionsSummary {
  user: {
    username: string;
    user_type: string;
    role_id: string | null;
    department: string | null;
    is_super_admin: boolean;
    can_view_private: boolean;
  };
  modules: Array<{
    name: string;
    can_view: boolean;
    can_create: boolean;
    can_edit: boolean;
    can_delete: boolean;
  }>;
  sensitive_fields_visible: string[];
}

const getUserPermissions: ToolDef<Record<string, never>, PermissionsSummary> = {
  name: "getUserPermissions",
  description:
    "Return a structured summary of the current user's permissions — their " +
    "role, module access grid, and which sensitive fields they are allowed " +
    "to see. Use this when the user asks about their own access, what apps " +
    "they can use, or whether they can view a specific kind of information.",
  parameters: {
    type: "object",
    properties: {},
  },
  minRole: "any",
  handler: async (ctx): Promise<ToolResult<PermissionsSummary>> => {
    const summary: PermissionsSummary = {
      user: {
        username: ctx.auth.username,
        user_type: ctx.auth.user_type,
        role_id: ctx.auth.role_id,
        department: ctx.department,
        is_super_admin: ctx.isSuperAdmin,
        can_view_private: ctx.canViewPrivate,
      },
      modules: Object.entries(ctx.modulePermissions).map(([name, perms]) => ({
        name,
        ...perms,
      })),
      sensitive_fields_visible: [...ctx.allowedSensitiveFields].sort(),
    };
    return {
      ok: true,
      permissionStatus: "allowed",
      data: summary,
      message: `Permissions snapshot for ${ctx.auth.username}.`,
      sources: ["koleex_permissions", "account_permission_overrides"],
    };
  },
};

export const permissionTools: ToolDef[] = [getUserPermissions as ToolDef];
