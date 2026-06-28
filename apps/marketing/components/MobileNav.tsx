"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { APP_URL, SHOW_SIGNIN } from "../lib/domain";

const links = [
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "About Us", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export default function MobileNav({ onJoinWaitlist }: { onJoinWaitlist: () => void }) {
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

      {/* Full-screen overlay */}
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

              {SHOW_SIGNIN && (
                <motion.a
                  href={APP_URL}
                  onClick={() => setOpen(false)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + links.length * 0.07, duration: 0.3 }}
                  className="text-4xl font-bold text-[#edeae3]/80 hover:text-[#edeae3] transition-colors py-3 border-b border-[#edeae3]/8"
                >
                  Sign in
                </motion.a>
              )}

              <motion.button
                onClick={() => { setOpen(false); onJoinWaitlist(); }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + (links.length + (SHOW_SIGNIN ? 1 : 0)) * 0.07, duration: 0.3 }}
                className="mt-8 self-start px-8 py-3.5 rounded-full border border-[#6b8f7e]/50 text-[#a8c5b5] text-sm font-medium cursor-pointer"
              >
                Join Waitlist
              </motion.button>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
