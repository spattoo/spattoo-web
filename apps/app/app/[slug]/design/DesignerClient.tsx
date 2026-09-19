"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";
import { makeCustomerApiClient } from "../../../lib/api";
import { setTelemetryContext } from "../../../lib/telemetry";
import { bridgeCoreTelemetryToSentry } from "../../../lib/coreTelemetryBridge";
import { takeResumeDesign } from "../../../lib/resumeDesign";
import { MARKETING_URL } from "../../../lib/domain";

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

// The SAME verification the storefront uses at quote time, not a second one. Two OTP screens on one
// origin would drift — different copy, different channel list, different captcha handling — and the
// one that drifts is always the one nobody is looking at.
const VerifyStep = dynamic(
  () => import("@spattoo/designer").then((m) => m.VerifyStep),
  { ssr: false, loading: () => <div style={{ fontFamily: "sans-serif", padding: 48 }}>Loading…</div> }
);

// Mounts CakeDesigner in customer mode: the customer designs and hits "Request
// quote", which routes to apiClient.requestQuote → POST /api/customer/orders.
//
// When the customer dismisses the "Quote Requested!" success popup (Done), core
// fires onQuoteRequested — we redirect OFF the designer to the share screen
// (/[slug]/quote-sent), which closes the loop and shows the share design.
// Only the fields the gate reads. `channels` in particular is the SERVER's decision, in its order of
// preference — offering SMS before DLT clearance is how somebody waits for a code a telco dropped.
/* ⚠️ What /storefront/:slug/settings ACTUALLY returns. It never carried `bakerName`, `channels` or
   `primary` — those were invented here and have been undefined ever since. The name and colour live
   on /storefront/:slug; the channels key is `otp_channels`. */
type StorefrontSettings = { otp_channels?: string[]; otp_required?: boolean };

export default function DesignerClient({ slug }: { slug: string }) {
  const supabase = getSupabase();
  const router = useRouter();
  const apiClient = useMemo(() => makeCustomerApiClient(supabase, slug), [supabase, slug]);

  // If the customer arrived from an invite the baker attached a design to, StorefrontClient stashed
  // it — take it once (read-and-clear) and seed the designer with it. Null → a normal blank start.
  const [initialDesign] = useState(() => takeResumeDesign(slug));
  // Joining a baker's live co-design session via the shared link (?session=<id>).
  const [liveSessionId] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session") : null,
  );

  useEffect(() => {
    setTelemetryContext({ surface: "designer", bakerSlug: slug, role: "customer" });
    bridgeCoreTelemetryToSentry("designer"); // route the designer's internal reportError to Sentry
  }, [slug]);

  // ── The gate ───────────────────────────────────────────────────────────────────────────────────
  // This page used to render for anyone. Every catalogue route behind the designer requires a
  // session — /api/elements, /element-types, /materials, /textures, /cake-shapes — so an unverified
  // visitor got the shell, an EMPTY DECORATIONS PANEL, and a console full of 401s. Nothing on screen
  // said why, and there was no way forward from it. Reached both by typing the URL and by the
  // storefront's own "let me build it myself in 3D" door, so the intended path was broken too.
  //
  // Nothing was ever exposed — the API refused every request correctly. What was broken was the
  // experience. See the "one exception" note in core's VerifyStep for why this door asks and the
  // storefront's other doors do not.
  //
  // `undefined` = still checking, and it must NOT render either branch: showing the verify screen
  // for a moment to somebody who is already signed in is the same bug in a nicer costume.
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const [settings, setSettings] = useState<StorefrontSettings | null>(null);
  const [gateBaker, setGateBaker] = useState<{ name?: string; primary_color?: string } | null>(null);

  useEffect(() => {
    let live = true;
    supabase.auth.getSession().then(({ data }) => { if (live) setAuthed(!!data.session); });
    // Kept in step with the storefront's own login: a session that expires, or a sign-out in another
    // tab, must drop the designer back to the gate rather than leaving it running on dead calls.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => { if (live) setAuthed(!!session); });
    return () => { live = false; sub.subscription.unsubscribe(); };
  }, [supabase]);

  // Only when the gate is actually going to show. The channels the server will accept are its
  // decision, not ours — offering SMS before DLT clearance is how somebody waits for a code a telco
  // already dropped.
  useEffect(() => {
    if (authed !== false || settings) return;
    apiClient.fetchBakerSettings()
      .then((s: unknown) => setSettings((s ?? {}) as StorefrontSettings))
      .catch(() => setSettings({}));   // a failed read must not strand the gate — VerifyStep has its own defaults
    // The name and colour the gate shows. Public, so it resolves before there is a session.
    apiClient.fetchBakerProfile()
      .then((r: { baker: { name?: string; primary_color?: string } }) => setGateBaker(r?.baker ?? null))
      .catch(() => {});
  }, [authed, settings, apiClient]);

  if (authed === undefined) {
    return <div style={{ fontFamily: "sans-serif", padding: 48 }}>Loading designer…</div>;
  }

  if (!authed) {
    return (
      <VerifyStep
        apiBaseUrl={process.env.NEXT_PUBLIC_API_URL}
        slug={slug}
        bakerName={gateBaker?.name}
        captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
        primary={gateBaker?.primary_color}
        /* ⚠️ Same two bugs as the order page's gate, and they were HERE first — this is where that
           gate was copied from. /storefront/:slug/settings carries neither `bakerName` nor `primary`
           nor `channels`: it has otp_channels, otp_required, delivery, store_hours, lead_time_days.
           So this door has been reading undefined for both, showing "Who shall undefined ask for?",
           and falling back to ["sms"] for bakers whose server accepts email only. Found 2026-09-18
           against the live 31-bakers storefront while testing the order link. */
        channels={settings?.otp_channels ?? ["email"]}
        /* ⚠️ NOBODY IS GETTING IN TOUCH YET. The default copy — "${baker} will be in touch about your
           cake" — is true at enquiry SUBMIT and false here: nothing has been sent, there is no cake
           yet, and the visitor came to build one. This door asks only because the designer cannot
           work without a session; every catalogue route behind it 401s. Promising a call to open a
           tool commits the baker to something nobody asked them about.
           Sandeep, 2026-09-19: "i came here to design the cake and the cake design is not ready yet." */
        title="Who's designing?"
        lede={`We just need to know who you are before you start. ${gateBaker?.name ?? "The bakery"} only sees your cake when you choose to send it.`}
        submitLabel="Start designing"
        onVerified={async (session: { access_token: string; refresh_token: string } | null) => {
          if (!session) return;
          await supabase.auth.setSession({
            access_token: session.access_token,
            refresh_token: session.refresh_token,
          });
          // onAuthStateChange flips `authed` and the designer mounts — they land where they were
          // going, rather than being returned to the storefront to find the door again.
        }}
        onBack={() => router.push(`/${slug}`)}
      />
    );
  }

  return (
    <CakeDesigner
      apiClient={apiClient}
      supabase={supabase}
      cfAssetsBase={process.env.NEXT_PUBLIC_ASSETS_BASE}
      orderMode="customer"
      // Where /terms + /privacy are served — the passive consent line under "Request a quote"
      // links here, and submitting the quote records the customer's acceptance server-side.
      legalBase={MARKETING_URL}
      initialDesign={initialDesign}
      liveSessionId={liveSessionId}
      onQuoteRequested={(result: { orderId?: string }) => {
        const orderId = result?.orderId;
        router.push(orderId ? `/${slug}/quote-sent?order=${orderId}` : `/${slug}/orders`);
      }}
    />
  );
}
