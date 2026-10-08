import type { MetadataRoute } from "next";
import { BASE_DOMAIN, IS_PRODUCTION_SITE } from "@/lib/domain";

// robots.txt for the marketing site. Served at /robots.txt by Next's metadata
// convention — there was no such file before this, on either domain, so every crawler
// got a 404 and had to discover the site purely by following links.
//
// ⚠️ ON ITS OWN THIS BUYS ALMOST NOTHING, and it is worth being clear about that. A
// missing robots.txt is read as "crawl everything", which is what we want anyway. The
// line that justifies the file is `Sitemap:` — it is how a crawler finds the sitemap
// without anyone submitting it anywhere.
//
// ⚠️ THE NON-PRODUCTION BRANCH IS THE PART THAT MATTERS. The same build is deployed to
// spattoo.com and spattoo.dev, so without the gate the dev site would advertise itself
// as crawlable and publish a sitemap of dev URLs. proxy.ts already sets
// `X-Robots-Tag: noindex, nofollow` on every host that is not spattoo.com — but its
// matcher deliberately skips paths with a file extension, so /robots.txt and
// /sitemap.xml are NOT covered by it. This is the second half of that guard, not a
// duplicate of it.
//
// Gated on IS_PRODUCTION_SITE for the same safe-by-default reason it exists: prod is
// whitelisted, so any new non-prod host is excluded without anyone remembering to add
// it. BASE_DOMAIN is inlined at BUILD time, so this is fixed per deploy.
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  if (!IS_PRODUCTION_SITE) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The legal API returns the canonical text of documents already published as
        // HTML pages. Crawling it adds nothing and splits signals across two URLs for
        // the same words.
        disallow: ["/api/"],
      },
    ],
    sitemap: `https://www.${BASE_DOMAIN}/sitemap.xml`,
  };
}
