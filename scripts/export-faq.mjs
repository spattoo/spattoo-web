#!/usr/bin/env node
/* ── The website FAQ, exported so the help assistant can answer from it ──────────────────────────
 *
 * Sandeep: *"we should actually include the FAQ section queries as well."*
 *
 * ⚠️ WHY THIS EXISTS RATHER THAN A SECOND COPY WRITTEN BY HAND. `lib/faq.ts` already warns that it
 * is a THIRD surface carrying claims the plan-copy gate cannot see. Typing the answers out again in
 * spattoo-docs would make a fourth, and the two would disagree the first time anybody edited one.
 * So faq.ts stays the single source and this generates the markdown.
 *
 * ⚠️ AND IT IS A DIFFERENT AUDIENCE, MARKED AS ONE. These answers were written for a VISITOR
 * deciding whether to sign up — "can it do X", "is it for me" — not for a baker mid-task. The
 * export writes `audience: faq`, the backfill stores it on the row, and the panel says where the
 * answer came from, so a signed-in baker is never handed a sales answer dressed as instructions.
 *
 * Measured 2026-10-27: 6 of the 9 FAQ questions got a confident WRONG card from the help index.
 * "Why are popular character-based cake designs not in the Spattoo library?" returned *Taking a
 * cake out of your catalogue* — the real answer is about licensing and exists nowhere else.
 *
 *   node scripts/export-faq.mjs          write spattoo-docs/help/faq.md
 *   node scripts/export-faq.mjs --check  fail if the file is missing or stale (used by the hook)
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, '..', 'apps', 'marketing', 'lib', 'faq.ts');
const OUT = join(HERE, '..', '..', 'spattoo-docs', 'help', 'faq.md');
const CHECK = process.argv.includes('--check');

/* ⚠️ READ AS DATA, NOT IMPORTED. faq.ts is TypeScript inside a Next app; importing it would drag a
   build step into a script that only wants an array of strings. The file is a plain literal — its
   own header insists on that shape — so it is parsed, and a parse that finds nothing FAILS rather
   than silently writing an empty FAQ. */
function parseFaq(src) {
  const body = src.slice(src.indexOf('export const FAQ'));
  const items = [];
  /* `q:` then an `a:` array of double-quoted paragraphs. Comments between entries are skipped by
     anchoring on the keys rather than walking the array. */
  const re = /q:\s*"((?:[^"\\]|\\.)*)"\s*,\s*a:\s*\[([\s\S]*?)\]\s*,?\s*\}/g;
  let m;
  while ((m = re.exec(body))) {
    const q = JSON.parse(`"${m[1]}"`);
    const paras = [...m[2].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(p => JSON.parse(`"${p[1]}"`));
    if (q && paras.length) items.push({ q, a: paras });
  }
  return items;
}

const items = parseFaq(readFileSync(SOURCE, 'utf8'));
if (!items.length) {
  console.error('✗ export:faq — parsed 0 questions from lib/faq.ts. The file shape changed; fix this script rather than shipping an empty FAQ.');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const existing = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
/* The date is carried over when nothing else changed, so a re-run does not churn the file (and the
   help index's manifest) just because a day has passed. */
const prevChecked = /^checked_against_app:\s*(\S+)/m.exec(existing)?.[1];

const md = [
  '---',
  'id: faq',
  'title: Common questions about Spattoo',
  /* ⚠️ NOT `baker`. The help filter requires an explicit audience, and calling this `baker` would
     bury the fact that these answers address somebody deciding whether to sign up. */
  'audience: faq',
  'status: live',
  `checked_against_app: ${prevChecked ?? today}`,
  'generated: true   # from spattoo-web/apps/marketing/lib/faq.ts — edit there, then run npm run export:faq',
  '---',
  '',
  '# Common questions about Spattoo',
  '',
  'These are the questions asked about Spattoo itself — what it is for, and what it can do. They are',
  'answered on the website, and repeated here so the assistant can find them.',
  '',
  ...items.flatMap(({ q, a }) => [`## ${q}`, '', ...a.flatMap(p => [p, ''])]),
].join('\n');

if (CHECK) {
  if (!existing) {
    console.error(`✗ export:faq — ${OUT} does not exist. Run: npm run export:faq`);
    process.exit(1);
  }
  /* Compared ignoring the date line, which is carried over above anyway — a difference here means
     the ANSWERS differ, which is the thing worth blocking a commit for. */
  const strip = (t) => t.replace(/^checked_against_app:.*$/m, '');
  if (strip(existing) !== strip(md)) {
    console.error('✗ export:faq — spattoo-docs/help/faq.md is behind lib/faq.ts.');
    console.error('  The assistant would keep answering with the previous wording, and nothing would error.');
    console.error('\n  Run:  npm run export:faq');
    console.error('        then commit spattoo-docs/help/faq.md and re-run the help backfill\n');
    process.exit(1);
  }
  console.log(`✓ export:faq — help/faq.md matches lib/faq.ts (${items.length} questions)`);
  process.exit(0);
}

writeFileSync(OUT, md);
console.log(`✓ export:faq — ${items.length} questions → spattoo-docs/help/faq.md`);
console.log('  ⚠ now re-run the help backfill, and commit both faq.md and help/.indexed.json');
