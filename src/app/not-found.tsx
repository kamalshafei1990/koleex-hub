import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6">
      {/* Animated background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-10">
          <img
            src="/koleex-hub-logo.svg"
            alt="Koleex HUB"
            className="h-10 w-auto opacity-40"
          />
        </div>

        {/* Construction icon */}
        <div className="w-20 h-20 rounded-full bg-[#111] border border-[#1a1a1a] flex items-center justify-center mb-8">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-white/20"
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>

        {/* Text */}
        <h1 className="text-[15px] font-semibold text-white/80 uppercase tracking-[0.2em] mb-3">
          Under Development
        </h1>
        <p className="text-[13px] text-white/30 max-w-xs leading-relaxed mb-10">
          This module is currently being built and will be available in a future update.
        </p>

        {/* Back button */}
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-[#111] border border-[#222] hover:border-[#333] text-[13px] font-medium text-white/60 hover:text-white transition-all"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="group-hover:-translate-x-0.5 transition-transform"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Hub
        </Link>
      </div>
    </div>
  );
}
