-- Retiring a contract must not unlock it.
--
-- The original guard fired on `old.status = 'signed'`. The moment an
-- amendment superseded a contract, old.status became 'superseded' and the
-- guard stopped firing entirely — so a contract that had been signed, and
-- was now history, could be edited freely. Exactly backwards: superseding is
-- the point at which a document becomes PURELY historical.
--
-- Found by testing the amendment lifecycle end to end (2026-08-25); the hole
-- existed from the day the table shipped, and only became reachable when
-- amendments gave anything a way to set 'superseded'.
--
-- The rule now: once a contract has been executed — signed OR superseded —
-- the only permitted transition is signed → superseded, with the snapshot and
-- the terms untouched. That is how an amendment retires its original, and it
-- is the only write that gets through.

create or replace function public.guard_signed_sales_contract()
returns trigger
language plpgsql
as $$
begin
  if old.status in ('signed', 'superseded') then
    if old.status = 'signed'
       and new.status = 'superseded'
       and new.snapshot is not distinct from old.snapshot
       and new.terms    is not distinct from old.terms then
      return new;
    end if;
    raise exception 'Contract % is % and cannot be modified. Raise an amendment instead.',
      old.contract_no, old.status;
  end if;
  return new;
end $$;
