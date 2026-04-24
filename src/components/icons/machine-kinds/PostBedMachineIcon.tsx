import { forwardRef } from "react";

/* Post-bed machine — vertical post rises from the base with the
   sewing head on top. Used for 3D shaped work: shoes, caps, bags,
   structured leather goods. */
const PostBedMachineIcon = forwardRef<
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
      {/* head at top */}
      <path d="M8 4 h8 a2 2 0 0 1 2 2 v2 a2 2 0 0 1-2 2 H12" />
      {/* needle descending to the post top */}
      <path d="M12 10 V13" />
      {/* the post (vertical cylinder) */}
      <rect x="10.5" y="13" width="3" height="5" rx="1.2" />
      {/* base */}
      <path d="M4 20 H20" />
      {/* support column from base up to arm */}
      <path d="M16 10 V4" />
    </svg>
  );
});
PostBedMachineIcon.displayName = "PostBedMachineIcon";
export default PostBedMachineIcon;
