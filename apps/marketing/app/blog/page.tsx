import type { Metadata } from "next";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { visiblePosts } from "@/lib/blog";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Blog — Spattoo",
  description: "Writing about cake design, and what people use cakes to say.",
};

export default function Page() {
  const posts = visiblePosts();

  return (
    <main className="min-h-screen bg-[#111111] text-[#edeae3]">
      <SiteNav />

      <section className="max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* The eyebrow IS the h1. A big "Cake design, written down" title plus a subtitle
            above a single article said the same thing three times before the reader reached
            anything worth reading. Removing it outright would have left the page with no h1
            at all, which costs search ranking and leaves a screen reader without a page
            heading — so the label carries the semantics and stays visually quiet. */}
        <h1 className="text-xs tracking-[0.35em] uppercase text-[#6b8f7e] mb-12">Blog</h1>

        {/* An empty index is reachable only on a preview deploy with nothing to show —
            production hides the nav item entirely in that case. Still handled, because a
            bare heading over blank space reads as a broken page rather than an empty one. */}
        {posts.length === 0 ? (
          <p className="text-[#edeae3]/50 text-sm">The first article is on its way.</p>
        ) : (
          <ul className="flex flex-col gap-10">
            {posts.map((p) => (
              <li key={p.slug} className="border-t border-[#3d5247]/20 pt-8">
                <Link href={`/blog/${p.slug}`} className="group block">
                  <div className="flex items-baseline gap-3 flex-wrap mb-2">
                    <span className="text-xs text-[#edeae3]/40">
                      {p.date || "Not yet published"} · {p.readingMinutes} min read
                    </span>
                    {p.status === "draft" && (
                      <span className="text-[10px] tracking-widest uppercase text-[#6b8f7e] border border-[#6b8f7e]/40 rounded-full px-2 py-0.5">
                        Draft
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-bold text-[#edeae3]/90 group-hover:text-[#edeae3] transition-colors mb-2">
                    {p.title}
                  </h2>
                  <p className="text-sm text-[#edeae3]/60 leading-relaxed">{p.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SiteFooter />
    </main>
  );
}
