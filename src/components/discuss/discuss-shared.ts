/* Small helpers shared by DiscussApp and its lazily-loaded modals. */

export type DiscussRecipient = {
  id: string;
  username: string;
  full_name: string | null;
  name_alt: string | null;
  avatar_url: string | null;
  role_name: string | null;
};

/** Native/alternate name (e.g. Chinese) to show muted beneath the primary
 *  name — only when it exists and differs from the primary. */
export function nativeAltOf(
  primary: string | null | undefined,
  alt: string | null | undefined,
): string | null {
  const a = (alt ?? "").trim();
  return a && a !== (primary ?? "").trim() ? a : null;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type DiscussT = (key: string, fallback?: string) => string;
