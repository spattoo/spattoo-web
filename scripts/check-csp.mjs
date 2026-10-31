#!/usr/bin/env node
// ── the CSP must know every host the page actually calls ─────────────────────
// A Content-Security-Policy that is missing an origin does not fail loudly. It is report-only here,
// so today the request goes through and a violation is logged where nobody is looking; the day
// CSP_ENFORCE is turned on, the feature simply stops working — and the symptom is a form that does
// nothing, on a page nobody changed.
//
// That already happened: `NEXT_PUBLIC_API_URL` is set on the baker app and NOT on marketing, which
// never called the API until the demo form did. Marketing builds its own API URL from the base
// domain, so connect-src came out as `'self' blob: data: <turnstile>` and every submission logged a
// violation.
//
// Pure — buildCsp reads only the env object it is handed, so this needs no network and no build.
// Run via `npm run check:csp`.
import { buildCsp } from "../shared/securityHeaders.mjs";

let failures = 0;
const ok = (cond, label, extra = "") => {
  if (cond) return;
  failures++;
  console.error(`✗ ${label}${extra ? `  — ${extra}` : ""}`);
};

const csp = (env) => {
  const out = buildCsp({ NODE_ENV: "production", ...env });
  return typeof out === "string" ? out : JSON.stringify(out);
};

// ── marketing: no NEXT_PUBLIC_API_URL, only a base domain ────────────────────
// This is the deploy that broke. The demo form posts to `https://api.${BASE_DOMAIN}`, derived in
// apps/marketing/lib/domain.ts exactly as APP_URL is, so the CSP has to reach the same answer from
// the same input or the two drift apart again the moment either is edited.
{
  const dev = csp({ NEXT_PUBLIC_BASE_DOMAIN: "spattoo.dev" });
  ok(dev.includes("api.spattoo.dev"), "a base-domain-only deploy admits its own API", dev.slice(0, 160));

  const prod = csp({ NEXT_PUBLIC_BASE_DOMAIN: "spattoo.com" });
  ok(prod.includes("api.spattoo.com"), "and does so per environment, not hardcoded to one");
  ok(!prod.includes("api.spattoo.dev"), "a prod deploy does not admit the dev API");
}

// ── the app: an explicit var still wins ──────────────────────────────────────
// The baker app sets NEXT_PUBLIC_API_URL and must be entirely unaffected by the fallback above.
{
  const app = csp({ NEXT_PUBLIC_API_URL: "https://api.spattoo.com" });
  ok(app.includes("api.spattoo.com"), "an explicit API URL is still honoured");

  // Both set and disagreeing: the explicit one is the deliberate statement, so it wins.
  const both = csp({ NEXT_PUBLIC_API_URL: "https://api.example.test", NEXT_PUBLIC_BASE_DOMAIN: "spattoo.com" });
  ok(both.includes("api.example.test"), "an explicit API URL beats the derived one");
}

// ── neither set ──────────────────────────────────────────────────────────────
// Must not invent an origin, and must not throw. A build with no config should produce a policy
// that is merely tight, not one that admits somebody else's host.
{
  const bare = csp({});
  ok(!/api\.(undefined|null)/.test(bare), "no API origin is invented from an unset base domain", bare.slice(0, 160));
}

// ── the captcha's own hosts ──────────────────────────────────────────────────
// The widget loads a script from Cloudflare and renders in an iframe. Miss either and there is no
// widget, no token, and an API that correctly refuses every submission — which reads as a broken
// form rather than a missing directive.
{
  const c = csp({ NEXT_PUBLIC_BASE_DOMAIN: "spattoo.dev" });
  ok(c.includes("challenges.cloudflare.com"), "Turnstile's host is admitted");
  ok(/frame-src[^;]*challenges\.cloudflare\.com/.test(c), "…including frame-src, which the widget needs");
}

// ── the demo video's frame ───────────────────────────────────────────────────
// `components/VideoEmbed.tsx` mounts a youtube-nocookie iframe on the click that asks for it. Miss
// this directive and nothing breaks today — the frame loads and a violation is logged where nobody
// is looking — and the day CSP_ENFORCE is on the video is a blank rectangle on the landing page.
// That is the same shape as the demo form at the top of this file, which is why it is pinned.
//
// The HOST is asserted, not just the word "youtube": the plain youtube.com origin would also
// contain it, and the whole point of the privacy-enhanced host is that it is the other one.
{
  const c = csp({ NEXT_PUBLIC_BASE_DOMAIN: "spattoo.dev" });
  ok(/frame-src[^;]*www\.youtube-nocookie\.com/.test(c), "the demo video's frame host is admitted");
  // The poster is served from /public on purpose, so Google is not called before a visitor presses
  // play. If img-src ever grows a YouTube thumbnail host, that decision has been quietly reversed.
  ok(!/img-src[^;]*ytimg\.com/.test(c), "…and its poster is ours, not a request to Google on every visit");
}

// ── Google Analytics: present when measured, ABSENT when not ─────────────────
// Two failure directions, and the second is the one nobody tests for.
//
// Miss an origin and the tag loads but its beacons are blocked — analytics that
// silently records nothing, which reads as "no traffic" rather than as a bug.
// gtag.js comes from googletagmanager.com even for a pure GA4 id, and the hits
// go to REGION-SHARDED hosts (region1.google-analytics.com), so the wildcards
// are load-bearing rather than defensive.
//
// The other direction matters because of SEC-WEB-7: this policy deliberately
// dropped two Google origins to stop disclosing visitor IPs. A deploy that does
// not measure must not quietly re-admit Google — so the absence is asserted, not
// assumed.
{
  const on = csp({ NEXT_PUBLIC_BASE_DOMAIN: "spattoo.com", NEXT_PUBLIC_GA_ID: "G-TESTID123" });
  ok(/script-src[^;]*googletagmanager\.com/.test(on), "a measured deploy may load gtag.js");
  ok(/connect-src[^;]*www\.google-analytics\.com/.test(on), "…and may send its hits");
  ok(
    /connect-src[^;]*\*\.google-analytics\.com/.test(on),
    "…including to region-sharded hosts, which is where GA4 actually beacons",
  );
  ok(/connect-src[^;]*\*\.analytics\.google\.com/.test(on), "…and the analytics.google.com shards");
  ok(/img-src[^;]*www\.google-analytics\.com/.test(on), "…and the 1x1 pixel fallback");

  const off = csp({ NEXT_PUBLIC_BASE_DOMAIN: "spattoo.com" });
  ok(!/google-analytics\.com/.test(off), "an UNMEASURED deploy admits no analytics origin");
  ok(!/googletagmanager\.com/.test(off), "…and no tag manager origin (SEC-WEB-7 stays closed)");
}

if (failures) {
  console.error(`\n✗ check:csp — ${failures} rule(s) broken.`);
  process.exit(1);
}
console.log("✓ check:csp — every host the page calls is in the policy");
