"use client";

/* ── The logo sting, on its own, at any aspect ratio ─────────────────────────────────────────────
 *
 * Two cake tiers become the two "o"s of Spattoo. Lifted out of `linkedin-company`, which drew the
 * same beat as the left-hand third of a 1920×1080 cover and then spent eleven more seconds on a
 * tagline, a URL and three value props. Sandeep wanted the logo part alone, for YouTube and
 * Instagram as well as LinkedIn.
 *
 * ⚠️ THE LAYOUT IS DERIVED, NOT TYPED. The cover version hardcoded `baseX=132, baseY=512` against a
 * fixed 1920×1080 — which is why it cannot be re-cut for a portrait Reel without moving every
 * number by hand. Here the lockup is drawn at the origin in its own units and then centred and
 * scaled into whatever canvas it is given, so a new size is a row in SIZES and nothing else.
 *
 * ⚠️ AND THE SCALE IS SET BY THE TRANSIENT, NOT THE FINAL WORDMARK. The top tier overshoots to the
 * right before settling, and the candle rises well above the cake — so fitting the finished
 * "Spattoo" to the frame puts the tallest moment of the animation off the top of a square. The
 * height term measures from the baseline to the top of the flame.
 *
 * ⚠️ GEIST, LOADED AS A FontFace BEFORE THE FIRST FRAME. The cover hardcodes `800 118px Arial`
 * throughout, so the published animation was never in a Spattoo face at all. Geist is what the
 * marketing site sets its text in (`--font-geist-sans`, app/layout.tsx) and the base64 is already
 * in the repo next door. A canvas falls back silently, so nothing draws until the face resolves —
 * a sting recorded in Arial looks fine and is wrong.
 *
 * The logo itself is a SCRIPT wordmark (public/Spattoo-lo-no-tag-line.png) and deliberately not
 * used here: its "oo" are cursive loops, and a round cake tier cannot morph into one. The whole
 * mechanic needs a geometric "o".
 */

import { useEffect, useRef, useState } from "react";
import { guardInternalPage } from "@/lib/domain";

const LOOP = 6.5;          // seconds — the beat ends 1s after the glyphs land
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

// ── The logo, keyed off its cream ground and tinted ───────────────────────────────────────────
/*
 * ⚠️ THE REAL WORDMARK, NOT A TYPEFACE STANDING IN FOR ONE. Three goes at this got it wrong.
 * `linkedin-company` hardcodes `800 118px Arial` in all eleven of its draw calls, so the published
 * cover was never in a Spattoo face. Swapping that for Geist — what the marketing site sets its
 * TEXT in — measured as a change and looked like none, because Geist at 800 and Arial at 800 are
 * near-identical grotesques. The site has no display face to find: the only thing on that screen
 * that IS the Spattoo wordmark is the drawn logo.
 *
 * ⚠️ AND THE MORPH SURVIVES IT. The obvious reading was that a script kills the trick — its letters
 * are cursive, so there is nothing round for a cake tier to become. Measured off the artwork, that
 * is wrong: the final "oo" are two near-round loops, and the tiers land on them exactly as they
 * landed on two geometric o's. The animation is unchanged; only what it lands on is real now.
 *
 * ⚠️ `spattoo-logo-2.jpg`, NOT one of the three PNGs. They carry alpha but are 400×300, which is
 * soft filling 76% of a 1920 frame, and none of them has the tagline. The JPEG is 1284×1178 and
 * its ground is a FLAT cream, so keying it is a luminance threshold rather than a matting problem:
 * the ink sits near 75 and the ground near 238, so the midpoint is nowhere near either.
 */
type Logo = { canvas: HTMLCanvasElement; w: number; h: number };

/* ⚠️ MEASURED OFF THE ARTWORK, NOT GUESSED — a 10% grid over the keyed logo, read by eye. These
   are fractions of the TRIMMED box (996 × 427 after the margins come off), so they survive the
   file being re-exported at another size, and they are the only numbers tying the animation to
   this particular drawing. If the logo is ever redrawn, re-measure these four and nothing else. */
const OO = {
  o1cx: 0.665,   // centre of the first  "o" loop, across
  o2cx: 0.765,   // centre of the second "o" loop, across
  cy:   0.455,   // both loops' vertical centre, down
  w:    0.100,   // one loop's width
  h:    0.330,   // one loop's height — taller than wide; these are slanted, not circles
  spattEnd: 0.615, // where "Spatt" stops and the first loop starts
  slant: 0.17,   // radians the loops lean, to match the script's italic
};

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

  wx.globalCompositeOperation = "source-in";
  wx.fillStyle = ink;
  wx.fillRect(0, 0, w, h);
  wx.globalCompositeOperation = "source-over";

  /* Trimmed to its ink: the file carries wide empty margins, so centring the FILE puts the
     wordmark off centre and sizing by the file makes it small. */
  const tw = maxX - minX + 1, th = maxY - minY + 1;
  const out = document.createElement("canvas");
  out.width = tw; out.height = th;
  out.getContext("2d")!.drawImage(work, minX, minY, tw, th, 0, 0, tw, th);
  return { canvas: out, w: tw, h: th };
}

// ── One frame, into a canvas of any size ──────────────────────────────────────────────────────

function drawFrame(ctx: CanvasRenderingContext2D, s: number, W: number, H: number, logo: Logo | null) {
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);

  /* The grid cell is tied to the SHORT edge, so a square, a portrait and a landscape frame all
     show squares of the same apparent size. 1080 / 13.5 = 80, the cover's original spacing. */
  const cell = Math.round(Math.min(W, H) / 13.5);
  ctx.save();
  ctx.globalAlpha = 0.14; ctx.strokeStyle = "#6b8f7e"; ctx.lineWidth = 0.8;
  for (let x = 0; x <= W; x += cell) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 0; y <= H; y += cell) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  ctx.restore();

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
  const lw = Math.min(W * 0.76, (H * 0.50) * (logo.w / logo.h));
  const lh = lw * logo.h / logo.w;
  const lx = (W - lw) / 2;
  const ly = (H - lh) / 2;

  const ooW  = lw * OO.w, ooH = lh * OO.h;
  const o1CX = lx + lw * OO.o1cx;
  const o2CX = lx + lw * OO.o2cx;
  const oCY  = ly + lh * OO.cy;

  const T_W = ooW * 0.70;
  const T_H = ooH * 0.58;
  const TIER_GAP = ooH * 0.07;
  const topInitCY = oCY - ooH / 2 - TIER_GAP - T_H / 2;

  // ── Phase timings — unchanged from the cover ────────────────────────────────────────────────
  /* ⚠️ THE FADE IS SHORT, OR THE SLIDE IS INVISIBLE. At the cover's 0.3s delay over a 0.5s ramp
     the cake was still half transparent at the midpoint of its travel, so it only became solid
     near the centre of the frame — "appears a little to the right" surviving the fix for it. */
  const RECT_IN = 0.0, RECT_D = 0.3;
  const CAKE_S  = 0.0, CAKE_D = 1.0;
  const SPATT_S = 1.0, SPATT_D = 0.6;
  const TILT_S  = 1.9, TILT_D  = 0.45;
  const TOP_S   = 2.5, TOP_D   = 0.7;
  const BOT_S   = 3.4, BOT_D   = 0.55;
  const SETTLE_S = 4.4, SETTLE_D = 0.5;
  const CROSS_S  = 5.0, CROSS_D  = 0.5;

  const rectsAlpha   = fadeIn(s, RECT_IN, RECT_D);
  const spattProg    = eo(cl((s - SPATT_S)  / SPATT_D));
  const tiltIn       = eo(cl((s - TILT_S)   / TILT_D));
  const tiltOut      = eo(cl((s - BOT_S)    / BOT_D));
  const tiltAngle    = (tiltIn - tiltOut) * (9 * Math.PI / 180);
  const topSlideProg = eo(cl((s - TOP_S)    / TOP_D));
  const botMorphProg = eo(cl((s - BOT_S)    / BOT_D));
  const settleProg   = eo(cl((s - SETTLE_S) / SETTLE_D));
  const crossProg    = eo(cl((s - CROSS_S)  / CROSS_D));

  /* ⚠️ THE CAKE SLIDES IN; IT DOES NOT APPEAR. The cover faded the tiers up on the spot, a little
     right of centre, which reads as a thing switching on rather than a thing arriving. It settles
     at 1.0s, exactly when "Spatt" starts its own slide, so every timing downstream is untouched. */
  const cakeEnter = eo(cl((s - CAKE_S) / CAKE_D));
  const cakeDX    = lerp(-(o1CX + ooW * 1.5), 0, cakeEnter);

  const OVERSHOOT = ooW * 0.85;
  const curTopW  = lerp(T_W, ooW, topSlideProg);
  const curTopH  = lerp(T_H, ooH, topSlideProg);
  const curTopCY = lerp(topInitCY, oCY, topSlideProg);
  const curTopCX = topSlideProg < 1
    ? lerp(o1CX, o2CX + OVERSHOOT, topSlideProg)
    : lerp(o2CX + OVERSHOOT, o2CX, settleProg);

  const botRad    = botMorphProg * Math.min(ooW, ooH) / 2;
  const botStroke = lerp(lh * 0.006, lh * 0.05, botMorphProg);
  const topRad    = topSlideProg * Math.min(curTopW, curTopH) / 2;
  const topStroke = lerp(lh * 0.006, lh * 0.05, topSlideProg);
  const shapeAlpha = rectsAlpha * (1 - crossProg);
  const sw = Math.max(1.5, lh * 0.006);

  /* "Spatt" slides in from the left — and it is the LOGO's own "Spatt", clipped off the artwork,
     not a typeface imitating it. Everything right of the first loop is held back for the morph. */
  withAlpha(ctx, spattProg, () => {
    ctx.save();
    ctx.translate((1 - spattProg) * -lw * 0.22, 0);
    ctx.beginPath();
    ctx.rect(0, 0, lx + lw * OO.spattEnd, H);
    ctx.clip();
    ctx.drawImage(logo.canvas, lx, ly, lw, lh);
    ctx.restore();
  });

  // ── Bottom tier — cake out, loop in ─────────────────────────────────────────────────────────
  withAlpha(ctx, shapeAlpha * (1 - botMorphProg), () => {
    ctx.save(); ctx.translate(o1CX + cakeDX, oCY); ctx.rotate(tiltAngle);
    drawCakeTierShape(ctx, 0, 0, ooW, ooH, 3, sw);
    ctx.restore();
  });
  withAlpha(ctx, shapeAlpha * botMorphProg, () => {
    ctx.save(); ctx.translate(o1CX + cakeDX, oCY); ctx.rotate(tiltAngle + OO.slant * botMorphProg);
    pathRRect(ctx, 0, 0, ooW, ooH, botRad);
    ctx.strokeStyle = "#edeae3"; ctx.lineWidth = botStroke; ctx.stroke();
    ctx.restore();
  });

  // ── Top tier — cake out, loop in, slides right and settles ──────────────────────────────────
  withAlpha(ctx, shapeAlpha * (1 - topSlideProg), () => {
    ctx.save(); ctx.translate(curTopCX + cakeDX, curTopCY);
    drawCakeTierShape(ctx, 0, 0, curTopW, curTopH, 2, sw);
    ctx.restore();
    drawCandle(ctx, curTopCX + cakeDX, curTopCY - curTopH / 2, curTopH, sw, s);
  });
  withAlpha(ctx, shapeAlpha * topSlideProg, () => {
    ctx.save(); ctx.translate(curTopCX + cakeDX, curTopCY); ctx.rotate(OO.slant * topSlideProg);
    pathRRect(ctx, 0, 0, curTopW, curTopH, topRad);
    ctx.strokeStyle = "#edeae3"; ctx.lineWidth = topStroke; ctx.stroke();
    ctx.restore();
  });

  // Dashed separator between the tiers, while they are still cakes
  withAlpha(ctx, shapeAlpha * (1 - topSlideProg), () => {
    const sepY = oCY - ooH / 2 - TIER_GAP / 2;
    ctx.strokeStyle = "rgba(237,234,227,0.25)"; ctx.lineWidth = Math.max(1, sw * 0.6);
    ctx.setLineDash([sw * 2, sw * 2]);
    ctx.beginPath();
    ctx.moveTo(o1CX + cakeDX - T_W * 0.42, sepY);
    ctx.lineTo(o1CX + cakeDX + T_W * 0.42, sepY);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // The real wordmark crossfades over the two drawn loops
  withAlpha(ctx, crossProg, () => {
    ctx.drawImage(logo.canvas, lx, ly, lw, lh);
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

  /* ⚠️ NOTHING DRAWS UNTIL THE LOGO IS KEYED. A canvas draws an unloaded image as nothing and
     does not complain, so a sting recorded early is a cake crossing an empty frame. */
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

  // Fit the preview into the page without changing the canvas's real pixel size
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
        {SIZES.map(s => (
          <button key={s.id} onClick={() => { setSize(s.id); setStatus("preview"); setDlUrl(""); }}
            style={{ padding: "8px 16px", borderRadius: 18, cursor: "pointer", fontSize: 13,
                     border: `1px solid ${size === s.id ? "#6b8f7e" : "rgba(107,143,126,0.25)"}`,
                     background: size === s.id ? "#3d5247" : "transparent",
                     color: size === s.id ? "#edeae3" : "#6b8f7e" }}>
            {s.label}<br />
            <span style={{ fontSize: 11, opacity: 0.7 }}>{s.w}×{s.h}</span>
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
