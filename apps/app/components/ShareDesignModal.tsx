"use client";

import { useEffect, useState, useCallback } from "react";
import { composeShareCard } from "../lib/shareCard";
import { shareOrDownload } from "../lib/shareDesign";

// Post-"request quote" celebration: composes a branded share card from the
// design the customer just submitted and lets them share it (native sheet on
// mobile) or download it. This is the growth loop — every shared design points a
// new customer back to "design your own". Rendered by DesignerClient, which owns
// the baker branding; the cake image is the design's existing R2 thumbnail.

export type ShareDesignModalProps = {
  open: boolean;
  onClose: () => void;
  cakeImageUrl: string;
  logoUrl?: string | null;
  storefrontUrl: string;   // full https url, e.g. https://sweetcrumb.spattoo.com
  brandColor?: string | null;
};

export default function ShareDesignModal(props: ShareDesignModalProps) {
  const { open, onClose, cakeImageUrl, logoUrl, storefrontUrl, brandColor } = props;
  const brand = brandColor || "#c39aa7";
  const displayUrl = storefrontUrl.replace(/^https?:\/\//, "");

  // Card + error are keyed to the image they were produced for, so they only
  // count when they match the CURRENT cakeImageUrl (derived below). This lets the
  // effect set state ONLY in its async callbacks — no synchronous reset in the
  // effect body — and the preview auto-resets to "preparing" when the image changes.
  const [card, setCard] = useState<{ forUrl: string; previewUrl: string; blob: Blob } | null>(null);
  const [errorUrl, setErrorUrl] = useState<string | null>(null);

  // Compose the card once the modal opens (and we have a cake image).
  useEffect(() => {
    if (!open || !cakeImageUrl) return;
    let alive = true;
    let objectUrl: string | null = null;
    composeShareCard({ cakeImageUrl, logoUrl, storefrontUrl: displayUrl, brandColor: brand })
      .then((b) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(b);
        setCard({ forUrl: cakeImageUrl, previewUrl: objectUrl, blob: b });
      })
      .catch(() => alive && setErrorUrl(cakeImageUrl));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, cakeImageUrl, logoUrl, displayUrl, brand]);

  // Only honour the composed card / error if it's for the image now showing.
  const ready = card && card.forUrl === cakeImageUrl ? card : null;
  const previewUrl = ready?.previewUrl ?? null;
  const blob = ready?.blob ?? null;
  const error = errorUrl === cakeImageUrl;

  const handleShare = useCallback(async () => {
    if (!blob) return;
    // The "design your own" CTA lives in the share message text (and the url),
    // not baked into the card the customer previews here.
    await shareOrDownload(blob, {
      filename: "my-cake-design.png",
      text: `Design your own cake at ${displayUrl}`,
      url: storefrontUrl,
    });
  }, [blob, displayUrl, storefrontUrl]);

  if (!open) return null;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <button style={S.close} onClick={onClose} aria-label="Close">×</button>

        <div style={S.preview}>
          {error ? (
            <div style={S.fallback}>Couldn&apos;t build the share image.</div>
          ) : previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Your cake design" style={S.previewImg} />
          ) : (
            <div style={S.fallback}>Preparing your design…</div>
          )}
        </div>

        <h2 style={S.title}>That&apos;s a stunning design</h2>
        <p style={S.sub}>A design like this deserves a wider audience.</p>

        <button
          style={{ ...S.primary, background: brand, opacity: blob ? 1 : 0.5 }}
          disabled={!blob}
          onClick={handleShare}
        >
          Share my design
        </button>
      </div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  backdrop: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 16, zIndex: 1000,
  },
  sheet: {
    position: "relative", width: "100%", maxWidth: 380, background: "#fff",
    borderRadius: 20, padding: "28px 22px 22px", textAlign: "center",
    fontFamily: "'Quicksand', system-ui, sans-serif",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
  },
  close: {
    position: "absolute", top: 10, right: 14, border: "none", background: "none",
    fontSize: 26, lineHeight: 1, color: "#999", cursor: "pointer",
  },
  title: { margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#222" },
  sub: { margin: "0 0 16px", fontSize: 13, color: "#888" },
  preview: {
    width: "100%", aspectRatio: "1 / 1", borderRadius: 14, overflow: "hidden",
    background: "#f4f1f2", display: "flex", alignItems: "center",
    justifyContent: "center", marginBottom: 16,
  },
  previewImg: { width: "100%", height: "100%", objectFit: "contain" },
  fallback: { fontSize: 13, color: "#aaa" },
  primary: {
    width: "100%", border: "none", borderRadius: 12, padding: "13px 0",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", marginBottom: 8,
  },
  secondary: {
    width: "100%", border: "1px solid #e3dadd", borderRadius: 12, padding: "11px 0",
    background: "#fff", color: "#555", fontSize: 13.5, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
};
