"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

// Cloudflare Turnstile widget — the ONE shared captcha for every auth form in this app
// (baker login, staff login, signup, forgot-password). Do NOT copy per-form (INVARIANTS #3):
// each form renders this and reads the token via onVerify.
//
// Enforcement is Supabase-native: when captcha is enabled in the Supabase dashboard, every
// auth endpoint (signInWithPassword / signUp / resetPasswordForEmail / signInWithOtp) requires
// a valid Turnstile token in options.captchaToken, or the call fails. This widget produces that
// token; Supabase verifies it server-side (we hold no secret, write no verification code).
//
// Config-driven / feature-flagged: renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set,
// so with no key configured the whole thing is a no-op (forms behave exactly as before). The
// matching secret key lives ONLY in the Supabase dashboard.

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

// True when a site key is configured — callers gate their submit button on this so an
// unconfigured build never blocks login waiting for a token that will never come.
export const captchaConfigured = !!SITE_KEY;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// Load the Turnstile script exactly once for the whole app (single-use across every widget
// instance / remount). Resolves as soon as window.turnstile is available.
let scriptPromise: Promise<void> | null = null;
function loadTurnstile(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Turnstile failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export type CaptchaHandle = {
  // Turnstile tokens are SINGLE-USE and expire (~5 min). After a failed submit the caller must
  // reset() so the next attempt gets a fresh token (otherwise the retry fails as already-used).
  reset: () => void;
};

export const Captcha = forwardRef<
  CaptchaHandle,
  {
    onVerify: (token: string) => void; // fired with a fresh token when the challenge passes
    onExpire?: () => void; // fired when the token expires or the widget errors — clear it
    className?: string;
    // Every Spattoo auth card is dark, so the widget defaults to the dark Turnstile theme. Pass
    // "light"/"auto" only for a light-background surface.
    theme?: "auto" | "light" | "dark";
  }
>(function Captcha({ onVerify, onExpire, className, theme = "dark" }, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  // Hold callbacks in refs so the render effect can run ONCE — inline parent callbacks must not
  // re-render (and re-mount) the widget on every keystroke.
  const onVerifyRef = useRef(onVerify);
  onVerifyRef.current = onVerify;
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useImperativeHandle(
    ref,
    () => ({
      reset() {
        if (widgetIdRef.current && window.turnstile) window.turnstile.reset(widgetIdRef.current);
      },
    }),
    [],
  );

  useEffect(() => {
    if (!captchaConfigured) return;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          // Stay invisible for the common silent pass — Turnstile only renders the widget when it
          // actually needs the user to solve a challenge. Avoids a confusing "Success!" box sitting
          // above the form before the user has done anything (the token is still obtained either way).
          appearance: "interaction-only",
          callback: (token: string) => onVerifyRef.current(token),
          "expired-callback": () => onExpireRef.current?.(),
          /* ⚠️ THE ERROR CODE WAS BEING THROWN AWAY. Cloudflare's client-side-rendering doc gives the
             signature as `function (errorCode)`, and all three copies of this component took no
             argument — so a captcha that would not pass left a dead widget, a dead button and
             nothing anywhere saying why. `600*` is "bot behaviour detected", `110200` a hostname not
             on the widget's allowlist, `400020` a bad sitekey. Mirror of spattoo-core's
             src/auth/Captcha.jsx, which carries the full note. */
          "error-callback": (errorCode: string) => {
            console.warn(`[captcha] turnstile error ${String(errorCode ?? "") || "(no code)"}`);
            onExpireRef.current?.();
          },
        });
      })
      .catch(() => {
        // Script blocked / offline: leave the widget empty. The caller's submit stays gated on
        // captchaConfigured, so this surfaces as "can't get a token" rather than a silent bypass.
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* widget already gone */
        }
        widgetIdRef.current = null;
      }
    };
  }, [theme]);

  if (!captchaConfigured) return null;
  return <div ref={containerRef} className={className} />;
});
