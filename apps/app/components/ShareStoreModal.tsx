"use client";

import { useCallback, useEffect, useState } from "react";
import { composeStoreShareCard } from "../lib/storeShareCard";
import { shareOrDownload } from "../lib/shareDesign";
import { BASE_DOMAIN } from "../lib/domain";

// Baker-side "share your store" modal, opened from the designer sidebar. Composes
// the store promo card (logo + tagline + CTA + QR) and lets the baker share it to
// WhatsApp/Instagram or download it. A modal (not a redirect) so the baker stays
// on their dashboard. Reuses shareOrDownload — same mechanism as the design share.

export type ShareStoreModalProps = {
  open: boolean;
  onClose: () => void;
  slug: string;
  name?: string | null;
  tagline?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
};

// The baker's public storefront URL, derived from the current host (app.X → slug.X,
// or slug.localhost:port in dev). The QR/share always points at the storefront.
function storefront(slug: string): { full: string; display: string } {
  if (typeof window === "undefined") return { full: `https://${slug}.${BASE_DOMAIN}`, display: `${slug}.${BASE_DOMAIN}` };
  const { protocol, host } = window.location;
  const base = host.replace(/^app\./, "");
  const sfHost = `${slug}.${base}`;
  return { full: `${protocol}//${sfHost}`, display: sfHost };
}

export default function ShareStoreModal(props: ShareStoreModalProps) {
  const { open, onClose, slug, name, tagline, logoUrl, brandColor } = props;
  const brand = brandColor || "#7c8b54";
  const { full: storefrontUrl, display: displayUrl } = storefront(slug);

  const [card, setCard] = useState<{ previewUrl: string; blob: Blob } | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let objectUrl: string | null = null;
    composeStoreShareCard({ storefrontUrl, displayUrl, name, tagline, logoUrl, brandColor })
      .then((blob) => {
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setCard({ previewUrl: objectUrl, blob });
      })
      .catch(() => alive && setErrored(true));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, storefrontUrl, displayUrl, name, tagline, logoUrl, brandColor]);

  const handleShare = useCallback(async () => {
    if (!card) return;
    await shareOrDownload(card.blob, {
      filename: "my-store.png",
      text: `Design & order your custom cake at ${displayUrl}`,
      url: storefrontUrl,
    });
  }, [card, displayUrl, storefrontUrl]);

  if (!open) return null;

  return (
    <div style={S.backdrop} onClick={onClose}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <button style={S.close} onClick={onClose} aria-label="Close">×</button>
        <h2 style={S.title}>Share your store</h2>
        <p style={S.sub}>Post this anywhere — customers scan to design &amp; order.</p>

        <div style={S.preview}>
          {errored ? (
            <div style={S.fallback}>Couldn&apos;t build the image.</div>
          ) : card ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.previewUrl} alt="Your store card" style={S.previewImg} />
          ) : (
            <div style={S.fallback}>Preparing…</div>
          )}
        </div>

        <button
          style={{ ...S.primary, background: brand, opacity: card ? 1 : 0.5 }}
          disabled={!card}
          onClick={handleShare}
        >
          Share my store
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
    borderRadius: 20, padding: "26px 22px 22px", textAlign: "center",
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
    fontFamily: "inherit",
  },
};
