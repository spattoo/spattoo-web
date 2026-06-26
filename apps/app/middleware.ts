import { NextRequest, NextResponse } from "next/server";

// Host-based routing for the app surface:
//   {slug}.spattoo.com/*  → /[slug]/*   (the baker's customer storefront)
//   app.spattoo.com/*     → /*          (the baker app; 'app' is reserved)
//   localhost/*           → /*          (use /[slug] paths directly in dev)
//
// Rewriting (not redirecting) keeps the customer on ONE origin through the whole
// journey, so the Supabase session set during login persists. Subdomains other
// than the reserved ones are treated as a baker slug.
const RESERVED = new Set(["www", "app", "api", "admin", "assets"]);

function bakerSubdomain(hostname: string): string | null {
  let sub: string | null = null;
  if (hostname.endsWith(".spattoo.com")) sub = hostname.split(".")[0];
  else if (hostname.endsWith(".localhost")) sub = hostname.split(".")[0];
  if (!sub || RESERVED.has(sub)) return null;
  return sub;
}

export function middleware(req: NextRequest) {
  const hostname = (req.headers.get("host") ?? "").split(":")[0];
  const slug = bakerSubdomain(hostname);
  if (!slug) return NextResponse.next();

  const url = req.nextUrl.clone();
  if (url.pathname === `/${slug}` || url.pathname.startsWith(`/${slug}/`)) {
    return NextResponse.next();
  }
  url.pathname = `/${slug}${url.pathname === "/" ? "" : url.pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip Next internals, API routes, and files with extensions.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
