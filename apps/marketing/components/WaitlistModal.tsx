"use client";

import { useState } from "react";
import { supabaseLeads } from "@/lib/supabase-leads";

interface Props {
  onClose: () => void;
}

export default function WaitlistModal({ onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    business_name: "",
    city: "",
  });

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabaseLeads.from("waitlist").insert([form]);
    setLoading(false);
    if (error) {
      setError("Something went wrong. Please try again.");
    } else {
      setSubmitted(true);
    }
  }

  const inputClass =
    "rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/20 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50";
  const inputStyle = { backgroundColor: "#1f1f1f", border: "1px solid rgba(255,255,255,0.08)" };

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
        <button
          onClick={onClose}
          className="absolute top-4 right-5 text-[#edeae3]/30 hover:text-[#edeae3]/70 text-xl transition-colors cursor-pointer"
        >
          ✕
        </button>

        {!submitted ? (
          <>
            <p className="text-xs tracking-[0.3em] uppercase text-[#6b8f7e] mb-2">Early Access</p>
            <h3 className="text-2xl font-bold text-[#edeae3] mb-1">Join the waitlist</h3>
            <p className="text-sm text-[#edeae3]/55 mb-7">
              Be the first to know when Spattoo launches. We'll reach out personally.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">First Name</label>
                  <input
                    name="first_name"
                    required
                    value={form.first_name}
                    onChange={handleChange}
                    placeholder="Priya"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">Last Name</label>
                  <input
                    name="last_name"
                    required
                    value={form.last_name}
                    onChange={handleChange}
                    placeholder="Sharma"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/55">Email</label>
                <input
                  name="email"
                  required
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="priya@sweetdreams.in"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/55">Phone Number</label>
                <input
                  name="phone"
                  required
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">Business Name <span className="text-[#edeae3]/30">(optional)</span></label>
                  <input
                    name="business_name"
                    value={form.business_name}
                    onChange={handleChange}
                    placeholder="Sweet Dreams Cakes"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/55">City / Town <span className="text-[#edeae3]/30">(optional)</span></label>
                  <input
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Hyderabad"
                    className={inputClass}
                    style={inputStyle}
                  />
                </div>
              </div>

              {error && <p className="text-red-400 text-xs">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: "#3d5247" }}
              >
                {loading ? "Joining..." : "Join Waitlist"}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col items-center text-center py-8 gap-5">
            <div>
              <h3 className="text-2xl font-bold text-[#edeae3] mb-3">You're on the list.</h3>
              <p className="text-[#edeae3]/65 text-sm leading-relaxed max-w-sm">
                We'll notify you the moment Spattoo is ready. Thanks for believing in what we're building.
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
