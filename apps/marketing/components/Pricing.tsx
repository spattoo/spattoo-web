"use client";

import { useState } from "react";
import StartCta from "./StartCta";

// ── Spark is a TRIAL, not a tier ────────────────────────────────────────────────────────────────
// Deliberately NOT in `tiers`, and this is the whole point of the layout (spattoo-core
// docs/SUBSCRIPTION_TIERS.md, "Spark is a TRIAL, not a tier").
//
// As the first of four columns, a reader ran their eye across the rows, saw ✓/✓/✓/✓ on designer,
// storefront, branding and orders, and concluded Flame added nothing. That was not a product
// problem — it was manufactured by the layout. Flame looked like a paywall because it was being
// measured against a free tier that has everything.
//
// So it is the FIRST CARD in the row, visibly a different kind of thing: messaging and a CTA, no
// price row, no ticks, nothing to run an eye across. Flame is then measured against what a baker
// actually uses today — a notebook, a phone gallery, Instagram DMs — which it beats comfortably.
//
// It was a full-width strip above the table until 2026-08-02, and that failed the other way: a
// reader who came for prices scrolled past it into the columns, so the free month — the cheapest
// thing we have to offer — was the one thing they never saw. The rule was never "keep it out of the
// row"; it was "never let it become a comparison column".
//
// The word TRIAL is deliberately absent from the card. "Trial" is what WE call it internally; what
// a baker is being offered is a month of using the thing.
//
// The headline leads on the OFFER, not the price. "Free for 30 days" spent the largest line on
// something the CTA ("Start free") and the footnote ("No credit card") already say twice over —
// three ways of saying free, and nothing saying what the month is FOR. Free is the condition;
// a month of running your bakery on it is the proposition.
//
// And it does NOT say "every plan starts free for 30 days", which the strip did — a Blaze buyer
// reading that reasonably expects 30 free days of Blaze and does not get it.
//
// ⚠️ IT ALSO NO LONGER SAYS "EVERYTHING IN FLAME" (changed 2026-08-05). That was accurate, and it
// was still the wrong sentence, for two reasons:
//
//   * It is a PROMISE OF PARITY, and the trial does not have to be a tier. A trial exists to let a
//     baker experience Spattoo; there is no reason its credit allowance must match Flame's, and
//     seed_plan_entitlements.sql records "trial = Blaze for 30 days" as still pending precisely
//     because the AI allowance is "the one way a trial can cost real money". Copy that names a tier
//     pins a decision that is still open, and goes false the moment it moves.
//   * The line contradicted itself — "everything in Flame PLUS a starter allowance of credits",
//     when Flame's allowance IS 300/mo. "Plus" implied extra.
//
// So it now names what a baker GETS, in their own terms, and leaves the credit allowance
// deliberately unquantified. True today, and still true if the trial changes tier or allowance
// tomorrow. The card's job was never comparison anyway — see the block above it.
const trial = {
  badge: "START HERE",
  headline: "Experience Spattoo for a full month",
  body: "Then decide which plan fits.",
  detail: "Your own storefront, the 3D designer, flavour suggestions, and unlimited orders and quotes — with credits to try the smart tools.",
  foot: "No credit card. Nothing is charged until you pick a plan.",
  accent: "#6b8f7e",
  border: "rgba(107,143,126,0.35)",
  glow: "rgba(107,143,126,0.10)",
  cta: "Start free",
};

// ── The plans ───────────────────────────────────────────────────────────────────────────────────
// Every row here must be something the API ACTUALLY ENFORCES — not merely something declared in
// seed_plan_entitlements.sql. Those are not the same set, and the difference is how fiction reaches
// this page: someone reads a value in the seed and writes a row for it.
//
// "Saved templates 30 / Unlimited / Unlimited" was exactly that (removed 2026-08-02).
// `max_saved_templates` exists in the entitlement registry and in the seed and is checked by
// NOTHING — no route, no component. We were advertising a cap on Flame that does not exist, which
// under-sells the plan and would be indefensible if a baker ever counted.
//
// Before adding a row: grep for the key outside constants/entitlements.js and the seed. If the only
// hits are the declaration and the seed, it is not a feature yet.
//
// RENAMED 2026-08-05, three times, and the last one is the point. Every row in this table is a
// NOUN naming a thing you get — Custom templates, X-Ray reports, Smart tool credits, Support. A row
// that reads as a sentence stops being scannable next to them.
//
//   "Edible print sheet (A4)"          named the CONSUMABLE, and read as though we supply sheets.
//                                      We do not; the baker buys those.
//   "Edible sheet layout (A4)"         fixed that, then named the paper twice — A4 IS a layout —
//                                      and named us not at all.
//   "Edible prints, sized to the cake" said the right thing in the wrong register: a description
//                                      with a comma clause, sitting in a column of headings.
//
// "Edible Print Studio" is the noun. The tool (src/chefsdesk/a4/A4Sheet.jsx) holds the page to
// scale and puts cake-diameter guides on it, so a baker checks the image against the cake BEFORE
// printing, then exports with cut marks — which is what stops an expensive sheet going in the bin
// at the wrong size.
//
// I first argued AGAINST "Studio", on the grounds that it would collide with a family of
// decoration-design tools. It does not: the studios (Glaze, Bow, Relief Sticker, Chocolate Drip) are
// ADMIN surfaces — a baker never meets one, and the only mention outside admin is a comment naming
// "the admin Chocolate Drip Studio". So the word is unclaimed on the baker side and the objection
// was about a collision that cannot happen.
//
// A4 is dropped deliberately: it is the sheet they already buy, not something we provide, and it is
// visible inside the tool itself.
//
// The reverse also happened: "Edible print sheet (A4)" shipped a long time ago and had never been
// sold. A baker arranges the customer's photo frames on an A4 sheet at true size, checks them
// against cake-diameter guides, and exports a print-ready PDF with cut marks — on the sheets they
// already buy. Unsold features are the cheaper mistake of the two, but still a mistake.
//
// ── IT IS NO LONGER ONE ROW-VALUE FOR EVERYONE (2026-08-05) ──────────────────────────────────────
// This row said ✓ on all three tiers, and that stopped being true when the studio became a place a
// baker can WALK INTO rather than a view of an order. There are now two things with one name:
//
//   ORDER PHOTOS — the sheet reached from an order, on EVERY plan. Deliberately ungated: printing a
//                  photo a customer attached is part of fulfilling an order they have already paid
//                  for, and taking it away would withhold work in progress.
//   ANY IMAGE    — the standalone studio, Blaze and Forge. Printing things NO order asked for: a
//                  name, a logo, a sheet of the same rose to cut out. That is the bakery's own
//                  productivity, which is a fair thing to sell; the customer's order is not.
//
// So the values name the SCOPE — whose images you may print — and not the access ("Anytime" vs "On
// orders" would describe when, when the real difference is what.
//
// This one passes the "grep for the key" test at the top of this block, and that test is why the row
// is worth trusting: `edible_print_studio` is enforced on every route in spattoo-api
// src/routes/printSheets.js via requireEntitlement, and the menu item in CakeDesigner.jsx is hidden
// unless `ent.edible_print_studio` resolves true. It is a real gate, not a seed value.
//
// ⚠️ AND THE GATE MUST BE OPEN BEFORE THIS SHIPS. The entitlement is declared with fallback:false and
// the plan rows did not carry the key, so it resolved FALSE on every tier — Blaze and Forge included.
// spattoo-api migration 050 grants it, and the seed carries it so a re-run cannot silently drop it
// again. If that migration has not been applied, this row promises Blaze something it does not have.
//
// STOREFRONT THEMES IS A ROW (added 2026-08-06) — Basic on Flame, "Basic + premium" on Blaze and
// Forge. It passes the grep test above, and only just: on the day it was asked for it did NOT.
//
// storefront_themes had is_active and nothing else, the theme-select route validated only that
// flag, and no entitlement key existed — so every baker on every plan saw the same list and this
// row would have been the team-seats mistake again, a fortnight before launch. The gate was built
// first: `storefront_themes.is_premium`, a `premium_themes` entitlement (spattoo-api migration
// 054), a 403 in PATCH /baker/profile, and a locked card in the Settings picker.
//
// ⚠️ EVERY THEME THAT EXISTS TODAY IS BASIC, deliberately — no baker loses one they already chose,
// and premium starts with themes built from here on. So the row is true and currently sells an
// empty set on Blaze. That is the honest way round: the capability is enforced, and the first
// premium theme is a data INSERT with is_premium = true, not another deploy. If premium themes are
// abandoned, this row goes and nothing was promised.
//
// "Basic + premium", not "Premium": Blaze does not lose the basic themes, and a column reading
// Basic / Premium implies a swap rather than a superset.
//
// FLAVOUR SUGGESTIONS IS A ROW (added 2026-08-05), and it is the same tick on all three. It passes
// the test above: not plumbing, but a capability a baker recognises — a customer who cannot decide
// is offered flavours from THIS baker's list, with the reason for each. It had shipped and was
// unsold, which is the mistake this file already names.
//
// Identical across tiers ON PURPOSE, and not an oversight to be "fixed" later by gating it. It is
// customer-facing: restricting it would give some bakers' CUSTOMERS worse recommendations, which is
// a strange thing to sell. It also improves with order volume, so limiting who can use it slows the
// data it runs on. There is no entitlement key to grep for, because there is no gate.
//
// BACKGROUND REMOVAL IS NOT A ROW (removed 2026-08-02). It is plumbing inside the upload flow, not
// a feature anyone shops for — a baker uploads a photo of their decoration and expects the cut-out;
// they do not compare plans on it. It also gated nothing. Where it belongs is inside the smart-tool
// story, which the credits row already carries.
//
// CUSTOM TEMPLATES IS ✓ EVERYWHERE (2026-08-02). It was "—" on Flame and a named Blaze hook, and
// `custom_templates` gates nothing — the registry calls it inert. Rather than keep selling a
// difference that does not exist, the capability is simply available to everyone, and the row now
// says so.
// Where the two disagreed, the SEED won and this file changed: the page must never promise more
// than a baker gets. Corrected 2026-08-02 — Spark's fictional "10 total orders" removed with the
// column (no plan has an order cap; a trial is bounded by TIME).
//
// TEAM SEATS ARE DELIBERATELY ABSENT, AND NOT MERELY DEFERRED. `max_team_members` exists in the
// entitlement registry (1/2/4/10) but nothing customer-facing enforces or shows it, staff seats are
// not a shipped feature, and it is NOT settled that they will be one.
//
// So: no row, and no "coming soon" either. A "coming soon" is a promise — cheap to print, expensive
// to withdraw — and the numbers beside it would commit us to 2/4/10 before the feature has a
// design. A pricing page should sell what a baker can use on the day they pay.
//
// Do not restore the row because the entitlement exists. If seats ever ship it comes back with
// values read from the seed, like every other row here.
const tiers = [
  {
    name: "Flame",
    hidden: false as const,
    quote: false as const,
    tagline: "Less than the price of one cake",
    monthly: 999,
    quarterly: 2697,   // 999 x 3 x 0.9
    annual: 9999,
    accent: "#c4852a",
    border: "rgba(196,133,42,0.3)",
    glow: "rgba(196,133,42,0.07)",
    features: [
      { label: "Storefront + 3D designer", value: "✓" },
      { label: "Flavour suggestions", value: "✓" },
      { label: "Orders & quotes", value: "Unlimited" },
      { label: "Custom templates", value: "✓" },
      { label: "X-Ray reports", value: "✓" },
      { label: "Storefront themes", value: "Basic" },
      { label: "Edible Print Studio", value: "Order photos" },
      { label: "Smart tool credits", value: "300 / mo" },
      { label: "Buy extra credits", value: "—" },
      { label: "Support", value: "Email" },
    ],
    cta: "Start with Flame",
    ctaVariant: "ghost" as const,
  },
  {
    name: "Blaze",
    hidden: false as const,
    quote: false as const,
    tagline: "Your brand. Your templates. Your rules.",
    monthly: 2499,
    quarterly: 6747,  // 2499 x 3 x 0.9
    annual: 24999,
    accent: "#c4512a",
    border: "rgba(196,81,42,0.5)",
    glow: "rgba(196,81,42,0.12)",
    recommended: true,
    features: [
      { label: "Storefront + 3D designer", value: "✓" },
      { label: "Flavour suggestions", value: "✓" },
      { label: "Orders & quotes", value: "Unlimited" },
      { label: "Custom templates", value: "✓" },
      { label: "X-Ray reports", value: "✓" },
      { label: "Storefront themes", value: "Basic + premium" },
      { label: "Edible Print Studio", value: "Any image" },
      { label: "Smart tool credits", value: "800 / mo" },
      { label: "Buy extra credits", value: "✓" },
      { label: "Support", value: "Priority Chat" },
    ],
    cta: "Start with Blaze",
    ctaVariant: "filled" as const,
  },
  {
    name: "Forge",
    // ── HIDDEN, NOT DELETED (2026-08-07) ──────────────────────────────────────────────────────────
    // Forge is off the page entirely. Turning it into a quote tier the day before was the smaller
    // version of the same finding: once team seats came off the table it differed from Blaze by
    // credits and the words "Account manager", and "Let's talk" still asks a bakery to start a
    // conversation about something we cannot yet describe. A column that cannot say what it is for
    // costs more than it earns — it invites the question "what do I get?" and answers it badly.
    //
    // The row STAYS here, flagged, rather than being deleted. Everything it needs already works —
    // the quote rendering, the contact CTA, the feature list — and when there IS something to sell,
    // this comes back by flipping one boolean rather than by rebuilding a column from a commit
    // message. It is also the honest record of why it went.
    //
    // Its sibling: spattoo-api migration 058 took it out of the in-app picker on the same grounds.
    // Both surfaces now say nothing rather than different things.
    hidden: true as const,
    // ── A CONVERSATION, NOT A PRICE ───────────────────────────────────────────────────────────────
    // Forge carried ₹4,999 and a feature list that, once team seats came off the table, differed
    // from Blaze by credits and the word "Account manager". That is not a tier — it is Blaze with a
    // bigger number, and a fixed price on it invites the only question we cannot answer well:
    // what does the extra ₹2,500 buy?
    //
    // So it stops pretending to be a package. A bakery that has outgrown Blaze wants something
    // specific — volume, an integration, a hand with setup — and the honest response to "specific"
    // is to talk, not to publish a number and hope it fits.
    //
    // The rows stay, because the column still has to be comparable to the two beside it. Only the
    // ones that would be PROMISES become "Custom": credits are negotiated now, so printing 2,000
    // would be quoting a figure nobody has agreed.
    quote: true as const,
    tagline: "Bigger volumes, set up around your bakery.",
    monthly: 4999,
    quarterly: 13497, // 4999 x 3 x 0.9
    annual: 49999,
    accent: "#8b3a2a",
    border: "rgba(139,58,42,0.4)",
    glow: "rgba(139,58,42,0.08)",
    features: [
      { label: "Storefront + 3D designer", value: "✓" },
      { label: "Flavour suggestions", value: "✓" },
      { label: "Orders & quotes", value: "Unlimited" },
      { label: "Custom templates", value: "✓" },
      { label: "X-Ray reports", value: "✓" },
      { label: "Storefront themes", value: "Basic + premium" },
      { label: "Edible Print Studio", value: "Any image" },
      { label: "Smart tool credits", value: "Custom" },
      { label: "Buy extra credits", value: "✓" },
      { label: "Support", value: "Account Manager" },
    ],
    cta: "Contact us",
    ctaVariant: "ghost" as const,
  },
];

/* ── The three intervals, and what each is WORTH ─────────────────────────────────────────────────
 *
 * ⚠️ THESE PRICES ARE A SECOND COPY. The authority is `billing_periods` + `subscription_plans` in
 * the API, which is what the in-app picker reads and what Razorpay charges; this page is a static
 * marketing build with no API call, so the numbers are repeated here by hand. They were already
 * repeated before quarterly — this note exists so the next person changing a price knows there are
 * two places, and that the DB is the one that takes money.
 *
 * `quarterly` is monthly × 3 × (1 − 10%), the same derivation planPricing.periodPrice makes.
 *
 * The SAVING is said in time, not percent — "2 months free" is a sentence a baker repeats, "-17%"
 * is arithmetic they have to do first. The unit follows the size: yearly's 17% is 2.04 months,
 * quarterly's 10% is 0.30, and "0.3 months free" is not something anybody says. Same rule, same
 * words as the in-app picker (spattoo-core billing/planPricing.js freeTimeLabel) — a baker who
 * compares the page to the app must not find two different claims about one discount.
 */
const INTERVALS = [
  { key: "monthly"   as const, label: "Monthly",   suffix: "mo",  saving: null },
  { key: "quarterly" as const, label: "Quarterly", suffix: "qtr", saving: "9 days free" },
  { key: "annual"    as const, label: "Annual",    suffix: "yr",  saving: "2 months free" },
];
type IntervalKey = (typeof INTERVALS)[number]["key"];

function formatPrice(amount: number) {
  if (amount === 0) return "Free";
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function Pricing() {
  const [interval, setInterval] = useState<IntervalKey>("monthly");
  const current = INTERVALS.find((i) => i.key === interval)!;
  // Hidden tiers stay in `tiers` — see the Forge block above for why — so the page renders this.
  const shown = tiers.filter((t) => !t.hidden);

  return (
    <section id="pricing" className="pt-14 pb-6 px-4 md:px-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <h2 className="text-3xl md:text-5xl font-bold text-center mb-2 text-[#edeae3]">
          Start free. Grow at your pace.
        </h2>


        {/* ── Interval picker ──────────────────────────────────────────────────────────────────
            A SEGMENTED CONTROL, not the sliding switch this replaces. That switch was a boolean —
            two labels either side of a knob — and it could not be extended to a third interval
            without becoming a thing that looks like a switch and does not behave like one.
            `flex-wrap`, because three buttons carrying their savings do not fit a 375px phone in
            one row: the in-app picker clipped its last badge for exactly this reason before it was
            allowed to wrap. */}
        <div className="flex flex-wrap items-center justify-center gap-1 mb-8 mt-6 mx-auto w-fit max-w-full rounded-full p-1 bg-white/5">
          {INTERVALS.map((i) => {
            const on = interval === i.key;
            return (
              <button
                key={i.key}
                onClick={() => setInterval(i.key)}
                className={`px-4 py-2 rounded-full text-sm transition-colors cursor-pointer whitespace-nowrap ${
                  on ? "bg-[#6b8f7e] text-[#0a0a0a] font-semibold" : "text-[#edeae3]/55 hover:text-[#edeae3]"
                }`}
              >
                {i.label}
                {i.saving && (
                  <span className={`ml-2 text-xs font-medium ${on ? "text-[#0a0a0a]/70" : "text-[#6b8f7e]"}`}>
                    {i.saving}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Cards */}
        {/* The column count follows what is actually shown — a hardcoded 4 leaves a gap the moment
            a tier is hidden. Both class strings are written out in full because Tailwind's JIT
            reads source text, so a template-built class name would be purged and silently do
            nothing. +1 is the trial card, which is not in `tiers`. */}
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${
          shown.length + 1 >= 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>

          {/* ── The trial, as the FIRST card ────────────────────────────────────────────
              It was a full-width strip above the table, and a reader who came for prices
              scrolled past it straight into the columns — so the free month, which is the
              cheapest thing we have to offer, was the one thing they never saw.
              In the row it cannot be missed. What it must NOT become is a comparison column:
              a trial with a feature list that matches Flame row for row is what made Flame look
              like a paywall in the first place (SUBSCRIPTION_TIERS.md). So it carries MESSAGING
              and a CTA — no price row, no ticks, nothing to run an eye across. It reads as an
              on-ramp beside three plans, not a fourth plan. */}
          <div
            className="relative rounded-2xl p-6 flex flex-col gap-4 transition-all"
            style={{
              border: `1px solid ${trial.border}`,
              background: `radial-gradient(ellipse at top, ${trial.glow}, transparent 70%), #111111`,
            }}
          >
            <div
              className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold text-white whitespace-nowrap"
              style={{ backgroundColor: trial.accent }}
            >
              {trial.badge}
            </div>

            <div className="relative pt-1">
              {/* Deliberately NOT styled as a price. The three cards beside this one open with a
                  number; this one opens with a sentence, which is most of what stops it reading
                  as a fourth tier. */}
              <p className="text-2xl font-black leading-tight text-[#edeae3]">{trial.headline}</p>
              <p className="text-sm text-[#edeae3]/70 mt-2 leading-relaxed">{trial.body}</p>
            </div>

            <p className="text-xs text-[#edeae3]/55 leading-relaxed">{trial.detail}</p>

            <StartCta
              className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer mt-auto"
              style={{ backgroundColor: trial.accent, color: "#fff" }}
            >
              {trial.cta}
            </StartCta>
            <p className="text-xs text-[#edeae3]/45 leading-relaxed">{trial.foot}</p>
          </div>

          {shown.map((tier) => (
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

              {/* Price — or, on a quote tier, the absence of one.
                  Deliberately still the biggest thing in this block, at the same size as the two
                  prices beside it. A quote tier that whispers reads as an afterthought; the point
                  is that "let's talk" IS the offer, sitting level with ₹999 and ₹2,499. */}
              <div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-black text-[#edeae3]">
                    {tier.quote ? "Let's talk" : formatPrice(tier[interval])}
                  </span>
                  {!tier.quote && tier[interval] > 0 && (
                    <span className="text-[#edeae3]/55 text-sm mb-1">
                      /{current.suffix}
                    </span>
                  )}
                </div>
              </div>

              {/* CTA. A quote tier does NOT get StartCta: that begins a signup, and signing somebody
                  up to a plan whose price has not been agreed is the wrong first step for both
                  sides. It goes to the contact section on this page instead — no new route, and
                  they keep their place.
                  ⚠️ It is also NOT gated on SHOW_SIGNIN, and that asymmetry is deliberate. StartCta
                  renders nothing before the app is live, because there is no signup to send anyone
                  to. Contact has no such dependency — the section is on this page either way, and
                  before launch a conversation is the only thing anybody CAN do. The visible effect
                  is that pre-launch Forge is the one column with a button, which is the correct way
                  round rather than an oversight to even out. */}
              {tier.quote ? (
                <a
                  href="#contact"
                  className="block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer"
                  style={{
                    border: `1px solid ${tier.border}`,
                    color: tier.accent,
                    backgroundColor: "transparent",
                  }}
                >
                  {tier.cta}
                </a>
              ) : (
                <StartCta
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
              )}

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

        {/* Credits footnote — the two credit rows above are meaningless without it.
            No job counts ("≈50 photo reads"): what an action costs is DATA that can move, and the
            app shows the live price list. A number printed here would go stale silently. */}
        <p className="text-center text-[#edeae3]/45 text-xs mt-8 max-w-2xl mx-auto leading-relaxed">
          Every plan prints the photos a customer attaches to an order. Blaze also opens the Edible
          Print Studio on its own, for anything no order asked for — a name, a logo, a sheet of the
          same rose to cut out. X-Ray works on every plan, for cakes you design and for orders
          that are just a reference photo. Credits pay for the AI part — reading a photo, and working out how a decoration was
          made; an X-Ray of a cake you designed costs nothing. Monthly credits refresh on the 1st.
          Credits you buy never expire and are only used once the monthly ones are gone.
        </p>

        {/* Data retention note */}
        <p className="text-center text-[#edeae3]/45 text-xs mt-4">
          Cancel anytime. Your designs are retained for 30 days after cancellation.
        </p>

      </div>
    </section>
  );
}
