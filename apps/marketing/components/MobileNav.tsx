"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { SHOW_SIGNIN, SIGNUP_URL } from "../lib/domain";
import { BLOG_IN_NAV } from "../lib/blog";

// ⚠️ Hrefs are ROOT-RELATIVE ("/#about"), not bare fragments ("#about"), and must stay
// that way. A bare fragment resolves against the CURRENT page, so from /blog or /privacy
// the drawer's section links did nothing at all — they scrolled for an id that is only on
// the home page. SiteNav has always used the "/#" form; this was the copy that drifted.
// Adding /blog made it matter, because it multiplies the pages the drawer is opened from.
const links = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/#pricing" },
  { label: "About Us", href: "/#about" },
  // Same position as the desktop header, so the two menus read in one order.
  // Filtered out below when there is nothing published — see BLOG_IN_NAV in lib/blog.ts.
  { label: "Blog", href: "/blog", blog: true },
  { label: "Contact", href: "/#contact" },
].filter((l) => !l.blog || BLOG_IN_NAV);

export default function MobileNav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="md:hidden flex flex-col justify-center gap-[5px] w-10 h-10 cursor-pointer"
      >
        <span className="block w-6 h-px bg-[#edeae3] mx-auto" />
        <span className="block w-6 h-px bg-[#edeae3] mx-auto" />
        <span className="block w-4 h-px bg-[#edeae3] mx-auto" />
      </button>

      {/* ── The overlay is rendered into <body>, not where it is written ─────────────────────────
          ⚠️ `fixed inset-0 z-50` is not enough, and this is the SECOND time this exact trap has been
          hit here — DemoModal.tsx carries the same note.

          This component lives inside SiteNav, which is `fixed … z-20`. A positioned ancestor with a
          z-index makes a STACKING CONTEXT, so the drawer's z-50 is only ever compared against its
          siblings INSIDE that context; against the rest of the page the whole thing sits at 20. The
          hero's SpaceGrid paints at zIndex 20 too, and being later in the document it wins — which
          is why the cake and the grid showed straight through an overlay whose background is opaque
          #0d0d0d.

          A portal moves it out to the body, where z-50 means what it says.

          ⚠️ The portal wraps AnimatePresence, NOT the other way round. Put createPortal INSIDE it and
          the drawer never appears at all: AnimatePresence inspects its children to track what is
          entering and leaving, and a portal is not a component it can see through — it rendered
          nothing, silently, with no error. Cost one debugging pass to find, because "the menu does
          not open" looks nothing like "the z-index fix was applied at the wrong level".

          `typeof document` rather than a mounted flag: on the server there is no document and this
          renders nothing; on the client a portal contributes no DOM where it is written, so the
          markup either side of hydration matches. That also keeps the exit fade, which gating the
          portal on `open` would have thrown away. */}
      {typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: "#0d0d0d" }}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between px-8 py-6">
              <span className="text-[#edeae3]/30 text-xs tracking-widest uppercase">Menu</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="w-10 h-10 flex items-center justify-center cursor-pointer text-[#edeae3]/60 hover:text-[#edeae3] transition-colors"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-6 h-6">
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Links */}
            <nav className="flex flex-col justify-center flex-1 px-8 gap-2 pb-16">
              {links.map(({ label, href }, i) => (
                <motion.a
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.07, duration: 0.3 }}
                  className="text-4xl font-bold text-[#edeae3]/80 hover:text-[#edeae3] transition-colors py-3 border-b border-[#edeae3]/8"
                >
                  {label}
                </motion.a>
              ))}

              {/* No "Sign in" here. SiteNav carries it in the mobile header, beside the hamburger
                  (`flex md:hidden`), so the drawer was repeating a link that lives two taps away.
                  The drawer is `fixed inset-0`, so it does cover that header while open — somebody
                  who opened the menu hunting for Sign in has to close it — but it is immediately
                  there, next to the X they just pressed. A shorter menu is worth that.

                  "Get started" STAYS: it is the conversion action rather than navigation, and being
                  reachable from anywhere is the point of it. */}
              {SHOW_SIGNIN && (
                <motion.a
                  href={SIGNUP_URL}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + links.length * 0.07, duration: 0.3 }}
                  className="text-4xl font-bold text-[#edeae3]/80 hover:text-[#edeae3] transition-colors py-3 border-b border-[#edeae3]/8"
                >
                  Get started
                </motion.a>
              )}
            </nav>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
