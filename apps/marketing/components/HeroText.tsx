"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import WaitlistModal from "./WaitlistModal";
import StartCta from "./StartCta";

const slides = [
  {
    eyebrow: "3D cake designer for bakers",
    headline: ["Your customers design", "their cake in 3D.", "You just bake it."],
    highlight: "You just bake it.",
  },
  {
    eyebrow: "Save hours every week",
    headline: ["Less design chats.", "More baking."],
    highlight: "More baking.",
  },
  {
    eyebrow: "No design skills needed.",
    headline: ["No design skills needed.", "Start from a template."],
    highlight: "Start from a template.",
  },
  {
    eyebrow: "They see your brand, not ours.",
    headline: ["Your logo.", "Your colours.", "Your customer's design experience."],
    highlight: "Your customer's design experience.",
  },
];

function Headline({ line, isHighlight, addBreak }: { line: string; isHighlight: boolean; addBreak: boolean }) {
  return isHighlight ? (
    <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#edeae3] to-[#a8c5b5]">
      {addBreak && <br />}{line}
    </span>
  ) : (
    <span>{addBreak && <br />}{line}</span>
  );
}

export default function HeroText() {
  const [index, setIndex] = useState(0);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const slide = slides[index];

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:block relative z-10 px-16 max-w-lg">
        {/* Grid stack: all slides in same cell, container auto-sizes to tallest, pure crossfade */}
        <div style={{ display: "grid", marginBottom: "2rem" }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              style={{ gridArea: "1 / 1" }}
            >
              <p
                className="inline-block text-sm tracking-[0.2em] uppercase text-[#a8c5b5] font-medium mb-5 px-4 py-1.5 rounded-full"
                style={{ border: "1px solid rgba(107,143,126,0.4)", backgroundColor: "rgba(107,143,126,0.08)" }}
              >
                {slide.eyebrow}
              </p>

              <div className="mb-6">
                <h1 className="text-3xl md:text-4xl font-bold leading-snug text-[#edeae3]">
                  {slide.headline.map((line, i) => (
                    <Headline key={line} line={line} isHighlight={line === slide.highlight} addBreak={i > 0} />
                  ))}
                </h1>
              </div>

            </motion.div>
          </AnimatePresence>
        </div>

        {/* Dot indicators */}
        <div className="flex gap-2 mb-6">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="h-1 rounded-full transition-all cursor-pointer"
              style={{
                width: i === index ? "24px" : "8px",
                backgroundColor: i === index ? "#6b8f7e" : "rgba(237,234,227,0.2)",
              }}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <a href="#how-it-works" className="px-6 py-2.5 rounded-full bg-[#3d5247] text-[#edeae3] font-semibold text-sm hover:bg-[#4a6357] transition-colors text-center">
            See How It Works
          </a>
          <StartCta onWaitlist={() => setWaitlistOpen(true)} className="px-6 py-2.5 rounded-full bg-[#3d5247] text-[#edeae3] font-semibold text-sm hover:bg-[#4a6357] transition-colors text-center cursor-pointer">
            Get Started Free
          </StartCta>
        </div>
      </div>

      {/* Mobile */}
      <div
        className="md:hidden absolute bottom-0 top-[5.5rem] left-0 right-0 z-10 px-6 pt-4 pb-10 overflow-hidden flex flex-col justify-end"
        style={{ background: "linear-gradient(to top, #111111 35%, transparent)" }}
      >
        <div style={{ display: "grid", marginBottom: "1rem" }}>
          <AnimatePresence initial={false}>
            <motion.div
              key={`mob-${index}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              style={{ gridArea: "1 / 1" }}
            >
              <p
                className="inline-block text-xs tracking-[0.2em] uppercase text-[#a8c5b5] font-medium mb-2 px-3 py-1 rounded-full"
                style={{ border: "1px solid rgba(107,143,126,0.4)", backgroundColor: "rgba(107,143,126,0.08)" }}
              >
                {slide.eyebrow}
              </p>

              <h1 className="text-xl font-bold leading-snug mb-2 text-[#edeae3]">
                {slide.headline.map((line, i) => (
                  <Headline key={line} line={line} isHighlight={line === slide.highlight} addBreak={i > 0} />
                ))}
              </h1>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex gap-2 mb-4">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className="h-1 rounded-full transition-all cursor-pointer"
              style={{
                width: i === index ? "20px" : "6px",
                backgroundColor: i === index ? "#6b8f7e" : "rgba(237,234,227,0.2)",
              }}
            />
          ))}
        </div>

        <div className="flex gap-3">
          <a href="#how-it-works" className="flex-1 py-3.5 rounded-full bg-[#3d5247] text-[#edeae3] font-semibold text-sm text-center">
            See How It Works
          </a>
          <StartCta onWaitlist={() => setWaitlistOpen(true)} className="flex-1 py-3.5 rounded-full bg-[#3d5247] text-[#edeae3] font-semibold text-sm text-center cursor-pointer">
            Get Started Free
          </StartCta>
        </div>
      </div>
      {waitlistOpen && <WaitlistModal onClose={() => setWaitlistOpen(false)} />}
    </>
  );
}
