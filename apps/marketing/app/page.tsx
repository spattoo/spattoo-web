import HeroText from "@/components/HeroText";
import SpaceGridLoader from "@/components/SpaceGridLoader";
import Pricing from "@/components/Pricing";
import PricingCTA from "@/components/PricingCTA";
import Contact from "@/components/Contact";
import PainPoint from "@/components/PainPoint";
import SiteNav from "@/components/SiteNav";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#111111] text-[#edeae3]">

      <SiteNav />

      {/* Hero */}
      <section className="relative min-h-screen flex flex-col md:flex-row md:items-center bg-gradient-to-br from-[#111111] via-[#2a2a2a] to-[#edeae3] overflow-hidden md:pt-24">

        {/* 3D space grid — full on mobile (top half), right side on desktop */}
        <div className="absolute right-0 top-0 w-full md:w-[90%] h-full pointer-events-none">
          <SpaceGridLoader />
        </div>

        {/* Fade gradient — desktop: left-to-right; mobile: subtle top-only so cake is visible */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-[#111111] via-[#111111]/80 to-transparent pointer-events-none" />
        <div className="md:hidden absolute inset-0 bg-gradient-to-b from-[#111111]/20 via-transparent to-transparent pointer-events-none" />

        <HeroText />

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-[#6b8f7e]/50 text-xs tracking-widest uppercase">
          <span>Scroll</span>
          <div className="w-px h-10 bg-gradient-to-b from-[#6b8f7e]/50 to-transparent animate-pulse" />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-28 px-8 md:px-16 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto">
          <p className="text-xs tracking-[0.35em] uppercase text-[#6b8f7e] text-center mb-3">
            Simple process
          </p>
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-16 text-[#edeae3]">
            How It Works
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {[
              {
                step: "01",
                title: "Design in 3D Cake Designer",
                desc: "You or your customer can build a custom cake in our 3D designer — choose the shape, tiers, cream, toppings, and message. What you see is exactly what gets made.",
              },
              {
                step: "02",
                title: "Customer Confirms & Orders",
                desc: "Once the design is finalised, your customer reviews and places the order directly. No back-and-forth. No miscommunication. Just a confirmed design.",
              },
              {
                step: "03",
                title: "Orders Land in Your Dashboard",
                desc: "Every order is stored and organised in one place. Get instant notifications the moment an order comes in — so you never miss a cake.",
              },
              {
                step: "04",
                title: "Make It Yours",
                desc: "Add your logo, pick your brand colours, and get your own custom subdomain — like yourname.spattoo.com. Your customers land on your branded storefront and never see ours.",
              },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex flex-col gap-4">
                <span className="text-6xl font-black text-[#3d5247]/40 leading-none">
                  {step}
                </span>
                <div className="w-10 h-0.5 bg-[#6b8f7e]/40" />
                <h3 className="text-lg font-semibold text-[#edeae3]">{title}</h3>
                <p className="text-[#edeae3]/60 leading-relaxed text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <PainPoint />

      <Pricing />

      <PricingCTA />

      <Contact />

      {/* Footer */}
      <footer className="py-8 px-8 border-t border-[#3d5247]/20 text-center text-[#edeae3]/25 text-sm">
        © {new Date().getFullYear()} Spattoo · From idea to Cake, Visually
      </footer>

    </main>
  );
}
