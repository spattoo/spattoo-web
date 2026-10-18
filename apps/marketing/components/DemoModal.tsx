"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_URL, TURNSTILE_SITE_KEY } from "@/lib/domain";
import Captcha, { type CaptchaHandle } from "./Captcha";

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

// How they found us. Kept short: a long list is read as a chore and answered with whatever is
// first. "Other" opens a text box rather than being an answer in itself — "Other" tells us nothing,
// and the ones worth reading are exactly the ones the list did not predict.
// ── The dark palette, measured rather than eyeballed ─────────────────────────────────────────────
// It read as an unlit box with dull grey labels, and the numbers agreed:
//
//   field #1f1f1f against card #161616   1.10:1   invisible — only the border said a field was there
//   placeholder at 20% opacity           1.8:1    unreadable
//   label at 55% opacity                 5.3:1    passes WCAG, and still dull at 12px on near-black
//
// The card lifts to #1c1c1c so it reads as a card sitting ON the 80%-black backdrop rather than
// dissolving into it; fields lift to #2a2a2a so they are visible as fields without leaning on a
// hairline border. Labels go to 75% (8.4:1) and placeholders to 40% (3.2:1) — placeholders stay
// deliberately below labels, because a placeholder that competes with a label is read as a value.
//
// Nothing here is a new colour: it is the same palette, spaced far enough apart to be seen.
const heardFromOptions = [
  "Instagram",
  "Google search",
  "A friend or another baker",
  "YouTube",
  "An event or expo",
  "Other",
];

export default function DemoModal({ onClose }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // The captcha's token. Held here rather than in `form` because it is not something the visitor
  // typed and must never be treated as a field — in particular it is CLEARED after every attempt.
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<CaptchaHandle>(null);

  // ── Rendered into <body>, not where it is written ────────────────────────────────────────────
  // z-50 against the nav's z-20 should have been the end of it, and was not: the modal opens from a
  // button inside the hero, and the hero animates — a framer-motion transform creates a STACKING
  // CONTEXT, so the modal's z-index is only ever compared against its siblings inside that context.
  // The nav, a sibling of the whole hero, painted straight through the card. A portal moves it out
  // to the body, where z-50 means what it says.
  //
  // No `mounted` guard: DemoCta renders this only once its button has been clicked, so it never
  // renders on the server and `document` is always there. The usual SSR dance would be dead weight
  // — and it trips the lint rule against setState in an effect, which is worth listening to here
  // rather than silencing.

  // Focused when the number is the reason the form did not go — an error message above a form of
  // eight fields does not say WHICH one, and the visitor has to hunt for it.
  const mobileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    mobile: "",
    city: "",
    brandName: "",
    cakesPerMonth: "",
    heardFrom: "",
    heardFromOther: "",
    // ── Honeypot ───────────────────────────────────────────────────────────────────────────────
    // Hidden from people, irresistible to the bots that fill every field they find. Kept in the
    // same state object so it posts like any other field and needs no special case on the way out.
    website: "",
  });

  // ── Has anything been typed? ─────────────────────────────────────────────────────────────────
  // The honeypot is excluded: it is filled by bots and never by people, and counting it would let a
  // bot's own submission protect itself from being dismissed.
  const dirty = Object.entries(form).some(([k, v]) => k !== "website" && v.trim() !== "");
  // Dismissing by accident must not cost eight fields of typing. A backdrop click and Escape both
  // close an EMPTY form — someone who opened it by mistake gets out the way they expect — and both
  // are ignored once anything has been entered. The ✕ always closes: nobody presses it by accident,
  // and it is the one exit that must never be second-guessed.
  const closeIfClean = () => { if (!dirty) onClose(); };

  // Escape closes it, and the page behind stops scrolling. Both are what a modal is expected to do,
  // and neither was true — a portal makes the second one necessary as well as possible, since the
  // dialog is no longer nested in anything that would trap a scroll.
  useEffect(() => {
    // `dirty` is in the deps below, not read through a ref: registered once, this handler would
    // close over the value from the first render — false, forever — and Escape would go on
    // discarding a filled form while looking entirely correct. Re-registering costs one listener
    // swap on the single transition from empty to typed-in.
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !dirty) onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, dirty]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  /* ── Is this the SHAPE of a phone number? ─────────────────────────────────────────────────────
   *
   * ⚠️ There was no check at all, here or on the API, and a demo request arrived with a twelve
   * digit number. Nobody can ring that, and unlike a mistyped email there is no bounce to tell
   * you — you find out when someone tries to call.
   *
   * ⚠️ THE API IS THE AUTHORITY, NOT THIS. The real verdict is libphonenumber's full metadata in
   * spattoo-api (`lib/phone.js`), which knows India's actual prefixes; this is the shape check that
   * catches a typo while the visitor is still looking at the field. It is deliberately a SUPERSET
   * of what the server accepts — anything this passes may still be refused, and the server's
   * message is shown when that happens. A browser check that is stricter than the server is how a
   * real customer gets locked out of a form by a rule nobody can see.
   *
   * The three local shapes are the ones the server accepts for India — ten digits, a trunk zero and
   * ten, or 91 and ten — plus anything written in full with a country code.
   *
   * It also runs BEFORE the fetch so a typo does not spend the captcha token: that token is
   * single-use, so submitting with a bad number would refuse the retry on the CAPTCHA instead of on
   * the thing the visitor just fixed. */
  function phoneShapeOk(value: string) {
    const v = value.replace(/[\s()\-.]/g, "");
    return v.startsWith("+") ? /^\+\d{8,15}$/.test(v) : /^(\d{10}|0\d{10}|91\d{10})$/.test(v);
  }

  // ── It used to just say "thank you" ──────────────────────────────────────────────────────────
  // handleSubmit was `setSubmitted(true)` and nothing else: a success screen over a lead that went
  // nowhere. The component was never imported, so nobody lost anything by it — but it was a trap
  // set for whoever wired up the button, which is now this.
  //
  // Success is shown ONLY on a 2xx. A visitor told "we'll be in touch" who then hears nothing is
  // worse off than one told to email us, because they stop trying.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    if (!phoneShapeOk(form.mobile)) {
      setErr("That mobile number does not look right — 10 digits for India, or the full number with its country code (+…).");
      mobileRef.current?.focus();
      return;
    }

    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`${API_URL}/api/public/demo-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // "Other" is a prompt, not an answer — send what they typed. Falls back to the literal
        // "Other" if they picked it and left the box empty, so the row still says something.
        body: JSON.stringify({
          ...form,
          heardFrom: form.heardFrom === "Other" ? (form.heardFromOther.trim() || "Other") : form.heardFrom,
          captchaToken,
        }),
      });
      if (res.ok) {
        setSubmitted(true);
        return;
      }
      // The API's own message where there is one — the rate limiter's "we already have your
      // request" is friendlier and more accurate than anything this component could guess.
      const body = await res.json().catch(() => null);
      // ── A misconfiguration that looks exactly like a bug ─────────────────────────────────────
      // If the API enforces the captcha and this bundle has NO site key, there is no widget, no
      // token, and every submission is refused — while the form looks completely normal. The
      // visitor cannot fix it and neither can they report it usefully. Said once, loudly, to
      // whoever opens devtools, because the fix is a deploy setting and nothing on this page.
      if (body?.code === "CAPTCHA_FAILED" && !TURNSTILE_SITE_KEY) {
        console.error(
          "[demo] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set on this deploy, so no captcha token is "
          + "sent and the API refuses every submission. Set it on the MARKETING Vercel project "
          + "(apps/app has its own), as a NORMAL variable — a Sensitive one is not inlined into the "
          + "client bundle — then redeploy without build cache.",
        );
      }
      setErr(body?.error || "Something went wrong. Please email hello@spattoo.com and we'll pick it up.");
      // ── A token is single-use ────────────────────────────────────────────────────────────────
      // Whatever went wrong, the one we just sent is spent. Without a fresh one the retry fails on
      // the CAPTCHA rather than on whatever the visitor just corrected — so they fix the real
      // problem, press again, and get a second error that has nothing to do with it.
      setCaptchaToken("");
      captchaRef.current?.reset();
    } catch {
      setErr("Could not reach us just now. Please check your connection, or email hello@spattoo.com.");
      setCaptchaToken("");
      captchaRef.current?.reset();
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) closeIfClean(); }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl p-8"
        style={{ backgroundColor: "#1c1c1c", border: "1px solid rgba(107,143,126,0.2)" }}
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
            <p className="text-sm text-[#edeae3]/75 mb-7">
              Tell us a bit about you and we&rsquo;ll reach out to walk you through personally.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/75">First Name</label>
                  <input
                    name="firstName"
                    required
                    value={form.firstName}
                    onChange={handleChange}
                    placeholder="Priya"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/40 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(255,255,255,0.14)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/75">Last Name</label>
                  <input
                    name="lastName"
                    required
                    value={form.lastName}
                    onChange={handleChange}
                    placeholder="Sharma"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/40 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(255,255,255,0.14)" }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/75">Email</label>
                <input
                  name="email"
                  required
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="priya@sweetdreams.in"
                  className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/40 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                  style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(255,255,255,0.14)" }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/75">Mobile Number</label>
                <input
                  ref={mobileRef}
                  name="mobile"
                  required
                  type="tel"
                  inputMode="tel"
                  value={form.mobile}
                  onChange={handleChange}
                  placeholder="+91 98765 43210"
                  className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/40 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                  style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(255,255,255,0.14)" }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/75">City</label>
                  <input
                    name="city"
                    required
                    value={form.city}
                    onChange={handleChange}
                    placeholder="Hyderabad"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/40 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(255,255,255,0.14)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[#edeae3]/75">Brand Name</label>
                  <input
                    name="brandName"
                    required
                    value={form.brandName}
                    onChange={handleChange}
                    placeholder="Sweet Dreams Cakes"
                    className="rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/40 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(255,255,255,0.14)" }}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/75">How many cakes do you sell in a month?</label>
                <select
                  name="cakesPerMonth"
                  required
                  value={form.cakesPerMonth}
                  onChange={handleChange}
                  className="rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#6b8f7e]/50 cursor-pointer"
                  style={{
                    backgroundColor: "#2a2a2a",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: form.cakesPerMonth ? "#edeae3" : "rgba(237,234,227,0.42)",
                  }}
                >
                  <option value="" disabled>Select a range</option>
                  {cakeRanges.map((r) => (
                    <option key={r} value={r} style={{ color: "#edeae3", backgroundColor: "#2a2a2a" }}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#edeae3]/75">How did you hear about us?</label>
                <select
                  name="heardFrom"
                  required
                  value={form.heardFrom}
                  onChange={handleChange}
                  className="rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-[#6b8f7e]/50 cursor-pointer"
                  style={{
                    backgroundColor: "#2a2a2a",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: form.heardFrom ? "#edeae3" : "rgba(237,234,227,0.42)",
                  }}
                >
                  <option value="" disabled>Select one</option>
                  {heardFromOptions.map((o) => (
                    <option key={o} value={o} style={{ color: "#edeae3", backgroundColor: "#2a2a2a" }}>
                      {o}
                    </option>
                  ))}
                </select>
                {/* Only once "Other" is chosen. Always-visible, it is a field to skip; revealed, it
                    is a question that was just asked. */}
                {form.heardFrom === "Other" && (
                  <input
                    name="heardFromOther"
                    value={form.heardFromOther}
                    onChange={handleChange}
                    placeholder="Where did you hear about us?"
                    className="mt-1.5 rounded-xl px-4 py-2.5 text-sm text-[#edeae3] placeholder-[#edeae3]/40 outline-none focus:ring-1 focus:ring-[#6b8f7e]/50"
                    style={{ backgroundColor: "#2a2a2a", border: "1px solid rgba(255,255,255,0.14)" }}
                  />
                )}
              </div>

              {/* Off-screen rather than display:none — some bots skip hidden fields, and a
                  positioned input is still filled by the ones that read the DOM. aria-hidden and
                  tabIndex keep it away from screen readers and the keyboard, so nobody real meets
                  it. Its name is one bots expect to find. */}
              <input
                name="website"
                value={form.website}
                onChange={handleChange}
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
              />

              {/* The widget is usually invisible — it only shows a checkbox when something about the
                  visit looks unusual. It renders nothing at all without a site key, which is how a
                  deploy that has not set one behaves. */}
              <Captcha
                ref={captchaRef}
                siteKey={TURNSTILE_SITE_KEY}
                onVerify={setCaptchaToken}
                onExpire={() => setCaptchaToken("")}
              />

              {err && (
                <p className="text-sm" style={{ color: "#e08a7a" }} role="alert">{err}</p>
              )}

              {/* Waiting on the captcha is a real state and the button should say so rather than
                  failing on press. Gated only when a site key is configured — otherwise no token is
                  ever coming and the button would never enable. */}
              <button
                type="submit"
                disabled={busy || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                className="mt-2 w-full py-3 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-default cursor-pointer"
                style={{ backgroundColor: "#3d5247" }}
              >
                {busy ? "Sending…" : (TURNSTILE_SITE_KEY && !captchaToken ? "Checking your browser…" : "Request Demo")}
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
                We&rsquo;ve received your demo request and we&rsquo;re excited to show you what Spattoo can do for you.
                We&rsquo;ll reach out to you shortly — get ready to ignite.
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
    </div>,
    document.body,
  );
}
