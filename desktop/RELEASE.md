# Koleex Hub Desktop — Release & Operations Guide

How to build, sign, notarize, publish, and troubleshoot the desktop shell.
The shell only wraps the live web app (`hub.koleexgroup.com`), so **web content
updates ship via Vercel with zero desktop work** — this guide covers the rare
desktop‑shell release.

---

## 1. Versioning strategy

- The installer/app version = `desktop/package.json` → `"version"` (semver).
- Bump **patch** for shell fixes, **minor** for new native features, **major**
  for breaking shell changes. The shell version is independent of the web app.
- Tag releases `desktop-vX.Y.Z` (keeps them separate from web tags).

## 2. Build installers

Prereq (first time): `cd desktop && npm install`

```bash
# macOS (run on a Mac)
npm run dist:mac      # → release/Koleex Hub-<ver>.dmg  +  .zip
# Windows (run on Windows)
npm run dist:win      # → release/Koleex Hub-Setup-<ver>.exe  +  Portable
# Quick unpacked build for local testing (current OS)
npm run dist:dir      # → release/<platform>-unpacked/
```

> Cross‑building macOS on Windows (or vice‑versa) is not supported for signed,
> notarized output — build each OS on its own machine or CI runner.

## 3. Code signing (when certificates are available)

**Windows (Authenticode / EV):**
```bash
export CSC_LINK="path-or-base64-of-.pfx"
export CSC_KEY_PASSWORD="********"
npm run dist:win
```
(EV/hardware tokens: use the vendor's signing tool or a cloud signer; point
electron‑builder at it per its docs.) Signing removes SmartScreen warnings.

**macOS (Developer ID Application):**
```bash
export CSC_LINK="path-or-base64-of-DeveloperID.p12"
export CSC_KEY_PASSWORD="********"
npm run dist:mac
```
`hardenedRuntime` + `entitlements` are already configured (`electron-builder.yml`
→ `resources/entitlements.mac.plist`).

## 4. Notarization (macOS, after signing)

```bash
npm i -D @electron/notarize          # one-time
export APPLE_ID="you@company.com"
export APPLE_APP_SPECIFIC_PASSWORD="abcd-efgh-ijkl-mnop"
export APPLE_TEAM_ID="XXXXXXXXXX"
npm run dist:mac
```
The `afterSign` hook (`scripts/notarize.cjs`) runs automatically and **no‑ops if
those vars are absent**, so unsigned builds never fail.

## 5. Auto‑update activation (future)

Currently **disabled**. To enable shell auto‑updates:

1. **Pick a provider — GitHub Releases recommended** (free, signed artifacts,
   private‑repo via `GH_TOKEN`). Set in `electron-builder.yml`:
   ```yaml
   publish:
     provider: github
     owner: kamalshafei1990
     repo: koleex-hub
   ```
   (Alternative: a generic server hosting `latest.yml` + `latest-mac.yml` +
   installers behind a URL — set `provider: generic, url: …`.)
2. Ensure **code signing** is in place (step 3/4) — unsigned auto‑update is
   rejected by SmartScreen/Gatekeeper.
3. Build + publish: `electron-builder --publish always` (or via CI on tag).
4. Ship a build launched with `KOLEEX_ENABLE_UPDATER=1` (or flip
   `ENABLE_UPDATER` default in `config.ts`). `updater.ts` then checks on launch
   and the **Tools → Check for Updates** menu performs a manual check.

> Reminder: this updates the **shell binary** only. App content already
> auto‑updates via Vercel.

## 6. Release process (checklist)

1. Decide scope; bump `desktop/package.json` version.
2. `npm run typecheck` (clean) → `npm run dist:mac` / `dist:win`.
3. Smoke‑test installers on each OS (see TESTING in README.md).
4. (If signing) verify signature: macOS `codesign --verify --deep --strict` +
   `spctl -a -t exec`; Windows `signtool verify /pa`.
5. Tag `desktop-vX.Y.Z`; attach installers to the release (or `--publish` if
   auto‑update is enabled).
6. Distribute the download link internally.

## 7. Troubleshooting

| Symptom | Cause / Fix |
|---|---|
| "App can't be opened" (macOS) | Unsigned build → right‑click → Open, or sign + notarize (steps 3–4). |
| SmartScreen warning (Windows) | Unsigned `.exe` → sign with Authenticode/EV (step 3). |
| Blank window on launch | Network/prod unreachable → app auto‑retries + shows the reconnect screen; check **Tools → Open Logs Folder** → `main.log`. |
| Login doesn't persist | Cookies blocked → ensure the prod URL is HTTPS (`config.ts`); clear the app's userData and relaunch. |
| Stuck on splash | Renderer failed first paint → logs will show `did-fail-load`/`render-process-gone`; **Restart** from Tools. |
| Downloads don't prompt | OS download dir missing/permission → check `app.getPath('downloads')`; logs capture failures. |
| Need diagnostics | **Tools → Open Logs Folder**: `main.log` (+ rotated `main.log.1/.2`). Logs are local‑only; nothing is sent externally. |
| Build fails on `afterSign` | Only runs notarization when Apple creds are set; otherwise it logs "skipping". If it errors, unset `APPLE_*` to build unsigned. |

## 8. Where things live

| Concern | File |
|---|---|
| Window/lifecycle/menu wiring | `electron/main.ts` |
| Security (nav/window-open/permissions) | `electron/security.ts` |
| Preload (the only renderer API) | `electron/preload.ts` + `electron/ipc.ts` |
| Diagnostics/logging | `electron/logger.ts` |
| Auto‑update (gated) | `electron/updater.ts` |
| Packaging | `electron-builder.yml` |
| Notarization hook | `scripts/notarize.cjs` |
| macOS entitlements | `resources/entitlements.mac.plist` |
| Overview + security/testing checklists | `README.md` |
