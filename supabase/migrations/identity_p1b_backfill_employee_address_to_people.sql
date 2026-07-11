-- Identity consolidation P1b — before retiring the employee private_address_*
-- columns, move any values they still hold into the shared people address.
-- Fill-only (COALESCE/NULLIF): never overwrites an existing people value.
--
-- Applied 2026-07-12: caught 2 employees (Nancy Shu → country CN; Adela Lee →
-- Taizhou / Zhejiang / CN) whose address lived only on koleex_employees. Their
-- data is now safely on people.* so no address is lost when the columns are
-- eventually dropped.
UPDATE public.people p
SET address_line1 = COALESCE(NULLIF(p.address_line1,''), e.private_address_line1),
    address_line2 = COALESCE(NULLIF(p.address_line2,''), e.private_address_line2),
    city          = COALESCE(NULLIF(p.city,''),          e.private_city),
    state         = COALESCE(NULLIF(p.state,''),         e.private_state),
    country       = COALESCE(NULLIF(p.country,''),       e.private_country),
    postal_code   = COALESCE(NULLIF(p.postal_code,''),   e.private_postal_code)
FROM public.koleex_employees e
WHERE e.person_id = p.id
  AND ( COALESCE(e.private_address_line1,'')<>''
     OR COALESCE(e.private_address_line2,'')<>''
     OR COALESCE(e.private_city,'')<>''
     OR COALESCE(e.private_state,'')<>''
     OR COALESCE(e.private_country,'')<>''
     OR COALESCE(e.private_postal_code,'')<>'' );
