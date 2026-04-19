"use client";

import Link from "next/link";
import AuthGate from "@/components/admin/AuthGate";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import SettingsIcon from "@/components/icons/SettingsIcon";

export default function SettingsPage() {
  return (
    <AuthGate title="Settings" subtitle="Manage your Koleex Hub preferences">
      <div
        className="bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col overflow-hidden w-full"
        style={{ height: "calc(100dvh - 3.5rem)" }}
      >
        <div className="shrink-0 bg-[var(--bg-primary)] border-b border-[var(--border-subtle)] z-10 w-full">
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8">
            <div className="flex flex-wrap items-center gap-3 pt-5 pb-1">
              <Link
                href="/"
                className="h-8 w-8 flex items-center justify-center rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-dim)] hover:text-[var(--text-primary)] transition-colors shrink-0"
              >
                <ArrowLeftIcon className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="h-8 w-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-dim)] shrink-0">
                  <SettingsIcon className="h-4 w-4" />
                </div>
                <h1 className="text-xl md:text-[22px] font-bold tracking-tight truncate">
                  Settings
                </h1>
              </div>
            </div>
            <p className="text-[12px] text-[var(--text-dim)] mb-4 ml-0 md:ml-11">
              Manage preferences &middot; Coming soon
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-[1500px] mx-auto px-4 md:px-6 lg:px-8 py-12 w-full">
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <SettingsIcon className="h-6 w-6 text-[var(--text-ghost)]" />
              </div>
              <p className="text-[var(--text-faint)] text-sm font-medium">
                Settings are coming soon
              </p>
              <p className="text-[12px] text-[var(--text-dim)] max-w-md">
                Account preferences, appearance, notifications, and workspace
                settings will live here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}
