/* The View-as picker's list cache, in its own module so the exit banner can
   clear it without importing the picker — that one import used to pull the
   whole picker (~10 KB of list UI and fetch logic) into every page's first
   download, for a menu only a Super Admin ever opens.

   Lists are shared across the whole app — there's only one picker instance,
   but if the picker remounts (route changes inside RootShell, theme flip,
   etc.) we don't want to refetch the same lists. The picker narrows the row
   types; nothing else reads the lists. */
export const viewAsListCache: {
  users: unknown[] | null;
  roles: unknown[] | null;
  usersFetchedAt: number;
  rolesFetchedAt: number;
  inflightUsers: Promise<unknown> | null;
  inflightRoles: Promise<unknown> | null;
} = {
  users: null,
  roles: null,
  usersFetchedAt: 0,
  rolesFetchedAt: 0,
  inflightUsers: null,
  inflightRoles: null,
};

/** Called on exit from view-as (and after a switch) so the next open reads
 *  fresh lists. */
export function invalidateViewAsLists(): void {
  viewAsListCache.users = null;
  viewAsListCache.roles = null;
  viewAsListCache.usersFetchedAt = 0;
  viewAsListCache.rolesFetchedAt = 0;
}
