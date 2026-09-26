"use client";

/* ---------------------------------------------------------------------------
   ProjectMembersPanel — drawer listing a project's members (project_members)
   with add / change role / remove for the project's managers. Everyone who
   can see the project can read the list. New members also join the
   project's Discuss chat (server side).
   --------------------------------------------------------------------------- */

import { useCallback, useEffect, useMemo, useState } from "react";
import Drawer from "@/components/kds/Drawer";
import { useConfirm } from "@/components/kds/useConfirm";
import { useTranslation } from "@/lib/i18n";
import { projectsT } from "@/lib/translations/projects";
import { SpinnerIcon, TrashIcon, UserPlusIcon } from "@/components/icons/ui";
import {
  accountLabel,
  addProjectMembers,
  fetchProjectMembers,
  removeProjectMember,
  updateProjectMemberRole,
  type AccountLite,
  type ProjectMember,
  type ProjectMemberRole,
  type ProjectMembersResponse,
} from "@/lib/projects";

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const ROLES: ProjectMemberRole[] = ["manager", "member", "viewer"];
const selCls = "h-8 ps-2 pe-7 rounded-lg text-[12px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] outline-none focus-visible:border-[var(--border-focus)] disabled:opacity-50";

export default function ProjectMembersPanel({
  projectId,
  open,
  accounts,
  onClose,
  onChanged,
  onError,
}: {
  projectId: string;
  open: boolean;
  accounts: AccountLite[];
  onClose: () => void;
  onChanged: (count: number) => void;
  onError: (msg: string) => void;
}) {
  const { t } = useTranslation(projectsT);
  const { askConfirm, confirmDialog } = useConfirm();
  const [res, setRes] = useState<ProjectMembersResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [pick, setPick] = useState("");
  const [role, setRole] = useState<ProjectMemberRole>("member");

  const load = useCallback(async () => {
    try {
      const r = await fetchProjectMembers(projectId);
      setRes(r);
      setFailed(false);
      onChanged(r.members.length);
    } catch {
      setFailed(true);
    }
  }, [projectId, onChanged]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const byId = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const nameOf = (m: ProjectMember) => {
    const a = byId.get(m.account_id);
    return a ? accountLabel(a) : m.account?.username ?? "—";
  };
  const memberIds = new Set((res?.members ?? []).map((m) => m.account_id));
  const candidates = accounts.filter((a) => !memberIds.has(a.id));
  const canManage = !!res?.can_manage;

  const act = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      await load();
    } catch (e) {
      onError(t("toast.saveFailed").replace("{err}", errText(e)));
    } finally {
      setBusy(null);
    }
  };

  const add = () => {
    if (!pick) return;
    void act("add", async () => {
      await addProjectMembers(projectId, [pick], role);
      setPick("");
    });
  };

  return (
    <Drawer open={open} onClose={onClose} eyebrow={t("mem.open")} title={t("mem.title")} maxWidth="sm:max-w-[440px]">
      {confirmDialog}
      {!res && !failed && (
        <div className="flex justify-center py-10"><SpinnerIcon className="h-5 w-5 text-[var(--text-dim)]" /></div>
      )}
      {failed && (
        <div className="text-[12px] text-[var(--text-dim)] py-6 text-center space-y-2">
          <div>{t("error.load")}</div>
          <button type="button" onClick={() => { void load(); }} className="h-8 px-3 rounded-lg border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            {t("btn.retry")}
          </button>
        </div>
      )}
      {res && !res.available && (
        <div className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 text-[12px] text-[var(--text-dim)]">
          {t("mem.notAvailable")}
        </div>
      )}
      {res?.available && (
        <>
          {canManage ? (
            <div className="kx-glass rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-3 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-dim)]">{t("mem.add")}</div>
              <div className="flex flex-wrap items-center gap-2">
                <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t("mem.pick")} className={`${selCls} flex-1 min-w-[160px]`}>
                  <option value="">{t("mem.pick")}</option>
                  {candidates.map((a) => <option key={a.id} value={a.id}>{accountLabel(a)}</option>)}
                </select>
                <select value={role} onChange={(e) => setRole(e.target.value as ProjectMemberRole)} aria-label={t("mem.role")} className={selCls}>
                  {ROLES.map((r) => <option key={r} value={r}>{t(`mem.role.${r}`)}</option>)}
                </select>
                <button
                  type="button"
                  onClick={add}
                  disabled={!pick || !!busy}
                  className="h-8 px-3 rounded-lg bg-[var(--bg-inverted)] text-[var(--text-inverted)] text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-50"
                >
                  {busy === "add" ? <SpinnerIcon className="h-3 w-3" /> : <UserPlusIcon size={12} />} {t("btn.add")}
                </button>
              </div>
              <p className="text-[11px] text-[var(--text-dim)]">{t("mem.roleHelp")}</p>
            </div>
          ) : (
            <p className="text-[11px] text-[var(--text-dim)]">{t("mem.readOnly")}</p>
          )}

          {res.members.length === 0 ? (
            <div className="text-[12px] text-[var(--text-dim)] py-4">{t("mem.empty")}</div>
          ) : (
            <ul className="space-y-1.5" aria-label={t("mem.title")}>
              {res.members.map((m) => {
                const isPM = m.account_id === res.manager_account_id;
                const name = nameOf(m);
                return (
                  <li key={m.account_id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)]">
                    <span className="h-7 w-7 shrink-0 rounded-full bg-[#567FB2]/15 text-[#567FB2] dark:text-[#7FA9D6] text-[11px] font-bold flex items-center justify-center uppercase" aria-hidden>
                      {name.slice(0, 1)}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-[12.5px] font-semibold text-[var(--text-primary)]">{name}</span>
                      {isPM && <span className="block text-[10px] text-[var(--text-dim)]">{t("mem.projectManager")}</span>}
                      {!isPM && m.source === "auto" && (
                        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-dim)]" title={t("mem.autoHelp")}>
                          {t("mem.auto")}
                          {canManage && (
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => { void act(`keep:${m.account_id}`, () => updateProjectMemberRole(projectId, m.account_id, m.role)); }}
                              aria-label={`${t("mem.keep")}: ${name}`}
                              className="font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] underline underline-offset-2 disabled:opacity-50"
                            >
                              {t("mem.keep")}
                            </button>
                          )}
                        </span>
                      )}
                    </span>
                    {canManage && !isPM ? (
                      <select
                        value={m.role}
                        disabled={!!busy}
                        onChange={(e) => {
                          const r = e.target.value as ProjectMemberRole;
                          void act(`role:${m.account_id}`, () => updateProjectMemberRole(projectId, m.account_id, r));
                        }}
                        aria-label={`${t("mem.role")}: ${name}`}
                        className={selCls}
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{t(`mem.role.${r}`)}</option>)}
                      </select>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-muted)]">{t(`mem.role.${m.role}`)}</span>
                    )}
                    {canManage && !isPM && (
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => askConfirm(
                          t("mem.removeConfirm").replace("{name}", name),
                          () => act(`rm:${m.account_id}`, () => removeProjectMember(projectId, m.account_id)),
                          { confirmLabel: t("mem.remove") },
                        )}
                        aria-label={`${t("mem.remove")}: ${name}`}
                        title={t("mem.remove")}
                        className="h-7 w-7 rounded-md text-[var(--text-dim)] hover:text-rose-400 flex items-center justify-center disabled:opacity-50"
                      >
                        {busy === `rm:${m.account_id}` ? <SpinnerIcon className="h-3 w-3" /> : <TrashIcon className="h-3 w-3" />}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </Drawer>
  );
}
