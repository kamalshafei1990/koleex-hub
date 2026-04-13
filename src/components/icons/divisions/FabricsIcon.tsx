import { forwardRef } from "react";

const FabricsIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m23 13c.552 0 1-.447 1-1s-.448-1-1-1h-1v-2h1c.552 0 1-.447 1-1s-.448-1-1-1h-1c0-2.757-2.243-5-5-5v-1c0-.553-.448-1-1-1s-1 .447-1 1v1h-2v-1c0-.553-.448-1-1-1s-1 .447-1 1v1h-2v-1c0-.553-.448-1-1-1s-1 .447-1 1v1c-2.757 0-5 2.243-5 5h-1c-.552 0-1 .447-1 1s.448 1 1 1h1v2h-1c-.552 0-1 .447-1 1s.448 1 1 1h1v2h-1c-.552 0-1 .447-1 1s.448 1 1 1h1c0 2.757 2.243 5 5 5v1c0 .553.448 1 1 1s1-.447 1-1v-1h2v1c0 .553.448 1 1 1s1-.447 1-1v-1h2v1c0 .553.448 1 1 1s1-.447 1-1v-1c2.757 0 5-2.243 5-5h1c.552 0 1-.447 1-1s-.448-1-1-1h-1v-2zm-3 2h-1c-.552 0-1 .447-1 1s.448 1 1 1h1c0 1.654-1.346 3-3 3v-1c0-.553-.448-1-1-1s-1 .447-1 1v1h-2v-1c0-.553-.448-1-1-1s-1 .447-1 1v1h-2v-1c0-.553-.448-1-1-1s-1 .447-1 1v1c-1.654 0-3-1.346-3-3h1c.552 0 1-.447 1-1s-.448-1-1-1h-1v-2h1c.552 0 1-.447 1-1s-.448-1-1-1h-1v-2h1c.552 0 1-.447 1-1s-.448-1-1-1h-1c0-1.654 1.346-3 3-3v1c0 .553.448 1 1 1s1-.447 1-1v-1h2v1c0 .553.448 1 1 1s1-.447 1-1v-1h2v1c0 .553.448 1 1 1s1-.447 1-1v-1c1.654 0 3 1.346 3 3h-1c-.552 0-1 .447-1 1s.448 1 1 1h1v2h-1c-.552 0-1 .447-1 1s.448 1 1 1h1z"/>
      </svg>
    );
  },
);
FabricsIcon.displayName = "FabricsIcon";
export default FabricsIcon;
