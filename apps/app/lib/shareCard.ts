// Composes a branded, shareable square card from the customer's finished design.
// The cake thumbnail (transparent-bg PNG, already captured by the designer and
// stored on R2) is centred on a branded background with the baker's logo + a
// "design your own" CTA + the storefront URL. This is the growth-loop artifact a
// customer shares to WhatsApp/Stories — the baker's logo speaks (no name text),
// and the URL/CTA carry identity + the path back to "design your own".
//
// Branding is app-level (baker) data; the cake render reuses the designer's
// existing thumbnail capture — so this needs NO change to @spattoo/designer.

export type ShareCardOptions = {
  cakeImageUrl: string;        // transparent-bg cake PNG (public R2 url)
  logoUrl?: string | null;     // baker logo (public url)
  storefrontUrl: string;       // display + CTA, e.g. "sweetcrumb.spattoo.com"
  brandColor?: string | null;  // baker primary colour for the background/accents
  size?: number;               // square px, default 1080
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // R2 serves CORS; crossOrigin keeps the canvas untainted so toBlob() works.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

// Bounding box of the non-transparent pixels, so a cake PNG with transparent
// padding still fills the card (we draw only the content sub-rect). Requires the
// image to be CORS-clean (loaded with crossOrigin) so getImageData isn't tainted.
function contentBounds(img: HTMLImageElement): { sx: number; sy: number; sw: number; sh: number } {
  const c = document.createElement("canvas");
  c.width = img.width;
  c.height = img.height;
  const cx = c.getContext("2d");
  const full = { sx: 0, sy: 0, sw: img.width, sh: img.height };
  if (!cx) return full;
  cx.drawImage(img, 0, 0);
  let data: Uint8ClampedArray;
  try {
    data = cx.getImageData(0, 0, c.width, c.height).data;
  } catch {
    return full; // tainted canvas — fall back to the full image
  }
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return full;
  return { sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

// Mix a hex colour toward white by `amount` (0..1) for a soft tinted background.
function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#f4eef0";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

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

  // ── Cake (centred big, with a soft contact shadow) ──────────────────────────
  // The cake is the hero — fill most of the card. The "design your own" CTA is
  // NOT baked in here (it goes in the share message text, so the customer's own
  // preview isn't telling them to design what they just designed).
  // The card is intentionally just logo + cake — the storefront URL / CTA travel
  // in the share action (message text + url), not baked into the visible image.
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

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png",
      0.95
    );
  });
}
