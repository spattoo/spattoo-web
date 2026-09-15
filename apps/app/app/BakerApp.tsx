"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../lib/supabase";
import { MARKETING_URL } from "../lib/domain";
import EnableNotifications from "./EnableNotifications";
import { makeBakerApiClient } from "../lib/bakerApi";
import { API_BASE } from "../lib/api";
import { setTelemetryContext } from "../lib/telemetry";
import { bridgeCoreTelemetryToSentry } from "../lib/coreTelemetryBridge";
import { extractLogoPalette, parseNotificationLink, withoutLinkParams } from "@spattoo/designer";
import ShareStoreModal from "../components/ShareStoreModal";
import PasswordChecklist from "../components/PasswordChecklist";
import { Captcha, captchaConfigured, type CaptchaHandle } from "../components/Captcha";
import { isPasswordValid } from "../lib/passwordPolicy";
// FULL ("max") metadata — the default "min" bundle wrongly validates junk like
// "123123123" for IN (it only length-checks). "max" enforces real patterns. Types come
// from the main package (metadata-independent).
import { isValidPhoneNumber, getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import type { CountryCode } from "libphonenumber-js";

// The full baker tool (designer + dashboard + OrdersPanel/Send quote + edit-in-3D).
// Heavy WebGL — client-only. Same component as core's :5173 dev harness.
const CakeDesigner = dynamic(
  () => import("@spattoo/designer").then((m) => m.CakeDesigner),
  { ssr: false, loading: () => <Centered>Loading…</Centered> }
);

// Login-path (Baker vs Staff) coordination. The chosen path is stored before
// signInWithPassword; BakerApp validates the server-resolved role against it and, on a
// mismatch, signs out with a notice (strict: the Staff path rejects owner credentials
// and vice-versa). sessionStorage because the login component unmounts on the auth-state
// change, so we can't hold this in React state.
const LS_LOGIN_MODE = "spattoo.loginMode";                       // 'baker' | 'staff'
const LS_LOGIN_NOTICE = "spattoo.loginNotice";                   // message to show on login
const LS_SUPPRESS_REDIRECT = "spattoo.suppressSignoutRedirect";  // skip marketing redirect once
const ss = {
  get: (k: string) => (typeof window !== "undefined" ? window.sessionStorage.getItem(k) : null),
  set: (k: string, v: string) => { if (typeof window !== "undefined") window.sessionStorage.setItem(k, v); },
  del: (k: string) => { if (typeof window !== "undefined") window.sessionStorage.removeItem(k); },
};

// Lightweight 3D grid backdrop for the sign-in — client-only (WebGL), lazy so it
// never blocks the form. The dark page shows instantly; the grid paints in.
const LoginGrid = dynamic(() => import("../components/LoginGrid"), { ssr: false });

// The baker app surface (app.spattoo.com / localhost root): Supabase login →
// the full CakeDesigner in baker mode. It self-loads baker data via the apiClient
// and contains the order management + Send quote + edit-in-3D.
export default function BakerApp() {
  const supabase = getSupabase();
  const api = useMemo(() => makeBakerApiClient(supabase), [supabase]);
  // Rejoining a live co-design session via the shared link (?session=<id>).
  const [liveSessionId] = useState(() =>
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session") : null,
  );
  // A link from outside the app — a WhatsApp template's "View Orders" button, a push opened while the
  // app was closed — arrives as ?order=<id> or ?panel=orders. Read once and handed to the designer,
  // which opens it the way a tap in the notification bell does. It survives signing in, because the
  // login form is this same page. Read with the designer's own parser so the two cannot disagree.
  const [initialLink] = useState(() =>
    typeof window !== "undefined" && parseNotificationLink(window.location.search) ? window.location.search : null,
  );
  // Taken out of the address straight away, so a refresh does not open the panel again. In an effect
  // rather than the initialiser above: React may call an initialiser twice, and the second call would
  // find the address already cleared.
  useEffect(() => {
    if (!initialLink) return;
    const { pathname, search, hash } = window.location;
    window.history.replaceState(window.history.state, "", withoutLinkParams(pathname, search, hash));
  }, [initialLink]);

  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [baker, setBaker] = useState<{
    slug?: string; name?: string; tagline?: string | null;
    logo_url?: string | null; primary_color?: string | null;
  } | null>(null);
  // null = closed. The object carries WHY it opened: the customiser passes { justPublished } the
  // first time a storefront goes live, and the sidebar passes nothing.
  const [shareStore, setShareStore] = useState<{ justPublished?: boolean } | null>(null);
  // A logged-in user with no baker yet (self-signup before profile completion) →
  // profile fetch 404s ("No baker account found"); route them to setup instead of
  // hanging on "Loading your shop…".
  const [needsSetup, setNeedsSetup] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  // Legal docs (ToS/Privacy) whose current version this baker hasn't accepted → show the
  // first-login acceptance gate before the app. [] until Layer 1 is published, so dormant
  // pre-launch. See docs/CONSENT_CAPTURE_PLAN.md.
  const [pendingConsents, setPendingConsents] = useState<string[]>([]);
  // Arrived via a password-reset link → Supabase fires PASSWORD_RECOVERY with a short-lived
  // recovery session. Gate the whole app behind ResetPassword until they set a new password.
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      // On sign-out, send the baker to the marketing site (symmetric with the
      // marketing "Sign in" CTA). Covers both sign-out paths + session loss — EXCEPT a
      // role-mismatch sign-out (wrong login path), which stays here to show the notice.
      if (event === "SIGNED_OUT") {
        if (ss.get(LS_SUPPRESS_REDIRECT)) { ss.del(LS_SUPPRESS_REDIRECT); setSession(null); return; }
        window.location.href = MARKETING_URL; return;
      }
      // Reset link followed → show the set-new-password screen instead of routing into the app.
      if (event === "PASSWORD_RECOVERY") { setRecovery(true); setSession(s); return; }
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
    if (!userId) { setBaker(null); setNeedsSetup(false); setPendingConsents([]); return; }
    bridgeCoreTelemetryToSentry("baker-app"); // route OrdersPanel's internal reportError to Sentry
    let alive = true;
    // Strict login-path enforcement: if the user came in via a specific path (Baker or
    // Staff), the server-resolved role MUST match. On mismatch, sign out with a notice
    // rather than letting owner credentials in through the Staff door (or vice-versa).
    const rejectPath = (notice: string, retryMode: "baker" | "staff") => {
      ss.set(LS_LOGIN_NOTICE, notice);
      ss.set(LS_LOGIN_MODE, retryMode);       // preselect the correct tab on retry
      ss.set(LS_SUPPRESS_REDIRECT, "1");       // stay on the login screen, don't bounce to marketing
      supabase.auth.signOut();
    };

    api
      .fetchBakerProfile()
      .then((p: { baker?: Record<string, unknown>; user?: { role?: string }; pending_consents?: string[] }) => {
        if (!alive) return;
        const mode = ss.get(LS_LOGIN_MODE);            // 'baker' | 'staff' | null
        const isStaff = p?.user?.role === "staff";
        if (mode) {
          if (mode === "staff" && !isStaff)  return rejectPath("Those are owner credentials. Use the Baker sign-in.", "baker");
          if (mode === "baker" && isStaff)   return rejectPath("Those are staff credentials. Use the Staff sign-in.", "staff");
          ss.del(LS_LOGIN_MODE);                        // path matched — consume it
        }
        setBaker((p?.baker ?? p) as typeof baker);
        setNeedsSetup(false);
        setPendingConsents(p?.pending_consents ?? []);
      })
      .catch((e: { message?: string }) => {
        if (!alive) return;
        // 404 "No baker account found" = no baker_appusers row for this user.
        if (/No baker account/i.test(e?.message ?? "")) {
          // Came in via the Staff path but there's no staff account → reject.
          if (ss.get(LS_LOGIN_MODE) === "staff") return rejectPath("No staff account found for these credentials.", "staff");
          ss.del(LS_LOGIN_MODE);
          setNeedsSetup(true);                          // a new owner → onboarding
        }
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, reloadKey]);

  if (!ready) return <Centered>Loading…</Centered>;
  // Password-reset completion takes precedence over all normal routing (the recovery session
  // would otherwise fall straight through into the app). Cancel signs out but stays on login.
  if (recovery && session) {
    return (
      <ResetPassword
        supabase={supabase}
        email={session.user.email ?? ""}
        onDone={() => setRecovery(false)}
        onCancel={() => { ss.set(LS_SUPPRESS_REDIRECT, "1"); setRecovery(false); supabase.auth.signOut(); }}
      />
    );
  }
  if (!session) return <AuthScreen supabase={supabase} />;
  // Invited staff arrive with a session but no password (must_set_password in metadata,
  // set at invite time). Gate the whole app behind setting one — clearing the flag lets
  // them through (the USER_UPDATED event refreshes the session → this recomputes false).
  if ((session.user.user_metadata as { must_set_password?: boolean } | undefined)?.must_set_password) {
    return <SetStaffPassword supabase={supabase} email={session.user.email ?? ""} onSignOut={() => supabase.auth.signOut()} />;
  }
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
  if (!baker) return <Centered>Loading your store…</Centered>;

  // "Save as Template" — the host-callback path in CakeDesigner.handleSaveTemplate.
  //
  // Supplying this callback is what DISABLES core's legacy fallback, which inserted into
  // cake_templates straight from the browser and resolved baker_id client-side. That path had no
  // server-side chokepoint: baker_id was CLIENT-chosen, so a caller could write for another
  // tenant. The API now resolves the tenant from the token (spattoo-api POST /api/baker/templates).
  // The rights attestation is NOT here — it is at storefront publish, the one moment content
  // becomes world-visible (supabase/content_attestations.sql).
  //
  async function saveTemplate(t: {
    name: string;
    offering: string;
    tierCount: number;
    designJson: { shape?: string } & Record<string, unknown>;
    thumbnailBlob: Blob | null;
    weightKg: number | null;
    minAge: number | null;
    maxAge: number | null;
    occasionTagIds: string[];
  }) {
    let thumbnailKey: string | null = null;
    if (t.thumbnailBlob) {
      const contentType = t.thumbnailBlob.type || "image/webp";
      const ext = contentType.split("/")[1] || "webp";   // must agree with the signed contentType — R2 signs it
      const { url, key } = await api.getSignedUploadUrl(
        "templates/thumbnails",
        `${crypto.randomUUID()}.${ext}`,
        contentType,
        t.thumbnailBlob.size,   // signed into the URL — R2 rejects a body of any other length
      );
      const put = await fetch(url, { method: "PUT", body: t.thumbnailBlob, headers: { "Content-Type": contentType } });
      if (!put.ok) throw new Error("Thumbnail upload failed — please try again.");
      thumbnailKey = key;
    }

    await api.createTemplate({
      name:             t.name,
      shape:            t.designJson?.shape ?? "round",
      tier_count:       t.tierCount,
      offering:         t.offering,
      design:           t.designJson,
      thumbnail_url:    thumbnailKey,
      min_weight_kg:    t.weightKg,
      min_age:          t.minAge,
      max_age:          t.maxAge,
      occasion_tag_ids: t.occasionTagIds,
    });
  }

  // Legal consent gate — a baker must accept the current ToS/Privacy before using the app.
  // Covers admin-onboarded bakers (who never saw the signup checkbox) + re-consent on a
  // version bump. pendingConsents is [] until the docs are published, so this stays dormant
  // pre-launch. Recording happens here (source 'gate'); self-signup records at signup time.
  if (pendingConsents.length > 0) {
    return (
      <AcceptTerms
        api={api}
        docKeys={pendingConsents}
        onAccepted={() => setPendingConsents([])}
        onSignOut={() => supabase.auth.signOut()}
      />
    );
  }

  // Full baker tool — lands on the designer; Orders (with Send quote) + edit-in-3D
  // live inside it, exactly like the :5173 dev harness. CakeDesigner self-loads
  // baker profile/settings/catalog via the apiClient (orderMode defaults to 'baker').
  return (
    <>
      <CakeDesigner apiClient={api} supabase={supabase} cfAssetsBase={process.env.NEXT_PUBLIC_ASSETS_BASE} onShareStore={(opts?: { justPublished?: boolean }) => setShareStore(opts ?? {})} liveSessionId={liveSessionId} initialLink={initialLink} onSaveTemplate={saveTemplate} legalBase={MARKETING_URL} />
      {/* Asked once shortly after sign-in, then not again for a week. Positions itself (a centred
          card over a scrim) and renders NOTHING when push is unavailable, already granted, or
          already declined — so it is inert for every baker who has answered it. */}
      <EnableNotifications api={api} />
      {baker.slug && (
        <ShareStoreModal
          open={!!shareStore}
          justPublished={!!shareStore?.justPublished}
          onClose={() => setShareStore(null)}
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
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [signupAllowed, setSignupAllowed] = useState(false);

  useEffect(() => {
    // ?signup=1 (the marketing "Get started" CTA) opens straight on the create-
    // account form — people who clicked "Get started" want to sign up, not log in.
    // They can still switch to sign-in from there ("Already have an account?").
    const wantsSignup = new URLSearchParams(window.location.search).get("signup") === "1";
    setSignupAllowed(wantsSignup);
    if (wantsSignup) setMode("signup");
  }, []);

  if (mode === "forgot") {
    return <ForgotPassword supabase={supabase} onBack={() => setMode("login")} />;
  }
  if (mode === "signup" && signupAllowed) {
    return <BakerSignup supabase={supabase} onBack={() => setMode("login")} />;
  }
  return (
    <BakerLogin
      supabase={supabase}
      showSignup={signupAllowed}
      onSignup={() => setMode("signup")}
      onForgot={() => setMode("forgot")}
    />
  );
}

// Shared chrome for the auth screens (sign in / sign up): on-brand grid backdrop,
// vignette, logo, centred panel. Keeps the look in ONE place for both screens.
function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#111111]">
      {/* On-brand grid backdrop (no heavy cake assets) */}
      <div className="absolute inset-0">
        <LoginGrid />
      </div>
      {/* Subtle vignette so the form panel stays legible over the grid */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(17,17,17,0.45)_0%,rgba(17,17,17,0.82)_72%)]" />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Cursive logo — clicking it goes home (the marketing site). */}
        <div className="p-6 md:p-10">
          <a href={MARKETING_URL} aria-label="Go to Spattoo home" className="inline-block">
            <Image src="/Spattoo-cursive.png" alt="Spattoo" width={120} height={43}
              priority className="h-auto w-[120px] [filter:drop-shadow(0_0_16px_rgba(237,234,227,0.22))]" />
          </a>
        </div>

        {/* Panel — centred, the focus of the page */}
        <div className="flex flex-1 items-center justify-center px-5 pb-16">{children}</div>
      </div>
    </div>
  );
}

// Shared field / card / button styling for the auth panels.
const AUTH_FIELD =
  "w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm text-[#edeae3] " +
  "placeholder:text-[#edeae3]/30 outline-none transition focus:border-[#6b8f7e] focus:bg-white/[0.06] focus:ring-2 focus:ring-[#6b8f7e]/25";
const AUTH_CARD =
  "w-full max-w-sm rounded-2xl border border-white/10 bg-[#161616]/70 p-7 shadow-2xl backdrop-blur-md";
const AUTH_BTN =
  "rounded-xl bg-[#6b8f7e] px-4 py-3 text-sm font-bold text-[#0e1a14] transition hover:bg-[#7ba18e] disabled:cursor-not-allowed disabled:opacity-40";

// Indian states + union territories (alphabetical) for the onboarding address dropdown. Fixed
// reference data — a hardcoded list, NOT DB master data (nothing edits it, ~36 entries). The
// stored value is still the state name (text column, unchanged). Revisit only if the address form
// is localised to other countries (then a country-scoped source).
const INDIAN_STATES = [
  "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
  "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
  "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
  "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
];

// Full ISO-3166 country list for the phone-region select (international-ready).
// Names via Intl.DisplayNames; sorted A→Z. Region drives how numbers written
// without a "+<dialcode>" prefix are parsed (see api src/lib/phone.js).
const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const COUNTRY_OPTIONS = getCountries()
  .map((code) => ({ code, calling: getCountryCallingCode(code), name: REGION_NAMES.of(code) || code }))
  .sort((a, b) => a.name.localeCompare(b.name));

// Shared email + password fields with show/hide. Used by BOTH the baker sign-in and the staff
// modal (DRY — one copy, not two). Purely presentational; the parent owns the values.
function CredentialFields({
  email, password, onEmail, onPassword,
}: { email: string; password: string; onEmail: (v: string) => void; onPassword: (v: string) => void }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="mt-4 flex flex-col gap-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Email</span>
        <input type="email" autoComplete="email" placeholder="you@bakery.com" value={email}
          onChange={(e) => onEmail(e.target.value)} className={AUTH_FIELD} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Password</span>
        <div className="relative">
          <input type={showPw ? "text" : "password"} autoComplete="current-password" placeholder="••••••••"
            value={password} onChange={(e) => onPassword(e.target.value)} className={`${AUTH_FIELD} pr-11`} />
          <button type="button" onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#edeae3]/40 transition hover:text-[#edeae3]/80">
            {showPw ? <EyeOff /> : <Eye />}
          </button>
        </div>
      </label>
    </div>
  );
}

// Resend the signup verification link (for a link that expired or never arrived). Shared by the
// post-signup "check your email" screen and the login screen's "email not confirmed" case.
// Supabase rate-limits resends, so we cool down and surface its message verbatim on error.
function ResendVerification({
  supabase, email,
}: { supabase: ReturnType<typeof getSupabase>; email: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    if (!email || state === "sending" || cooldown > 0) return;
    setState("sending");
    setMsg(null);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) { setState("error"); setMsg(error.message); }
    else { setState("sent"); setCooldown(60); }
  }

  return (
    <div className="mt-4 text-sm">
      <button type="button" onClick={resend} disabled={!email || state === "sending" || cooldown > 0}
        className="font-semibold text-[#a8c5b5] transition hover:underline disabled:opacity-50 disabled:no-underline">
        {state === "sending" ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
      </button>
      {state === "sent"  && <p className="mt-1 text-[#edeae3]/45">A new link is on its way — check your inbox.</p>}
      {state === "error" && <p className="mt-1 text-[#e0b877]">{msg ?? "Couldn't resend just now — please try again shortly."}</p>}
    </div>
  );
}

function BakerLogin({
  supabase, showSignup, onSignup, onForgot,
}: { supabase: ReturnType<typeof getSupabase>; showSignup?: boolean; onSignup?: () => void; onForgot?: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => ss.get(LS_LOGIN_NOTICE));
  const [showStaff, setShowStaff] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [linkExpired, setLinkExpired] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaHandle>(null);

  useEffect(() => {
    ss.del(LS_LOGIN_NOTICE);                            // one-shot notice: shown once, then cleared
    // Supabase redirects an expired/invalid verification link back here with an error hash
    // (#error=access_denied&error_code=otp_expired…). Surface it + reveal the resend option, then
    // strip the hash so a refresh doesn't re-trigger. NOTE: an expired link and an already-USED
    // (already-verified) link both return otp_expired — indistinguishable here — so the copy
    // self-selects (resend if unverified / sign in if verified) with sign-in as the primary action.
    if (/error_code=otp_expired|error=access_denied/.test(window.location.hash || "")) {
      setLinkExpired(true);
      setUnconfirmed(true);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, []);

  // The baker door routes by the SERVER-resolved role, so clear any stale path first (e.g. a
  // 'baker' retry left by a rejected staff attempt) — no client-selected mode here. The staff
  // modal is the ONLY place that sets LS_LOGIN_MODE='staff' (strict staff enforcement).
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setUnconfirmed(false);
    ss.del(LS_LOGIN_MODE);
    // captchaToken flows to Supabase only when captcha is configured; it's ignored until the
    // Supabase dashboard toggle is on, and undefined when no widget is present (no behaviour change).
    const { error } = await supabase.auth.signInWithPassword({
      email, password,
      options: { captchaToken: captchaToken ?? undefined },
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
      // Turnstile tokens are single-use — reset so a retry gets a fresh one.
      captchaRef.current?.reset();
      setCaptchaToken(null);
      // Unconfirmed email (expired / never-clicked link) → offer a resend inline.
      if (/not confirmed|confirm your email/i.test(error.message)) setUnconfirmed(true);
    }
    // On success the component unmounts (auth state change) → BakerApp routes by role.
  }

  return (
    <AuthShell>
      <form onSubmit={signIn} className={AUTH_CARD}>
        <h1 className="text-2xl font-bold text-[#edeae3]">Sign in to continue</h1>

        {notice && <p className="mt-4 text-sm font-semibold text-[#e0b877]">{notice}</p>}
        {linkExpired && (
          <p className="mt-4 text-sm text-[#e0b877]">
            This verification link is invalid or has expired. Not verified yet? Enter your email
            below and resend it. Already verified — just sign in.
          </p>
        )}

        <CredentialFields email={email} password={password} onEmail={setEmail} onPassword={setPassword} />

        {err && <p className="mt-4 text-sm font-semibold text-[#ef9a9a]">{err}</p>}
        {unconfirmed && <ResendVerification supabase={supabase} email={email} />}

        <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} className="mt-4" />

        <button type="submit"
          disabled={busy || !email || !password || (captchaConfigured && !captchaToken)}
          className={`${AUTH_BTN} mt-4`}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button type="button" onClick={onForgot}
          className="mt-3 block w-full text-center text-sm font-medium text-[#edeae3]/45 transition hover:text-[#edeae3]/80 hover:underline">
          Forgot password?
        </button>

        <div className="mt-6 flex items-center justify-between text-sm">
          {showSignup ? (
            <button type="button" onClick={onSignup} className="font-semibold text-[#a8c5b5] hover:underline">
              Create an account
            </button>
          ) : <span />}
          <button type="button" onClick={() => setShowStaff(true)}
            className="font-medium text-[#edeae3]/45 transition hover:text-[#edeae3]/80 hover:underline">
            Staff login
          </button>
        </div>
      </form>

      {showStaff && <StaffLoginModal supabase={supabase}
        onClose={() => setShowStaff(false)}
        onForgot={() => { setShowStaff(false); onForgot?.(); }} />}
    </AuthShell>
  );
}

// Staff sign-in as a distinct popup so it reads as a separate door. Sets LS_LOGIN_MODE='staff'
// so BakerApp strictly validates the staff role (and rejects owner credentials used here). No
// "create account" — staff are invited by their bakery, they don't self-sign-up.
function StaffLoginModal({
  supabase, onClose, onForgot,
}: { supabase: ReturnType<typeof getSupabase>; onClose: () => void; onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaHandle>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    ss.set(LS_LOGIN_MODE, "staff");                    // BakerApp's profile effect validates the staff role
    const { error } = await supabase.auth.signInWithPassword({
      email, password,
      options: { captchaToken: captchaToken ?? undefined },
    });
    if (error) {
      setErr(error.message); setBusy(false); ss.del(LS_LOGIN_MODE);
      captchaRef.current?.reset(); setCaptchaToken(null);  // single-use token — fresh one for retry
    }
    // On success the component unmounts → BakerApp validates the staff path.
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#141414] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#edeae3]">Staff login</h2>
            <p className="mt-1 text-sm text-[#edeae3]/45">Sign in with the login your bakery gave you.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-1.5 text-[#edeae3]/40 transition hover:text-[#edeae3]/80">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form onSubmit={signIn}>
          <CredentialFields email={email} password={password} onEmail={setEmail} onPassword={setPassword} />

          {err && <p className="mt-4 text-sm font-semibold text-[#ef9a9a]">{err}</p>}

          <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} className="mt-4" />

          <button type="submit"
            disabled={busy || !email || !password || (captchaConfigured && !captchaToken)}
            className={`${AUTH_BTN} mt-4`}>
            {busy ? "Signing in…" : "Staff sign in"}
          </button>

          <button type="button" onClick={onForgot}
            className="mt-3 block w-full text-center text-sm font-medium text-[#edeae3]/45 transition hover:text-[#edeae3]/80 hover:underline">
            Forgot password?
          </button>
        </form>
      </div>
    </div>
  );
}

// Shared "set a new password" card — password + confirm, live policy checklist, show/hide, and
// a submit gated on isPasswordValid. DRY: used by BOTH staff activation and the forgot-password
// reset, which are the same form with different copy + submit action (never a second copy).
// onSubmit returns an error message to show, or null on success (the parent then advances).
function PasswordSetCard({
  title, subtitle, cta, busyCta, onSubmit, secondaryLabel, onSecondary,
}: {
  title: string;
  subtitle: React.ReactNode;
  cta: string;
  busyCta: string;
  onSubmit: (password: string) => Promise<string | null>;
  secondaryLabel: string;
  onSecondary: () => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = !busy && isPasswordValid(password) && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const message = await onSubmit(password);
    // On success the parent unmounts/advances; keep busy so the button stays disabled meanwhile.
    if (message) { setErr(message); setBusy(false); }
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className={AUTH_CARD}>
        <h1 className="text-2xl font-bold text-[#edeae3]">{title}</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#edeae3]/45">{subtitle}</p>

        <div className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">New password</span>
            <div className="relative">
              <input type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="Create a password"
                value={password} onChange={(e) => setPassword(e.target.value)} className={`${AUTH_FIELD} pr-11`} />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#edeae3]/40 transition hover:text-[#edeae3]/80">
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <PasswordChecklist password={password} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Confirm password</span>
            <input type="password" autoComplete="new-password" placeholder="Re-enter password"
              value={confirm} onChange={(e) => setConfirm(e.target.value)}
              className={`${AUTH_FIELD} ${mismatch ? "border-[#ef9a9a]/60 focus:border-[#ef9a9a] focus:ring-[#ef9a9a]/25" : ""}`} />
            {mismatch && <p className="mt-1.5 text-xs font-semibold text-[#ef9a9a]">Passwords do not match.</p>}
          </label>

          {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}

          <button type="submit" disabled={!canSubmit} className={`${AUTH_BTN} mt-1`}>
            {busy ? busyCta : cta}
          </button>
        </div>

        <div className="mt-6 text-sm">
          <button type="button" onClick={onSecondary} className="font-semibold text-[#edeae3]/45 transition hover:text-[#edeae3]/80">
            {secondaryLabel}
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

// Invited staff set their password here on first entry (they have a session but no
// password). Clears must_set_password in the same update, so the app gate opens.
function SetStaffPassword({
  supabase, email, onSignOut,
}: { supabase: ReturnType<typeof getSupabase>; email: string; onSignOut: () => void }) {
  return (
    <PasswordSetCard
      title="Set your password"
      subtitle={<>Welcome! Choose a password for <b className="text-[#edeae3]/70">{email}</b> to finish activating your staff account.</>}
      cta="Set password & continue" busyCta="Saving…"
      // Set the password AND clear the gate flag atomically. USER_UPDATED → session refresh →
      // the must_set_password gate in BakerApp recomputes to false → app opens.
      onSubmit={async (password) => {
        const { error } = await supabase.auth.updateUser({ password, data: { must_set_password: false } });
        return error?.message ?? null;
      }}
      secondaryLabel="Sign out" onSecondary={onSignOut}
    />
  );
}

// Forgot-password step 1: request a reset link. The confirmation is neutral whether or not the
// email maps to an account — Supabase resetPasswordForEmail doesn't error on unknown emails, so
// we don't leak account existence. The link returns to THIS origin, where BakerApp's
// PASSWORD_RECOVERY handler shows ResetPassword.
function ForgotPassword({
  supabase, onBack,
}: { supabase: ReturnType<typeof getSupabase>; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaHandle>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    // redirectTo must be allow-listed in Supabase Auth → URL Configuration → Redirect URLs
    // (same origin as the signup verification link).
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
      captchaToken: captchaToken ?? undefined,
    });
    if (error) {
      setErr(error.message); setBusy(false);
      captchaRef.current?.reset(); setCaptchaToken(null);  // single-use token — fresh one for retry
      return;
    }
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <AuthShell>
        <div className={AUTH_CARD}>
          <h1 className="text-2xl font-bold text-[#edeae3]">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#edeae3]/55">
            If an account exists for <b className="text-[#edeae3]/80">{email}</b>, we&apos;ve sent a
            password-reset link. Open it on this device to choose a new password.
          </p>
          <button type="button" onClick={onBack} className={`${AUTH_BTN} mt-5 w-full`}>Back to sign in</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={submit} className={AUTH_CARD}>
        <h1 className="text-2xl font-bold text-[#edeae3]">Reset your password</h1>
        <p className="mt-1 text-sm text-[#edeae3]/45">Enter your email and we&apos;ll send you a link to set a new one.</p>

        <div className="mt-6 flex flex-col gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Email</span>
            <input type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className={AUTH_FIELD} />
          </label>

          {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}

          <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

          <button type="submit"
            disabled={busy || !email || (captchaConfigured && !captchaToken)}
            className={`${AUTH_BTN} mt-1`}>
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </div>

        <div className="mt-6 text-sm">
          <button type="button" onClick={onBack} className="font-semibold text-[#a8c5b5] hover:underline">
            Back to sign in
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

// Forgot-password step 2: the completion screen. BakerApp renders this when Supabase fires
// PASSWORD_RECOVERY (the user arrived via the reset link, so they hold a short-lived recovery
// session). Sets the new password on that session; onDone then lets BakerApp route into the app.
function ResetPassword({
  supabase, email, onDone, onCancel,
}: { supabase: ReturnType<typeof getSupabase>; email: string; onDone: () => void; onCancel: () => void }) {
  return (
    <PasswordSetCard
      title="Set a new password"
      subtitle={<>Choose a new password for <b className="text-[#edeae3]/70">{email}</b>.</>}
      cta="Update password" busyCta="Updating…"
      onSubmit={async (password) => {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) return error.message;
        onDone();
        return null;
      }}
      secondaryLabel="Cancel" onSecondary={onCancel}
    />
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneCountry, setPhoneCountry] = useState("IN");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [agreed, setAgreed] = useState(false);   // ToS + Privacy — clear affirmative action (DPDP)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<CaptchaHandle>(null);

  // Mismatch surfaces only once they've started typing the confirmation.
  const mismatch = confirm.length > 0 && password !== confirm;
  // Phone must be a valid number for the chosen region. Error surfaces only once
  // they've typed something (like the password mismatch). Server re-validates +
  // enforces one-phone-per-baker.
  const phoneValid = phone.trim().length > 0 && isValidPhoneNumber(phone.trim(), phoneCountry as CountryCode);
  const phoneInvalid = phone.trim().length > 0 && !phoneValid;
  const canSubmit = !busy && firstName.trim() && lastName.trim() && phoneValid
    && email && isPasswordValid(password) && password === confirm && agreed
    && (!captchaConfigured || !!captchaToken);

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setErr("Passwords do not match."); return; }
    setBusy(true);
    setErr(null);

    // Reject a phone that already belongs to a baker BEFORE creating the account +
    // confirm email. UX guard only — /api/bakers/self + the DB unique index are the
    // authoritative backstops. Network failure falls through to signUp (backstop covers it).
    try {
      const r = await fetch(`${API_BASE}/api/bakers/phone-available?phone=${encodeURIComponent(phone.trim())}&country=${phoneCountry}`);
      const j = await r.json();
      if (j && j.available === false) {
        setErr(j.reason === "invalid"
          ? "Enter a valid phone number."
          : "This phone number is already registered. Please sign in instead.");
        setBusy(false);
        return;
      }
    } catch { /* ignore — the server-side check still rejects at brand setup */ }

    // Send the verification link back to THIS origin (app.spattoo.dev in dev,
    // app.spattoo.com in prod, localhost locally) so the confirmed user lands on
    // the app and flows straight into brand setup. The origin must be allow-listed
    // in Supabase Auth → URL Configuration → Redirect URLs.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // role:"baker" in user_metadata lets the shared "Confirm sign up" email
      // template branch: bakers get a verification LINK, customers (storefront
      // OTP login) keep their sign-in CODE. Both flows share one Supabase project.
      // first_name/last_name/phone are stored here so they survive the email-
      // verification gap and become the primary baker_appusers row at brand setup.
      options: {
        emailRedirectTo: window.location.origin,
        captchaToken: captchaToken ?? undefined,
        data: {
          role: "baker",
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim(),
          phone_country: phoneCountry,
          // Affirmative agreement captured at signup. The consent EVENT is recorded once
          // the user is authed with a baker (SetupBaker → recordConsent, source 'signup');
          // this flag is a durable marker of the tick for audit.
          terms_agreed: true,
        },
      },
    });
    if (error) {
      setErr(error.message); setBusy(false);
      captchaRef.current?.reset(); setCaptchaToken(null);  // single-use token — fresh one for retry
      return;
    }
    // If email confirmation is ON, there's no session yet → tell them to verify.
    // If OFF, the auth state change logs them in and BakerApp routes to setup.
    if (!data.session) setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <AuthShell>
        <div className={AUTH_CARD}>
          <h1 className="text-2xl font-bold text-[#edeae3]">Check your email</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#edeae3]/55">
            We sent a verification link to <b className="text-[#edeae3]/80">{email}</b>. Confirm it
            to finish setting up your brand — if the link expires before you get to it, just resend
            it below. (Opened it on another device? Just sign in here.)
          </p>
          <ResendVerification supabase={supabase} email={email} />
          <button type="button" onClick={onBack} className={`${AUTH_BTN} mt-5 w-full`}>Back to sign in</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <form onSubmit={signUp} className={AUTH_CARD}>
        <h1 className="text-2xl font-bold text-[#edeae3]">Create your baker account</h1>
        <p className="mt-1 text-sm text-[#edeae3]/45">Start your free Spark trial.</p>

        <div className="mt-6 flex flex-col gap-4">
          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">First name</span>
              <input autoComplete="given-name" value={firstName}
                onChange={(e) => setFirstName(e.target.value)} className={AUTH_FIELD} />
            </label>
            <label className="block flex-1">
              <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Last name</span>
              <input autoComplete="family-name" value={lastName}
                onChange={(e) => setLastName(e.target.value)} className={AUTH_FIELD} />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="block w-2/5 shrink-0">
              <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Country</span>
              <select value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value)}
                className={AUTH_FIELD}>
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code} className="bg-[#161616]">{c.name} (+{c.calling})</option>
                ))}
              </select>
            </label>
            <label className="block flex-1">
              <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Phone</span>
              <input type="tel" autoComplete="tel" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`${AUTH_FIELD} ${phoneInvalid ? "border-[#ef9a9a]/60 focus:border-[#ef9a9a] focus:ring-[#ef9a9a]/25" : ""}`} />
            </label>
          </div>
          {phoneInvalid && <p className="-mt-2 text-xs font-semibold text-[#ef9a9a]">Enter a valid phone number.</p>}

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Email</span>
            <input type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} className={AUTH_FIELD} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Password</span>
            <div className="relative">
              <input type={showPw ? "text" : "password"} autoComplete="new-password" placeholder="Create a password"
                value={password} onChange={(e) => setPassword(e.target.value)} className={`${AUTH_FIELD} pr-11`} />
              <button type="button" onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#edeae3]/40 transition hover:text-[#edeae3]/80">
                {showPw ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <PasswordChecklist password={password} />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Confirm password</span>
            <div className="relative">
              <input type={showConfirm ? "text" : "password"} autoComplete="new-password" placeholder="Re-enter password"
                value={confirm} onChange={(e) => setConfirm(e.target.value)}
                className={`${AUTH_FIELD} pr-11 ${mismatch ? "border-[#ef9a9a]/60 focus:border-[#ef9a9a] focus:ring-[#ef9a9a]/25" : ""}`} />
              <button type="button" onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-[#edeae3]/40 transition hover:text-[#edeae3]/80">
                {showConfirm ? <EyeOff /> : <Eye />}
              </button>
            </div>
            {mismatch && <p className="mt-1.5 text-xs font-semibold text-[#ef9a9a]">Passwords do not match.</p>}
          </label>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#6b8f7e]" />
            <span className="text-xs leading-relaxed text-[#edeae3]/60">
              I agree to Spattoo&apos;s{" "}
              <a href={`${MARKETING_URL}/terms`} target="_blank" rel="noopener noreferrer"
                className="font-semibold text-[#a8c5b5] hover:underline">Terms of Service</a>{" "}and{" "}
              <a href={`${MARKETING_URL}/privacy`} target="_blank" rel="noopener noreferrer"
                className="font-semibold text-[#a8c5b5] hover:underline">Privacy Policy</a>.
            </span>
          </label>

          {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}

          <Captcha ref={captchaRef} onVerify={setCaptchaToken} onExpire={() => setCaptchaToken(null)} />

          <button type="submit" disabled={!canSubmit}
            className={`${AUTH_BTN} mt-1`}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>

        <div className="mt-6 text-sm">
          <button type="button" onClick={onBack} className="font-semibold text-[#a8c5b5] hover:underline">
            Already have an account? Sign in
          </button>
        </div>
      </form>
    </AuthShell>
  );
}

// docKey → display label + public marketing path. Keys match the api's LEGAL_DOC_KEYS /
// marketing lib/legal.ts docKey. Only tos/privacy are ever gated; the map covers all four
// for safety if the server ever returns another.
const LEGAL_DOC_LABELS: Record<string, { label: string; path: string }> = {
  tos:       { label: "Terms of Service", path: "/terms" },
  privacy:   { label: "Privacy Policy", path: "/privacy" },
  refund:    { label: "Refund & Cancellation Policy", path: "/refund" },
  grievance: { label: "Grievance & Contact", path: "/grievance" },
};

// First-login / re-consent gate. Full-screen, blocks the app until the baker accepts the
// current version of the pending documents. Single UNTICKED checkbox (clear affirmative
// action — DPDP), records ONE consent event per doc server-side. Mirrors the SetStaffPassword
// gate's placement in the ladder.
function AcceptTerms({
  api, docKeys, onAccepted, onSignOut,
}: {
  api: ReturnType<typeof makeBakerApiClient>;
  docKeys: string[];
  onAccepted: () => void;
  onSignOut: () => void;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const docs = docKeys.map((k) => LEGAL_DOC_LABELS[k]).filter(Boolean);

  async function accept() {
    if (!agreed || busy) return;
    setBusy(true); setErr(null);
    try {
      await api.recordConsent(docKeys, "gate");
      onAccepted();
    } catch (e) {
      setErr((e as { message?: string })?.message ?? "Could not save your response. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <div className={AUTH_CARD}>
        <h1 className="text-2xl font-bold text-[#edeae3]">Before you continue</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#edeae3]/55">
          Please review and accept the terms that govern your use of Spattoo to continue.
        </p>

        <label className="mt-6 flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[#6b8f7e]" />
          <span className="text-sm leading-relaxed text-[#edeae3]/70">
            I agree to Spattoo&apos;s{" "}
            {docs.map((d, i) => (
              <span key={d.path}>
                <a href={`${MARKETING_URL}${d.path}`} target="_blank" rel="noopener noreferrer"
                  className="font-semibold text-[#a8c5b5] hover:underline">{d.label}</a>
                {i < docs.length - 2 ? ", " : i === docs.length - 2 ? " and " : ""}
              </span>
            ))}.
          </span>
        </label>

        {err && <p className="mt-4 text-sm font-semibold text-[#ef9a9a]">{err}</p>}

        <button type="button" disabled={!agreed || busy} onClick={accept} className={`${AUTH_BTN} mt-6 w-full`}>
          {busy ? "Saving…" : "Agree and continue"}
        </button>

        <div className="mt-5 text-sm">
          <button type="button" onClick={onSignOut} className="font-semibold text-[#a8c5b5] hover:underline">
            Sign out
          </button>
        </div>
      </div>
    </AuthShell>
  );
}

// Post-signup shop setup: a logged-in user with no baker yet provides their name +
// business + storefront address; we provision them on the free Spark tier via
// POST /api/bakers/self. No payment involved.
// Signup always starts a baker on Spark (free); paid upgrades happen later in Settings →
// Billing (Razorpay Checkout). So onboarding shows NO plan picker — just a "start free,
// decide later" message. The full plan catalog lives in the DB and is shown in Billing.

// Post-signup brand wizard. Name + phone were already collected at signup (in auth
// metadata); here the baker names their bakery (step 1 creates the baker), picks a
// plan (step 2, no charge), and — ONLY if the plan includes a storefront — adds a
// logo (step 3) then storefront details (step 4). Logo/storefront steps are
// skippable. The slug is generated server-side, so there's no slug UI.
function SetupBaker({
  api, email, onDone, onSignOut,
}: {
  api: ReturnType<typeof makeBakerApiClient>;
  email: string;
  onDone: () => void;
  onSignOut: () => void;
}) {
  type Step = "basics" | "address" | "plan" | "logo" | "extras";
  const [step, setStep] = useState<Step>("basics");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("India");
  const [instagram, setInstagram] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#6b8f7e");
  const [accentColor, setAccentColor] = useState("#000000");

  // Everyone (incl. Spark) goes name → address → logo → branding → start. Storefront +
  // branding are all-tiers now, so brand setup is part of EVERY signup; the logo and the
  // colours/Instagram steps are OPTIONAL (each has a "Skip for now").
  const steps: Step[] = ["basics", "address", "logo", "extras", "plan"];
  const stepIndex = steps.indexOf(step);

  const fail = (e: unknown) => {
    setErr((e as { message?: string })?.message ?? "Something went wrong");
    setBusy(false);
  };

  // Step 1 — create the baker (server generates the slug + writes the primary user).
  // Phone (captured at signup, in user_metadata) is validated + checked for the
  // one-phone-per-baker rule server-side here — the first point we can. A conflict
  // isn't fixable in this step (phone lives on the signup screen), so we route the
  // user to sign out and re-register with a different number.
  async function createBaker(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      await api.createBakerSelf({ name: name.trim() });
      // Record the agreement ticked at signup, now that the baker exists and the user is
      // authed (source 'signup'). Best-effort: never block onboarding — if it fails, the
      // first-login gate is the backstop. No-op server-side until the docs are published.
      api.recordConsent(["tos", "privacy"], "signup").catch(() => {});
      setBusy(false);
      setStep("address");
    } catch (e2) {
      if ((e2 as { code?: string })?.code === "phone_taken") {
        setErr("This phone number is already registered to another bakery. Sign out and sign up again with a different number.");
        setBusy(false);
        return;
      }
      fail(e2);
    }
  }

  function pickLogo(f: File | null) {
    setLogoFile(f);
    setLogoPreview(f ? URL.createObjectURL(f) : null);
    // Suggest brand colours from the logo — the two most dominant, perceptually distinct colours —
    // pre-filling the primary/accent pickers shown on the NEXT (branding) step. Only fills a picker
    // still at its default, so re-picking a logo never clobbers a colour the baker hand-changed.
    // Best-effort: a greyscale/undecodable logo returns null and the defaults stand. Still editable.
    if (f) {
      extractLogoPalette(f).then((p) => {
        if (!p) return;
        const { primary, accent } = p;
        if (primary) setPrimaryColor((cur) => (cur === "#6b8f7e" ? primary : cur));
        if (accent)  setAccentColor((cur) => (cur === "#000000" ? accent : cur));
      });
    }
  }

  // Step 3 — optional logo upload (R2 → logo_url), then storefront details.
  async function saveLogo(skip: boolean) {
    setErr(null);
    if (skip || !logoFile) { setStep("extras"); return; }
    setBusy(true);
    try {
      const ext = (logoFile.name.split(".").pop() || "png").toLowerCase();
      const contentType = logoFile.type || "image/png";
      const { url, key } = await api.getSignedUploadUrl("logos", `${crypto.randomUUID()}.${ext}`, contentType, logoFile.size);
      const put = await fetch(url, { method: "PUT", body: logoFile, headers: { "Content-Type": contentType } });
      if (!put.ok) throw new Error("Logo upload failed — please try again.");
      await api.updateBakerProfile({ logo_url: key });
      setBusy(false);
      setStep("extras");
    } catch (e2) { fail(e2); }
  }

  // Address is REQUIRED and captured for EVERY baker (incl. Spark) — billing/invoices
  // need it, and it drives area-wise subscription stats (line 2 + street optional).
  const addressValid = !!(line1.trim() && city.trim() && stateRegion.trim() && postalCode.trim() && country.trim());

  // Step 2 — save the address (all bakers), then on to the (optional) logo step.
  async function saveAddress() {
    if (!addressValid) return;
    setBusy(true); setErr(null);
    try {
      const addr: Record<string, string> = {
        address_line1: line1, address_line2: line2, street, city,
        state: stateRegion, postal_code: postalCode, country,
      };
      const payload: Record<string, string> = {};
      for (const [k, v] of Object.entries(addr)) if (v.trim()) payload[k] = v.trim();
      await api.updateBakerProfile(payload);
      setBusy(false);
      setStep("logo");
    } catch (e2) { fail(e2); }
  }

  // Branding step (ALL tiers — storefront + branding are all-tiers) — optional colours +
  // Instagram. Skipping or saving lands on the final "all set" screen (never the studio
  // directly), so the flow always ends the same way.
  async function finish(skip: boolean) {
    setErr(null);
    if (skip) { setStep("plan"); return; }
    setBusy(true);
    try {
      const payload: Record<string, string> = { primary_color: primaryColor, accent_color: accentColor };
      if (instagram.trim()) payload.instagram_handle = instagram.trim().replace(/^@/, "");
      await api.updateBakerProfile(payload);
      setBusy(false);
      setStep("plan");
    } catch (e2) { fail(e2); }
  }

  const skipLink = "text-sm font-semibold text-[#edeae3]/45 transition hover:text-[#edeae3]/80 disabled:opacity-40";

  return (
    <AuthShell>
      <div className={AUTH_CARD}>
        {/* Sign out — a subtle escape hatch, top-right (not competing with the step's primary CTA) */}
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={onSignOut}
            className="text-xs font-medium text-[#edeae3]/40 transition hover:text-[#edeae3]/80">
            Sign out
          </button>
        </div>
        {/* Progress */}
        <div className="mb-5 flex items-center gap-1.5">
          {steps.map((s, i) => (
            <span key={s} className="h-1 flex-1 rounded-full transition-all"
              style={{ backgroundColor: i <= stepIndex ? "#6b8f7e" : "rgba(237,234,227,0.15)" }} />
          ))}
        </div>

        {step === "basics" && (
          <form onSubmit={createBaker}>
            <h1 className="text-2xl font-bold text-[#edeae3]">Name your bakery</h1>
            <p className="mt-1 text-sm leading-relaxed text-[#edeae3]/45">
              Signed in as <b className="text-[#edeae3]/70">{email}</b>. That&apos;s all we need to get you started.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <input className={AUTH_FIELD} placeholder="Bakery name" value={name} autoFocus
                onChange={(e) => setName(e.target.value)} />
              {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}
              <button type="submit" disabled={busy || !name.trim()} className={`${AUTH_BTN} mt-1`}>
                {busy ? "Creating…" : "Continue"}
              </button>
              <button type="button" onClick={onSignOut}
                className="text-sm font-semibold text-[#edeae3]/45 transition hover:text-[#edeae3]/80">
                Not you? Sign out
              </button>
            </div>
          </form>
        )}

        {step === "address" && (
          <div>
            <h1 className="text-2xl font-bold text-[#edeae3]">Your business address</h1>
            <p className="mt-1 text-sm leading-relaxed text-[#edeae3]/45">
              Required for billing &amp; invoices. Line 2 and street are optional.
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <input className={AUTH_FIELD} placeholder="Address line 1" value={line1} autoFocus
                onChange={(e) => setLine1(e.target.value)} />
              <input className={AUTH_FIELD} placeholder="Address line 2 (optional)" value={line2}
                onChange={(e) => setLine2(e.target.value)} />
              <input className={AUTH_FIELD} placeholder="Street (optional)" value={street}
                onChange={(e) => setStreet(e.target.value)} />
              <div className="flex gap-2">
                <input className={AUTH_FIELD} placeholder="City" value={city}
                  onChange={(e) => setCity(e.target.value)} />
                <select className={AUTH_FIELD} value={stateRegion} style={{ colorScheme: "dark" }}
                  onChange={(e) => setStateRegion(e.target.value)}>
                  <option value="" disabled>State</option>
                  {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <input className={AUTH_FIELD} placeholder="Postal code" value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)} />
                <input className={AUTH_FIELD} placeholder="Country" value={country}
                  onChange={(e) => setCountry(e.target.value)} />
              </div>
              {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}
              <button type="button" onClick={saveAddress} disabled={busy || !addressValid} className={`${AUTH_BTN} mt-2`}>
                {busy ? "Saving…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {step === "plan" && (
          <div>
            <h1 className="text-2xl font-bold text-[#edeae3]">You&apos;re all set</h1>
            <p className="mt-2 text-sm leading-relaxed text-[#edeae3]/55">
              You&apos;re starting on <b className="text-[#edeae3]/80">Spark — free for a month</b>. Explore the
              full 3D designer and start taking orders, then decide. When you want a public storefront and
              unlimited orders, upgrade anytime from <b className="text-[#edeae3]/80">Billing</b>.
            </p>
            {err && <p className="mt-3 text-sm font-semibold text-[#ef9a9a]">{err}</p>}
            <button type="button" onClick={() => onDone()} disabled={busy} className={`${AUTH_BTN} mt-6`}>
              Start designing →
            </button>
          </div>
        )}

        {step === "logo" && (
          <div>
            <h1 className="text-2xl font-bold text-[#edeae3]">Add your logo</h1>
            <p className="mt-1 text-sm leading-relaxed text-[#edeae3]/45">
              Shown across your storefront. You can skip and add it later in settings.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.03] py-7 text-center transition hover:border-[#6b8f7e]/60">
                {logoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoPreview} alt="Logo preview" className="h-20 w-20 rounded-lg object-contain" />
                ) : (
                  <span className="text-sm text-[#edeae3]/50">Click to upload (PNG, JPG, SVG)</span>
                )}
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => pickLogo(e.target.files?.[0] ?? null)} />
              </label>
              {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}
              <button type="button" onClick={() => saveLogo(false)} disabled={busy} className={`${AUTH_BTN} mt-1`}>
                {busy ? "Uploading…" : logoFile ? "Upload & continue" : "Continue"}
              </button>
              <button type="button" onClick={() => saveLogo(true)} disabled={busy} className={skipLink}>
                Skip for now
              </button>
            </div>
          </div>
        )}

        {step === "extras" && (
          <div>
            <h1 className="text-2xl font-bold text-[#edeae3]">Storefront branding</h1>
            <p className="mt-1 text-sm leading-relaxed text-[#edeae3]/45">
              Optional finishing touches for your public page — editable later in settings.
            </p>
            <div className="mt-6 flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Instagram</span>
                <input className={AUTH_FIELD} placeholder="@yourbakery" value={instagram}
                  onChange={(e) => setInstagram(e.target.value)} />
              </label>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-[#edeae3]/70">Brand colors</span>
                <div className="flex gap-3">
                  <label className="flex flex-1 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                    <span className="text-sm text-[#edeae3]/70">Primary</span>
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded bg-transparent" />
                  </label>
                  <label className="flex flex-1 items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                    <span className="text-sm text-[#edeae3]/70">Accent</span>
                    <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                      className="h-7 w-10 cursor-pointer rounded bg-transparent" />
                  </label>
                </div>
              </div>
              {err && <p className="text-sm font-semibold text-[#ef9a9a]">{err}</p>}
              <button type="button" onClick={() => finish(false)} disabled={busy} className={`${AUTH_BTN} mt-1`}>
                {busy ? "Saving…" : "Finish & enter studio"}
              </button>
              <button type="button" onClick={() => finish(true)} disabled={busy} className={skipLink}>
                Skip for now
              </button>
            </div>
          </div>
        )}

      </div>
    </AuthShell>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "sans-serif", background: "#111111", color: "rgba(237,234,227,0.5)" }}>
      {children}
    </div>
  );
}

