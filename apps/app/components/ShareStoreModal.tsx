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
  /** Opened by the customiser the FIRST time a storefront goes live, rather than by a baker
   *  reaching for it. Only the two lines at the top change — the card, the link and the share
   *  buttons are identical, because it is the same thing being offered at a different moment. */
  justPublished?: boolean;
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

/* Copy, with a fallback, because `navigator.clipboard` is not always there.
 *
 * ⚠️ It requires a SECURE CONTEXT. On plain http — a phone hitting a dev box by IP, a baker on an
 * old in-app browser — the promise rejects and a bare `await` swallows it, so the button appears to
 * work and copies nothing. The textarea + execCommand path is deprecated and still the only thing
 * that works there. Returns whether it actually copied, so the caller can say so honestly instead
 * of claiming success it cannot verify. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to the old way */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Local to this screen on purpose: shared/icons.jsx in core says only genuinely shared glyphs
// belong there, and this one has a single caller.
function CopyIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );
}

function TickIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m5 13 4.5 4.5L19 7" />
    </svg>
  );
}

export default function ShareStoreModal(props: ShareStoreModalProps) {
  const { open, onClose, slug, name, tagline, logoUrl, brandColor, justPublished } = props;
  const brand = brandColor || "#7c8b54";
  const { full: storefrontUrl, display: displayUrl } = storefront(slug);

  const [card, setCard] = useState<{ previewUrl: string; blob: Blob } | null>(null);
  const [errored, setErrored] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "done" | "failed">("idle");

  useEffect(() => {
    if (copyState === "idle") return;
    const t = setTimeout(() => setCopyState("idle"), 1800);
    return () => clearTimeout(t);
  }, [copyState]);

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

  /* Closing resets the row, so reopening never shows a stale "Link copied" claiming something that
   * did not just happen. Done in the handler rather than in an effect on `open`: setting state
   * synchronously inside an effect cascades a render, and React's own guidance is to do it in the
   * event that caused it. */
  const close = useCallback(() => { setCopyState("idle"); onClose(); }, [onClose]);

  const handleCopy = useCallback(async () => {
    setCopyState(await copyText(storefrontUrl) ? "done" : "failed");
  }, [storefrontUrl]);

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
    <div style={S.backdrop} onClick={close}>
      <div style={S.sheet} onClick={(e) => e.stopPropagation()}>
        <button style={S.close} onClick={close} aria-label="Close">×</button>
        {/* A baker who has just published has never seen this address and did not ask for it, so
            the heading tells them what happened. Every other time they came looking for the card,
            and being told they are live is news they already have. */}
        <h2 style={S.title}>{justPublished ? "You're live — here's your link" : "Share your store"}</h2>
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

        {/* ⚠️ THE ADDRESS, IN TEXT, AND COPYABLE. Until now the only place the link appeared was
            baked INTO the card image — fine for a poster, useless for a WhatsApp message, a bio
            link or an invoice, which is where most of these actually go. A baker who wanted the
            plain URL had to read it off a picture and retype it.

            One button, not a field plus an icon: the whole row is the target, which on a phone is
            the difference between a comfortable tap and aiming at a 16px glyph (rule 5). The
            confirmation replaces the row's own text rather than appearing beneath it — the effect
            belongs at the control (INVARIANTS #11), and a line that appears and disappears would
            shift the Share button under the baker's thumb as they read it. */}
        <button
          type="button"
          style={{ ...S.copyRow, color: copyState === "done" ? brand : "#5b5b5b" }}
          onClick={handleCopy}
          title={`Copy ${displayUrl}`}
          aria-label={`Copy your store link, ${displayUrl}`}
        >
          <span style={S.copyText}>
            {copyState === "done" ? "Link copied" : copyState === "failed" ? "Press and hold to copy" : displayUrl}
          </span>
          {copyState === "done" ? <TickIcon /> : <CopyIcon />}
        </button>
        {/* Announced to a screen reader, which cannot see the icon swap. */}
        <span aria-live="polite" style={S.srOnly}>{copyState === "done" ? "Link copied" : ""}</span>

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
  copyRow: {
    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
    minHeight: 44,                       // a thumb, not a cursor
    border: "1px solid #e6e3e4", borderRadius: 12, background: "#fbfafa",
    padding: "0 12px", marginBottom: 10, cursor: "pointer", fontFamily: "inherit",
    fontSize: 13.5, fontWeight: 700,
  },
  // The address can be longer than the sheet; it truncates rather than wrapping the row taller.
  copyText: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  srOnly: {
    position: "absolute", width: 1, height: 1, padding: 0, margin: -1,
    overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0,
  },
  fallback: { fontSize: 13, color: "#aaa" },
  primary: {
    width: "100%", border: "none", borderRadius: 12, padding: "13px 0",
    color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit",
  },
};
