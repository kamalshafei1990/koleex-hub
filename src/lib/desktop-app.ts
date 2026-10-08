/* True inside the Koleex Hub desktop app (the Electron shell's preload sets
   a frozen `window.koleex` with isDesktop: true — desktop/electron/preload). */
export function isDesktopApp(): boolean {
  return typeof window !== "undefined" && !!(window as { koleex?: { isDesktop?: boolean } }).koleex?.isDesktop;
}
