"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import { makeBakerApiClient } from "../lib/bakerApi";
import { setTelemetryContext } from "../lib/telemetry";
import { bridgeCoreTelemetryToSentry } from "../lib/coreTelemetryBridge";

// The full baker tool (designer + dashboard + OrdersPanel/Send quote + edit-in-3D).
// Heavy WebGL — client-only. Same component as core's :5173 dev harness.
const CakeDesigner = dynamic(
  () => import("@spattoo/designer").then((m) => m.CakeDesigner),
  { ssr: false, loading: () => <Centered>Loading…</Centered> }
);

// The baker app surface (app.spattoo.com / localhost root): Supabase login →
// the full CakeDesigner in baker mode. It self-loads baker data via the apiClient
// and contains the order management + Send quote + edit-in-3D.
export default function BakerApp() {
  const supabase = getSupabase();
  const api = useMemo(() => makeBakerApiClient(supabase), [supabase]);

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [baker, setBaker] = useState<{ slug?: string; primary_color?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Key on the STABLE user id, not the session object — Supabase hands a new session
  // reference on every auth event (token refresh / focus / initial), and depending on
  // the object made this re-run → re-fetch → setBaker churn → CakeDesigner re-mounted
  // in a loop (new WebGLRenderer each time → context exhaustion → cake flickers + dies).
  const userId = session?.user?.id;
  useEffect(() => {
    setTelemetryContext({ surface: "baker-app", role: "baker", userId });
    if (!userId) { setBaker(null); return; }
    bridgeCoreTelemetryToSentry("baker-app"); // route OrdersPanel's internal reportError to Sentry
    let alive = true;
    api
      .fetchBakerProfile()
      .then((p: { baker?: Record<string, unknown> }) => { if (alive) setBaker((p?.baker ?? p) as typeof baker); })
      // Keep the current baker on a transient error — never tear down the mounted designer.
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (!ready) return <Centered>Loading…</Centered>;
  if (!session) return <BakerLogin supabase={supabase} />;
  if (!baker) return <Centered>Loading your shop…</Centered>;

  // Full baker tool — lands on the designer; Orders (with Send quote) + edit-in-3D
  // live inside it, exactly like the :5173 dev harness. CakeDesigner self-loads
  // baker profile/settings/catalog via the apiClient (orderMode defaults to 'baker').
  return <CakeDesigner apiClient={api} supabase={supabase} />;
}

function BakerLogin({ supabase }: { supabase: ReturnType<typeof getSupabase> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    setBusy(false);
  }

  return (
    <div style={L.wrap}>
      <form onSubmit={signIn} style={L.card}>
        <h1 style={L.h1}>Baker sign in</h1>
        <input style={L.input} type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input style={L.input} type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        <button style={L.btn} disabled={busy || !email || !password}>{busy ? "Signing in…" : "Sign in"}</button>
        {err && <p style={L.err}>{err}</p>}
      </form>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", color: "#777" }}>
      {children}
    </div>
  );
}

const L: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#F4F1EC", padding: 20 },
  card: { width: "100%", maxWidth: 360, background: "#fff", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 12px 30px rgba(60,40,45,0.08)" },
  h1: { fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "#2A2024" },
  input: { padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E0DDD8", fontSize: 14, fontFamily: "inherit", outline: "none" },
  btn: { padding: "12px", borderRadius: 10, border: "none", background: "#2C4433", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  err: { fontSize: 13, fontWeight: 700, color: "#C0392B", margin: 0 },
};
