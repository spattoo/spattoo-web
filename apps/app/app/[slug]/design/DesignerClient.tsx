"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { makeCustomerApiClient } from "../../../lib/api";
import { setTelemetryContext } from "../../../lib/telemetry";
import { bridgeCoreTelemetryToSentry } from "../../../lib/coreTelemetryBridge";
import ShareDesignModal from "../../../components/ShareDesignModal";

// The designer is a heavy WebGL client component — load it client-only.
const CakeDesigner = dynamic(
  () => import("@spattoo/designer").then((m) => m.CakeDesigner),
  {
    ssr: false,
    loading: () => (
      <div style={{ fontFamily: "sans-serif", padding: 48 }}>Loading designer…</div>
    ),
  }
);

type Branding = { logoUrl: string | null; brandColor: string | null };

// Mounts CakeDesigner in customer mode: the customer designs and hits "Request
// quote", which routes to apiClient.requestQuote → POST /api/customer/orders
// (server derives the customer from the session token). Same origin as the
// storefront, so the login session persists in here.
//
// We wrap requestQuote so a successful submit pops the share modal — core's flow
// is untouched (the real response is still returned). The cake image reuses the
// order's existing R2 thumbnail, so the designer needs no change.
export default function DesignerClient({ slug }: { slug: string }) {
  const supabase = getSupabase();
  const baseApi = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  const [branding, setBranding] = useState<Branding>({ logoUrl: null, brandColor: null });
  const [shareImage, setShareImage] = useState<string | null>(null);

  const apiClient = useMemo(
    () => ({
      ...baseApi,
      requestQuote: async (payload: unknown) => {
        const res = await baseApi.requestQuote(payload);
        // POST returns only { orderId, createdAt } — fetch the order to get the
        // public design_thumbnail_url, then pop the share modal. Best-effort and
        // non-blocking so the designer's own flow returns immediately.
        const orderId = (res as { orderId?: string })?.orderId;
        if (orderId) {
          baseApi
            .fetchMyOrder(orderId)
            .then((o) => {
              const url = (o as { design_thumbnail_url?: string | null })?.design_thumbnail_url;
              if (url) setShareImage(url);
            })
            .catch(() => {
              /* share card is best-effort */
            });
        }
        return res;
      },
    }),
    [baseApi]
  );

  useEffect(() => {
    setTelemetryContext({ surface: "designer", bakerSlug: slug, role: "customer" });
    bridgeCoreTelemetryToSentry("designer"); // route the designer's internal reportError to Sentry
  }, [slug]);

  // Best-effort baker branding for the share card (logo + primary colour).
  useEffect(() => {
    let cancelled = false;
    baseApi
      .fetchBakerProfile()
      .then((r) => {
        if (cancelled) return;
        const b = (r as { baker?: { logo_url?: string | null; primary_color?: string | null } })?.baker;
        setBranding({ logoUrl: b?.logo_url ?? null, brandColor: b?.primary_color ?? null });
      })
      .catch(() => {
        /* branding is best-effort — the card still renders without it */
      });
    return () => {
      cancelled = true;
    };
  }, [baseApi]);

  const storefrontUrl =
    typeof window !== "undefined" ? window.location.origin : `https://${slug}.spattoo.com`;

  return (
    <>
      <CakeDesigner apiClient={apiClient} supabase={supabase} orderMode="customer" />
      <ShareDesignModal
        open={!!shareImage}
        onClose={() => setShareImage(null)}
        cakeImageUrl={shareImage ?? ""}
        logoUrl={branding.logoUrl}
        storefrontUrl={storefrontUrl}
        brandColor={branding.brandColor}
      />
    </>
  );
}
