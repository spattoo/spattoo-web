// ── The questions a baker asks before signing up ────────────────────────────────────────────────
//
// Every answer here was written or corrected by Sandeep, question by question, and the reasoning
// for each one lives in spattoo-docs/plans/website-faq.md — including the wordings that were tried
// and cut. Change copy there first, or the two drift and the doc stops being worth reading.
//
// ⚠️ THIS IS THE VISITOR AUDIENCE: SALES, NOT SUPPORT. A subscribed baker asking "how do I…" is a
// different corpus (see spattoo-docs/plans/support-automation.md). Everything here answers "can it
// do X" and "is it for me".
//
// ⚠️ NO PLAN OR PRICING CLAIMS. NOT ONE. `bin/check-plan-copy.mjs` in spattoo-docs guards two
// surfaces — Pricing.tsx and the plan rows in migrations — because those claims have already
// drifted apart twice. This file is a THIRD surface and the gate cannot see it, so it carries no
// numbers, no per-tier feature lists, and no plan names. "Your plan already includes credits" is
// the shape to copy: state the dependency, quantify nothing.
//
// ⚠️ TWO CLAIMS ARE SPECIFICALLY FORBIDDEN and must never appear: staff or team SEATS (not a
// shipped feature — the UI is behind STAFF_UI_ENABLED = false), and any unpaired wording of
// PREMIUM themes (a Blaze+ entitlement; logo and colours are not gated, themes are).
//
// ⚠️ A CAPABILITY ANSWER IS A PRE-SALES CLAIM. Of 57 feature docs, 21 are still `in-progress`, so
// "we built it" and "a baker can rely on it" are not the same sentence. Every answer below was
// checked against the product or the data before it was written; the checks are recorded in the
// plan doc. Do not add an answer here that has not had the same treatment.

/** ⚠️ `a` IS AN ARRAY OF PARAGRAPHS, NOT A STRING, and that is not a style choice.
 *  The first version joined every answer into one string, and the answer that happens to have two
 *  paragraphs — "what if a customer designs a cake I can't make" — silently lost its second one on
 *  the way out of the doc. It compiled, it rendered, and it read as a complete answer; only opening
 *  the page showed that the half about reviewing and pricing the order was gone.
 *  Paragraphs that exist in the source now have somewhere to land. */
export type FaqItem = { q: string; a: string[] };

export const FAQ: FaqItem[] = [
  {
    q: "Why design in 3D?",
    a: [
      "Because a cake is three-dimensional, and decoration can go anywhere on it — the top, the sides, the board. A flat drawing cannot tell you whether a flower sits on the top edge or halfway down the side. Designing in 3D shows you exactly where every decoration sits, before you bake.",
    ],
  },
  {
    q: "How does a storefront help me?",
    a: [
      "Your storefront is your shareable store. Your customers order from one link — yourname.spattoo.com — instead of twenty messages. Put it in your Instagram bio or send it on WhatsApp. Add your logo and your colours, and they see your branding, not ours.",
    ],
  },
  {
    q: "Can I use my existing cake photos in my catalogue?",
    a: [
      "Yes. Your catalogue can hold photos of cakes you have already made, designs you build in Spattoo's 3D designer, and any design from Spattoo's ready-made library. Your customers can also design their own cake on your storefront and ask you for a price.",
    ],
  },
  {
    q: "Do I have to create every design myself?",
    a: [
      "No. Spattoo gives you a library of ready-made 3D designs — birthdays, weddings, anniversaries — and you can put any of them straight into your catalogue. Start from one and change it, or use it as it is. We keep adding new designs.",
    ],
  },
  {
    q: "Can I let my customer design their own cake?",
    a: [
      "Yes. Your customers design their cake in 3D on your storefront, with your branding on the page. They can also start from one of your designs, or send a photo of a cake they have seen. The flavours they choose from are the ones you offer.",
    ],
  },
  {
    q: "What if a customer designs a cake I can't make?",
    a: [
      "We understand this problem. Spattoo creates a build guide for every order. For example, if the design has a fondant figure on it, your guide shows you how to make it.",
      "You review every order before confirming it. You see the design, approve it, and send your price. You can always discuss design adjustments with your customer.",
    ],
  },
  {
    q: "Can my customers pay through the storefront?",
    a: [
      "No. Your customer asks you for a price on Spattoo and you send back your quote. The money itself does not pass through Spattoo — you keep taking payment the way you do today.",
    ],
  },
  {
    q: "When do I need to buy smart tool credits?",
    a: [
      "Spattoo has some smart tools that cost us money each time they run — reading a cake photo, for example. Your plan already includes credits for them, and you only need to buy more if you use them all. Your included credits refresh every month, and any extra credits you buy never expire.",
    ],
  },
  {
    q: "Why are popular character-based cake designs not in the Spattoo library?",
    a: [
      "Spattoo's library does not include character-based cake designs. Those characters belong to someone else, and the rights are not ours to give. What you put in your own catalogue is your decision.",
    ],
  },
];
