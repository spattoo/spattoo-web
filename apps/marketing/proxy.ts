import { NextRequest, NextResponse } from "next/server";

// SEO guard for the marketing site. The same build is deployed to both the
// production base domain (spattoo.com) and the dev environment (spattoo.dev),
// so we gate indexing on the request host at the edge: only spattoo.com is
// allowed into search indexes. Every other host — spattoo.dev, Vercel preview
// URLs, localhost — gets X-Robots-Tag: noindex so it stays publicly reachable
// but never ranks and never competes with spattoo.com. Whitelisting prod
// (instead of blacklisting .dev) means any new non-prod host is safe-by-default.
export function proxy(req: NextRequest) {
  const hostname = (req.headers.get("host") ?? "").split(":")[0];
  const res = NextResponse.next();
  const indexable = hostname === "spattoo.com" || hostname.endsWith(".spattoo.com");
  if (!indexable) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  // Skip Next internals, API routes, and files with extensions — only HTML
  // routes need the indexing header.
  matcher: ["/((?!_next|api|.*\\..*).*)"],
};
