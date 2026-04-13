"use client";

/* ---------------------------------------------------------------------------
   BarcodeQRDisplay — auto-generates Barcode (Code128) + QR Code for a model.

   - Barcode is generated from the given value (SKU or barcode string)
   - QR Code encodes a JSON payload with {sku, name, brand} for scanner lookup
   - Both are rendered inline as SVG/Canvas via jsbarcode and qrcode libraries
   - Download buttons export each as PNG
   --------------------------------------------------------------------------- */

import { useEffect, useRef, useState } from "react";
import DownloadIcon from "@/components/icons/ui/DownloadIcon";
import RefreshIcon from "@/components/icons/ui/RefreshIcon";
import JsBarcode from "jsbarcode";
import QRCode from "qrcode";

interface Props {
  value: string;          // the barcode value (SKU or custom)
  label?: string;         // human label (model name)
  qrPayload?: string;     // what to encode in QR (URL or JSON string). Defaults to `value`.
  compact?: boolean;      // compact mode for narrow layouts
}

export default function BarcodeQRDisplay({ value, label, qrPayload, compact = false }: Props) {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Generate barcode
  useEffect(() => {
    if (!value || !barcodeRef.current) return;
    try {
      JsBarcode(barcodeRef.current, value, {
        format: "CODE128",
        width: compact ? 1.4 : 2,
        height: compact ? 36 : 48,
        fontSize: compact ? 10 : 12,
        margin: 4,
        background: "transparent",
        lineColor: "#e5e7eb",
        displayValue: true,
      });
      setBarcodeError(null);
    } catch (err) {
      setBarcodeError(err instanceof Error ? err.message : "Barcode failed");
    }
  }, [value, compact]);

  // Generate QR code
  useEffect(() => {
    if (!value || !qrCanvasRef.current) return;
    const payload = qrPayload || value;
    QRCode.toCanvas(qrCanvasRef.current, payload, {
      width: compact ? 72 : 96,
      margin: 1,
      color: {
        dark: "#e5e7eb",
        light: "#00000000",
      },
      errorCorrectionLevel: "M",
    })
      .then(() => setQrError(null))
      .catch((err: Error) => setQrError(err.message));
  }, [value, qrPayload, compact]);

  // Download handlers
  const downloadBarcode = () => {
    if (!barcodeRef.current) return;
    const svg = barcodeRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `${value || "barcode"}-barcode.png`;
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  const downloadQR = () => {
    if (!qrCanvasRef.current) return;
    const url = qrCanvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${value || "qrcode"}-qr.png`;
    a.click();
  };

  if (!value) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-[var(--text-ghost)] italic py-3 px-4 rounded-lg border border-dashed border-[var(--border-subtle)]">
        <RefreshIcon className="h-3 w-3" />
        Barcode &amp; QR will generate automatically once the SKU is saved
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Barcode */}
      <div className="bg-[var(--bg-primary)]/60 rounded-xl border border-[var(--border-subtle)] p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">Barcode (Code 128)</div>
            {label && <div className="text-[10px] text-[var(--text-ghost)] truncate max-w-[150px]">{label}</div>}
          </div>
          <button
            type="button"
            onClick={downloadBarcode}
            className="h-6 w-6 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors"
            title="Download PNG"
          >
            <DownloadIcon className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center justify-center py-1">
          {barcodeError ? (
            <div className="text-[10px] text-red-400">Invalid value</div>
          ) : (
            <svg ref={barcodeRef} className="max-w-full" />
          )}
        </div>
      </div>

      {/* QR Code */}
      <div className="bg-[var(--bg-primary)]/60 rounded-xl border border-[var(--border-subtle)] p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-ghost)]">QR Code</div>
            <div className="text-[10px] text-[var(--text-ghost)] truncate max-w-[150px]">Scan for lookup</div>
          </div>
          <button
            type="button"
            onClick={downloadQR}
            className="h-6 w-6 rounded-md bg-[var(--bg-surface-subtle)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-ghost)] hover:text-[var(--text-primary)] transition-colors"
            title="Download PNG"
          >
            <DownloadIcon className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center justify-center py-1">
          {qrError ? (
            <div className="text-[10px] text-red-400">QR error</div>
          ) : (
            <canvas ref={qrCanvasRef} />
          )}
        </div>
      </div>
    </div>
  );
}
