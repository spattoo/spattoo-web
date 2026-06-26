"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import { makeBakerApiClient } from "../lib/bakerApi";

// OrdersPanel is a heavy client component (renders the 3D X-ray etc.) — client-only.
const OrdersPanel = dynamic(
  () => import("@spattoo/designer").then((m) => m.OrdersPanel),
  { ssr: false, loading: () => <Centered>Loading…</Centered> }
);

// The baker app surface (app.spattoo.com / localhost root): Supabase login → the
// order management screen, where the baker reviews requests and Sends quotes from
// the order details (reuses core OrdersPanel + its QuotePanel).
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

  useEffect(() => {
    if (!session) { setBaker(null); return; }
    api
      .fetchBakerProfile()
      .then((p: { baker?: Record<string, unknown> }) => setBaker((p?.baker ?? p) as typeof baker))
      .catch(() => setBaker(null));
  }, [session, api]);

  if (!ready) return <Centered>Loading…</Centered>;
  if (!session) return <BakerLogin supabase={supabase} />;
  if (!baker) return <Centered>Loading your shop…</Centered>;

  return (
    <OrdersPanel
      open
      apiClient={api}
      bakerSlug={baker.slug ?? null}
      primaryColor={baker.primary_color ?? "#2C4433"}
      onClose={() => supabase.auth.signOut()}
      onEditDesign={() => {
        // In-app 3D editing from the baker side isn't wired in this surface yet.
        alert("Editing the 3D design from here is coming soon.");
      }}
    />
  );
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
