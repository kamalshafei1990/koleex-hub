import { forwardRef } from "react";

const RecruitmentIcon = forwardRef<SVGSVGElement, { size?: number | string; className?: string; style?: React.CSSProperties; strokeWidth?: number }>(
  ({ size = 24, className, style, ...rest }, ref) => {
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;
    return (
      <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={s} height={s} fill="currentColor" className={className} style={style} {...rest}>
        <path d="M23.707,22.293l-3.54-3.54c.524-.791,.833-1.736,.833-2.753,0-2.757-2.243-5-5-5s-5,2.243-5,5,2.243,5,5,5c1.017,0,1.962-.309,2.753-.833l3.54,3.54c.195,.195,.451,.293,.707,.293s.512-.098,.707-.293c.391-.391,.391-1.023,0-1.414Zm-10.707-6.293c0-1.654,1.346-3,3-3s3,1.346,3,3-1.346,3-3,3-3-1.346-3-3Zm2-10c0-3.309-2.691-6-6-6S3,2.691,3,6s2.691,6,6,6,6-2.691,6-6Zm-6,4c-2.206,0-4-1.794-4-4s1.794-4,4-4,4,1.794,4,4-1.794,4-4,4Zm-.008,4.938c.068,.548-.32,1.047-.869,1.116-3.491,.436-6.124,3.421-6.124,6.946,0,.552-.448,1-1,1s-1-.448-1-1c0-4.531,3.386-8.37,7.876-8.93,.542-.069,1.047,.32,1.116,.869Z" />
      </svg>
    );
  },
);
RecruitmentIcon.displayName = "RecruitmentIcon";
export default RecruitmentIcon;
