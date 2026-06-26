"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import MobileNav from "./MobileNav";
import WaitlistModal from "./WaitlistModal";

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

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
        <a href="#how-it-works" className="hover:text-[#edeae3] transition-colors">How It Works</a>
        <a href="#pricing" className="hover:text-[#edeae3] transition-colors">Pricing</a>
        <a href="#about" className="hover:text-[#edeae3] transition-colors">About Us</a>
        <a href="#contact" className="hover:text-[#edeae3] transition-colors">Contact</a>
      </div>

      <button
        onClick={() => setWaitlistOpen(true)}
        className="hidden md:inline-flex px-6 py-2.5 rounded-full border border-[#6b8f7e]/50 text-[#a8c5b5] text-sm font-medium hover:border-[#6b8f7e] hover:text-[#edeae3] transition-all cursor-pointer"
      >
        Join Waitlist
      </button>

      <MobileNav onJoinWaitlist={() => setWaitlistOpen(true)} />
      {waitlistOpen && <WaitlistModal onClose={() => setWaitlistOpen(false)} />}
    </nav>
  );
}
