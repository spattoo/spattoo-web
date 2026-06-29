"use client";

import { useState } from "react";
import WaitlistModal from "./WaitlistModal";
import StartCta from "./StartCta";

const tiers = [
  {
    name: "Spark",
    tagline: "Try before you commit",
    monthly: 0,
    annual: 0,
    accent: "#6b8f7e",
    border: "rgba(107,143,126,0.25)",
    glow: "rgba(107,143,126,0.08)",
    features: [
      { label: "Design Canvas", value: "✓" },
      { label: "Custom Templates", value: "—" },
      { label: "yourname.spattoo.com", value: "—" },
      { label: "Custom Branding", value: "—" },
      { label: "WhatsApp Notifications", value: "—" },
      { label: "Team Members", value: "1" },
      { label: "Support", value: "Help Docs" },
      { label: "Orders", value: "10 total" },
    ],
    cta: "Get Started Free",
    ctaVariant: "ghost" as const,
  },
  {
    name: "Flame",
    tagline: "Less than the price of one cake",
    monthly: 999,
    annual: 9999,
    accent: "#c4852a",
    border: "rgba(196,133,42,0.3)",
    glow: "rgba(196,133,42,0.07)",
    features: [
      { label: "Design Canvas", value: "✓" },
      { label: "Custom Templates", value: "—" },
      { label: "yourname.spattoo.com", value: "✓" },
      { label: "Custom Branding", value: "—" },
      { label: "WhatsApp Notifications", value: "✓" },
      { label: "Team Members", value: "2" },
      { label: "Support", value: "Email" },
      { label: "Orders", value: "Unlimited" },
    ],
    cta: "Start with Flame",
    ctaVariant: "ghost" as const,
  },
  {
    name: "Blaze",
    tagline: "Your brand. Your templates. Your rules.",
    monthly: 2499,
    annual: 24999,
    accent: "#c4512a",
    border: "rgba(196,81,42,0.5)",
    glow: "rgba(196,81,42,0.12)",
    recommended: true,
    features: [
      { label: "Design Canvas", value: "✓" },
      { label: "Custom Templates", value: "✓" },
      { label: "yourname.spattoo.com", value: "✓" },
      { label: "Custom Branding", value: "✓" },
      { label: "WhatsApp Notifications", value: "✓" },
      { label: "Team Members", value: "5" },
      { label: "Support", value: "Priority Chat" },
      { label: "Orders", value: "Unlimited" },
    ],
    cta: "Start with Blaze",
    ctaVariant: "filled" as const,
  },
  {
    name: "Forge",
    tagline: "No limits. Everything on. We've got your back.",
    monthly: 4999,
    annual: 49999,
    accent: "#8b3a2a",
    border: "rgba(139,58,42,0.4)",
    glow: "rgba(139,58,42,0.08)",
    features: [
      { label: "Design Canvas", value: "✓" },
      { label: "Custom Templates", value: "✓" },
      { label: "yourname.spattoo.com", value: "✓" },
      { label: "Custom Branding", value: "✓" },
      { label: "WhatsApp Notifications", value: "✓" },
      { label: "Team Members", value: "Unlimited" },
      { label: "Support", value: "Account Manager" },
      { label: "Orders", value: "Unlimited" },
    ],
    cta: "Start with Forge",
    ctaVariant: "ghost" as const,
  },
];

function formatPrice(amount: number) {
  if (amount === 0) return "Free";
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <section id="pricing" className="pt-14 pb-6 px-4 md:px-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-2 text-[#edeae3]">
          Start free. Grow at your pace.
        </h2>


        {/* Toggle */}
        <div className="flex items-center justify-center gap-4 mb-8 mt-6">
          <span className={`text-sm transition-colors ${!annual ? "text-[#edeae3]" : "text-[#edeae3]/40"}`}>
            Monthly
          </span>
          <button
            onClick={() => setAnnual(!annual)}
            className="relative w-12 h-6 rounded-full transition-colors cursor-pointer"
            style={{ backgroundColor: annual ? "#6b8f7e" : "rgba(255,255,255,0.1)" }}
          >
            <span
              className="absolute top-1 w-4 h-4 rounded-full bg-white transition-all"
              style={{ left: annual ? "28px" : "4px" }}
            />
          </button>
          <span className={`text-sm transition-colors ${annual ? "text-[#edeae3]" : "text-[#edeae3]/40"}`}>
            Annual
            <span className="ml-2 text-xs text-[#6b8f7e] font-medium">save 2 months</span>
          </span>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="relative rounded-2xl p-6 flex flex-col gap-6 transition-all"
              style={{
                border: `1px solid ${tier.border}`,
                background: `radial-gradient(ellipse at top, ${tier.glow}, transparent 70%), #111111`,
                ...(tier.recommended && {
                  boxShadow: `0 0 40px ${tier.glow}, 0 0 0 1px ${tier.border}`,
                }),
              }}
            >
              {/* Recommended badge */}
              {tier.recommended && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white"
                  style={{ backgroundColor: tier.accent }}
                >
                  Most Popular
                </div>
              )}

              {/* Name + tagline */}
              <div className="relative">
                <p
                  className="text-5xl font-black leading-none select-none"
                  style={{ color: tier.accent, opacity: 0.25 }}
                >
                  {tier.name}
                </p>
                <p className="text-xs text-[#edeae3]/60 leading-relaxed mt-1">{tier.tagline}</p>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-[#edeae3]">
                    {formatPrice(annual ? tier.annual : tier.monthly)}
                  </span>
                  {(annual ? tier.annual : tier.monthly) > 0 && (
                    <span className="text-[#edeae3]/55 text-sm mb-1">
                      /{annual ? "yr" : "mo"}
                    </span>
                  )}
                </div>
                {tier.monthly === 0 && (
                  <p className="text-xs text-[#edeae3]/55 mt-1">No credit card required</p>
                )}
              </div>

              {/* CTA */}
              <StartCta
                onWaitlist={() => setWaitlistOpen(true)}
                className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                style={
                  tier.ctaVariant === "filled"
                    ? { backgroundColor: tier.accent, color: "#fff" }
                    : {
                        border: `1px solid ${tier.border}`,
                        color: tier.accent,
                        backgroundColor: "transparent",
                      }
                }
              >
                {tier.cta}
              </StartCta>

              {/* Divider */}
              <div className="h-px bg-white/5" />

              {/* Features */}
              <ul className="flex flex-col gap-3">
                {tier.features.map(({ label, value }) => (
                  <li key={label} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-[#edeae3]/65">{label}</span>
                    <span
                      className="text-xs font-medium shrink-0"
                      style={{ color: value === "—" ? "rgba(237,234,227,0.4)" : tier.accent }}
                    >
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Data retention note */}
        <p className="text-center text-[#edeae3]/45 text-xs mt-10">
          Cancel anytime. Your designs are retained for 30 days after cancellation.
        </p>

      </div>
      {waitlistOpen && <WaitlistModal onClose={() => setWaitlistOpen(false)} />}
    </section>
  );
}
