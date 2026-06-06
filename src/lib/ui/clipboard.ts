/* ---------------------------------------------------------------------------
   copyText — reliable clipboard copy with a legacy fallback.

   `navigator.clipboard` is undefined in insecure contexts (and can be blocked
   by an iframe permissions policy). The old `navigator.clipboard?.writeText()
   .then()` pattern THROWS synchronously when clipboard is undefined (calling
   .then on undefined), so the .catch never runs and the copy silently fails.

   This helper tries the async Clipboard API, then falls back to a hidden
   textarea + execCommand("copy"). Returns whether the copy succeeded.
   --------------------------------------------------------------------------- */

export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  // Preferred path: async Clipboard API (secure contexts).
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path below */
  }

  // Legacy fallback: hidden textarea + execCommand.
  try {
    if (typeof document === "undefined") return false;
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    ta.style.top = "0";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
