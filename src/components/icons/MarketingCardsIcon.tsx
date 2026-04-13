import { forwardRef } from "react";

const MarketingCardsIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="m19,3H5C2.243,3,0,5.243,0,8v8c0,2.757,2.243,5,5,5h14c2.757,0,5-2.243,5-5v-8c0-2.757-2.243-5-5-5Zm3,13c0,1.654-1.346,3-3,3H5c-1.654,0-3-1.346-3-3v-8c0-1.654,1.346-3,3-3h14c1.654,0,3,1.346,3,3v8Zm-2-8c0,.553-.448,1-1,1h-4c-.552,0-1-.447-1-1s.448-1,1-1h4c.552,0,1,.447,1,1Zm0,4c0,.553-.448,1-1,1h-4c-.552,0-1-.447-1-1s.448-1,1-1h4c.552,0,1,.447,1,1Zm-2,4c0,.553-.448,1-1,1h-2c-.552,0-1-.447-1-1s.448-1,1-1h2c.552,0,1,.447,1,1Zm-5.545-5.017c.108.296.019.628-.222.831l-1.774,1.445.734,2.235c.1.302-.001.635-.254.83-.253.194-.601.208-.867.034l-2.065-1.345-2.031,1.359c-.126.085-.272.127-.417.127-.159,0-.317-.05-.45-.15-.255-.191-.361-.522-.266-.825l.706-2.262-1.783-1.451c-.24-.204-.327-.535-.219-.83.108-.295.389-.491.704-.491h2.251l.797-2.235c.109-.293.39-.488.703-.488s.594.195.703.488l.797,2.235h2.251c.315,0,.597.197.705.493Z" />
      </svg>
    );
  },
);
MarketingCardsIcon.displayName = "MarketingCardsIcon";
export default MarketingCardsIcon;
