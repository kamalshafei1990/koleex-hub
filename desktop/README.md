# Koleex Hub — Desktop (Electron)

A professional native desktop shell around the **live** Koleex Hub. It loads
the production deployment (`https://hub.koleexgroup.com`) in a hardened window,
so **every Vercel web deploy reaches desktop users instantly — no reinstall.**
No business logic or web assets are duplicated here.

> This folder is fully self‑contained and builds **independently** of the
> Next.js app. Nothing here runs during `next build`; the web version cannot be
> affected by desktop changes.

---

## Architecture (why a remote shell)

Koleex Hub is a **server‑runtime** Next.js 16 app (API routes, custom server
auth, native argon2). It cannot be statically exported, and it doesn't need to
be: the desktop app is a thin Electron `BrowserWindow` that points at the live
URL. Two independent update streams:

| Stream | What updates | How | Frequency |
|---|---|---|---|
| **Web content** | the entire Koleex Hub app | Vercel deploy (automatic) | continuous |
| **Desktop shell** | the `.exe` / `.dmg` wrapper | electron‑updater (later) | rare |

```
desktop/
├─ electron/
│  ├─ config.ts        # APP_URL, origins, feature flags (tray, updater)
│  ├─ main.ts          # window lifecycle, splash, downloads, IPC, tray
│  ├─ preload.ts       # the ONLY renderer-exposed API (window.koleex)
│  ├─ ipc.ts           # the single IPC contract (+ Phase 5 reserved channels)
│  ├─ security.ts      # navigation/window-open allow-list, permission gate
│  ├─ window-state.ts  # remember size/position/maximized
│  ├─ menu.ts          # native menu + About dialog
│  └─ updater.ts       # auto-update scaffold (DISABLED this round)
├─ resources/          # icon.png, splash.html
├─ electron-builder.yml
├─ tsconfig.json
└─ package.json
```

---

## Develop & run

```bash
cd desktop
npm install            # first time
npm run dev            # compiles TS → dist, launches Electron (KOLEEX_DEV=1)
```

Useful env flags:
- `KOLEEX_APP_URL` — override the target URL (e.g. a staging build).
- `KOLEEX_TRAY=1` — enable system tray + minimize‑to‑tray.
- `KOLEEX_ENABLE_UPDATER=1` — (later) turn on shell auto‑update; **needs signing + a publish provider**.

## Package installers

```bash
cd desktop
npm run dist:mac       # → release/Koleex Hub-*.dmg  + .zip   (run on macOS)
npm run dist:win       # → release/Koleex Hub-Setup-*.exe + Portable (run on Windows)
npm run dist:dir       # unpacked build for quick local testing
```

Builds are **unsigned** this round (see signing hooks below). On first launch,
macOS Gatekeeper / Windows SmartScreen will warn for unsigned apps — expected
until certificates are added.

### Production app icons
`resources/icon.png` (512×512) is used as the build source. For crisp installers
generate platform icons before release:
- macOS: `icon.icns`  ·  Windows: `icon.ico` (electron‑builder can derive these
  from a ≥512px PNG; for best quality provide dedicated `.icns`/`.ico`).

---

## Security posture (Electron checklist)

- [x] `contextIsolation: true` on every window
- [x] `nodeIntegration: false`
- [x] `sandbox: true`
- [x] No `webSecurity:false`; only HTTPS production content is loaded
- [x] `<webview>` disabled (`webviewTag:false` + `will-attach-webview` denied)
- [x] `setWindowOpenHandler` → **deny** in‑window popups; vetted links open in OS browser
- [x] `will-navigate` / `will-redirect` pinned to the Koleex origin allow‑list
- [x] Preload exposes a **frozen, minimal** `window.koleex` over `contextBridge` — never raw `ipcRenderer`/Node
- [x] IPC limited to the channels declared in `ipc.ts`; payloads validated in `main.ts`
- [x] Permission gate default‑denies; allows only notifications + sanitized clipboard
- [x] Single‑instance lock
- [x] No remote code execution surface (no `eval`, no dynamic `require` of remote code)
- [x] Koleex Hub's own server‑side security (auth, RLS, service‑role isolation) is **untouched**

---

## Testing checklist (manual smoke)

- [ ] App launches → branded splash → main window reveals on first paint (no flash)
- [ ] Loads `hub.koleexgroup.com`; login works and **persists** after quit/relaunch
- [ ] Window size/position/maximized **restored** on next launch
- [ ] Maximize / minimize / fullscreen all work
- [ ] External links (`target=_blank`, `window.open`) open in the **default browser**, not a popup
- [ ] In‑app navigation stays in‑window; off‑origin nav is redirected to the browser
- [ ] File **download** (e.g. a catalog PDF) shows a native Save dialog and saves
- [ ] **Print** (Ctrl/Cmd+P or a print button) opens the native print dialog
- [ ] Native notification fires (in‑app bell event / `window.koleex.notify`)
- [ ] Native menu: Edit clipboard ops, View zoom/reload/fullscreen, Help → About shows version
- [ ] Offline: pull network → friendly "Can't reach Koleex Hub" + countdown; **auto‑reconnects** (and "Retry now"); restore → loads
- [ ] **Tools → Check for Updates** shows the "you're on the latest" dialog (auto‑update disabled)
- [ ] **Tools → Restart Koleex Hub** relaunches the app
- [ ] **Tools → Open Logs Folder** opens the logs dir; `main.log` has a startup line
- [ ] **Tools → Open Downloads Folder** opens the OS downloads dir
- [ ] Renderer crash (devtools → kill) → app logs it and reloads (bounded)
- [ ] (If `KOLEEX_TRAY=1`) tray icon + minimize‑to‑tray + Quit work
- [ ] Second launch focuses the existing window (single‑instance)
- [ ] `npm run dist:dir` produces a runnable unpacked app

---

## Diagnostics & logs (local only)

Local, on‑device logging — **nothing is ever sent externally** (`logger.ts`).
- **Open via:** Tools → **Open Logs Folder**.
- **Location:** OS logs dir (macOS `~/Library/Logs/Koleex Hub/`, Windows
  `%APPDATA%\Koleex Hub\logs\`), file `main.log` (size‑rotated → `.1`, `.2`).
- **Captures:** startup banner (version/runtime), warnings, errors, and crashes
  (`uncaughtException`, `unhandledRejection`, renderer/child process gone,
  `did-fail-load`, updater events). Keep entries diagnostic — never log secrets.

Build, signing, notarization, auto‑update activation, the release checklist, and
troubleshooting all live in **[RELEASE.md](./RELEASE.md)**.

---

## Future hooks (prepared, not enabled)

### Auto‑update (Phase 3)
`updater.ts` is wired to `electron-updater` but **off** (`ENABLE_UPDATER=false`).
To turn on later:
1. Set `publish:` in `electron-builder.yml` — **GitHub Releases recommended**
   (free, signed artifacts, private‑repo via token). Alternative: a generic
   server hosting `latest.yml` + installers.
2. Add code signing (below) — unsigned auto‑update is unsafe/blocked.
3. Launch with `KOLEEX_ENABLE_UPDATER=1`. Remember: this updates only the
   shell; web content already auto‑updates via Vercel.

### Code signing (Phase 6)
- **Windows:** Authenticode/EV cert via `CSC_LINK` + `CSC_KEY_PASSWORD` (or a
  cloud/HSM signer). Removes SmartScreen warnings.
- **macOS:** Apple **Developer ID Application** cert; set `mac.notarize: true`
  and provide `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID`.

### Phase 5 native capabilities (reserved channels in `ipc.ts`, not implemented)
local printing · barcode scanner · local file access · native drag‑and‑drop ·
offline cache · USB · serial port · local backup/restore · camera. Each gets a
single audited IPC channel + a `window.koleex` method when built — no ad‑hoc
surface.
