/* A page of the public site as the Website app lists it (GET /api/website/pages). */
export interface WebsitePageRow {
  slug: string;
  name: string;
  title: string | null;
  /** Visible sections from the old editor (shown until the page is published). */
  sections: number;
  /** The published version (0 = never published: the site keeps its built-in page). */
  version: number;
  /** The draft has changes the site does not show yet. */
  changed: boolean;
  publishedAt: string | null;
  updatedAt: string | null;
}
