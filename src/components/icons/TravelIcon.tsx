import { forwardRef } from "react";

/* Travel — a passport booklet with its data page open. Reads as travel
   documents rather than as a plane, because the app is about the paperwork
   (invitation letters, passports, visas), not about flights. */
const TravelIcon = forwardRef<
  SVGSVGElement,
  { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }
>(({ size = 24, className, style, ...rest }, ref) => {
  const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="currentColor"
      className={className}
      style={style}
      {...rest}
    >
      {/* booklet cover */}
      <path d="M18,0H6C4.343,0,3,1.343,3,3v18c0,1.657,1.343,3,3,3h12c1.657,0,3-1.343,3-3V3c0-1.657-1.343-3-3-3Zm1,21c0,.552-.448,1-1,1H6c-.552,0-1-.448-1-1V3c0-.552,.448-1,1-1h12c.552,0,1,.448,1,1V21Z" />
      {/* globe emblem */}
      <path d="M12,4.5c-2.485,0-4.5,2.015-4.5,4.5s2.015,4.5,4.5,4.5,4.5-2.015,4.5-4.5-2.015-4.5-4.5-4.5Zm2.949,3.75h-.983c-.06-.828-.223-1.594-.468-2.229,.762,.454,1.309,1.246,1.451,2.229Zm-2.949-2.75c.317,0,.828,1.02,.962,2.75h-1.925c.135-1.73,.645-2.75,.962-2.75Zm-1.498,.521c-.245,.635-.408,1.401-.468,2.229h-.983c.142-.983,.689-1.775,1.451-2.229Zm-1.451,3.229h.983c.06,.828,.223,1.594,.468,2.229-.762-.454-1.309-1.246-1.451-2.229Zm2.949,2.75c-.317,0-.828-1.02-.962-2.75h1.925c-.135,1.73-.645,2.75-.962,2.75Zm1.498-.521c.245-.635,.408-1.401,.468-2.229h.983c-.142,.983-.689,1.775-1.451,2.229Z" />
      {/* the two MRZ lines */}
      <path d="M15.5,16.5H8.5c-.414,0-.75,.336-.75,.75s.336,.75,.75,.75h7c.414,0,.75-.336,.75-.75s-.336-.75-.75-.75Z" />
      <path d="M13.5,19H8.5c-.414,0-.75,.336-.75,.75s.336,.75,.75,.75h5c.414,0,.75-.336,.75-.75s-.336-.75-.75-.75Z" />
    </svg>
  );
});
TravelIcon.displayName = "TravelIcon";
export default TravelIcon;
