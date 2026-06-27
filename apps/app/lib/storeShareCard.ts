// Composes the baker's **store** share card — a promo the baker posts to drive
// people to their storefront. Unlike the design card, the hero here is the BRAND
// + a scannable QR (the conversion path on Instagram Stories, where links aren't
// clickable). Shares low-level canvas helpers with the design card via shareCanvas.ts.

import QRCode from "qrcode";
import { loadImage, tint, canvasToPngBlob } from "./shareCanvas";

export type StoreShareCardOptions = {
  storefrontUrl: string;       // full https url — the QR target
  displayUrl: string;          // shown as text, e.g. "sweetcrumb.spattoo.com"
  name?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  size?: number;               // square px, default 1080
};

// Draw text centred, truncating with an ellipsis if it would overflow maxW.
function centredText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number) {
  let t = text;
  if (ctx.measureText(t).width > maxW) {
    while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
    t += "…";
  }
  ctx.fillText(t, x, y);
}

export async function composeStoreShareCard(opts: StoreShareCardOptions): Promise<Blob> {
  const S = opts.size ?? 1080;
  const brand = opts.brandColor || "#7c8b54";

  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // ── Background: soft brand-tinted vertical gradient ─────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, tint(brand, 0.85));
  bg.addColorStop(1, "#ffffff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  ctx.textAlign = "center";

  let y = S * 0.08;

  // ── Logo ────────────────────────────────────────────────────────────────────
  if (opts.logoUrl) {
    try {
      const logo = await loadImage(opts.logoUrl);
      const maxH = S * 0.13;
      const scale = Math.min(maxH / logo.height, (S * 0.5) / logo.width);
      const w = logo.width * scale, h = logo.height * scale;
      ctx.drawImage(logo, (S - w) / 2, y, w, h);
      y += h + S * 0.035;
    } catch {
      /* logo optional */
    }
  }

  // ── Name + tagline ──────────────────────────────────────────────────────────
  if (opts.name?.trim()) {
    ctx.fillStyle = "#1f1f1f";
    ctx.font = `700 ${Math.round(S * 0.05)}px 'Quicksand', system-ui, sans-serif`;
    centredText(ctx, opts.name.trim(), S / 2, y, S * 0.84);
    y += S * 0.06;
  }
  if (opts.tagline?.trim()) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = `500 ${Math.round(S * 0.03)}px 'Quicksand', system-ui, sans-serif`;
    centredText(ctx, opts.tagline.trim(), S / 2, y, S * 0.82);
    y += S * 0.05;
  }

  // ── CTA ──────────────────────────────────────────────────────────────────────
  ctx.fillStyle = brand;
  ctx.font = `700 ${Math.round(S * 0.042)}px 'Quicksand', system-ui, sans-serif`;
  ctx.fillText("Design your custom cake online", S / 2, y + S * 0.01);

  // ── QR (the conversion path) on a white rounded panel ───────────────────────
  const qrDataUrl = await QRCode.toDataURL(opts.storefrontUrl, {
    margin: 1,
    width: 640,
    color: { dark: "#1f1f1f", light: "#ffffff" },
  });
  const qr = await loadImage(qrDataUrl);
  const qrSize = S * 0.34;
  const pad = S * 0.022;
  const panel = qrSize + pad * 2;
  const panelX = (S - panel) / 2;
  const panelY = S * 0.5;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.14)";
  ctx.shadowBlur = S * 0.03;
  ctx.shadowOffsetY = S * 0.008;
  ctx.fillStyle = "#ffffff";
  const r = S * 0.03;
  ctx.beginPath();
  ctx.moveTo(panelX + r, panelY);
  ctx.arcTo(panelX + panel, panelY, panelX + panel, panelY + panel, r);
  ctx.arcTo(panelX + panel, panelY + panel, panelX, panelY + panel, r);
  ctx.arcTo(panelX, panelY + panel, panelX, panelY, r);
  ctx.arcTo(panelX, panelY, panelX + panel, panelY, r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.drawImage(qr, panelX + pad, panelY + pad, qrSize, qrSize);

  // ── "Scan to order" hint + URL ──────────────────────────────────────────────
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.font = `600 ${Math.round(S * 0.028)}px 'Quicksand', system-ui, sans-serif`;
  ctx.fillText("Scan to design & order", S / 2, panelY + panel + S * 0.05);

  ctx.fillStyle = brand;
  ctx.font = `700 ${Math.round(S * 0.032)}px system-ui, sans-serif`;
  centredText(ctx, opts.displayUrl, S / 2, panelY + panel + S * 0.095, S * 0.84);

  return canvasToPngBlob(canvas);
}
