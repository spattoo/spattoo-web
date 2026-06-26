"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo } from "react";
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
// quote", which routes to apiClient.requestQuote → POST /api/customer/orders
// (server derives the customer from the session token). Same origin as the
// storefront, so the login session persists in here.
export default function DesignerClient({ slug }: { slug: string }) {
  const supabase = getSupabase();
  const apiClient = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  useEffect(() => {
    setTelemetryContext({ surface: "designer", bakerSlug: slug, role: "customer" });
    bridgeCoreTelemetryToSentry("designer"); // route the designer's internal reportError to Sentry
  }, [slug]);

  return (
    <CakeDesigner apiClient={apiClient} supabase={supabase} orderMode="customer" />
  );
}
