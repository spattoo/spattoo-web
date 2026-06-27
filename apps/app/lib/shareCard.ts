// Composes the customer's branded **design** share card: the cake render (the
// hero) on a brand-tinted background with the baker's logo. The storefront URL /
// CTA travel in the share action (message text + url), not baked into the image.
// Shares low-level canvas helpers with the store card via shareCanvas.ts.

import { loadImage, tint, contentBounds, canvasToPngBlob } from "./shareCanvas";

export type ShareCardOptions = {
  cakeImageUrl: string;        // transparent-bg cake PNG (public R2 url)
  logoUrl?: string | null;     // baker logo (public url)
  storefrontUrl: string;       // kept for callers; not drawn on the card
  brandColor?: string | null;  // baker primary colour for the background/accents
  size?: number;               // square px, default 1080
};

export async function composeShareCard(opts: ShareCardOptions): Promise<Blob> {
  const S = opts.size ?? 1080;
  const brand = opts.brandColor || "#c39aa7";

  const canvas = document.createElement("canvas");
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // ── Background: soft brand-tinted vertical gradient ─────────────────────────
  const bg = ctx.createLinearGradient(0, 0, 0, S);
  bg.addColorStop(0, tint(brand, 0.82));
  bg.addColorStop(1, "#ffffff");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);

  // ── Logo (top-centre, "the logo speaks") ────────────────────────────────────
  let topInset = S * 0.06;
  if (opts.logoUrl) {
    try {
      const logo = await loadImage(opts.logoUrl);
      const maxH = S * 0.1;
      const scale = Math.min(maxH / logo.height, (S * 0.45) / logo.width);
      const w = logo.width * scale, h = logo.height * scale;
      ctx.drawImage(logo, (S - w) / 2, topInset, w, h);
      topInset += h + S * 0.02;
    } catch {
      /* logo is optional — fall through if it fails to load */
    }
  }

  // ── Cake (centred big, with a soft contact shadow) — the hero ───────────────
  const cake = await loadImage(opts.cakeImageUrl);
  const b = contentBounds(cake); // trim transparent padding so the cake fills the card
  const zoneTop = topInset;
  const zoneBottom = S * 0.94;
  const zoneH = zoneBottom - zoneTop;
  const zoneW = S * 0.94;
  const scale = Math.min(zoneW / b.sw, zoneH / b.sh);
  const cw = b.sw * scale, ch = b.sh * scale;
  const cx = (S - cw) / 2;
  const cy = zoneTop + (zoneH - ch) / 2;

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = S * 0.04;
  ctx.shadowOffsetY = S * 0.012;
  ctx.drawImage(cake, b.sx, b.sy, b.sw, b.sh, cx, cy, cw, ch);
  ctx.restore();

  return canvasToPngBlob(canvas);
}
