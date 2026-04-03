import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center mb-6">
        <span className="text-3xl font-bold text-white/20">K</span>
      </div>
      <h1 className="text-5xl font-bold text-white mb-3">404</h1>
      <p className="text-lg text-gray-400 mb-2">Module Not Available Yet</p>
      <p className="text-sm text-gray-600 max-w-md mb-8">
        This module is coming soon. Use the button below to return to the Hub.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-semibold text-sm rounded-xl hover:bg-gray-200 transition-colors active:scale-95"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        Back to Hub
      </Link>
    </div>
  );
}
