// Base domain for the current deploy — the single source of truth for both
// subdomain tenant routing (proxy) and every "{slug}.<base>" storefront URL.
// Set per environment (NEXT_PUBLIC_ so it's inlined into client + edge bundles):
//   prod:  NEXT_PUBLIC_BASE_DOMAIN=spattoo.com
//   dev:   NEXT_PUBLIC_BASE_DOMAIN=spattoo.dev   (live: app.spattoo.dev + *.spattoo.dev)
//   local: {slug}.localhost is handled directly in proxy; this default only
//          backs SSR fallbacks / display text when the var is unset.
export const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "spattoo.com";

// Public storefront URL for a baker slug, on the configured base domain.
export function storefrontUrl(slug: string): string {
  return `https://${slug}.${BASE_DOMAIN}`;
}

// Marketing site (canonical = www; the apex 308-redirects to it). Where bakers
// land after signing out. www.spattoo.dev in dev, www.spattoo.com in prod.
export const MARKETING_URL = `https://www.${BASE_DOMAIN}`;
