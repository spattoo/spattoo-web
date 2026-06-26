export default function PainPoint() {
  return (
    <section className="py-24 px-8 md:px-16 bg-[#111111]">
      <div className="max-w-5xl mx-auto">

        {/* Statement */}
        <p className="text-xs tracking-[0.35em] uppercase text-[#6b8f7e] mb-6">The problem</p>
        <h2 className="text-3xl md:text-5xl font-bold text-[#edeae3] mb-6 leading-tight">
          Stop hours of<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#c4512a] to-[#c4852a]">
            back-and-forth messages.
          </span>
        </h2>
        <p className="text-[#edeae3]/60 text-base mb-14 max-w-xl leading-relaxed">
          The average baker spends hours every week in endless chat conversations just to finalise a cake design — only to get it wrong on bake day.
        </p>

        {/* Before / After */}
        <div className="grid md:grid-cols-2 gap-6 mb-14">

          {/* Before */}
          <div className="rounded-2xl p-7 flex flex-col gap-4" style={{ backgroundColor: "#0f0f0f", border: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs uppercase tracking-widest text-[#edeae3]/30">Before Spattoo</p>
            {[
              "Hours of messages describing the design",
              "Last-minute changes, wrong expectations",
              "No record of what was agreed",
              "Design surprises on delivery day",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span className="text-[#c4512a]/60 mt-0.5">✕</span>
                <p className="text-[#edeae3]/50 text-sm leading-relaxed">{line}</p>
              </div>
            ))}
          </div>

          {/* After */}
          <div className="rounded-2xl p-7 flex flex-col gap-4" style={{ backgroundColor: "#0f0f0f", border: "1px solid rgba(107,143,126,0.2)" }}>
            <p className="text-xs uppercase tracking-widest text-[#6b8f7e]">With Spattoo</p>
            {[
              "Customer designs it themselves in 3D",
              "Design confirmed before you bake",
              "Every order stored and tracked",
              "No surprises. Just happy customers.",
            ].map((line) => (
              <div key={line} className="flex items-start gap-3">
                <span className="text-[#6b8f7e] mt-0.5">✓</span>
                <p className="text-[#edeae3]/70 text-sm leading-relaxed">{line}</p>
              </div>
            ))}
          </div>

        </div>

        {/* CTA */}
        <a
          href="#how-it-works"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#3d5247" }}
        >
          See How It Works
          <span>↓</span>
        </a>

      </div>
    </section>
  );
}
