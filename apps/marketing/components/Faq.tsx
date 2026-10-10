import { BASE_DOMAIN } from "@/lib/domain";
import { FAQ } from "@/lib/faq";
import { faqPageSchema } from "@/lib/structuredData";

// ── Common questions ────────────────────────────────────────────────────────────────────────────
//
// The objections a baker raises before signing up, answered. Copy lives in `lib/faq.ts`, and the
// reasoning behind every sentence — including the wordings tried and cut — is in
// spattoo-docs/plans/website-faq.md. Edit the doc first.
//
// ⚠️ NATIVE <details>, NOT A useState ACCORDION, and the reason is not laziness. This section is the
// one part of the page most likely to be read by somebody who arrived from a search result, so it
// has to work before JavaScript does and its text has to be in the HTML. A client component would
// cost a hydration boundary and put the answers behind a bundle, for an interaction the browser
// already implements — including keyboard support and the open/close semantics a screen reader
// announces.
//
// ⚠️ THE SCHEMA AND THE VISIBLE LIST READ THE SAME ARRAY. structuredData.ts opens with "NEVER MARK
// UP WHAT THE PAGE DOES NOT SHOW — schema that disagrees with the visible page is a manual-action
// risk, not a clever trick." Deriving both from `FAQ` is what makes that true by construction
// rather than by care: there is no second list to forget.
//
// ⚠️ FAQPage is the markup with a VISIBLE effect — it can expand the search result itself, listing
// these questions under the link. That is why the questions are phrased the way a baker would type
// them ("what if a customer designs a cake I can't make") rather than as feature headings.
//
// Placed between About and Contact on purpose: a visitor who has read the pricing and the story has
// exactly these left, and the one thing after them is how to ask something that is not here.
export default function Faq() {
  /* The schema wants one plain string per answer; the page wants paragraphs. Joined here rather
     than stored flat, so the two renderings cannot disagree about what the answer says. */
  const schema = faqPageSchema(
    FAQ.map(({ q, a }) => ({ q, a: a.join(" ") })),
    `https://www.${BASE_DOMAIN}/#faq`,
  );

  return (
    <section id="faq" className="py-28 px-8 md:px-16 bg-[#0f0f0f]">
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      )}

      <div className="max-w-3xl mx-auto">
        <p className="text-xs tracking-[0.35em] uppercase text-[#6b8f7e] mb-3">FAQ</p>
        <h2 className="text-3xl md:text-5xl font-bold mb-12 text-[#edeae3]">
          Common questions
        </h2>

        <div className="divide-y divide-[#edeae3]/10 border-y border-[#edeae3]/10">
          {FAQ.map(({ q, a }) => (
            /* `group` + `open:` drives the chevron from the element's own state, so nothing has to
               track which row is open. One row open does not close another — a baker comparing two
               answers should not have to choose between them. */
            /* ⚠️ THE PADDING IS ON THE <summary>, NOT THE <details>, AND THAT IS THE TAP TARGET.
               It was on the details first, which looked identical and was not: tapping a details'
               padding does nothing — only the summary toggles. Measured at 375px the row was 26px
               tall, the height of the text alone, against the 44px Apple asks for and the 48dp
               Android does. A baker on a phone was aiming at a line of text. */
            <details key={q} className="group">
              <summary
                className="flex items-start justify-between gap-6 py-5 cursor-pointer list-none
                           text-[#edeae3] font-medium leading-relaxed
                           marker:content-none [&::-webkit-details-marker]:hidden
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-[#6b8f7e] focus-visible:ring-offset-4
                           focus-visible:ring-offset-[#0f0f0f] rounded-sm"
              >
                <span>{q}</span>
                {/* aria-hidden: the triangle is decoration. <details> already tells a screen
                    reader whether the row is expanded. */}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="w-5 h-5 shrink-0 mt-0.5 text-[#6b8f7e] transition-transform
                             duration-200 group-open:rotate-180"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              {/* pb-5 restores the bottom breathing room the details used to own. */}
              <div className="pb-5">
                {a.map((para, i) => (
                  <p
                    key={i}
                    className={`${i === 0 ? "" : "mt-3"} pr-11 text-[#edeae3]/60 leading-relaxed`}
                  >
                    {para}
                  </p>
                ))}
              </div>
            </details>
          ))}
        </div>

        <p className="mt-10 text-sm text-[#edeae3]/50">
          Something not answered here?{" "}
          <a
            href="/#contact"
            className="text-[#6b8f7e] underline underline-offset-4 hover:text-[#edeae3] transition-colors"
          >
            Ask us
          </a>
          .
        </p>
      </div>
    </section>
  );
}
