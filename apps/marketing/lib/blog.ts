// Single source of truth for the marketing site's articles. Mirrors lib/legal.ts on
// purpose: a registry of metadata in TypeScript, bodies as markdown under content/,
// rendered by one shared component. Consumed by app/blog/*, components/BlogPostPage.tsx
// and the "Blog" item in components/SiteNav.tsx + MobileNav.tsx.
//
// This file is imported by CLIENT components (the nav), so it must stay pure data —
// no `fs`. Reading the markdown body belongs in the server component that renders it.

import { IS_PRODUCTION_SITE } from "./domain";

export type PostStatus = "draft" | "published";

export type BlogPost = {
  slug: string;
  title: string;
  // Sentence that sits under the title on the index and in <meta description>.
  description: string;
  file: string; // filename under content/blog/
  status: PostStatus;
  date: string; // human-readable; "" while a post is still draft
  readingMinutes: number;
  // The share card — what WhatsApp, LinkedIn and search results show. OPTIONAL, and it
  // falls back to the generic /blog/og-article.jpg, which is a leather-satchel cake from
  // the first article and says nothing about any other piece. A post worth sharing
  // deserves its own; 1200x630, and the alt text is read aloud, so describe the picture.
  ogImage?: { url: string; alt: string };
};

/** The share card for a post, or the generic one. ONE definition, because the route's
 *  metadata and the Article structured data both need it and must not disagree about
 *  which image this page is. */
export const OG_FALLBACK = {
  url: "/blog/og-article.jpg",
  alt: "A cake made to look like a leather satchel, cut open to reveal sponge inside",
} as const;

export const ogFor = (post: BlogPost): { url: string; alt: string } =>
  post.ogImage ?? OG_FALLBACK;

// ⚠️ STATUS IS NOT COSMETIC — it decides whether the public site serves the post.
//
//   published → visible everywhere.
//   draft     → visible on dev/preview deploys ONLY; 404 on spattoo.com.
//
// This is the same safe-by-default direction as guardInternalPage() in lib/domain.ts:
// production is whitelisted, so anything not explicitly published stays off the public
// site rather than needing to be remembered about. It lets a piece be read and reviewed
// at its real URL, on a phone, in the real layout, before anyone outside can reach it.
export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "indian-cake-design",
    title: "Indian Cake Design: How Culture Becomes Cake",
    description:
      "How Indian bakers turn culture into cake — a Krishna cake with no Krishna on it, mithai flavours that survive the move, and what the work costs to make.",
    file: "indian-cake-design.md",
    // Published 9 October 2026. Rights are clear on the same basis as the first article:
    // all four illustrations are generated rather than licensed, no cake photograph
    // belonging to anyone else appears, and nobody is quoted.
    //
    // ⚠️ Still outstanding, and NOT a blocker — it is the most valuable change left:
    //   · no Indian baker speaks in it. Section 7, on what the work actually costs to
    //     make, is written entirely from the outside. That matters more than it used to:
    //     a language model can produce a competent average of everything already written
    //     about fondant in humidity, so first-hand testimony from a named baker is the
    //     part of this piece that cannot be synthesised — and the part an answer engine
    //     would cite rather than absorb.
    //
    // ⚠️ Section 5 has no illustration ON PURPOSE. It names Prachi Dhabal Deb's
    // record-breaking royal icing palace, and a generated image beside that paragraph
    // would read as a photograph of her actual work. Same rule as the first article's
    // opening. See ~/Downloads/Blogs/image-prompts-indian-cake-design.md.
    status: "published",
    date: "9 October 2026",
    readingMinutes: 13,
    ogImage: {
      url: "/blog/og-indian-cake-design.jpg",
      alt: "A two-tier Indian celebration cake in royal blue and marigold fondant, with a gold flute across the base, sugar peacock feathers, and a terracotta pot tipping butter down the side",
    },
  },
  {
    slug: "cake-design-storytelling",
    title: "How Cake Design Is Becoming a New Form of Storytelling",
    description:
      "Cake design has shifted from marking an occasion to being about a specific person. What changed, and what it asks of the people who make them.",
    file: "cake-design-storytelling.md",
    // Published 7 September 2026, after the rights questions were closed rather than
    // waived. Nothing in the article needs anyone's permission: the illustrations are
    // generated rather than licensed, no cake photograph belonging to a third party
    // appears, nobody is quoted, and the one branded-content source was never cited.
    //
    // ⚠️ Still outstanding, and NOT blockers — they are improvements:
    //   · sections 7 and 8 are about the Indian market and no Indian baker speaks in
    //     them. Quotes are the strongest thing this piece could still gain, and the
    //     outreach material for gathering them is written.
    //   · the miniature-scene illustration is a Tuscan villa. The prompt named no region
    //     so the model defaulted to Mediterranean, and the paragraph beside it says "a
    //     family house". A corrected Indian-courtyard prompt is waiting in
    //     Downloads/Blogs/image-prompts.md.
    status: "published",
    date: "7 September 2026",
    readingMinutes: 8,
  },
];

export const getPost = (slug: string): BlogPost | undefined =>
  BLOG_POSTS.find((p) => p.slug === slug);

// What this DEPLOY may serve. Production sees published posts only; dev and preview see
// drafts too, so a piece can be reviewed at its real URL before it is public.
export const visiblePosts = (): BlogPost[] =>
  BLOG_POSTS.filter((p) => p.status === "published" || !IS_PRODUCTION_SITE);

// Whether the "Blog" nav item should appear at all. A nav link to an empty index is
// worse than no nav link, so the header follows the content rather than the other way
// round: on production the item appears the moment the first post is published, and
// disappears again if there is nothing to show.
export const BLOG_IN_NAV = visiblePosts().length > 0;
