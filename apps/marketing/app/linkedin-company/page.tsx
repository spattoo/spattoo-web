"use client";

import { useEffect, useRef, useState } from "react";

const W = 1920;
const H = 1080;
const LOOP = 17;

// ── Helpers ───────────────────────────────────────────────────────────────────

const cl   = (t: number) => Math.min(1, Math.max(0, t));
const eo   = (t: number) => 1 - Math.pow(1 - cl(t), 3);
const lerp = (a: number, b: number, t: number) => a + (b - a) * cl(t);
function fadeIn(s: number, delay: number, dur = 0.8) { return eo((s - delay) / dur); }

function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, fn: () => void) {
  if (alpha <= 0) return;
  ctx.save(); ctx.globalAlpha = Math.min(1, alpha); fn(); ctx.restore();
}

// Rounded-rect path centred at (cx, cy)
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
  cx: number, cy: number,
  w: number, h: number,
  numScallops: number,
  sw: number           // stroke width
) {
  const x = cx - w / 2, y = cy - h / 2;
  const R          = 10;                // top corner radius
  const scallDepth = h * 0.22;         // how far drips hang down
  const bodyH      = h - scallDepth;   // height of main rectangular body
  const scallW     = w / numScallops;

  ctx.strokeStyle = "#edeae3";
  ctx.lineWidth   = sw;

  // ── Outer tier path ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.moveTo(x + R, y);
  ctx.lineTo(x + w - R, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + R);   // top-right corner
  ctx.lineTo(x + w, y + bodyH);

  // Scallop drips: right → left
  for (let i = 0; i < numScallops; i++) {
    const fromX = x + w - i * scallW;
    const toX   = fromX - scallW;
    const midX  = (fromX + toX) / 2;
    ctx.quadraticCurveTo(midX, y + bodyH + scallDepth, toX, y + bodyH);
  }

  ctx.lineTo(x, y + R);
  ctx.quadraticCurveTo(x, y, x + R, y);            // top-left corner
  ctx.closePath();
  ctx.stroke();

  // ── Inner wavy cream line ────────────────────────────────────────────────
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
    wx   = nextWx;
    dir  = -dir;
  }
  ctx.stroke();
}

// Candle + flame sitting on top of the top tier
function drawCandle(
  ctx: CanvasRenderingContext2D,
  cx: number,    // horizontal centre
  topY: number,  // y of the tier's top edge (candle base goes here)
  tierH: number, // tier height — used for proportioning
  sw: number,    // stroke width
  s: number      // time — for flame flicker
) {
  const candleW = tierH * 0.16;
  const candleH = tierH * 0.55;
  const flameW  = candleW * 1.8;
  const flameH  = candleH * 0.55;

  const cLeft   = cx - candleW / 2;
  const cTop    = topY - candleH;

  ctx.strokeStyle = "#edeae3";
  ctx.lineWidth   = sw;

  // Candle body
  ctx.beginPath();
  ctx.roundRect(cLeft, cTop, candleW, candleH, 2);
  ctx.stroke();

  // Wick
  const wickX = cx;
  const wickTop = cTop - candleH * 0.08;
  ctx.beginPath();
  ctx.moveTo(wickX, cTop);
  ctx.lineTo(wickX, wickTop);
  ctx.stroke();

  // Flame (teardrop) — slight flicker via sin
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

// ── Draw one frame ────────────────────────────────────────────────────────────

function drawFrame(ctx: CanvasRenderingContext2D, s: number) {

  // Background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.save();
  ctx.globalAlpha = 0.14; ctx.strokeStyle = "#6b8f7e"; ctx.lineWidth = 0.8;
  for (let x = 0; x <= W; x += 80) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y <= H; y += 80) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  ctx.restore();

  // Glows
  const g1 = ctx.createRadialGradient(160,H/2,0,160,H/2,520);
  g1.addColorStop(0,"rgba(50,75,60,0.6)"); g1.addColorStop(1,"transparent");
  ctx.fillStyle=g1; ctx.fillRect(0,0,W,H);
  const g2 = ctx.createRadialGradient(W-180,H/2,0,W-180,H/2,420);
  g2.addColorStop(0,"rgba(107,143,126,0.18)"); g2.addColorStop(1,"transparent");
  ctx.fillStyle=g2; ctx.fillRect(0,0,W,H);

  // Divider
  withAlpha(ctx, fadeIn(s, 2.5, 1.5), () => {
    const lg = ctx.createLinearGradient(0,160,0,H-160);
    lg.addColorStop(0,"transparent"); lg.addColorStop(0.5,"rgba(107,143,126,0.7)"); lg.addColorStop(1,"transparent");
    ctx.strokeStyle=lg; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(700,160); ctx.lineTo(700,H-160); ctx.stroke();
  });


  // ── Brand animation ───────────────────────────────────────────────────────

  ctx.font = "800 118px Arial";
  const om     = ctx.measureText("o");
  const oW     = om.width;
  const oAsc   = om.actualBoundingBoxAscent  || Math.round(118*0.72);
  const oDsc   = om.actualBoundingBoxDescent || Math.round(118*0.07);
  const oH     = oAsc + oDsc;
  const spattW = ctx.measureText("Spatt").width;

  const baseX=132, baseY=512;
  const o1X  = baseX + spattW;
  const o2X  = o1X + oW;
  const o1CX = o1X + oW/2;
  const o2CX = o2X + oW/2;
  const oCY  = baseY - oAsc + oH/2;

  const TIER_GAP  = 8;
  const T_W       = oW * 0.70;
  const T_H       = oH * 0.58;
  const topInitCX = o1CX;
  const topInitCY = oCY - oH/2 - TIER_GAP - T_H/2;

  // Phase timings
  const RECT_IN  = 0.3,  RECT_D   = 0.5;
  const SPATT_S  = 1.0,  SPATT_D  = 0.6;
  const TILT_S   = 1.9,  TILT_D   = 0.45;
  const TOP_S    = 2.5,  TOP_D    = 0.7;
  const BOT_S    = 3.4,  BOT_D    = 0.55;
  const SETTLE_S = 4.4,  SETTLE_D = 0.5;
  const CROSS_S  = 5.0,  CROSS_D  = 0.5;
  const TAG_S    = 6.0;

  const rectsAlpha   = fadeIn(s, RECT_IN, RECT_D);
  const spattProg    = eo(cl((s - SPATT_S)  / SPATT_D));
  const tiltIn       = eo(cl((s - TILT_S)   / TILT_D));
  const tiltOut      = eo(cl((s - BOT_S)    / BOT_D));
  const tiltAngle    = (tiltIn - tiltOut) * (9 * Math.PI / 180);
  const topSlideProg = eo(cl((s - TOP_S)    / TOP_D));
  const botMorphProg = eo(cl((s - BOT_S)    / BOT_D));
  const settleProg   = eo(cl((s - SETTLE_S) / SETTLE_D));
  const crossProg    = eo(cl((s - CROSS_S)  / CROSS_D));

  const OVERSHOOT = oW * 0.85;

  const curTopW  = lerp(T_W, oW, topSlideProg);
  const curTopH  = lerp(T_H, oH, topSlideProg);
  const curTopCY = lerp(topInitCY, oCY, topSlideProg);
  const curTopCX = topSlideProg < 1
    ? lerp(topInitCX, o2CX + OVERSHOOT, topSlideProg)
    : lerp(o2CX + OVERSHOOT, o2CX, settleProg);

  // Oval shapes (for morph-in phase)
  const botRad    = botMorphProg * Math.min(oW, oH) / 2;
  const botStroke = lerp(2, 16, botMorphProg);
  const topRad    = topSlideProg * Math.min(curTopW, curTopH) / 2;
  const topStroke = lerp(2, 16, topSlideProg);

  const shapeAlpha = rectsAlpha * (1 - crossProg);

  // ── Bottom tier ───────────────────────────────────────────────────────────
  // Cake shape fades out as morph begins
  withAlpha(ctx, shapeAlpha * (1 - botMorphProg), () => {
    ctx.save();
    ctx.translate(o1CX, oCY);
    ctx.rotate(tiltAngle);
    drawCakeTierShape(ctx, 0, 0, oW, oH, 3, 2);
    ctx.restore();
  });
  // Oval fades in during morph
  withAlpha(ctx, shapeAlpha * botMorphProg, () => {
    ctx.save();
    ctx.translate(o1CX, oCY);
    ctx.rotate(tiltAngle);
    pathRRect(ctx, 0, 0, oW, oH, botRad);
    ctx.strokeStyle="#edeae3"; ctx.lineWidth=botStroke; ctx.stroke();
    ctx.restore();
  });

  // ── Top tier ──────────────────────────────────────────────────────────────
  // Cake shape fades out as slide begins
  withAlpha(ctx, shapeAlpha * (1 - topSlideProg), () => {
    ctx.save();
    ctx.translate(curTopCX, curTopCY);
    drawCakeTierShape(ctx, 0, 0, curTopW, curTopH, 2, 2);
    ctx.restore();
    // Candle on top of the top tier
    drawCandle(ctx, curTopCX, curTopCY - curTopH / 2, curTopH, 2, s);
  });
  // Oval fades in, slides, and settles
  withAlpha(ctx, shapeAlpha * topSlideProg, () => {
    ctx.save();
    ctx.translate(curTopCX, curTopCY);
    pathRRect(ctx, 0, 0, curTopW, curTopH, topRad);
    ctx.strokeStyle="#edeae3"; ctx.lineWidth=topStroke; ctx.stroke();
    ctx.restore();
  });

  // ── Dashed separator between tiers (while cake shapes visible) ────────────
  withAlpha(ctx, shapeAlpha * (1 - topSlideProg), () => {
    const sepY = oCY - oH/2 - TIER_GAP/2;
    ctx.strokeStyle="rgba(237,234,227,0.25)"; ctx.lineWidth=1;
    ctx.setLineDash([4,4]);
    ctx.beginPath();
    ctx.moveTo(o1CX - T_W*0.42, sepY);
    ctx.lineTo(o1CX + T_W*0.42, sepY);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // ── "oo" text crossfades in ───────────────────────────────────────────────
  withAlpha(ctx, crossProg, () => {
    ctx.fillStyle="#edeae3";
    ctx.font="800 118px Arial";
    ctx.fillText("o", o1X, baseY);
    ctx.fillText("o", o2X, baseY);
  });

  // ── "Spatt" slides in from left ───────────────────────────────────────────
  withAlpha(ctx, spattProg, () => {
    ctx.save();
    ctx.translate((1 - spattProg) * -260, 0);
    ctx.fillStyle="#edeae3";
    ctx.font="800 118px Arial";
    ctx.fillText("Spatt", baseX, baseY);
    ctx.restore();
  });

  // ── Tagline ───────────────────────────────────────────────────────────────
  withAlpha(ctx, fadeIn(s, TAG_S, 1.4), () => {
    ctx.save();
    ctx.translate(0, (1 - eo(cl((s-TAG_S)/1.2))) * 40);
    ctx.fillStyle="rgba(237,234,227,0.5)";
    ctx.font="300 24px Arial";
    ctx.fillText("3D cake designer for bakers", 140, 572);
    ctx.restore();
  });

  // ── URL ───────────────────────────────────────────────────────────────────
  withAlpha(ctx, fadeIn(s, 14, 1.2), () => {
    ctx.fillStyle="#6b8f7e"; ctx.font="500 19px Arial";
    ctx.letterSpacing="1.5px";
    ctx.fillText("spattoo.com", 140, 628);
    ctx.letterSpacing="0px";
  });

  // ── Right column ──────────────────────────────────────────────────────────
  const values   = ["Your customers design their cake in 3D.", "Less design chats. More baking.", "Your logo. Your colours."];
  const subtexts = ["You just bake it.", "Save hours every week.", "Your customer's design experience."];

  values.forEach((text, i) => {
    const delay = 7 + i * 2.0;
    const y = 340 + i * 170;
    withAlpha(ctx, fadeIn(s, delay, 1.2), () => {
      ctx.save();
      ctx.translate(0, (1 - eo(cl((s-delay)/1.2))) * 40);
      ctx.fillStyle="#6b8f7e"; ctx.font="600 13px Arial";
      ctx.letterSpacing="2px"; ctx.fillText(`0${i+1}`, 762, y+18); ctx.letterSpacing="0px";
      ctx.strokeStyle="rgba(107,143,126,0.35)"; ctx.lineWidth=1;
      ctx.beginPath(); ctx.moveTo(804,y-8); ctx.lineTo(804,y+58); ctx.stroke();
      ctx.fillStyle="#edeae3"; ctx.font="600 30px Arial"; ctx.fillText(text, 830, y+22);
      ctx.fillStyle="rgba(237,234,227,0.45)"; ctx.font="700 18px Arial"; ctx.fillText(subtexts[i], 830, y+52);
      ctx.restore();
    });
  });

  // Bottom bar
  withAlpha(ctx, fadeIn(s, 0.5, 2.5), () => {
    const bb = ctx.createLinearGradient(0,0,W,0);
    bb.addColorStop(0,"transparent"); bb.addColorStop(0.3,"#3d5247");
    bb.addColorStop(0.5,"#6b8f7e");  bb.addColorStop(0.7,"#3d5247"); bb.addColorStop(1,"transparent");
    ctx.fillStyle=bb; ctx.fillRect(0,H-4,W,4);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LinkedInCompanyPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus]     = useState<"preview"|"recording"|"done">("preview");
  const [progress, setProgress] = useState(0);
  const [dlUrl, setDlUrl]       = useState("");
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (status !== "preview") return;
    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const start  = performance.now();
    const loop   = (now: number) => {
      drawFrame(ctx, ((now-start)/1000) % LOOP);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [status]);

  async function handleRecord() {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    setStatus("recording");
    setProgress(0);

    const canvas = canvasRef.current!;
    const ctx    = canvas.getContext("2d")!;
    const FPS    = 30;
    const total  = Math.ceil(LOOP * FPS);

    const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({ target, video: { codec: "avc", width: W, height: H }, fastStart: "in-memory" });

    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
      error:  (e) => console.error("VideoEncoder:", e),
    });
    encoder.configure({ codec: "avc1.640028", width: W, height: H, bitrate: 1_500_000, framerate: FPS });

    for (let i = 0; i < total; i++) {
      drawFrame(ctx, (i / FPS) % LOOP);
      const frame = new VideoFrame(canvas, { timestamp: Math.round(i / FPS * 1_000_000), duration: Math.round(1_000_000 / FPS) });
      encoder.encode(frame, { keyFrame: i % 150 === 0 });
      frame.close();
      if (i % 30 === 0) {
        setProgress(i / total);
        await new Promise<void>(r => setTimeout(r, 0));
      }
    }

    await encoder.flush();
    muxer.finalize();
    setDlUrl(URL.createObjectURL(new Blob([target.buffer], { type: "video/mp4" })));
    setStatus("done");
  }

  return (
    <div style={{ background:"#080808", minHeight:"100vh", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"20px", padding:"40px", fontFamily:"Arial, sans-serif" }}>
      <p style={{ color:"#6b8f7e", fontSize:"12px", letterSpacing:"0.2em", textTransform:"uppercase", margin:0 }}>
        LinkedIn Company Cover · 1920 × 1080
      </p>
      <canvas ref={canvasRef} width={W} height={H}
        style={{ width:"960px", height:"540px", border:"1px solid rgba(107,143,126,0.25)", borderRadius:"6px" }} />

      {status === "preview" && (
        <button onClick={handleRecord}
          style={{ padding:"12px 32px", background:"#3d5247", color:"#edeae3", border:"none", borderRadius:"24px", cursor:"pointer", fontSize:"15px" }}>
          Record & Download (17 s)
        </button>
      )}
      {status === "recording" && (
        <div style={{ width:"960px", textAlign:"center" }}>
          <div style={{ height:"4px", background:"rgba(107,143,126,0.15)", borderRadius:"2px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${progress*100}%`, background:"#6b8f7e", transition:"width 0.1s linear" }} />
          </div>
          <p style={{ color:"#6b8f7e", fontSize:"13px", marginTop:"10px" }}>Recording… {Math.round(progress*100)}%</p>
        </div>
      )}
      {status === "done" && (
        <a href={dlUrl} download="spattoo-linkedin-company.mp4"
          style={{ padding:"12px 32px", background:"#3d5247", color:"#edeae3", borderRadius:"24px", fontSize:"15px", textDecoration:"none" }}>
          ↓ Download MP4
        </a>
      )}
    </div>
  );
}
