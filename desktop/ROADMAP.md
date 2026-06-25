# Koleex Hub Desktop — Native Feature Roadmap

Prioritized backlog for desktop‑only native capabilities. Each gets a single
audited IPC channel (reserved in `electron/ipc.ts`) + a `window.koleex` method
when built — never an ad‑hoc surface. The web app stays the source of truth;
these only add native power the browser can't give.

Legend: **Effort** S/M/L · **Risk** to security/stability.

## High priority (clear daily value, low‑moderate risk)

| Feature | Why | Effort | Risk | Notes |
|---|---|---|---|---|
| **Native printing improvements** | Catalogs/quotations/invoices print a lot | M | Low | `webContents.print()` / `printToPDF()`; silent print + printer pick via IPC. Builds on existing print. |
| **Better downloads UX** | Save dialogs work, but no progress/"reveal in folder"/history | M | Low | `will-download` progress → renderer toast; "Show in folder"; recent‑downloads list. |
| **Native drag‑and‑drop (files in)** | Faster product photo / catalog / attachment upload | M | Med | Accept OS file drops → hand paths/buffers to the web uploader via a vetted IPC channel; size/type guards. |
| **Deep links (`koleexhub://`)** | Open a specific record from email/Teams | S | Med | Register protocol; route to a path on the live app. Validate/allow‑list targets. |

## Medium priority (valuable for specific workflows)

| Feature | Why | Effort | Risk | Notes |
|---|---|---|---|---|
| **Barcode scanner support** | Inventory/serials operators | M | Med | Most USB scanners act as keyboards (works already); add raw HID only if a non‑keyboard scanner is needed. |
| **Camera integration** | Capture product/serial photos in‑app | M | Med | Permission gate already default‑deny; add an allow‑listed capture flow + explicit consent. |
| **Local file access (scoped)** | Bulk import/export to a chosen folder | M | Med | `dialog.showOpenDialog` + read/write only user‑picked paths; never arbitrary FS from the renderer. |
| **Export to OS (reveal/share)** | "Save & reveal", native share sheet | S | Low | Thin wrappers over `shell.showItemInFolder` / share. |

## Low priority (niche / hardware / heavy)

| Feature | Why | Effort | Risk | Notes |
|---|---|---|---|---|
| **USB device integration** | Label printers, specialized hardware | L | High | Needs `usb`/WebUSB + driver concerns; per‑device. Only on real demand. |
| **Serial port support** | Scales, legacy machines | L | High | `serialport` native module; strict allow‑list + audit. |
| **Offline mode / local cache** | Work without network | L | High | Explicitly out of scope per product direction (cloud‑first). Would need a sync model + conflict handling — large. |
| **Local backup / restore** | On‑device export of key data | M | Med | Pull from existing APIs → encrypted local archive; restore via API. Governance + secrets care. |

## Sequencing recommendation

1. **Downloads UX + native printing** — highest everyday payoff, lowest risk; both extend existing flows.
2. **Drag‑and‑drop file input** — big upload‑speed win; do after downloads (shared file plumbing).
3. **Deep links** — small, enables external entry points.
4. Revisit camera / scanner / scoped file access against real operator demand.
5. USB / serial / offline only when a concrete customer requirement justifies the maintenance + security cost.

## Guardrails for every item

- One audited IPC channel per capability (declared in `ipc.ts`), payloads validated in `main.ts`.
- Default‑deny permissions; explicit user action/consent for hardware + filesystem.
- No new renderer privileges; `contextIsolation`/`sandbox`/`nodeIntegration:false` stay intact.
- Never duplicate web business logic — native code only does what the browser can't.
- Each feature ships with a test‑checklist entry + a security note.
