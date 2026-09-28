/* The QR modules for a template's code, as rows of booleans (true = dark).
   Level M: survives a scuff or a foil edge on a 15 mm code. */

import QRCode from "qrcode";

export function qrModules(text: string | null | undefined): boolean[][] | null {
  if (!text) return null;
  try {
    const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
    const n = modules.size;
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => !!modules.get(r, c)));
  } catch {
    return null;
  }
}
