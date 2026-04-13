import { forwardRef } from "react";

const ImageRawIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m19 0h-6a5.006 5.006 0 0 0 -5 5v.1a5.009 5.009 0 0 0 -4 4.9v.1a5.009 5.009 0 0 0 -4 4.9v4a5.006 5.006 0 0 0 5 5h6a5.006 5.006 0 0 0 5-5v-.1a5.009 5.009 0 0 0 4-4.9v-.1a5.009 5.009 0 0 0 4-4.9v-4a5.006 5.006 0 0 0 -5-5Zm-17 15a3 3 0 0 1 3-3h6a2.988 2.988 0 0 1 2.638 1.6l-3.455 3.463-.475-.479a1.992 1.992 0 0 0 -2.708-.111l-4.621 3.96a2.96 2.96 0 0 1 -.379-1.433Zm12 4a3 3 0 0 1 -3 3h-6a2.971 2.971 0 0 1 -1.118-.221l4.406-3.779.476.481a2 2 0 0 0 2.828 0l2.408-2.413Zm4-5a3 3 0 0 1 -2 2.816v-1.816a5.006 5.006 0 0 0 -5-5h-5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3Zm4-5a3 3 0 0 1 -2 2.816v-1.816a5.006 5.006 0 0 0 -5-5h-5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3Zm-18 6a1 1 0 1 1 1 1 1 1 0 0 1 -1-1Z"/>
      </svg>
    );
  },
);
ImageRawIcon.displayName = "ImageRawIcon";
export default ImageRawIcon;
