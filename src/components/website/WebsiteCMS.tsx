"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import MonitorIcon from "@/components/icons/ui/MonitorIcon";
import TabletIcon from "@/components/icons/ui/TabletIcon";
import SmartphoneIcon from "@/components/icons/ui/SmartphoneIcon";
import Maximize2Icon from "@/components/icons/ui/Maximize2Icon";
import ArrowLeftIcon from "@/components/icons/ui/ArrowLeftIcon";
import ExternalLinkIcon from "@/components/icons/ui/ExternalLinkIcon";
import RefreshIcon from "@/components/icons/ui/RefreshIcon";
import EyeIcon from "@/components/icons/ui/EyeIcon";
import LayoutIcon from "@/components/icons/ui/LayoutIcon";
import DocumentIcon from "@/components/icons/ui/DocumentIcon";
import PackageIcon from "@/components/icons/ui/PackageIcon";
import LayersIcon from "@/components/icons/ui/LayersIcon";
import TagsIcon from "@/components/icons/ui/TagsIcon";
import WebsiteIcon from "@/components/icons/WebsiteIcon";

/* ── Config ── */
const WEBSITE_URL = "https://koleex-website.vercel.app";
const CMS_URL = `${WEBSITE_URL}/admin?v=2`;

const quickLinks = [
  { label: "Page Builder", icon: <LayoutIcon size={16} />, url: `${WEBSITE_URL}/admin?v=2` },
  { label: "Products", icon: <PackageIcon size={16} />, url: "/products" },
  { label: "Divisions", icon: <LayersIcon size={16} />, url: "/divisions" },
  { label: "Categories", icon: <TagsIcon size={16} />, url: "/categories" },
  { label: "Subcategories", icon: <DocumentIcon size={16} />, url: "/subcategories" },
];

const websitePages = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Products", path: "/products" },
  { label: "Solutions", path: "/solutions" },
  { label: "Stories", path: "/stories" },
  { label: "Careers", path: "/careers" },
  { label: "Contact", path: "/contact" },
];

type Viewport = "desktop" | "tablet" | "mobile" | "full";

export default function WebsiteCMS() {
  const [activeTab, setActiveTab] = useState<"builder" | "preview">("builder");
  const [viewport, setViewport] = useState<Viewport>("full");
  const [previewPage, setPreviewPage] = useState("/");
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const viewportStyles: Record<Viewport, string> = {
    full: "w-full h-full",
    desktop: "w-[1280px] h-full",
    tablet: "w-[768px] h-full",
    mobile: "w-[375px] h-full",
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setIframeKey((k) => k + 1);
  };

  const iframeSrc = activeTab === "builder" ? CMS_URL : `${WEBSITE_URL}${previewPage}`;

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-[var(--bg-primary)]/95 backdrop-blur border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-gray-400 hover:text-[var(--text-primary)] transition-colors text-sm"
            >
              <ArrowLeftIcon size={16} />
              <span className="hidden sm:inline">Hub</span>
            </Link>
            <div className="w-px h-6 bg-[#333]" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <WebsiteIcon size={18} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-sm font-semibold leading-tight">Website</h1>
                <p className="text-[10px] text-gray-500 leading-tight hidden sm:block">
                  CMS &amp; Page Builder
                </p>
              </div>
            </div>
          </div>

          {/* Center — Tabs */}
          <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-0.5 border border-[var(--border-color)]">
            <button
              onClick={() => { setActiveTab("builder"); setIsLoading(true); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "builder"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-gray-400 hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <LayoutIcon size={13} />
                <span className="hidden sm:inline">Page Builder</span>
              </span>
            </button>
            <button
              onClick={() => { setActiveTab("preview"); setIsLoading(true); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                activeTab === "preview"
                  ? "bg-blue-500/20 text-blue-400"
                  : "text-gray-400 hover:text-[var(--text-primary)]"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <EyeIcon size={13} />
                <span className="hidden sm:inline">Live Preview</span>
              </span>
            </button>
          </div>

          {/* Right — Controls */}
          <div className="flex items-center gap-2">
            {/* Viewport switcher (preview mode) */}
            {activeTab === "preview" && (
              <div className="hidden md:flex items-center gap-1 bg-[var(--bg-secondary)] rounded-lg p-0.5 border border-[var(--border-color)]">
                {([
                  { key: "full" as Viewport, icon: <Maximize2Icon size={13} />, title: "Full Width" },
                  { key: "desktop" as Viewport, icon: <MonitorIcon size={13} />, title: "Desktop" },
                  { key: "tablet" as Viewport, icon: <TabletIcon size={13} />, title: "Tablet" },
                  { key: "mobile" as Viewport, icon: <SmartphoneIcon size={13} />, title: "Mobile" },
                ]).map(({ key, icon, title }) => (
                  <button
                    key={key}
                    onClick={() => setViewport(key)}
                    title={title}
                    className={`p-1.5 rounded-md transition-all ${
                      viewport === key
                        ? "bg-[var(--bg-surface-hover)] text-[var(--text-primary)]"
                        : "text-gray-500 hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            )}

            {/* Page selector (preview mode) */}
            {activeTab === "preview" && (
              <select
                value={previewPage}
                onChange={(e) => {
                  setPreviewPage(e.target.value);
                  setIsLoading(true);
                  setIframeKey((k) => k + 1);
                }}
                className="hidden sm:block bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-xs px-2 py-1.5 text-gray-300 focus:outline-none focus:border-[#444]"
              >
                {websitePages.map((p) => (
                  <option key={p.path} value={p.path}>
                    {p.label}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleRefresh}
              className="p-2 rounded-lg text-gray-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
              title="Refresh"
            >
              <RefreshIcon size={14} />
            </button>

            <a
              href={activeTab === "builder" ? CMS_URL : `${WEBSITE_URL}${previewPage}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-gray-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-all"
              title="Open in New Tab"
            >
              <ExternalLinkIcon size={14} />
            </a>
          </div>
        </div>

        {/* Quick Links Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[#181818] overflow-x-auto scrollbar-hide">
          {quickLinks.map((link) => {
            const isExternal = link.url.startsWith("http");
            if (isExternal) {
              return (
                <button
                  key={link.label}
                  onClick={() => {
                    setActiveTab("builder");
                    setIsLoading(true);
                    setIframeKey((k) => k + 1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                    activeTab === "builder"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-[var(--bg-secondary)] text-gray-400 border border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {link.icon}
                  {link.label}
                </button>
              );
            }
            return (
              <Link
                key={link.label}
                href={link.url}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs whitespace-nowrap bg-[var(--bg-secondary)] text-gray-400 border border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all"
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs whitespace-nowrap bg-[var(--bg-secondary)] text-gray-400 border border-[var(--border-color)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-all ml-auto"
          >
            <WebsiteIcon size={13} />
            Visit Website
            <ExternalLinkIcon size={10} />
          </a>
        </div>
      </header>

      {/* ── Iframe Container ── */}
      <main className="flex-1 relative bg-[var(--bg-primary)]">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--bg-primary)]">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center animate-pulse">
                <WebsiteIcon size={20} className="text-emerald-400" />
              </div>
              <p className="text-xs text-gray-500">Loading {activeTab === "builder" ? "Page Builder" : "Preview"}...</p>
            </div>
          </div>
        )}

        {/* Viewport wrapper */}
        <div
          className={`h-[calc(100vh-7.5rem)] flex justify-center ${
            viewport !== "full" && activeTab === "preview" ? "overflow-x-auto bg-[#050505] p-4" : ""
          }`}
        >
          <div
            className={
              viewport !== "full" && activeTab === "preview"
                ? `${viewportStyles[viewport]} border border-[var(--border-color)] rounded-xl overflow-hidden shadow-2xl mx-auto`
                : "w-full h-full"
            }
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={iframeSrc}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              allow="clipboard-write"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
