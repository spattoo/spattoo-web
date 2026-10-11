// JSON-LD for articles — the machine-readable half of a blog post.
//
// Google reads the rendered page for prose and this block for facts: what kind of thing
// the page is, who published it, when, and (for an FAQ) which questions it answers. The
// site emitted none of it before now, so every article was an anonymous wall of text as
// far as a search engine was concerned.
//
// ⚠️ FAQ SCHEMA IS THE ONE WITH A VISIBLE EFFECT. Article markup mostly clarifies what
// already exists; FAQPage can expand the search result itself, listing the questions
// under the link. That is more space on the page for the same ranking position, which is
// why the questions are worth writing as questions people actually type.
//
// ⚠️ PURE FUNCTIONS, NO `fs`, NO JSX. Same bargain lib/blog.ts makes — this is imported
// by a server component that has already read the file, and keeping it pure is what lets
// the parser below be tested without a build.
//
// ⚠️ NEVER MARK UP WHAT THE PAGE DOES NOT SHOW. Schema that disagrees with the visible
// page is a manual-action risk, not a clever trick. Everything here is derived from the
// registry entry or from the article body itself, so the two cannot drift apart.

import { SPATTOO_PROFILE } from "./legal";
import type { BlogPost } from "./blog";

/** Author and publisher are the same entity: posts carry no byline on the page, so
 *  claiming a named author in the markup would describe a page that does not exist. */
function organisation(site: string) {
  return {
    "@type": "Organization",
    name: "Spattoo",
    legalName: SPATTOO_PROFILE.legalName,
    url: site,
  };
}

/* ⚠️ DATE-ONLY, NOT A TIMESTAMP, and that is a correction rather than a style choice.
 * `Date.parse("9 October 2026")` returns LOCAL midnight; `toISOString()` then converts to
 * UTC, which in IST (+5:30) lands at 18:30 the PREVIOUS day. The markup was telling search
 * engines each article was published a day before the page says it was. schema.org accepts
 * a bare YYYY-MM-DD, so the fix is to never introduce a time we do not know in the first
 * place — the registry stores a day, so the markup should state a day. */
function isoDay(human: string): string | undefined {
  if (!human) return undefined;
  const t = Date.parse(human);
  if (Number.isNaN(t)) return undefined;
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function articleSchema(post: BlogPost, site: string, image: string) {
  const iso = isoDay(post.date);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    url: `${site}/blog/${post.slug}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `${site}/blog/${post.slug}` },
    image: [`${site}${image}`],
    datePublished: iso,
    dateModified: iso,
    author: organisation(site),
    publisher: organisation(site),
    inLanguage: "en-IN",
  };
}

/* ── Pulling the questions out of the article itself ──────────────────────────────────
 *
 * ⚠️ PARSED FROM THE BODY RATHER THAN RE-TYPED INTO THE REGISTRY, and that is the whole
 * point. An FAQ listed in two places is two copies of the same words, and the schema copy
 * is the one nobody re-reads — so it goes stale silently and then describes a page that
 * has moved on. Reading the markdown means the answer a crawler sees and the answer a
 * person reads cannot disagree.
 *
 * THE CONTRACT an article has to follow for this to fire:
 *   · a level-2 heading beginning "Common questions"
 *   · each question a bold line of its own, ending in "?"
 *   · the answer in the lines beneath it, up to the next bold line or the end of section
 *
 * It FAILS SAFE. No matching heading, or no questions under it, returns null and the page
 * simply emits no FAQ block — never a half-formed one, and never an error. An article
 * without an FAQ section is the normal case, not an exception.
 */
export function faqSchema(body: string, site: string, slug: string) {
  const lines = body.split("\n");
  const start = lines.findIndex((l) => /^##\s+common questions/i.test(l.trim()));
  if (start === -1) return null;

  // The section ends at the next heading of the same level or a horizontal rule.
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]) || /^---\s*$/.test(lines[i].trim())) { end = i; break; }
  }

  const questions: { q: string; a: string[] }[] = [];
  for (const line of lines.slice(start + 1, end)) {
    const t = line.trim();
    const asked = t.match(/^\*\*(.+\?)\*\*$/);
    if (asked) { questions.push({ q: asked[1], a: [] }); continue; }
    if (t && questions.length) questions[questions.length - 1].a.push(t);
  }

  const answered = questions
    .map(({ q, a }) => ({ q, a: a.join(" ").trim() }))
    .filter((x) => x.a.length > 0);

  return faqPageSchema(answered, `${site}/blog/${slug}#faq`);
}

/** The FAQPage block itself, for questions that are ALREADY a list.
 *
 *  Split out of `faqSchema` when the marketing homepage grew its own FAQ section: that one does not
 *  parse markdown — its questions are a typed array in `lib/faq.ts` — but the schema it emits has
 *  to be the same shape, and two copies of a schema is how one of them quietly stops matching the
 *  page. The markdown parser above now ends here too.
 *
 *  ⚠️ The `@id` is the caller's, because it names where the questions are VISIBLE. Same rule as the
 *  note at the top of this file: never mark up what the page does not show, which also means never
 *  claiming the markup lives somewhere it does not. */
export function faqPageSchema(questions: { q: string; a: string }[], id: string) {
  if (!questions.length) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": id,
    mainEntity: questions.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
