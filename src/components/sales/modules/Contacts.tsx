"use client";

/* Contacts — people inside customer companies. Standard CRM
   primitive (Salesforce Contacts, HubSpot Contacts, Odoo
   Individuals). The `customers` table stores B2B accounts; this
   tab lets sales reps see and link people they actually talk to. */

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import type { SalesModuleProps } from "../SalesApp";
import { cardCls, linkBtnCls, sectionTitleCls } from "../shared";
import UsersIcon from "@/components/icons/ui/UsersIcon";
import AngleRightIcon from "@/components/icons/ui/AngleRightIcon";
import SpinnerIcon from "@/components/icons/ui/SpinnerIcon";

type Contact = {
  id: string;
  display_name: string | null; full_name: string | null;
  first_name: string | null; last_name: string | null;
  company_name: string | null;
  position: string | null; job_title: string | null;
  email: string | null; phone: string | null; mobile: string | null;
  country: string | null; city: string | null;
  contact_type: string | null;
  vip_status: boolean | null; strategic_account: boolean | null;
};

export default function ContactsModule({ t }: SalesModuleProps) {
  const [rows, setRows] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await supabase
        .from("contacts")
        .select("id,display_name,full_name,first_name,last_name,company_name,position,job_title,email,phone,mobile,country,city,contact_type,vip_status,strategic_account")
        .eq("is_active", true)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(50);
      if (cancelled) return;
      setRows((r.data ?? []) as Contact[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div className="h-full flex items-center justify-center text-[var(--text-dim)]"><SpinnerIcon size={20} className="animate-spin" /></div>;

  const display = (c: Contact): string => {
    return c.display_name
      || c.full_name
      || [c.first_name, c.last_name].filter(Boolean).join(" ")
      || c.email
      || "—";
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className={sectionTitleCls}><UsersIcon className="h-3 w-3" />{t("sales.recent")} contacts</h2>
        <Link href="/contacts" className={linkBtnCls}>{t("sales.openInApp")}<AngleRightIcon className="h-3 w-3" /></Link>
      </div>

      {rows.length === 0 ? (
        <div className={`${cardCls} p-8 text-center`}>
          <p className="text-[14px] text-[var(--text-muted)] mb-3">{t("sales.empty.noContacts")}</p>
          <Link href="/contacts" className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold hover:opacity-90">Add contact</Link>
        </div>
      ) : (
        <div className={`${cardCls} divide-y divide-[var(--border-subtle)] overflow-hidden`}>
          {rows.map((c) => {
            const role = c.position || c.job_title;
            const where = [c.city, c.country].filter(Boolean).join(", ");
            const subtitle = [c.company_name, role].filter(Boolean).join(" · ");
            return (
              <Link
                key={c.id}
                href={`/contacts?id=${c.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--bg-surface)] transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="h-8 w-8 rounded-full bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[11px] font-bold text-[var(--text-muted)] shrink-0">
                    {display(c).slice(0, 2).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-[var(--text-primary)] truncate">{display(c)}</p>
                      {c.vip_status && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/20 shrink-0">VIP</span>
                      )}
                      {c.strategic_account && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/20 shrink-0">Key</span>
                      )}
                    </div>
                    <p className="text-[11px] text-[var(--text-dim)] truncate">{subtitle || "—"}</p>
                  </div>
                </div>
                <div className="hidden md:flex flex-col items-end shrink-0 text-right">
                  <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">{c.email || c.phone || c.mobile || "—"}</span>
                  <span className="text-[10px] text-[var(--text-dim)] truncate max-w-[200px]">{where || ""}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
