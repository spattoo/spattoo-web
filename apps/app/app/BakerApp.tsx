"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import { BASE_DOMAIN, MARKETING_URL } from "../lib/domain";
import { makeBakerApiClient } from "../lib/bakerApi";
import { setTelemetryContext } from "../lib/telemetry";
import { bridgeCoreTelemetryToSentry } from "../lib/coreTelemetryBridge";
import ShareStoreModal from "../components/ShareStoreModal";

// The full baker tool (designer + dashboard + OrdersPanel/Send quote + edit-in-3D).
// Heavy WebGL — client-only. Same component as core's :5173 dev harness.
const CakeDesigner = dynamic(
  () => import("@spattoo/designer").then((m) => m.CakeDesigner),
  { ssr: false, loading: () => <Centered>Loading…</Centered> }
);

// Lightweight 3D grid backdrop for the sign-in — client-only (WebGL), lazy so it
// never blocks the form. The dark page shows instantly; the grid paints in.
const LoginGrid = dynamic(() => import("../components/LoginGrid"), { ssr: false });

// The baker app surface (app.spattoo.com / localhost root): Supabase login →
// the full CakeDesigner in baker mode. It self-loads baker data via the apiClient
// and contains the order management + Send quote + edit-in-3D.
export default function BakerApp() {
  const supabase = getSupabase();
  const api = useMemo(() => makeBakerApiClient(supabase), [supabase]);

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [baker, setBaker] = useState<{
    slug?: string; name?: string; tagline?: string | null;
    logo_url?: string | null; primary_color?: string | null;
  } | null>(null);
  const [shareStoreOpen, setShareStoreOpen] = useState(false);
  // A logged-in user with no baker yet (self-signup before profile completion) →
  // profile fetch 404s ("No baker account found"); route them to setup instead of
  // hanging on "Loading your shop…".
  const [needsSetup, setNeedsSetup] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // On sign-out, send the baker to the marketing site (symmetric with the
      // marketing "Sign in" CTA). Covers both sign-out paths + session loss.
      if (event === "SIGNED_OUT") { window.location.href = MARKETING_URL; return; }
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  // Key on the STABLE user id, not the session object — Supabase hands a new session
  // reference on every auth event (token refresh / focus / initial), and depending on
  // the object made this re-run → re-fetch → setBaker churn → CakeDesigner re-mounted
  // in a loop (new WebGLRenderer each time → context exhaustion → cake flickers + dies).
  const userId = session?.user?.id;
  useEffect(() => {
    setTelemetryContext({ surface: "baker-app", role: "baker", userId });
    if (!userId) { setBaker(null); setNeedsSetup(false); return; }
    bridgeCoreTelemetryToSentry("baker-app"); // route OrdersPanel's internal reportError to Sentry
    let alive = true;
    api
      .fetchBakerProfile()
      .then((p: { baker?: Record<string, unknown> }) => {
        if (!alive) return;
        setBaker((p?.baker ?? p) as typeof baker);
        setNeedsSetup(false);
      })
      .catch((e: { message?: string }) => {
        if (!alive) return;
        // 404 "No baker account found" = this verified user hasn't created their shop
        // yet → setup. Any other (transient) error: keep current, don't tear down.
        if (/No baker account/i.test(e?.message ?? "")) setNeedsSetup(true);
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloadKey]);

  if (!ready) return <Centered>Loading…</Centered>;
  if (!session) return <AuthScreen supabase={supabase} />;
  if (needsSetup) {
    return (
      <SetupBaker
        api={api}
        email={session.user.email ?? ""}
        onDone={() => { setNeedsSetup(false); setReloadKey((k) => k + 1); }}
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }
  if (!baker) return <Centered>Loading your shop…</Centered>;

  // Full baker tool — lands on the designer; Orders (with Send quote) + edit-in-3D
  // live inside it, exactly like the :5173 dev harness. CakeDesigner self-loads
  // baker profile/settings/catalog via the apiClient (orderMode defaults to 'baker').
  return (
    <>
      <CakeDesigner apiClient={api} supabase={supabase} cfAssetsBase={process.env.NEXT_PUBLIC_ASSETS_BASE} onShareStore={() => setShareStoreOpen(true)} />
      {baker.slug && (
        <ShareStoreModal
          open={shareStoreOpen}
          onClose={() => setShareStoreOpen(false)}
          slug={baker.slug}
          name={baker.name}
          tagline={baker.tagline}
          logoUrl={baker.logo_url}
          brandColor={baker.primary_color}
        />
      )}
    </>
  );
}

// Login by default. Self-signup is built but intentionally UNLINKED for now — it only
// appears when the URL carries ?signup=1 (so marketing's CTA isn't wired to it yet).
function AuthScreen({ supabase }: { supabase: ReturnType<typeof getSupabase> }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupAllowed, setSignupAllowed] = useState(false);

  useEffect(() => {
    setSignupAllowed(new URLSearchParams(window.location.search).get("signup") === "1");
  }, []);

  if (mode === "signup" && signupAllowed) {
    return <BakerSignup supabase={supabase} onBack={() => setMode("login")} />;
  }
  return (
    <BakerLogin
      supabase={supabase}
      showSignup={signupAllowed}
      onSignup={() => setMode("signup")}
    />
  );
}

function BakerLogin({
  supabase, showSignup, onSignup,
}: { supabase: ReturnType<typeof getSupabase>; showSignup?: boolean; onSignup?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [showPw, setShowPw] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErr(error.message);
    setBusy(false);
  }

  const field =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-[#edeae3] " +
    "placeholder:text-[#edeae3]/30 outline-none transition focus:border-[#6b8f7e] focus:bg-white/[0.06] focus:ring-2 focus:ring-[#6b8f7e]/25";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#111111]">
      {/* On-brand grid backdrop (no heavy cake assets) */}
      <div className="absolute inset-0">
        <LoginGrid />
      </div>
      {/* Subtle vignette so the form panel stays legible over the grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(17,17,17,0.45)_0%,rgba(17,17,17,0.82)_72%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Cursive logo — same treatment as the marketing site; clicking it goes
            home (the marketing site). No www/app jargon shown to the user. */}
        <div className="p-6 md:p-10">
          <a href={MARKETING_URL} aria-label="Go to Spattoo home" className="inline-block">
            <Image src="/Spattoo-cursive.png" alt="Spattoo" width={120} height={43}
              priority className="h-auto w-[120px] [filter:drop-shadow(0_0_16px_rgba(237,234,227,0.22))]" />
          </a>
        </div>

        {/* Form — centred, the focus of the page */}
        <div className="flex flex-1 items-center justify-center px-5 pb-16">
          <form onSubmit={signIn}
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#161616]/70 p-7 shadow-2xl backdrop-blur-md">
            <h1 className="text-2xl font-bold text-[#edeae3]">Welcome back</h1>
            <p className="mt-1 text-sm text-[#edeae3]/45">Sign in to continue.</p>

            <div className="mt-6 flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Email</span>
                <input type="email" autoComplete="email" placeholder="you@bakery.com" value={email}
                  onChange={(e) => setEmail(e.target.value)} className={field} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Password</span>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="••••••••"
                    value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} pr-11`} />
                  <button type="button" onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#edeae3]/40 transition hover:text-[#edeae3]/80">
                    {showPw ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </label>

              {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}

              <button type="submit" disabled={busy || !email || !password}
                className="mt-1 rounded-xl bg-[#6b8f7e] px-4 py-3 text-sm font-bold text-[#0e1a14] transition hover:bg-[#7ba18e] disabled:cursor-not-allowed disabled:opacity-40">
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>

            {showSignup && (
              <div className="mt-6 text-sm">
                <button type="button" onClick={onSignup} className="font-semibold text-[#a8c5b5] hover:underline">
                  Create an account
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

// Inline icons for the password show/hide toggle (no icon dep).
function Eye() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className="h-5 w-5">
      <path d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.9 4.8A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a10.4 10.4 0 0 0 3.4-.6"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Account creation only (email + password). Business details are collected AFTER
// login in SetupBaker, so nothing is lost across email verification.
function BakerSignup({
  supabase, onBack,
}: { supabase: ReturnType<typeof getSupabase>; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setErr(error.message); setBusy(false); return; }
    // If email confirmation is ON, there's no session yet → tell them to verify.
    // If OFF, the auth state change logs them in and BakerApp routes to setup.
    if (!data.session) setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div style={L.wrap}>
        <div style={L.card}>
          <h1 style={L.h1}>Check your email</h1>
          <p style={{ fontSize: 14, color: "#555", margin: 0, lineHeight: 1.5 }}>
            We sent a verification link to <b>{email}</b>. Confirm it, then sign in to
            finish setting up your shop.
          </p>
          <button type="button" onClick={onBack} style={L.btn}>Back to sign in</button>
        </div>
      </div>
    );
  }

  return (
    <div style={L.wrap}>
      <form onSubmit={signUp} style={L.card}>
        <h1 style={L.h1}>Create your baker account</h1>
        <input style={L.input} type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <input style={L.input} type="password" placeholder="Password (min 6 chars)" value={password}
          onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <button style={L.btn} disabled={busy || !email || password.length < 6}>{busy ? "Creating…" : "Create account"}</button>
        {err && <p style={L.err}>{err}</p>}
        <button type="button" onClick={onBack} style={L.link}>Already have an account? Sign in</button>
      </form>
    </div>
  );
}

// Post-signup shop setup: a logged-in user with no baker yet provides their name +
// business + storefront address; we provision them on the free Spark tier via
// POST /api/bakers/self. No payment involved.
function SetupBaker({
  api, email, onDone, onSignOut,
}: {
  api: ReturnType<typeof makeBakerApiClient>;
  email: string;
  onDone: () => void;
  onSignOut: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugState, setSlugState] = useState<{ checking: boolean; available?: boolean; reason?: string }>({ checking: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const derive = (s: string) =>
    s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);

  // Auto-derive slug from business name until the baker edits it themselves.
  useEffect(() => {
    if (!slugEdited) setSlug(derive(name));
  }, [name, slugEdited]);

  // Debounced availability check.
  useEffect(() => {
    const s = slug.trim();
    if (!s) { setSlugState({ checking: false }); return; }
    setSlugState({ checking: true });
    const t = setTimeout(() => {
      api.checkSlug(s)
        .then((r: { available: boolean; reason?: string }) => setSlugState({ checking: false, available: r.available, reason: r.reason }))
        .catch(() => setSlugState({ checking: false }));
    }, 350);
    return () => clearTimeout(t);
  }, [slug, api]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.createBakerSelf({ name: name.trim(), firstName: firstName.trim(), lastName: lastName.trim(), slug: slug.trim() });
      onDone();
    } catch (e2) {
      setErr((e2 as { message?: string })?.message ?? "Something went wrong");
      setBusy(false);
    }
  }

  const canSubmit =
    firstName.trim() && lastName.trim() && name.trim() && slug.trim() &&
    slugState.available === true && !busy;

  return (
    <div style={L.wrap}>
      <form onSubmit={submit} style={{ ...L.card, maxWidth: 420 }}>
        <h1 style={L.h1}>Set up your shop</h1>
        <p style={{ fontSize: 13.5, color: "#666", margin: "0 0 4px", lineHeight: 1.5 }}>
          You&apos;re signed in as <b>{email}</b>. A couple of details and you&apos;re on the
          free Spark plan.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <input style={L.input} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input style={L.input} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <input style={L.input} placeholder="Bakery name" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "#999" }}>{BASE_DOMAIN}/</span>
            <input style={{ ...L.input, flex: 1 }} placeholder="your-shop" value={slug}
              onChange={(e) => { setSlugEdited(true); setSlug(derive(e.target.value)); }} />
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6, minHeight: 16,
            color: slugState.available === true ? "#2E7D32" : slugState.available === false ? "#C0392B" : "#999" }}>
            {!slug.trim() ? "" :
              slugState.checking ? "Checking…" :
              slugState.available === true ? "✓ Available" :
              slugState.reason === "taken" ? "Already taken" :
              slugState.reason === "reserved" ? "Reserved — pick another" :
              slugState.available === false ? "Not a valid address" : ""}
          </div>
        </div>
        <button style={L.btn} disabled={!canSubmit}>{busy ? "Creating your shop…" : "Create my shop"}</button>
        {err && <p style={L.err}>{err}</p>}
        <button type="button" onClick={onSignOut} style={L.link}>Sign out</button>
      </form>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#111111", color: "rgba(237,234,227,0.5)" }}>
      {children}
    </div>
  );
}

const L: Record<string, React.CSSProperties> = {
  wrap: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#F4F1EC", padding: 20 },
  card: { width: "100%", maxWidth: 360, background: "#fff", borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 12px 30px rgba(60,40,45,0.08)" },
  h1: { fontSize: 20, fontWeight: 800, margin: "0 0 6px", color: "#2A2024" },
  input: { padding: "12px 14px", borderRadius: 10, border: "1.5px solid #E0DDD8", fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" },
  btn: { padding: "12px", borderRadius: 10, border: "none", background: "#2C4433", color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer" },
  err: { fontSize: 13, fontWeight: 700, color: "#C0392B", margin: 0 },
  link: { background: "none", border: "none", color: "#6B8C74", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", padding: 4 },
};
