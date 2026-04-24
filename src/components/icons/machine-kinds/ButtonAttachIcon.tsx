import { forwardRef } from "react";

/* Button attaching — a 4-hole button with stitches forming a cross
   through the holes. */
const ButtonAttachIcon = forwardRef<
  SVGSVGElement,
  { size?: number | string; className?: string; style?: React.CSSProperties }
>(({ size = 24, className, style, ...rest }, ref) => {
  const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={s}
      height={s}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      {...rest}
    >
      {/* button body */}
      <circle cx="12" cy="12" r="7.5" />
      {/* inner ring */}
      <circle cx="12" cy="12" r="5.3" />
      {/* 4 thread holes */}
      <circle cx="10" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="14" r="0.9" fill="currentColor" stroke="none" />
      {/* cross stitches through the holes */}
      <path d="M10 10 L14 14" />
      <path d="M14 10 L10 14" />
    </svg>
  );
});
ButtonAttachIcon.displayName = "ButtonAttachIcon";
export default ButtonAttachIcon;
