"use client";

/* ── The logo sting: the cake pipes the wordmark ─────────────────────────────────────────────────
 *
 * A two-tier cake travels in from the left and the Spattoo script is revealed behind it as it
 * goes, the way icing comes off a piping nozzle. It reaches the end of the word, and fades,
 * leaving the logo.
 *
 * ⚠️ THIS REPLACED A MORPH, AND THE MORPH COULD NOT SURVIVE THE BRIEF. `linkedin-company` turned
 * two round cake tiers into the two round "o"s of a GEOMETRIC "Spattoo" — a good trick that only
 * works in a face whose "o" is a circle. Sandeep: *"we should use the actual logo"*, and the actual
 * logo is a script wordmark whose "oo" are cursive loops. There is nothing round to land on. So the
 * cake stops BECOMING the letters and starts WRITING them, which is also the better idea: left to
 * right is now the whole mechanic rather than an entrance, and a cake piping its own name is what
 * this product does.
 *
 * ⚠️ AND IT IS THE REAL LOGO, NOT A TYPEFACE STANDING IN FOR ONE. Three attempts got this wrong in
 * a row. `linkedin-company` hardcodes `800 118px Arial` in all eleven of its draw calls, so the
 * published cover was never in a Spattoo face at all. Swapping that for Geist — what the marketing
 * site sets its TEXT in — measured as a change and looked like none, because Geist at 800 and Arial
 * at 800 are near-identical grotesques. Sandeep, correctly: *"you did not change the font"*. The
 * site has no distinctive display face to find; the only thing on that screen that IS the Spattoo
 * wordmark is the drawn logo.
 *
 * ⚠️ `spattoo-logo-2.jpg`, NOT one of the three PNGs. The PNGs carry alpha and are 400×300, which
 * is soft by the time it fills 72% of a 1920 frame. The JPEG is 1178×1284 and carries the tagline,
 * and its background is a FLAT cream — so keying it is a threshold, not a matting problem. Keyed
 * and tinted once at load into an offscreen canvas, then trimmed to its ink, so the layout centres
 * the wordmark rather than the file's margins.
 *
 * ⚠️ THE LAYOUT IS DERIVED, NOT TYPED. The cover hardcoded `baseX=132, baseY=512` against a fixed
 * 1920×1080, which is why it could not be re-cut for a portrait Reel without moving every number by
 * hand. Everything here is a fraction of the canvas it is handed, so a new size is a row in SIZES.
 */

import { useEffect, useRef, useState } from "react";
import { guardInternalPage } from "@/lib/domain";

const LOOP = 7.0;          // seconds — the beat ends ~1s after the glyphs land
const FPS  = 30;

const SIZES = [
  { id: "16x9", label: "YouTube · LinkedIn",        w: 1920, h: 1080 },
  { id: "9x16", label: "Shorts · Reels · Stories",  w: 1080, h: 1920 },
  { id: "1x1",  label: "Instagram feed",            w: 1080, h: 1080 },
  { id: "4x5",  label: "Instagram feed, tall",      w: 1080, h: 1350 },
] as const;

type SizeId = (typeof SIZES)[number]["id"];

// ── Helpers (from linkedin-company — same easing, so the beat reads identically) ──────────────

const cl   = (t: number) => Math.min(1, Math.max(0, t));
const eo   = (t: number) => 1 - Math.pow(1 - cl(t), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * cl(t);
const fadeIn = (s: number, delay: number, dur = 0.8) => eo((s - delay) / dur);

function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, fn: () => void) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha); fn(); ctx.restore();
}

function pathRRect(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, h: number, r: number) {
  const x = cx - w / 2, y = cy - h / 2;
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

// Cake tier: rounded top corners, scalloped drip bottom, inner wavy cream line
function drawCakeTierShape(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, w: number, h: number,
  numScallops: number, sw: number,
) {
  const x = cx - w / 2, y = cy - h / 2;
  const R          = 10;
  const scallDepth = h * 0.22;
  const bodyH      = h - scallDepth;
  const scallW     = w / numScallops;

  ctx.strokeStyle = "#edeae3";
  ctx.lineWidth   = sw;

  ctx.beginPath();
  ctx.moveTo(x + R, y);
  ctx.lineTo(x + w - R, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + R);
  ctx.lineTo(x + w, y + bodyH);
  for (let i = 0; i < numScallops; i++) {
    const fromX = x + w - i * scallW;
    const toX   = fromX - scallW;
    const midX  = (fromX + toX) / 2;
    ctx.quadraticCurveTo(midX, y + bodyH + scallDepth, toX, y + bodyH);
  }
  ctx.lineTo(x, y + R);
  ctx.quadraticCurveTo(x, y, x + R, y);
  ctx.closePath();
  ctx.stroke();

  const waveY    = y + bodyH * 0.52;
  const innerAmp = scallDepth * 0.38;
  const innerW   = w / (numScallops * 2);
  const pad      = 8;

  ctx.beginPath();
  ctx.moveTo(x + pad, waveY);
  let dir = -1, wx = x + pad;
  for (let i = 0; i < numScallops * 2; i++) {
    const nextWx = wx + innerW;
    if (nextWx > x + w - pad) break;
    ctx.quadraticCurveTo(wx + innerW * 0.5, waveY + dir * innerAmp, nextWx, waveY);
    wx = nextWx; dir = -dir;
  }
  ctx.stroke();
}

function drawCandle(
  ctx: CanvasRenderingContext2D,
  cx: number, topY: number, tierH: number, sw: number, s: number,
) {
  const candleW = tierH * 0.16;
  const candleH = tierH * 0.55;
  const flameW  = candleW * 1.8;
  const flameH  = candleH * 0.55;
  const cLeft   = cx - candleW / 2;
  const cTop    = topY - candleH;

  ctx.strokeStyle = "#edeae3";
  ctx.lineWidth   = sw;

  ctx.beginPath();
  ctx.roundRect(cLeft, cTop, candleW, candleH, 2);
  ctx.stroke();

  const wickTop = cTop - candleH * 0.08;
  ctx.beginPath();
  ctx.moveTo(cx, cTop);
  ctx.lineTo(cx, wickTop);
  ctx.stroke();

  const flicker = Math.sin(s * 9) * flameH * 0.06;
  const fBottom = wickTop - 2;
  const fTop    = fBottom - flameH + flicker;
  const fMidY   = fBottom - flameH * 0.35;

  ctx.beginPath();
  ctx.moveTo(cx, fTop);
  ctx.bezierCurveTo(cx + flameW / 2, fMidY, cx + flameW / 2, fBottom, cx, fBottom);
  ctx.bezierCurveTo(cx - flameW / 2, fBottom, cx - flameW / 2, fMidY, cx, fTop);
  ctx.stroke();
}

// ── The logo, keyed off its cream background and tinted ───────────────────────────────────────
/*
 * The source is a JPEG, so there is no alpha to use — but its background is a single flat cream
 * and its ink a single flat green, which makes this a threshold rather than a matte. Luminance
 * decides; everything darker than the midpoint becomes opaque cream, everything lighter vanishes.
 *
 * ⚠️ AND IT IS TRIMMED TO THE INK. The file carries wide empty margins (the wordmark occupies
 * roughly the middle half of a 1178×1284 canvas), so centring the FILE puts the wordmark off
 * centre and sizing by the file makes it small. The bounding box is measured once here.
 */
type Logo = { canvas: HTMLCanvasElement; w: number; h: number };

async function buildLogo(src: string, ink: string): Promise<Logo | null> {
  const img = new Image();
  img.src = src;
  await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); });
  if (!img.naturalWidth) return null;

  const w = img.naturalWidth, h = img.naturalHeight;
  const work = document.createElement("canvas");
  work.width = w; work.height = h;
  const wx = work.getContext("2d")!;
  wx.drawImage(img, 0, 0);

  const d = wx.getImageData(0, 0, w, h);
  const px = d.data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Rec.601 luma. The ink sits near 75, the ground near 238, so the midpoint is nowhere near
      // either and a few points either way changes nothing.
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      const a = lum > 160 ? 0 : 255;
      px[i + 3] = a;
      if (a) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  wx.putImageData(d, 0, 0);

  // Recolour: keep the shape, replace the ink.
  wx.globalCompositeOperation = "source-in";
  wx.fillStyle = ink;
  wx.fillRect(0, 0, w, h);
  wx.globalCompositeOperation = "source-over";

  const tw = maxX - minX + 1, th = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = tw; out.height = th;
  out.getContext("2d")!.drawImage(work, minX, minY, tw, th, 0, 0, tw, th);
  return { canvas: out, w: tw, h: th };
}

// ── One frame, into a canvas of any size ──────────────────────────────────────────────────────

function drawFrame(ctx: CanvasRenderingContext2D, s: number, W: number, H: number, logo: Logo | null) {
  // Background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);

  /* The grid cell is tied to the SHORT edge, so a square, a portrait and a landscape frame all
     show squares of the same apparent size rather than a fine mesh on one and a coarse one on
     another. 1080 / 13.5 = 80, the cover's original spacing. */
  const cell = Math.round(Math.min(W, H) / 13.5);
  ctx.save();
  ctx.globalAlpha = 0.14; ctx.strokeStyle = "#6b8f7e"; ctx.lineWidth = 0.8;
  for (let x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

  // Glows, hung off the edges rather than at fixed pixel offsets
  const gr = Math.max(W, H) * 0.3;
  const g1 = ctx.createRadialGradient(W * 0.08, H / 2, 0, W * 0.08, H / 2, gr);
  g1.addColorStop(0, "rgba(50,75,60,0.6)"); g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.92, H / 2, 0, W * 0.92, H / 2, gr * 0.8);
  g2.addColorStop(0, "rgba(107,143,126,0.18)"); g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);

  if (!logo) return;

  // ── Where the wordmark sits ─────────────────────────────────────────────────────────────────
  /* Fit by width on a landscape frame and by height on a tall one, so a 9:16 Reel does not get a
     wordmark three pixels high and a 16:9 does not get one running off both edges. */
  const lw = Math.min(W * 0.76, (H * 0.52) * (logo.w / logo.h));
  const lh = lw * logo.h / logo.w;
  const lx = (W - lw) / 2;
  const ly = (H - lh) / 2;

  // ── Timings ─────────────────────────────────────────────────────────────────────────────────
  const TRAVEL_S = 0.25, TRAVEL_D = 4.1;   // the cake crosses, writing as it goes
  const LIFT_S   = 4.5,  LIFT_D   = 0.7;   // then it fades, leaving the logo

  const travel = eo(cl((s - TRAVEL_S) / TRAVEL_D));
  const lift   = eo(cl((s - LIFT_S) / LIFT_D));

  /* The cake is sized off the wordmark's own height so it reads as the thing that drew it, and it
     rides the vertical middle of the word rather than the middle of the frame — the tagline hangs
     below the baseline on the right and would otherwise pull the cake off the line it is writing. */
  const tierW = lh * 0.30;
  const tierH = tierW * 0.62;
  const cakeCY = ly + lh * 0.42;

  // Starts fully off the left edge; ends just past the end of the word.
  const startX = -tierW * 1.6;
  const endX   = lx + lw + tierW * 0.5;
  const cakeCX = lerp(startX, endX, travel);

  /* ⚠️ THE ICING TRAILS THE NOZZLE. The reveal edge is the cake's LEFT side, so the script appears
     out from under it as it moves right. Put the edge at the centre and the cake sits on top of
     wet icing it has not laid down yet. */
  const revealX = cakeCX - tierW * 0.5;

  withAlpha(ctx, 1, () => {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, Math.max(0, revealX), H);
    ctx.clip();
    ctx.drawImage(logo.canvas, lx, ly, lw, lh);
    ctx.restore();
  });

  // ── The cake that is writing it ─────────────────────────────────────────────────────────────
  const cakeAlpha = fadeIn(s, 0, 0.35) * (1 - lift);
  withAlpha(ctx, cakeAlpha, () => {
    const topW = tierW * 0.62, topH = tierH * 0.78;
    const gap  = Math.max(1, tierH * 0.06);
    const topCY = cakeCY - tierH / 2 - gap - topH / 2;
    const sw = Math.max(1.5, lh * 0.012);

    drawCakeTierShape(ctx, cakeCX, cakeCY, tierW, tierH, 3, sw);
    drawCakeTierShape(ctx, cakeCX, topCY,  topW,  topH,  2, sw);
    drawCandle(ctx, cakeCX, topCY - topH / 2, topH, sw, s);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────────────────────

export default function LogoStingPage() {
  guardInternalPage();   // SEC-WEB-4 — internal asset generator; 404 on the production site

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);
  const logoRef   = useRef<Logo | null>(null);
  const [size, setSize]   = useState<SizeId>("16x9");
  const [ready, setReady] = useState(false);
  const [status, setStatus]     = useState<"preview" | "recording" | "done">("preview");
  const [progress, setProgress] = useState(0);
  const [dlUrl, setDlUrl]       = useState("");

  const dim = SIZES.find(s => s.id === size)!;

  /* ⚠️ NOTHING DRAWS UNTIL THE LOGO IS KEYED. A canvas draws an unloaded image as nothing and does
     not complain, so a sting recorded early is a cake crossing an empty frame. */
  useEffect(() => {
    buildLogo("/spattoo-logo-2.jpg", "#edeae3").then(l => { logoRef.current = l; setReady(!!l); });
  }, []);

  useEffect(() => {
    if (!ready || status !== "preview") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const start = performance.now();
    const loop = (now: number) => {
      drawFrame(ctx, ((now - start) / 1000) % LOOP, dim.w, dim.h, logoRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ready, status, dim.w, dim.h]);

  async function record() {
    cancelAnimationFrame(rafRef.current);
    setStatus("recording"); setProgress(0); setDlUrl("");

    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const total  = Math.ceil(LOOP * FPS);

    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({ target, video: { codec: "avc", width: dim.w, height: dim.h }, fastStart: "in-memory" });
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
      error:  (e) => console.error("VideoEncoder:", e),
    });
    encoder.configure({ codec: "avc1.640028", width: dim.w, height: dim.h, bitrate: 4_000_000, framerate: FPS });

    for (let i = 0; i < total; i++) {
      drawFrame(ctx, i / FPS, dim.w, dim.h, logoRef.current);
      const frame = new VideoFrame(canvas, {
        timestamp: Math.round(i / FPS * 1_000_000),
        duration:  Math.round(1_000_000 / FPS),
      });
      encoder.encode(frame, { keyFrame: i % 30 === 0 });
      frame.close();
      if (i % 15 === 0) { setProgress(i / total); await new Promise<void>(r => setTimeout(r, 0)); }
    }

    await encoder.flush();
    muxer.finalize();
    setDlUrl(URL.createObjectURL(new Blob([target.buffer], { type: "video/mp4" })));
    setStatus("done");
  }

  const previewH = 460;
  const previewW = Math.round(previewH * dim.w / dim.h);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", gap: 20, padding: 40,
                  fontFamily: "Arial, sans-serif" }}>
      <p style={{ color: "#6b8f7e", fontSize: 12, letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
        Spattoo logo sting · {dim.w} × {dim.h} · {LOOP}s
      </p>

      <div style={{ display: "flex", gap: 8 }}>
        {SIZES.map(sz => (
          <button key={sz.id} onClick={() => { setSize(sz.id); setStatus("preview"); setDlUrl(""); }}
            style={{ padding: "8px 16px", borderRadius: 18, cursor: "pointer", fontSize: 13,
                     border: `1px solid ${size === sz.id ? "#6b8f7e" : "rgba(107,143,126,0.25)"}`,
                     background: size === sz.id ? "#3d5247" : "transparent",
                     color: size === sz.id ? "#edeae3" : "#6b8f7e" }}>
            {sz.label}<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>{sz.w}×{sz.h}</span>
          </button>
        ))}
      </div>

      <canvas ref={canvasRef} width={dim.w} height={dim.h}
        style={{ width: previewW, height: previewH, border: "1px solid rgba(107,143,126,0.25)", borderRadius: 6 }} />

      {!ready && <p style={{ color: "#6b8f7e", fontSize: 13 }}>Keying the logo…</p>}

      {ready && status === "preview" && (
        <button onClick={record} data-record
          style={{ padding: "12px 32px", background: "#3d5247", color: "#edeae3", border: "none",
                   borderRadius: 24, cursor: "pointer", fontSize: 15 }}>
          Record &amp; Download ({LOOP}s)
        </button>
      )}
      {status === "recording" && (
        <div style={{ width: previewW, textAlign: "center" }}>
          <div style={{ height: 4, background: "rgba(107,143,126,0.15)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: "#6b8f7e" }} />
          </div>
          <p style={{ color: "#6b8f7e", fontSize: 13, marginTop: 10 }}>Recording… {Math.round(progress * 100)}%</p>
        </div>
      )}
      {status === "done" && (
        <a href={dlUrl} download={`spattoo-logo-${size}.mp4`} data-download
          style={{ padding: "12px 32px", background: "#3d5247", color: "#edeae3", borderRadius: 24,
                   fontSize: 15, textDecoration: "none" }}>
          ↓ Download {dim.w}×{dim.h} MP4
        </a>
      )}
    </div>
  );
}
