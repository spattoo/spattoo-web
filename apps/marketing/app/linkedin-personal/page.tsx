"use client";
import { useRef, useEffect, useState } from "react";
import geistB64 from "./geistFont";
import garetB64 from "./garetFont";

// LinkedIn personal cover — 1584 × 396 px
const W = 1584;
const H = 396;

// ── Perspective projection ────────────────────────────────────────────────────
// Camera at [0, 1.8, 4] looking at [0, 0, 0], matching SpaceGrid.tsx exactly.
// Forward (world): normalize([0, -1.8, -4])  →  [0, -0.4104, -0.9120]
// Up     (world): Gram–Schmidt vs world Y     →  [0,  0.9120, -0.4104]
const FWD_Y = -1.8 / Math.sqrt(1.8 * 1.8 + 4 * 4);
const FWD_Z = -4.0 / Math.sqrt(1.8 * 1.8 + 4 * 4);
const UP_Y  =  0.9120;   // symmetric with FWD_Z in magnitude
const UP_Z  = -0.4104;   // symmetric with FWD_Y in magnitude

const FOV = 60 * Math.PI / 180;
const F   = 1 / Math.tan(FOV / 2);   // ≈ 1.732
const ASP = W / H;                    // ≈ 4.0

function project(wx: number, wy: number, wz: number) {
  const tx = wx;
  const ty = wy - 1.8;
  const tz = wz - 4.0;
  const depth = FWD_Y * ty + FWD_Z * tz;
  if (depth <= 0) return null;
  const cx =           tx;
  const cy = UP_Y * ty + UP_Z * tz;
  return {
    x: (1 + (cx / depth) * (F / ASP)) * W / 2,
    y: (1 - (cy / depth) *  F)        * H / 2,
  };
}

// ── Grid geometry — mirrors SpaceGrid.tsx ─────────────────────────────────────
const GY   = -1.2;   // floor y  (group position y = -1.2)
const GW   = 16;     // grid total width  (-8 … +8)
const COLS = 16;
const NEAR_Z =  3.0; // extend past camera so near lines bleed off canvas
const FAR_Z  = -40;  // extend toward VP so lines converge cleanly

const ROW_NEAR_Z =  0;   // first visible row
const ROW_FAR_Z  = -24;  // matches depth=20 + a little extra
const ROWS = 22;

// Vanishing rings from SpaceGrid.tsx (converted to world space after group offset)
const RINGS = Array.from({ length: 7 }, (_, i) => ({
  z:       -i * 3,
  r:        0.3 + i * 0.35,
  opacity: Math.max(0.05, 0.52 - i * 0.065),
}));

// Right wall heights (local y values from SpaceGrid.tsx)
const WALL_YS = [0.8, 1.6, 2.4, 3.2, 4.0];

// ── Draw ──────────────────────────────────────────────────────────────────────

function draw(ctx: CanvasRenderingContext2D, geistFamily = "Arial", logoImg?: HTMLImageElement) {
  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#0d0d0d";
  ctx.fillRect(0, 0, W, H);

  // Radial glows (matches linkedin-company page)
  const g1 = ctx.createRadialGradient(W * 0.60, H * 0.44, 0, W * 0.60, H * 0.44, W * 0.50);
  g1.addColorStop(0, "rgba(40,65,50,0.50)");
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W * 0.09, H * 0.52, 0, W * 0.09, H * 0.52, W * 0.26);
  g2.addColorStop(0, "rgba(50,75,60,0.40)");
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // ── Floor row lines (horizontal, receding) ──────────────────────────────────
  ctx.lineWidth = 0.9;
  for (let r = 0; r <= ROWS; r++) {
    const z  = ROW_NEAR_Z + r * (ROW_FAR_Z - ROW_NEAR_Z) / ROWS;
    const p1 = project(-GW / 2, GY, z);
    const p2 = project( GW / 2, GY, z);
    if (!p1 || !p2) continue;
    const t = r / ROWS;
    ctx.globalAlpha = 0.85 * (1 - t * 0.68);
    ctx.strokeStyle = "#6b8f7e";
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // ── Floor column lines (depth, converging to VP) ────────────────────────────
  for (let c = 0; c <= COLS; c++) {
    const x       = -GW / 2 + c * (GW / COLS);
    const isCenter = c === COLS / 2;
    const pNear   = project(x, GY, NEAR_Z);
    const pFar    = project(x, GY, FAR_Z);
    if (!pNear || !pFar) continue;
    ctx.strokeStyle  = isCenter ? "#a8c5b5" : "#6b8f7e";
    ctx.globalAlpha  = isCenter ? 0.95 : 0.62;
    ctx.lineWidth    = isCenter ? 1.1 : 0.9;
    ctx.beginPath();
    ctx.moveTo(pNear.x, pNear.y);
    ctx.lineTo(pFar.x,  pFar.y);
    ctx.stroke();
  }

  // ── Right wall horizontal lines ─────────────────────────────────────────────
  ctx.lineWidth = 0.8;
  for (const wh of WALL_YS) {
    const p1 = project(GW / 2, GY + wh, NEAR_Z);
    const p2 = project(GW / 2, GY + wh, FAR_Z);
    if (!p1 || !p2) continue;
    ctx.strokeStyle = "#6b8f7e";
    ctx.globalAlpha = 0.20;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  // ── Vanishing rings ─────────────────────────────────────────────────────────
  // Each ring lies in the xz-plane at y=GY, same as SpaceGrid.tsx ring geometry
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = "#6b8f7e";
  const SEGS = 80;
  for (const ring of RINGS) {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i <= SEGS; i++) {
      const a = (i / SEGS) * Math.PI * 2;
      const p = project(ring.r * Math.cos(a), GY, ring.z + ring.r * Math.sin(a));
      if (p) pts.push(p);
    }
    if (pts.length < 3) continue;
    ctx.globalAlpha = ring.opacity;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  ctx.globalAlpha = 1;

  // ── Text glow behind "Spattoo" ──────────────────────────────────────────────
  const tg = ctx.createRadialGradient(220, H * 0.45, 0, 220, H * 0.45, 340);
  tg.addColorStop(0, "rgba(50,75,60,0.28)");
  tg.addColorStop(1, "transparent");
  ctx.fillStyle = tg;
  ctx.fillRect(0, 0, W, H);

  // ── "Spattoo" ───────────────────────────────────────────────────────────────
  const LOGO_TOP = H * 0.07;
  const LOGO_H   = 140;

  if (logoImg) {
    const logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * LOGO_H;
    ctx.drawImage(logoImg, 60, LOGO_TOP, logoW, LOGO_H);
  } else {
    ctx.fillStyle = "#edeae3";
    ctx.font      = `800 102px ${geistFamily}`;
    ctx.fillText("Spattoo", 60, LOGO_TOP + LOGO_H * 0.75);
  }

  // ── Tagline — aligned to the 'p' in the logo ────────────────────────────────
  // 'p' starts at image x≈97/400; at rendered scale (LOGO_H/300) that maps to:
  const pOffsetX = 60 + (97 / 400) * ((400 / 300) * LOGO_H);
  ctx.fillStyle     = "rgba(237,234,227,0.55)";
  ctx.font          = `400 17px GaretCanvas, "Helvetica Neue", Arial, sans-serif`;
  ctx.letterSpacing = "1.5px";
  ctx.fillText("The software every baker needs", pOffsetX, LOGO_TOP + LOGO_H - 28);
  ctx.letterSpacing = "0px";

  // ── Right-side feature items ────────────────────────────────────────────────
  const items = [
    "Design cakes in 3D",
    "Customise the 3D studio to match your brand",
    "Manage your orders",
  ];
  const itemYs = [88, 192, 296];
  const numX  = 930;
  const divX  = 974;
  const textX = 994;

  items.forEach((text, i) => {
    const y = itemYs[i];

    // Number label
    ctx.fillStyle     = "#6b8f7e";
    ctx.font          = `600 11px ${geistFamily}`;
    ctx.letterSpacing = "1.5px";
    ctx.fillText(`0${i + 1}`, numX, y + 9);
    ctx.letterSpacing = "0px";

    // Vertical divider
    ctx.strokeStyle = "rgba(107,143,126,0.35)";
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(divX, y - 4);
    ctx.lineTo(divX, y + 36);
    ctx.stroke();

    // Main text
    ctx.fillStyle = "#edeae3";
    ctx.font      = `600 19px ${geistFamily}`;
    ctx.fillText(text, textX, y + 18);
  });

  // ── Bottom bar (matches linkedin-company page) ──────────────────────────────
  const bb = ctx.createLinearGradient(0, 0, W, 0);
  bb.addColorStop(0,   "transparent");
  bb.addColorStop(0.3, "#3d5247");
  bb.addColorStop(0.5, "#6b8f7e");
  bb.addColorStop(0.7, "#3d5247");
  bb.addColorStop(1,   "transparent");
  ctx.fillStyle = bb;
  ctx.fillRect(0, H - 3, W, 3);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LinkedInPersonalPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const logo = new Image();
    logo.src = "/Spattoo-lo-no-tag-line.png";

    const geistSrc   = `url(data:font/woff2;base64,${geistB64})`;
    const garetSrc = `url(data:font/woff;base64,${garetB64})`;
    const f300   = new FontFace("GeistCanvas", geistSrc,  { weight: "300" });
    const f600   = new FontFace("GeistCanvas", geistSrc,  { weight: "600" });
    const fGaret = new FontFace("GaretCanvas", garetSrc,  { weight: "400" });

    Promise.all([
      new Promise<void>(res => { logo.onload = () => res(); logo.onerror = () => res(); }),
      f300.load().then(f => document.fonts.add(f)).catch(() => {}),
      f600.load().then(f => document.fonts.add(f)).catch(() => {}),
      fGaret.load().then(f => document.fonts.add(f)).catch(() => {}),
    ]).then(() => {
      draw(ctx, "GeistCanvas", logo.complete && logo.naturalWidth ? logo : undefined);
      setReady(true);
    });
  }, []);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "spattoo-linkedin-personal-cover.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div style={{ background: "#080808", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", padding: "40px", fontFamily: "Arial, sans-serif" }}>
      <p style={{ color: "#6b8f7e", fontSize: "12px", letterSpacing: "0.2em", textTransform: "uppercase", margin: 0 }}>
        LinkedIn Personal Cover · 1584 × 396
      </p>
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{ width: "1188px", height: "297px", border: "1px solid rgba(107,143,126,0.25)", borderRadius: "6px" }}
      />
{ready && (
        <button
          onClick={handleDownload}
          style={{ padding: "12px 32px", background: "#3d5247", color: "#edeae3", border: "none", borderRadius: "24px", cursor: "pointer", fontSize: "15px" }}
        >
          ↓ Download PNG
        </button>
      )}
    </div>
  );
}
