-- Document titles — how the rest of the sheet should read for each heading.
--
-- Changing the heading alone was not enough: the meta strip still printed
-- "Quotation No" and the party card still said "Quotation To" on a document
-- titled COMMERCIAL INVOICE, because those labels were derived from the PAGE
-- (docKind), not from the chosen title.
--
-- `doc_family` cannot answer this on its own. A Proforma Invoice belongs to
-- the quotation family (it precedes the sale and carries a validity date) yet
-- must read "Invoice No", not "Quotation No". So the noun is stored
-- explicitly per title.
--
--   meta_noun       the word used in "<noun> No" and "<noun> To"
--   shows_validity  whether the sheet prints a "Valid Till" cell — true for
--                   offers that expire, false for a document recording a
--                   sale that already happened
--
-- Additive and idempotent.

alter table public.document_titles
  add column if not exists meta_noun      text,
  add column if not exists shows_validity boolean not null default false;

update public.document_titles set meta_noun = 'Quotation', shows_validity = true  where code = 'quotation'          and meta_noun is null;
update public.document_titles set meta_noun = 'Invoice',   shows_validity = true  where code = 'proforma_invoice'   and meta_noun is null;
update public.document_titles set meta_noun = 'Contract',  shows_validity = false where code = 'sales_contract'     and meta_noun is null;
update public.document_titles set meta_noun = 'Invoice',   shows_validity = false where code = 'commercial_invoice' and meta_noun is null;
update public.document_titles set meta_noun = 'Invoice',   shows_validity = false where code = 'invoice'            and meta_noun is null;
update public.document_titles set meta_noun = 'Invoice',   shows_validity = false where code = 'tax_invoice'        and meta_noun is null;

-- Any tenant-added title without an explicit noun falls back to its family.
update public.document_titles
   set meta_noun = case when doc_family = 'invoice' then 'Invoice' else 'Quotation' end
 where meta_noun is null;
