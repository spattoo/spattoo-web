"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
}

const cakeRanges = [
  "Less than 10",
  "10 – 50",
  "50 – 100",
  "100 – 500",
  "500+",
];

export default function DemoModal({ onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    mobile: "",
    city: "",
    brandName: "",
    cakesPerMonth: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-8"
        style={{ backgroundColor: "#161616", border: "1px solid rgba(107,143,126,0.2)" }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-[#edeae3]/30 hover:text-[#edeae3]/70 text-xl transition-colors cursor-pointer"
        >
          ✕
        </button>

        {!submitted ? (
          <>
            <p className="text-xs tracking-[0.3em] uppercase text-[#6b8f7e] mb-2">Request a Demo</p>
            <h3 className="text-2xl font-bold text-[#edeae3] mb-1">See Spattoo in action</h3>
            <p className="text-sm text-[#edeae3]/55 mb-7">
              Tell us a bit about you and we'll reach out to walk you through personally.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">First Name</label>
                  <input
                    name="firstName"
                    required
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Priya"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/20 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">Last Name</label>
                  <input
                    name="lastName"
                    required
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Sharma"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/20 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/55">Mobile Number</label>
                <input
                  name="mobile"
                  required
                  type="tel"
                  value={form.mobile}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/20 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                  style={{ backgroundColor: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">City</label>
                  <input
                    name="city"
                    required
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Hyderabad"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/20 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">Brand Name</label>
                  <input
                    name="brandName"
                    required
                    value={form.brandName}
                    onChange={handleChange}
                    placeholder="Sweet Dreams Cakes"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/20 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)" }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/55">How many cakes do you sell in a month?</label>
                <select
                  name="cakesPerMonth"
                  required
                  value={form.cakesPerMonth}
                  onChange={handleChange}
                  className="rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#6b8f7e]/50 cursor-pointer"
                  style={{
                    backgroundColor: "#1f1f1f",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: form.cakesPerMonth ? "#edeae3" : "rgba(237,234,227,0.2)",
                  }}
                >
                  <option value="" disabled>Select a range</option>
                  {cakeRanges.map((r) => (
                    <option key={r} value={r} style={{ color: "#edeae3", backgroundColor: "#1f1f1f" }}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="mt-2 w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: "#3d5247" }}
              >
                Request Demo
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-8 gap-5">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl"
              style={{ backgroundColor: "rgba(107,143,126,0.15)", border: "1px solid rgba(107,143,126,0.3)" }}
            >
              ✦
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[#edeae3] mb-3">Your spark is lit.</h3>
              <p className="text-[#edeae3]/65 text-sm leading-relaxed max-w-sm">
                We've received your demo request and we're excited to show you what Spattoo can do for you.
                We'll reach out to you shortly — get ready to ignite.
              </p>
            </div>
            <button
              onClick={onClose}
              className="mt-2 px-8 py-2.5 rounded-xl text-sm font-medium text-[#6b8f7e] transition-colors hover:text-[#edeae3] cursor-pointer"
              style={{ border: "1px solid rgba(107,143,126,0.3)" }}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
