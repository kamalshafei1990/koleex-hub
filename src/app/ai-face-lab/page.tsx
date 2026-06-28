"use client";

/* ---------------------------------------------------------------------------
   Reactions Lab — preview + tune the Koleex AI robot face.
   Pick any expression, or Auto-Loop through all of them. Internal design tool
   (not in nav); reach it at /ai-face-lab.
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import KoleexRobot, {
  ROBOT_EXPRESSIONS,
  type RobotExpression,
} from "@/components/ai/KoleexRobot";

export default function AiFaceLabPage() {
  const [expr, setExpr] = useState<RobotExpression>("normal");
  const [loop, setLoop] = useState(false);
  const idx = useRef(0);

  useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => {
      idx.current = (idx.current + 1) % ROBOT_EXPRESSIONS.length;
      setExpr(ROBOT_EXPRESSIONS[idx.current]);
    }, 1600);
    return () => clearInterval(id);
  }, [loop]);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      <div className="mx-auto flex max-w-[1100px] flex-col items-center px-6 py-10">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/35">
          Koleex AI · Reactions Lab
        </div>
        <h1 className="mb-8 text-2xl font-bold capitalize">{expr}</h1>

        {/* the character */}
        <div className="flex min-h-[360px] items-center justify-center">
          <KoleexRobot expression={expr} size={460} />
        </div>

        {/* auto loop */}
        <button
          onClick={() => setLoop((v) => !v)}
          className={`mt-6 rounded-full px-5 py-2 text-sm font-medium transition-colors ${
            loop
              ? "bg-white text-black"
              : "bg-white/[0.08] text-white/80 hover:bg-white/[0.14]"
          }`}
        >
          {loop ? "■ Stop" : "▶ Auto Loop"}
        </button>

        {/* expression picker */}
        <div className="mt-8 flex max-w-[820px] flex-wrap justify-center gap-2.5">
          {ROBOT_EXPRESSIONS.map((e) => (
            <button
              key={e}
              onClick={() => { setLoop(false); setExpr(e); }}
              className={`rounded-lg px-3.5 py-2 text-[13px] font-medium capitalize transition-all ${
                expr === e
                  ? "bg-[#3385FF] text-white shadow-[0_4px_14px_rgba(51,133,255,.4)]"
                  : "bg-white/[0.06] text-white/65 hover:bg-white/[0.12] hover:text-white"
              }`}
            >
              {e}
            </button>
          ))}
        </div>

        {/* size preview row — how it reads small */}
        <div className="mt-12 flex items-end gap-8 border-t border-white/[0.06] pt-8">
          {[120, 72, 40].map((s) => (
            <div key={s} className="flex flex-col items-center gap-2">
              <KoleexRobot expression={expr} size={s} animated={false} />
              <span className="text-[11px] text-white/30">{s}px</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
