"use client";

/* ---------------------------------------------------------------------------
   KdsShowcase — Database › Visual Library › UI Components (top block).

   The owner's rebuilt component library: NOT a name dump, but the CANONICAL
   KDS kit rendered LIVE from the very same code the apps import
   (src/components/kds). It cannot drift from reality — if a component
   changes, this page changes with it. Interactive pieces (Modal, Drawer,
   ConfirmDialog, Toast, Dropzone) open as demos.
   --------------------------------------------------------------------------- */

import { useState } from "react";
import {
  StatusPill, ProgressBar, Toggle, SearchInput, SectionHeader, Button,
  Checkbox, EmptyState, Modal, ConfirmDialog, Drawer, Toast, Avatar,
  Table, Th, Td, MenuList, MenuItem, FilterChip, Pagination, Spinner,
  CollapsibleSection,
} from "@/components/kds";
import BoxIcon from "@/components/icons/ui/BoxIcon";

function Card({ name, usage, children }: { name: string; usage: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-[13px] font-bold text-[var(--text-primary)]">{name}</h3>
        <p className="text-[10.5px] text-[var(--text-ghost)] font-mono mt-0.5">{usage}</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-[var(--border-subtle)]/70 p-3 min-h-[64px]">
        {children}
      </div>
    </section>
  );
}

export default function KdsShowcase() {
  const [toggleOn, setToggleOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div className="space-y-5 mb-10">
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-secondary)] p-4">
        <h2 className="text-[13.5px] font-bold text-[var(--text-primary)]">KDS — the canonical component kit</h2>
        <p className="text-[11.5px] text-[var(--text-dim)] mt-1 leading-relaxed">
          Rendered LIVE from <span className="font-mono">src/components/kds</span> — the owner-elected canon every new screen must build from. What you see here is exactly what ships; the kit and this page cannot diverge.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <Card name="Button" usage='<Button variant="primary|secondary|ghost|danger">'>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Card>

        <Card name="StatusPill" usage='<StatusPill tone="…">'>
          <StatusPill tone="success">Active</StatusPill>
          <StatusPill tone="warning">Pending</StatusPill>
          <StatusPill tone="error">Failed</StatusPill>
          <StatusPill tone="brand">Brand</StatusPill>
          <StatusPill tone="neutral">Draft</StatusPill>
        </Card>

        <Card name="Toggle" usage="<Toggle checked onChange />">
          <Toggle checked={toggleOn} onChange={setToggleOn} label="Demo toggle" />
          <Toggle checked={false} onChange={() => {}} disabled label="Disabled" />
          <span className="text-[11px] text-[var(--text-ghost)]">emerald ON · white knob (standing rule)</span>
        </Card>

        <Card name="ProgressBar" usage="<ProgressBar value={0..1} knob? />">
          <div className="w-full space-y-3">
            <ProgressBar value={0.28} />
            <ProgressBar value={0.72} knob />
          </div>
        </Card>

        <Card name="Checkbox" usage="<Checkbox checked onChange label />">
          <Checkbox checked={checked} onChange={setChecked} label="Demo checkbox" />
          <Checkbox checked={false} onChange={() => {}} disabled label="Disabled" />
        </Card>

        <Card name="SearchInput" usage="<SearchInput value onChange />">
          <SearchInput value={search} onChange={setSearch} placeholder="Search anything…" className="w-full" />
        </Card>

        <Card name="Avatar" usage="<Avatar name size />">
          <Avatar name="Kamal Esmat" size={40} />
          <Avatar name="Seraph Chen" size={36} />
          <Avatar name="Koleex Bot" size={28} />
        </Card>

        <Card name="FilterChip" usage="<FilterChip label onRemove />">
          <FilterChip label="Status: Active" onRemove={() => {}} />
          <FilterChip label="Ironing Systems" onRemove={() => {}} />
          <FilterChip label="Read-only" />
        </Card>

        <Card name="Pagination" usage="<Pagination page pages onPrev onNext />">
          <Pagination page={page} pages={9} summary={`Page ${page} of 9`} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => Math.min(9, p + 1))} />
        </Card>

        <Card name="Spinner" usage="<Spinner />">
          <Spinner />
          <span className="text-[11px] text-[var(--text-ghost)]">loading state</span>
        </Card>

        <Card name="EmptyState" usage="<EmptyState icon title hint action />">
          <EmptyState
            icon={<BoxIcon className="h-6 w-6" />}
            title="Nothing here yet"
            hint="This is how every empty screen should speak."
            action={<Button variant="secondary">Add first item</Button>}
            className="w-full"
          />
        </Card>

        <Card name="SectionHeader" usage="<SectionHeader title description action />">
          <SectionHeader
            title="Section title"
            description="One-line description of what lives below."
            action={<Button variant="ghost">Action</Button>}
            className="w-full"
          />
        </Card>

        <Card name="MenuList" usage="<MenuList><MenuItem/></MenuList>">
          <MenuList className="w-56">
            <MenuItem onClick={() => {}}>Open</MenuItem>
            <MenuItem onClick={() => {}}>Duplicate</MenuItem>
            <MenuItem destructive onClick={() => {}}>Delete</MenuItem>
          </MenuList>
        </Card>

        <Card name="Table" usage="<Table><Th/><Td/></Table>">
          <div className="w-full overflow-x-auto">
            <Table>
              <thead><tr><Th>Model</Th><Th>Status</Th><Th>Cost</Th></tr></thead>
              <tbody>
                <tr className="border-t border-[var(--border-subtle)]"><Td>XPRS-160S</Td><Td><StatusPill tone="success">Active</StatusPill></Td><Td>¥ —</Td></tr>
                <tr className="border-t border-[var(--border-subtle)]"><Td>XPRR-2100E-ZS</Td><Td><StatusPill tone="neutral">Draft</StatusPill></Td><Td>¥10,500</Td></tr>
              </tbody>
            </Table>
          </div>
        </Card>

        <Card name="CollapsibleSection" usage="<CollapsibleSection title>">
          <div className="w-full">
            <CollapsibleSection title="Click to collapse">
              <p className="text-[12px] text-[var(--text-muted)] p-2">Body content lives here.</p>
            </CollapsibleSection>
          </div>
        </Card>

        <Card name="Modal · ConfirmDialog · Drawer · Toast" usage="interactive — open the demos">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Modal</Button>
          <Button variant="secondary" onClick={() => setConfirmOpen(true)}>ConfirmDialog</Button>
          <Button variant="secondary" onClick={() => setDrawerOpen(true)}>Drawer</Button>
          <Button variant="secondary" onClick={() => { setToast("This is a KDS toast"); setTimeout(() => setToast(null), 2500); }}>Toast</Button>
        </Card>
      </div>

      <Modal open={modalOpen} title="KDS Modal" onClose={() => setModalOpen(false)} actions={<Button variant="primary" onClick={() => setModalOpen(false)}>Done</Button>}>
        <p className="text-[13px] text-[var(--text-muted)]">The canonical modal — dim + blur backdrop per the standing rule.</p>
      </Modal>
      <ConfirmDialog
        open={confirmOpen}
        title="Delete this item?"
        message="This is the canonical destructive confirmation."
        confirmLabel="Delete"
        onConfirm={() => setConfirmOpen(false)}
        onCancel={() => setConfirmOpen(false)}
      />
      <Drawer open={drawerOpen} title="KDS Drawer" onClose={() => setDrawerOpen(false)}>
        <p className="text-[13px] text-[var(--text-muted)] p-4">Side-panel content.</p>
      </Drawer>
      {toast && <Toast message={toast} />}
    </div>
  );
}
