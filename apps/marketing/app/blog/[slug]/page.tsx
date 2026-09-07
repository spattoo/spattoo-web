import type { Metadata } from "next";
import BlogPostPage from "@/components/BlogPostPage";
import { getPost, visiblePosts } from "@/lib/blog";

export const dynamic = "force-static";

// Only what this deploy may serve gets built: on production a draft has no route at all,
// rather than a route that 404s at request time.
export function generateStaticParams() {
  return visiblePosts().map((p) => ({ slug: p.slug }));
}

// ⚠️ `params` is a PROMISE in this version of Next and must be awaited — it was a plain
// object up to 14. Reading it synchronously is the mistake to avoid here.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Spattoo`,
    description: post.description,
    // A draft that leaks onto a preview URL should still never be indexed.
    robots: post.status === "draft" ? { index: false, follow: false } : undefined,
    // The share card. WhatsApp is the channel this gets sent on, and it reads OG tags
    // only — no OG image means a bare line of text next to a favicon, which is what
    // every link to this site produced before now. `title` here is the ARTICLE title
    // rather than the page title, so a shared link says what the piece is instead of
    // ending on the site name.
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      url: `/blog/${post.slug}`,
      publishedTime: post.date || undefined,
      images: [
        {
          url: "/blog/og-article.jpg",
          width: 1200,
          height: 630,
          alt: "A cake made to look like a leather satchel, cut open to reveal sponge inside",
        },
      ],
    },
  };
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BlogPostPage slug={slug} />;
}
