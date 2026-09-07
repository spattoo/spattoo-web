"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import MobileNav from "./MobileNav";
import { APP_URL, SHOW_SIGNIN, SIGNUP_URL } from "../lib/domain";
import { BLOG_IN_NAV } from "../lib/blog";

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-8 md:px-16 py-5 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(13,13,13,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(237,234,227,0.06)" : "1px solid transparent",
      }}
    >
      <a href="/">
        <Image
          src="/Spattoo-lo-no-tag-line.png"
          alt="Spattoo"
          width={155}
          height={55}
          className="object-contain"
          style={{ width: 135, height: "auto", filter: "drop-shadow(20px 0px 20px rgba(237,234,227,0.25))" }}
          priority
        />
      </a>

      <div className="hidden md:flex items-center gap-8 text-sm font-medium text-[#edeae3]/70">
        <a href="/#how-it-works" className="hover:text-[#edeae3] transition-colors">How It Works</a>
        <a href="/#pricing" className="hover:text-[#edeae3] transition-colors">Pricing</a>
        <a href="/#about" className="hover:text-[#edeae3] transition-colors">About Us</a>
        {/* Between About Us and Contact deliberately: the first four items are the pitch in
            order (what it does, what it costs, who we are), and Contact is the end of that
            run. Writing sits with "who we are" rather than interrupting the pitch, and
            Contact stays last where people expect to find it.

            Hidden entirely when there is nothing to show — see BLOG_IN_NAV in lib/blog.ts.
            On production that means the item appears the moment the first post is published. */}
        {/* <Link>, where the neighbours are plain <a>: those point at "/#section" anchors on
            the home page, but this is a real route change, so it gets client-side navigation
            and prefetch. */}
        {BLOG_IN_NAV && (
          <Link href="/blog" className="hover:text-[#edeae3] transition-colors">Blog</Link>
        )}
        <a href="/#contact" className="hover:text-[#edeae3] transition-colors">Contact</a>
      </div>

      <div className="hidden md:flex items-center gap-5">
        {SHOW_SIGNIN && (
          <a
            href={APP_URL}
            className="text-sm font-medium text-[#edeae3]/70 hover:text-[#edeae3] transition-colors"
          >
            Sign in
          </a>
        )}
        {SHOW_SIGNIN && (
          <a
            href={SIGNUP_URL}
            className="inline-flex px-6 py-2.5 rounded-full bg-[#3d5247] text-[#edeae3] text-sm font-medium hover:bg-[#4a6357] transition-all"
          >
            Get started
          </a>
        )}
      </div>

      {/* ── Sign in, on MOBILE ────────────────────────────────────────────────────────────────────
          Desktop has carried this in the header all along; the block above is `hidden md:flex`, so
          on a phone the only way in was the hamburger — open the drawer, read four section links,
          find "Sign in" underneath. A returning baker should not have to search for the door.

          Here rather than in the hero, where it was first suggested as a replacement for "See How
          It Works". The hero is for people deciding; sign-in is for people who already decided
          months ago, and trading a conversion element for a utility one serves the second audience
          at the first's expense. The header also survives scrolling and exists on /pricing and
          /privacy, where the hero does not — and the nav is `fixed`, so it is reachable from
          anywhere on the page.

          Still in the drawer too: somebody who opens the menu looking for it should find it.

          Gated on SHOW_SIGNIN like every other route into the app — before launch there is nothing
          to sign in to. */}
      <div className="flex items-center gap-4 md:hidden">
        {SHOW_SIGNIN && (
          <a
            href={APP_URL}
            className="text-sm font-medium text-[#edeae3]/80 hover:text-[#edeae3] transition-colors"
          >
            Sign in
          </a>
        )}
        <MobileNav />
      </div>
    </nav>
  );
}
