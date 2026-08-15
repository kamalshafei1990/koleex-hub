"use client";

/* ---------------------------------------------------------------------------
   /documents layout — the Aurora scope + the ground.

   One `kx-app` remaps the app's own tokens, so its panels and rows turn
   translucent and the recessed-well field rules match its inputs unedited.

   THE PAPER IS EXEMPT, AND THAT WAS ARRANGED BEFORE THIS FILE EXISTED.
   PackingListDoc renders `.quot-a4-doc` — the same A4 sheet the quotation and
   invoice documents use — and its 18 fields would otherwise have become dark
   recessed wells on white paper the moment this scope landed. The exemption in
   globals now matches the SHEET class rather than one app's wrapper, so the
   paper stays paper here and in anything else that reuses it.

   `min-h-full`, not `min-h-screen`: the shell already subtracted the header.
   --------------------------------------------------------------------------- */

import dynamic from "next/dynamic";
import { useSkin } from "@/lib/appearance";

const WavyBackground = dynamic(() => import("@/components/ui/WavyBackground"), { ssr: false });

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const aurora = useSkin() === "aurora";
  return (
    <div className={`${aurora ? "kx-app kx-ground-host " : ""}relative min-h-full bg-[var(--bg-primary)] text-[var(--text-primary)]`}>
      {aurora && (
        <div className="fixed inset-0 z-0 pointer-events-none" aria-hidden>
          <WavyBackground topLight />
        </div>
      )}
      {children}
    </div>
  );
}
