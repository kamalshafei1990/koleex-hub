/* A page of the public site as the Website app lists it (GET /api/website/pages). */
export interface WebsitePageRow {
  slug: string;
  name: string;
  title: string | null;
  /** Visible sections built for it in the Hub (0 = the site's built-in content). */
  sections: number;
  updatedAt: string | null;
}
