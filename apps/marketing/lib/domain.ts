import { notFound } from "next/navigation";

// Environment wiring for the marketing site.
// Base domain per deploy (spattoo.dev in dev, spattoo.com in prod); defaults to
// prod so an unset prod build is safe. NEXT_PUBLIC_ so it's inlined client-side.
export const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "spattoo.com";

// The baker app (sign-in) URL on the matching environment.
export const APP_URL = `https://app.${BASE_DOMAIN}`;

// The API, on the matching environment. Derived from BASE_DOMAIN like everything else here, so a
// dev deploy talks to the dev API without a second variable that can be set wrong independently.
//
// The demo form posts here rather than to a route on this site: the API already owns the ONE place
// email is sent and the Redis-backed rate limiter, and the leads database is written SERVER-SIDE
// with a service key. The previous version of that form shipped the leads project's anon key in this
// bundle, which let anyone write rows directly — removed under SEC-WEB-1, and this is how it stays
// removed. Nothing secret belongs in a NEXT_PUBLIC_ value.
export const API_URL = `https://api.${BASE_DOMAIN}`;

// Cloudflare Turnstile's PUBLIC site key. NEXT_PUBLIC_ because the widget needs it in the browser —
// and that is fine: the site key is meant to be seen. The SECRET key that verifies a token lives
// only in the API, and nothing here can produce a valid token without Cloudflare's help.
//
// Unset → the widget renders nothing, matching how the backend treats an unset secret. Both must be
// set for the captcha to actually be enforced.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";

// Feature gate for the baker-app entry CTAs — both "Sign in" and the signup CTAs
// (nav "Get started", hero, pricing). They appear together (the app is live) or not
// at all. Set NEXT_PUBLIC_SHOW_SIGNIN=true on the dev marketing project; leave it
// unset on prod until the prod baker app exists, then flip it on — same code
// everywhere. When off, the conversion CTAs render nothing (we no longer collect
// a pre-launch waitlist), so the marketing site simply shows no signup CTA yet.
export const SHOW_SIGNIN = process.env.NEXT_PUBLIC_SHOW_SIGNIN === "true";

// Baker signup entry — the app reveals its signup screen behind ?signup=1.
export const SIGNUP_URL = `${APP_URL}/?signup=1`;

/* ── Carrying a campaign across to the app ───────────────────────────────────────────────────────
 *
 * WhatsApp campaigns to scraped bakers (spattoo-leads) land here with UTMs, and GA4 counts those
 * landings per campaign for free. What GA4 cannot tell us is the number the campaign is actually
 * being judged on — how many of a 50-lead batch opened a bakery — because signup happens on
 * ANOTHER ORIGIN (app.<domain>) behind an email confirmation and a phone OTP. The tag has to be
 * handed over at the door or it is gone.
 *
 * ⚠️ `c` AND `s`, NOT THE WHOLE UTM SET. Only two things are worth carrying across an origin: which
 * batch, and which channel. Forwarding every utm_* would widen what a stranger can write into our
 * database for nothing — and the API narrows these to a short slug before storing them anyway.
 *
 * ⚠️ NARROWED HERE TOO, rather than trusting the API to be the only guard. This value is about to
 * be put in a URL and then into the browser's own storage; a tag that is not a short lowercase slug
 * is not one we sent, so it is dropped at the first opportunity rather than the last.
 */
const campaignTag = (v: string | null): string | null => {
  const t = (v ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(t) ? t : null;
};

export function signupUrl(search?: string): string {
  // No window on the server, and a static render has no visitor to attribute — the plain URL is
  // the honest answer there, and the client re-renders with the tag when it hydrates.
  const q = search ?? (typeof window === "undefined" ? "" : window.location.search);
  if (!q) return SIGNUP_URL;

  const p = new URLSearchParams(q);
  const campaign = campaignTag(p.get("utm_campaign") ?? p.get("c"));
  const source   = campaignTag(p.get("utm_source") ?? p.get("s"));
  if (!campaign && !source) return SIGNUP_URL;

  const out = new URLSearchParams({ signup: "1" });
  if (campaign) out.set("c", campaign);
  if (source)   out.set("s", source);
  return `${APP_URL}/?${out.toString()}`;
}

// Google Analytics 4 measurement id ("G-XXXXXXXXXX"). NEXT_PUBLIC_ because the tag
// runs in the browser, and that is fine — a measurement id is meant to be seen and
// authorises nothing. Like TURNSTILE_SITE_KEY above, nothing secret belongs here.
//
// UNSET MEANS NO ANALYTICS AT ALL: no script, and no Google origin in the CSP either
// (shared/securityHeaders.mjs gates on this same variable). So local development and
// any deploy that has not opted in stay entirely Google-free, rather than loading a
// tag that reports nowhere.
//
// SET IT PER VERCEL PROJECT, to a DIFFERENT property per environment. Dev and prod
// sharing one property would mix our own test traffic into the numbers we make
// decisions from — and the dev property's real job is to prove the wiring works
// before prod, not to be analysed.
//
// ⚠️ MARKETING ONLY. Neither surface of `apps/app` is measured by Google:
//   · the baker app, because GA answers an ACQUISITION question and that app is
//     entirely post-acquisition — nobody arrives there from a search result. A
//     baker reaches it by signing up, which is the event measured over here.
//   · customer storefronts, which are counted first-party instead (spattoo-api
//     storefront_views) because GA4's ad-blocker undercount and thresholding
//     corrupt exactly the long tail that "is this shop used at all" depends on.
// So the whole of apps/app stays Google-free — a simpler rule to hold than a
// per-route one. See plans/analytics.md.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "";

// True only on the production marketing deploy. Whitelisting prod (rather than
// blacklisting .dev) means any new non-prod host is treated as non-prod by
// default — the same safe-by-default direction `proxy.ts` uses for indexing.
// BASE_DOMAIN falls back to spattoo.com, so an unset build is treated as prod.
export const IS_PRODUCTION_SITE = BASE_DOMAIN === "spattoo.com";

// SEC-WEB-4 — gate for internal/experimental routes that must not be reachable on
// the public production site (asset generators, render test-beds). Call as the
// first statement of the page component; on a production build the route renders
// the 404 instead. Kept as ONE helper so every internal page is gated the same
// way and a new one only has to call this, not re-derive the condition.
// NOTE: BASE_DOMAIN is a NEXT_PUBLIC_* value inlined at BUILD time, so which
// routes exist is fixed per deploy — this is a build-time gate, not a runtime one.
export function guardInternalPage(): void {
  if (IS_PRODUCTION_SITE) notFound();
}
