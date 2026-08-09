import AngleDownIcon from "@/components/icons/ui/AngleDownIcon";

/* The arrow for every <select> on the sign-in screen.

   A browser paints its own chevron pinned about 4px from the inline-end edge,
   at a size and colour we do not control, and it ignores whatever padding is
   reserved for it — which is why the help dialog's dropdowns had their arrows
   sitting on the border while 36px of padding did nothing. `appearance-none`
   removes it; this draws the replacement.

   `end-4` (16px), not `end-3`: the field's corner radius is 12px, so an arrow
   12px in sits inside the curve and reads as crooked. 16px clears it and
   balances the 12px of leading text padding optically, because the icon's own
   box has air around the glyph.

   Logical property, so Arabic puts it on the left without a second rule. */
export default function SelectChevron() {
  return (
    <AngleDownIcon
      size={14}
      className="absolute end-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
    />
  );
}
