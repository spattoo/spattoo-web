"use client";

import { useState } from "react";
import WaitlistModal from "./WaitlistModal";

export default function PricingCTA() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <section className="pt-10 pb-16 px-8 text-center bg-[#0a0a0a]">
        <h2 className="text-4xl md:text-6xl font-bold mb-4 text-[#edeae3]">
          Ready to ignite?
        </h2>
        <p className="text-[#edeae3]/60 text-base mb-6 max-w-md mx-auto">
          Start free with 10 orders, or let us walk you through what Spattoo can do for you.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setModalOpen(true)}
            className="px-8 py-3.5 rounded-full font-semibold text-sm text-white transition-opacity hover:opacity-90 cursor-pointer"
            style={{ backgroundColor: "#3d5247" }}
          >
            Get Started Free
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="px-8 py-3.5 rounded-full font-semibold text-sm transition-opacity hover:opacity-90 cursor-pointer text-white"
            style={{ backgroundColor: "#3d5247" }}
          >
            Request a Demo
          </button>
        </div>

        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-12 text-xs text-[#edeae3]/30 hover:text-[#edeae3]/60 transition-colors cursor-pointer flex items-center gap-2 mx-auto"
        >
          <span>↑</span>
          <span>Back to top</span>
        </button>
      </section>

      {modalOpen && <WaitlistModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
