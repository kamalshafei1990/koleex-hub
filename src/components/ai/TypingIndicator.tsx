"use client";

/* ---------------------------------------------------------------------------
   TypingIndicator — 3-dot bouncing animation used while the AI is
   computing a response but hasn't streamed any tokens yet.

   Visible from the moment the user hits send until the first delta
   arrives on the SSE stream. Gives the immediate "something is
   happening" feedback a spinner doesn't provide — the same pattern
   ChatGPT / DeepSeek / Claude use on mobile.

   Pure CSS animation (no JS timers). Tiny footprint — inline SVG
   would work too but three <span>s with a keyframes animation keeps
   the DOM cheap and the file obvious.
   --------------------------------------------------------------------------- */

export default function TypingIndicator(): React.ReactElement {
  return (
    <div
      className="koleex-typing-indicator"
      role="status"
      aria-label="Koleex AI is thinking"
    >
      <span />
      <span />
      <span />
      <style jsx>{`
        .koleex-typing-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 10px 14px;
          background: var(--surface-subtle, rgba(0, 0, 0, 0.04));
          border-radius: 14px;
          min-height: 20px;
        }
        .koleex-typing-indicator span {
          display: inline-block;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
          opacity: 0.45;
          animation: koleex-typing 1.2s infinite ease-in-out;
        }
        .koleex-typing-indicator span:nth-child(2) {
          animation-delay: 0.15s;
        }
        .koleex-typing-indicator span:nth-child(3) {
          animation-delay: 0.3s;
        }
        @keyframes koleex-typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.35;
          }
          30% {
            transform: translateY(-4px);
            opacity: 0.9;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .koleex-typing-indicator span {
            animation: none;
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
