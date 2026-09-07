import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SiteNav from "./SiteNav";
import SiteFooter from "./SiteFooter";
import { getPost, visiblePosts } from "@/lib/blog";

// Reads an article body at build time. The leading H1 is dropped because the page
// renders its own heading from the registry title — same split as LegalDocPage, so a
// title only ever has one definition.
function loadBody(file: string): string {
  const raw = fs.readFileSync(path.join(process.cwd(), "content/blog", file), "utf8");
  return raw.replace(/^#\s+.*\n+/, "");
}

// Shared renderer for every article under /blog.
export default function BlogPostPage({ slug }: { slug: string }) {
  const post = getPost(slug);

  // A draft is served on dev and 404s on production. Checking against visiblePosts()
  // rather than re-deriving the condition keeps ONE definition of "may this deploy show
  // this post", shared with the index and the nav.
  if (!post || !visiblePosts().some((p) => p.slug === slug)) notFound();

  const body = loadBody(post.file);

  return (
    <main className="min-h-screen bg-[#111111] text-[#edeae3]">
      <SiteNav />

      <article className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        {post.status === "draft" && (
          <div className="mb-8 rounded-lg border border-[#6b8f7e]/40 bg-[#6b8f7e]/10 px-5 py-4 text-sm text-[#a8c5b5]">
            Draft — not published. This page is visible on preview deploys only, and is not
            reachable on spattoo.com. Images and interview quotes are still outstanding.
          </div>
        )}

        <p className="text-xs tracking-[0.35em] uppercase text-[#6b8f7e] mb-3">Blog</p>
        <h1 className="text-3xl md:text-4xl font-bold mb-3 text-[#edeae3] leading-tight">
          {post.title}
        </h1>
        <p className="text-sm text-[#edeae3]/50 mb-10">
          {post.date ? `${post.date} · ` : ""}
          {post.readingMinutes} min read
        </p>

        {/* `.legal-doc` is the site's generic prose style, despite the name — it is the
            markdown body treatment shared by every long-form page. `.blog-doc` rides on
            top of it with the few overrides an article needs — currently just the pull
            quote, which is emphasis here and a dimmed aside on a policy page. Additive,
            not a second copy. */}
        <div className="legal-doc blog-doc">
          <Markdown remarkPlugins={[remarkGfm]}>{body}</Markdown>
        </div>

        <nav className="mt-16 pt-8 border-t border-[#3d5247]/20 text-sm">
          <Link href="/blog" className="text-[#a8c5b5] hover:text-[#edeae3] transition-colors">
            All articles
          </Link>
        </nav>
      </article>

      <SiteFooter />
    </main>
  );
}
