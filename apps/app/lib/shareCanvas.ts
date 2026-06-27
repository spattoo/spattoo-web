// Low-level canvas primitives shared by the share-card composers (design card +
// store card). Keeping these in one place so the two cards reuse the same image
// loading / colour / trim / encode logic instead of each copying it.

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // R2 serves CORS; crossOrigin keeps the canvas untainted so toBlob() works.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`image load failed: ${src}`));
    img.src = src;
  });
}

// Mix a hex colour toward white by `amount` (0..1) for a soft tinted background.
export function tint(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#f4eef0";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

// Bounding box of the non-transparent pixels, so a PNG with transparent padding
// can be drawn to fill its zone (we draw only the content sub-rect). Requires the
// image to be CORS-clean (loaded with crossOrigin) so getImageData isn't tainted.
export function contentBounds(
  img: HTMLImageElement
): { sx: number; sy: number; sw: number; sh: number } {
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

// Encode a canvas to a PNG blob.
export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("toBlob returned null"))),
      "image/png",
      0.95
    );
  });
}
