import type { MetadataRoute } from "next";
import { BASE_DOMAIN, IS_PRODUCTION_SITE } from "@/lib/domain";
import { BLOG_POSTS } from "@/lib/blog";
import { LEGAL_DOCS } from "@/lib/legal";

// sitemap.xml for the marketing site. Served at /sitemap.xml by Next's metadata
// convention and pointed at from robots.ts.
//
// ⚠️ A SITEMAP DOES NOT IMPROVE RANKING, and nothing here should be justified as if it
// did. What it buys is discovery and diagnosis: this site has very few inbound links, so
// there are few trails for a crawler to follow, and handing over the list is faster than
// being found. The larger half is that Search Console can then report which of these URLs
// are indexed and which are not — a question we currently cannot answer at all.
//
// ⚠️ THE LIST IS DERIVED, NEVER HAND-WRITTEN. Every URL comes from the registry that
// already decides whether the page exists: BLOG_POSTS for articles, LEGAL_DOCS for
// policies. A hand-kept list is a second definition of "what pages does this site have",
// and it goes stale the first time someone adds a post — which is exactly the failure a
// sitemap is supposed to prevent.
//
// ⚠️ WHAT IS DELIBERATELY ABSENT:
//   · /linkedin-company, /linkedin-personal, /test — all call guardInternalPage() and
//     return 404 on production. Listing a URL that 404s is worse than omitting it.
//   · draft posts — status "draft" 404s on production and carries robots noindex. It has
//     no business in a sitemap even while it is readable on dev.
export const dynamic = "force-static";

const SITE = `https://www.${BASE_DOMAIN}`;

/* The registry stores a human date ("7 September 2026") because that is what the page
   prints. Date.parse handles that form, but a blank or malformed value must not become
   an Invalid Date in the XML — so anything unparseable simply omits lastModified, which
   is an optional field. */
function published(date: string): Date | undefined {
  if (!date) return undefined;
  const t = Date.parse(date);
  return Number.isNaN(t) ? undefined : new Date(t);
}

export default function sitemap(): MetadataRoute.Sitemap {
  // Non-production hosts are excluded from search entirely (robots.ts disallows all,
  // proxy.ts sets noindex), so publishing a list of dev URLs would contradict both.
  if (!IS_PRODUCTION_SITE) return [];

  const posts = BLOG_POSTS.filter((p) => p.status === "published");

  // Newest article date, so the blog index reports movement when a post lands rather
  // than looking untouched since launch.
  const newestPost = posts
    .map((p) => published(p.date))
    .filter((d): d is Date => Boolean(d))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return [
    {
      url: SITE,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${SITE}/blog`,
      lastModified: newestPost,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...posts.map((p) => ({
      url: `${SITE}/blog/${p.slug}`,
      lastModified: published(p.date),
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
    ...LEGAL_DOCS.map((d) => ({
      url: `${SITE}/${d.slug}`,
      lastModified: published(d.effectiveDate),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
