"use client";

import { useState, useEffect } from "react";
import { LogIn } from "lucide-react";

const ADMIN_PASSWORD = "koleex2024";
const SESSION_KEY = "koleex-admin";

interface Props {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export default function AdminAuth({ title, subtitle, children }: Props) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === "true") setAuthed(true);
  }, []);

  const login = () => {
    if (pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      setAuthed(true);
      setErr(false);
    } else {
      setErr(true);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="bg-[#141414] rounded-2xl border border-white/[0.06] p-8">
            <h1 className="text-[20px] font-bold text-[var(--text-primary)] text-center mb-1">{title}</h1>
            <p className="text-[13px] text-[var(--text-dim)] text-center mb-6">{subtitle}</p>
            <input
              type="password"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setErr(false); }}
              onKeyDown={(e) => e.key === "Enter" && login()}
              placeholder="Password"
              className="w-full h-10 px-4 rounded-lg bg-[var(--bg-inverted)]/[0.05] border border-[var(--border-subtle)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-dim)] outline-none focus:border-[var(--border-focus)] mb-3"
            />
            {err && <p className="text-red-400/80 text-[12px] mb-3">Incorrect password</p>}
            <button
              onClick={login}
              className="w-full h-10 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[13px] font-semibold flex items-center justify-center gap-2 hover:bg-[var(--bg-inverted-hover)] transition-colors"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
