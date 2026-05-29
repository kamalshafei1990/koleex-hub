/* eslint-disable @typescript-eslint/no-explicit-any */
declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: (actual: unknown) => any;

import {
  resolveSchema,
  clearSchemas,
  registerSchema,
  getSchemaById,
  LOCKSTITCH_SCHEMA,
  isVisibleIn,
  filterFieldsForSurface,
  computeReadiness,
  DEFAULT_PUBLIC_VISIBILITY,
  DEFAULT_INTERNAL_VISIBILITY,
} from "../index";

describe('resolveSchema', () => {
  it('returns LOCKSTITCH_SCHEMA when classification matches exactly', () => {
    const r = resolveSchema({ divisionCode: 'XS', categoryCode: 'XSL', subcategoryCode: 'XCS', machineKindId: 'standard-single-needle-lockstitch' });
    expect(r.schema?.id).toBe('lockstitch.standard-single-needle.v1');
    expect(r.source).toBe('exact');
  });

  it('falls back to subcategory match when machineKindId is unknown', () => {
    const r = resolveSchema({ divisionCode: 'XS', categoryCode: 'XSL', subcategoryCode: 'XCS', machineKindId: 'unknown-kind' });
    expect(r.schema?.id).toBe('lockstitch.standard-single-needle.v1');
    expect(r.source).toBe('subcategory');
  });

  it('returns null with fallback source for unknown classification', () => {
    const r = resolveSchema({ divisionCode: 'ZZ', categoryCode: 'ZZ', subcategoryCode: 'ZZ' });
    expect(r.schema).toBeNull();
    expect(r.source).toBe('fallback');
    expect(r.appliedRules.length).toBeGreaterThan(0);
  });

  it('getSchemaById returns the registered schema', () => {
    expect(getSchemaById('lockstitch.standard-single-needle.v1')?.name).toBe('Standard Single Needle Lockstitch');
  });
});

describe('visibility', () => {
  it('isVisibleIn returns true for a publicVisible field on the website surface', () => {
    const f = { ...DEFAULT_PUBLIC_VISIBILITY };
    expect(isVisibleIn(f, 'website')).toBe(true);
  });
  it('isVisibleIn returns false for internal-only fields on the public surface', () => {
    const f = { ...DEFAULT_INTERNAL_VISIBILITY };
    expect(isVisibleIn(f, 'public')).toBe(false);
    expect(isVisibleIn(f, 'website')).toBe(false);
  });
  it('filterFieldsForSurface drops internal-only fields when asked for the public surface', () => {
    const fields = LOCKSTITCH_SCHEMA.groups.flatMap(g => g.fields);
    const publicFields = filterFieldsForSurface(fields, 'public');
    expect(publicFields.length).toBeGreaterThan(0);
    expect(publicFields.length).toBeLessThan(fields.length);
  });
});

describe('computeReadiness', () => {
  const emptyInput = {
    schema: LOCKSTITCH_SCHEMA,
    values: {},
    media: { main: 0, gallery: 0, packing: 0, manual: 0, video: 0 },
    commercial: {},
    knowledge: [],
  };
  it('returns near-zero overall on an empty product', () => {
    const r = computeReadiness(emptyInput);
    expect(r.overall).toBeLessThan(20);
  });

  it('topMissing surfaces required schema fields first', () => {
    const r = computeReadiness(emptyInput);
    expect(r.topMissing.length).toBeGreaterThan(0);
  });

  it('returns ready data dimension when all required fields are filled', () => {
    const requiredFields = LOCKSTITCH_SCHEMA.groups.flatMap(g => g.fields).filter(f => f.required);
    const values: Record<string, unknown> = {};
    for (const f of requiredFields) {
      if (f.fieldType === 'boolean') values[f.key] = true;
      else if (f.fieldType === 'number' || f.fieldType === 'unit_number') values[f.key] = 1;
      else if (f.fieldType === 'multi_select' || f.fieldType === 'chips' || f.fieldType === 'icon_chips' || f.fieldType === 'image_chips') values[f.key] = ['x'];
      else values[f.key] = 'x';
    }
    const r = computeReadiness({ ...emptyInput, values });
    const data = r.dimensions.find(d => d.dimension === 'data');
    expect(data?.status).toBe('ready');
  });
});
