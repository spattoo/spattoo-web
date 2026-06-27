"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabase } from "../../../lib/supabase";
import { makeCustomerApiClient } from "../../../lib/api";
import { composeShareCard } from "../../../lib/shareCard";
import { shareOrDownload } from "../../../lib/shareDesign";

type Baker = { name: string; logoUrl: string | null; brandColor: string | null };

// Post-quote share screen. The HERO is the share design (the branded card built
// from the just-submitted order's cake render); the copy + actions support it.
// Reuses composeShareCard / shareOrDownload — same helpers as the designer.
export default function QuoteSentClient({ slug, orderId }: { slug: string; orderId: string | null }) {
  const supabase = getSupabase();
  const api = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  const [baker, setBaker] = useState<Baker | null>(null);
  const [card, setCard] = useState<{ previewUrl: string; blob: Blob } | null>(null);
  const [errored, setErrored] = useState(false);

  const storefrontUrl =
    typeof window !== "undefined" ? window.location.origin : `https://${slug}.spattoo.com`;
  const displayUrl = storefrontUrl.replace(/^https?:\/\//, "");
  const bakerName = baker?.name?.trim() || "the baker";

  // Baker branding (name + logo + colour) for the card and copy.
  useEffect(() => {
    let alive = true;
    api
      .fetchBakerProfile()
      .then((r) => {
        if (!alive) return;
        const b = (r as { baker?: { name?: string; logo_url?: string | null; primary_color?: string | null } })?.baker;
        setBaker({ name: b?.name ?? "", logoUrl: b?.logo_url ?? null, brandColor: b?.primary_color ?? null });
      })
      .catch(() => alive && setBaker({ name: "", logoUrl: null, brandColor: null }));
    return () => {
      alive = false;
    };
  }, [api]);

  // Compose the share card once we have the order's cake render + branding.
  useEffect(() => {
    if (!orderId || !baker) return;
    let alive = true;
    let objectUrl: string | null = null;
    (async () => {
      try {
        const order = await api.fetchMyOrder(orderId);
        const cakeUrl = (order as { design_thumbnail_url?: string | null })?.design_thumbnail_url;
        if (!cakeUrl) throw new Error("no design thumbnail");
        const blob = await composeShareCard({
          cakeImageUrl: cakeUrl,
          logoUrl: baker.logoUrl,
          storefrontUrl: displayUrl,
          brandColor: baker.brandColor,
        });
        if (!alive) return;
        objectUrl = URL.createObjectURL(blob);
        setCard({ previewUrl: objectUrl, blob });
      } catch {
        if (alive) setErrored(true);
      }
    })();
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [api, orderId, baker, displayUrl]);

  const handleShare = useCallback(async () => {
    if (!card) return;
    await shareOrDownload(card.blob, {
      filename: "my-cake-design.png",
      text: `Design your own cake at ${displayUrl}`,
      url: storefrontUrl,
    });
  }, [card, displayUrl, storefrontUrl]);

  const brand = baker?.brandColor || "#7c8b54";
  const noDesign = !orderId || errored;

  return (
    <main style={S.page}>
      <div style={S.inner}>
        <h1 style={S.title}>You&apos;ve just designed something stunning</h1>
        <p style={S.body}>
          Your quote is with {bakerName}. While they work on it, share your design — it
          genuinely deserves a wider audience.
        </p>

        <div style={S.hero}>
          {noDesign ? (
            <div style={S.fallback}>Your quote has been sent.</div>
          ) : card ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.previewUrl} alt="Your cake design" style={S.heroImg} />
          ) : (
            <div style={S.fallback}>Preparing your design…</div>
          )}
        </div>

        {!noDesign && (
          <button
            style={{ ...S.primary, background: brand, opacity: card ? 1 : 0.5 }}
            disabled={!card}
            onClick={handleShare}
          >
            Share my design
          </button>
        )}

        <Link href={`/${slug}`} style={S.back}>
          Back to {bakerName}
        </Link>
      </div>
    </main>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100dvh",
    background: "#faf8f9",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    fontFamily: "'Quicksand', system-ui, sans-serif",
  },
  inner: { width: "100%", maxWidth: 460, textAlign: "center" },
  title: { fontSize: 22, fontWeight: 700, color: "#222", margin: "0 0 8px" },
  body: { fontSize: 14, color: "#777", lineHeight: 1.6, margin: "0 0 20px" },
  hero: {
    width: "100%",
    aspectRatio: "1 / 1",
    borderRadius: 18,
    overflow: "hidden",
    background: "#f1edee",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 14px 40px rgba(0,0,0,0.12)",
    marginBottom: 20,
  },
  heroImg: { width: "100%", height: "100%", objectFit: "contain" },
  fallback: { fontSize: 13, color: "#aaa" },
  primary: {
    width: "100%",
    border: "none",
    borderRadius: 13,
    padding: "15px 0",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    marginBottom: 14,
  },
  back: {
    display: "inline-block",
    fontSize: 13.5,
    fontWeight: 600,
    color: "#999",
    textDecoration: "none",
  },
};
