/* ---------------------------------------------------------------------------
   Brand Center — what the library and the guidelines hold, in numbers.

   Counts come from the owner's item discussion (workshop, 28/09/2026): 21
   sections, every item with every type he chose. The items themselves move
   into the database with the library (plan step C3); until then this is the
   summary the home screen shows. Names live in translations/brand-center.
   --------------------------------------------------------------------------- */

export interface BrandSection { id: string; no: number; groups: number; items: number; types: number }
export interface GuidelinePart { id: string; no: number; sections: number }

export const BRAND_SECTIONS: readonly BrandSection[] = [
  { id: "stationery", no: 1, groups: 6, items: 40, types: 368 },
  { id: "gifts", no: 2, groups: 10, items: 44, types: 449 },
  { id: "packaging", no: 3, groups: 5, items: 27, types: 245 },
  { id: "uniforms", no: 4, groups: 7, items: 34, types: 230 },
  { id: "machine", no: 5, groups: 6, items: 26, types: 154 },
  { id: "shipping", no: 6, groups: 5, items: 18, types: 104 },
  { id: "paperwork", no: 7, groups: 4, items: 18, types: 210 },
  { id: "print", no: 8, groups: 7, items: 20, types: 143 },
  { id: "digital", no: 9, groups: 8, items: 27, types: 219 },
  { id: "video", no: 10, groups: 3, items: 18, types: 138 },
  { id: "documents", no: 11, groups: 3, items: 13, types: 95 },
  { id: "offices", no: 12, groups: 5, items: 19, types: 97 },
  { id: "factory", no: 13, groups: 4, items: 15, types: 79 },
  { id: "showroom", no: 14, groups: 4, items: 14, types: 62 },
  { id: "signage", no: 15, groups: 4, items: 14, types: 96 },
  { id: "exhibitions", no: 16, groups: 3, items: 15, types: 78 },
  { id: "events", no: 17, groups: 4, items: 14, types: 78 },
  { id: "vehicles", no: 18, groups: 3, items: 11, types: 68 },
  { id: "dealers", no: 19, groups: 4, items: 12, types: 57 },
  { id: "occasions", no: 20, groups: 3, items: 14, types: 135 },
  { id: "employees", no: 21, groups: 5, items: 15, types: 74 },
];

export const GUIDELINE_PARTS: readonly GuidelinePart[] = [
  { id: "p01", no: 1, sections: 12 },
  { id: "p02", no: 2, sections: 10 },
  { id: "p03", no: 3, sections: 15 },
  { id: "p04", no: 4, sections: 13 },
  { id: "p05", no: 5, sections: 12 },
  { id: "p06", no: 6, sections: 15 },
  { id: "p07", no: 7, sections: 9 },
  { id: "p08", no: 8, sections: 18 },
  { id: "p09", no: 9, sections: 15 },
  { id: "p10", no: 10, sections: 15 },
  { id: "p11", no: 11, sections: 14 },
  { id: "p12", no: 12, sections: 13 },
  { id: "p13", no: 13, sections: 9 },
  { id: "p14", no: 14, sections: 14 },
];
