/* QR modules for a template's codes, as rows of booleans (true = dark).
   Level M by default (survives a scuff or a foil edge); level H when a logo
   sits in the middle of the code. */

import QRCode from "qrcode";
import type { QrRequest } from "./types";

export function qrModules(text: string | null | undefined, level: "M" | "H" = "M"): boolean[][] | null {
  if (!text) return null;
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: level });
    const n = modules.size;
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!modules.get(r, c)));
  } catch {
    return null;
  }
}

/** Every generated code of a fill, by its id. */
export function qrCodes(requests: QrRequest[] | undefined): Record<string, boolean[][]> {
  const out: Record<string, boolean[][]> = {};
  for (const r of requests ?? []) {
    const m = qrModules(r.text, r.level);
    if (m) out[r.id] = m;
  }
  return out;
}
