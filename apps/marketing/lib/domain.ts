// Environment wiring for the marketing site.
// Base domain per deploy (spattoo.dev in dev, spattoo.com in prod); defaults to
// prod so an unset prod build is safe. NEXT_PUBLIC_ so it's inlined client-side.
export const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "spattoo.com";

// The baker app (sign-in) URL on the matching environment.
export const APP_URL = `https://app.${BASE_DOMAIN}`;

// Feature gate for the "Sign in" CTA. Set NEXT_PUBLIC_SHOW_SIGNIN=true on the dev
// marketing project; leave it unset on prod until the prod baker app exists, then
// flip it on — no redeploy juggling, same code everywhere.
export const SHOW_SIGNIN = process.env.NEXT_PUBLIC_SHOW_SIGNIN === "true";
