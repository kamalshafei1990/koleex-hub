"use client";

/* /brand-center/* layout — the Aurora scope for every Brand Center route,
   on the segment layout (the Orders lesson: without it the app renders flat
   Core on a glass Hub). min-h-full, max width set by the page (1500px).
   Paper (…/print) renders bare, as the Reports layout does. */

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function BrandCenterLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  const pathname = usePathname() ?? "";
  if (pathname.endsWith("/print")) return <>{children}</>;
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
