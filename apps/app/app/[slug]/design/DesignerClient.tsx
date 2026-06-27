"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";
import { makeCustomerApiClient } from "../../../lib/api";
import { setTelemetryContext } from "../../../lib/telemetry";
import { bridgeCoreTelemetryToSentry } from "../../../lib/coreTelemetryBridge";

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

// Mounts CakeDesigner in customer mode: the customer designs and hits "Request
// quote", which routes to apiClient.requestQuote → POST /api/customer/orders.
//
// When the customer dismisses the "Quote Requested!" success popup (Done), core
// fires onQuoteRequested — we redirect OFF the designer to the share screen
// (/[slug]/quote-sent), which closes the loop and shows the share design.
export default function DesignerClient({ slug }: { slug: string }) {
  const supabase = getSupabase();
  const router = useRouter();
  const apiClient = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  useEffect(() => {
    setTelemetryContext({ surface: "designer", bakerSlug: slug, role: "customer" });
    bridgeCoreTelemetryToSentry("designer"); // route the designer's internal reportError to Sentry
  }, [slug]);

  return (
    <CakeDesigner
      apiClient={apiClient}
      supabase={supabase}
      orderMode="customer"
      onQuoteRequested={(result: { orderId?: string }) => {
        const orderId = result?.orderId;
        router.push(orderId ? `/${slug}/quote-sent?order=${orderId}` : `/${slug}/orders`);
      }}
    />
  );
}
