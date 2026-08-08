/* ---------------------------------------------------------------------------
   products-config — server-list contract for the product catalogue.

   WHY THIS EXISTS: the catalogue grid downloads every product and filters in
   the browser. At today's 121 products that is 71 KB and ~800 ms. The owner's
   real target is 3000+ products, which is ~1.8 MB on a response path measured
   at 2100 ms per 128 KB — past the grid's own 30 s abort, so the "Couldn't
   load products" screen would stop being occasional and become permanent. It
   also overflows the localStorage warm-start (2.5 MB guard against a ~5 MB
   origin quota, shared with contacts and the image map).

   Same shape and same rules as contacts-config: framework-agnostic (no React,
   no Supabase, no server-only) so a plain Node test can import it, and the
   client may search / sort / filter by NOTHING except what is allowlisted
   here — never a raw column name, never an expression.
   --------------------------------------------------------------------------- */
import type { ServerListConfig } from "./types";

export const PRODUCTS_LIST_CONFIG: ServerListConfig = {
  /* 150, not 48. The owner watched the catalogue arrive in three visible
     steps — 48, then 96, then 121 — because a 121-product catalogue was
     being cut into three pages. Each page is only ~170 ms from Tokyo, so it
     looked fine here; on his link each one is seconds, so the grid grew
     under him twice ("it shows not all the products, then suddenly shows
     all"). A page that holds his whole catalogue arrives in ONE request and
     the grid never changes after it appears.

     Still a multiple of 6, so a page boundary never lands mid-row on either
     the 12-column desktop grid or the 2-column mobile one. Paging is not
     abandoned: past the auto-complete threshold the scroll path takes over,
     which is what the 3000 products he is about to enter actually need. */
  defaultPageSize: 150,
  maxPageSize: 200,
  sortFields: {
    name: "product_name",
    brand: "brand",
    created: "created_at",
    updated: "updated_at",
  },
  /* Newest first — the working order in Product Data, and what the unpaged
     route has always returned. */
  defaultSort: { field: "created", dir: "desc" },
  /* TEXT columns only. `tags` and `alternate_names` are text[] and ilike does
     not apply to an array, so including them here would silently produce an
     invalid PostgREST or-expression and break every search. Array search needs
     the containment operators and a separate pass — see
     [products text[] trap] in lib/product-array-columns. Until then the
     Chinese/alternate names stay searchable through the client-side haystack
     on the page the user already has. */
  searchColumns: ["product_name", "slug", "brand", "excerpt", "description"],
  filters: {
    division: { column: "division_slug" },
    category: { column: "category_slug" },
    subcategory: { column: "subcategory_slug" },
    brand: { column: "brand" },
    level: { column: "level" },
    status: { column: "status", allowed: ["draft", "active", "archived"] },
    featured: { column: "featured", allowed: ["true", "false"] },
    visible: { column: "visible", allowed: ["true", "false"] },
  },
  maxQueryLength: 100,
};
