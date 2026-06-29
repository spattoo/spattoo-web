import { NextRequest, NextResponse } from "next/server";
import { BASE_DOMAIN } from "./lib/domain";

// Host-based routing for the app surface (base domain is env-driven — spattoo.com
// in prod, spattoo.dev in dev — so this same code serves every environment):
//   {slug}.<base>/*  → /[slug]/*   (the baker's customer storefront)
//   app.<base>/*     → /*          (the baker app; 'app' is reserved)
//   {slug}.localhost → /[slug]/*   (local dev; always supported)
//
// Rewriting (not redirecting) keeps the customer on ONE origin through the whole
// journey, so the Supabase session set during login persists. Subdomains other
// than the reserved ones are treated as a baker slug.
const RESERVED = new Set(["www", "app", "api", "admin", "assets"]);

// Only the production base domain (spattoo.com) is allowed into search indexes.
// Every other host — the spattoo.dev dev environment, Vercel preview URLs,
// localhost — gets X-Robots-Tag: noindex so it stays publicly reachable but
// never ranks and never competes with spattoo.com. Whitelisting prod (instead
// of blacklisting .dev) means any new non-prod host is safe-by-default.
function applyRobots(res: NextResponse, hostname: string): NextResponse {
  const indexable = hostname === "spattoo.com" || hostname.endsWith(".spattoo.com");
  if (!indexable) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

function bakerSubdomain(hostname: string): string | null {
  // Try the configured base domain first, then localhost (always on for dev).
  for (const base of [BASE_DOMAIN, "localhost"]) {
    const suffix = `.${base}`;
    if (!hostname.endsWith(suffix)) continue;
    const head = hostname.slice(0, -suffix.length);
    // Require exactly ONE label (no nested dots) so a.b.<base> never silently
    // resolves to "a"; reserved labels (app/www/…) are not bakers.
    if (!head || head.includes(".") || RESERVED.has(head)) return null;
    return head;
  }
  return null;
}

export function proxy(req: NextRequest) {
  const hostname = (req.headers.get("host") ?? "").split(":")[0];
  const slug = bakerSubdomain(hostname);
  if (!slug) return applyRobots(NextResponse.next(), hostname);

  const url = req.nextUrl.clone();
  if (url.pathname === `/${slug}` || url.pathname.startsWith(`/${slug}/`)) {
    return applyRobots(NextResponse.next(), hostname);
  }
  url.pathname = `/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  return applyRobots(NextResponse.rewrite(url), hostname);
}

export const config = {
  // Skip Next internals, API routes, and files with extensions.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
