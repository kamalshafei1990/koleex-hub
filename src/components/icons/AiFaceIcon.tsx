"use client";

/**
 * AiFaceIcon — Lottie-animated AI icon for Koleex AI.
 *
 * Accepts the same props as a Lucide icon (size, className, style)
 * so it can be used as a drop-in replacement in navigation config.
 */

import { forwardRef, useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import animationData from "@/assets/animations/ai-robot.json";

interface AiFaceIconProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  animated?: boolean;
}

const AiFaceIcon = forwardRef<HTMLDivElement, AiFaceIconProps>(
  ({ size = 24, className = "", style, animated = true }, ref) => {
    const lottieRef = useRef<LottieRefCurrentProps>(null);
    const s = typeof size === "string" ? parseInt(size, 10) || 24 : size;

    useEffect(() => {
      const lottie = lottieRef.current;
      if (!lottie) return;
      if (animated) {
        lottie.play();
      } else {
        lottie.pause();
        lottie.goToAndStop(0, true);
      }
    }, [animated]);

    return (
      <div
        ref={ref}
        className={className}
        style={{
          width: s,
          height: s,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          ...style,
        }}
      >
        <Lottie
          lottieRef={lottieRef}
          animationData={animationData}
          loop
          autoplay={animated}
          className="invert dark:invert-0"
          style={{ width: "140%", height: "140%" }}
        />
      </div>
    );
  },
);

AiFaceIcon.displayName = "AiFaceIcon";
export default AiFaceIcon;
