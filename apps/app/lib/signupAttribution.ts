/* ── Remembering which campaign brought a baker here ─────────────────────────────────────────────
 *
 * The WhatsApp campaigns to bakers scraped from Google Maps (spattoo-leads) go out 50 at a time,
 * and the AiSensy package on this account does not surface replies — so a tap on the message is the
 * only thing that comes back. GA4 already counts the landing on the marketing site. The number the
 * campaign is judged on is further down: how many of those 50 opened a bakery.
 *
 * ⚠️ THE QUERY STRING CANNOT SURVIVE THE JOURNEY, which is the entire reason this file exists.
 * Between arriving on `/?signup=1&c=…` and the moment the baker row is created there is an email
 * confirmation and a phone OTP, each of which navigates. By the time `POST /api/bakers/self` is
 * called, the URL that carried the tag is several redirects in the past. So it is taken off the URL
 * the moment the app loads and parked somewhere that outlives a navigation.
 *
 * ⚠️ `localStorage`, NOT `sessionStorage`. Confirming an email opens a NEW TAB, and a session store
 * is per-tab — the tag would be gone at precisely the step it has to cross. localStorage is
 * per-origin and survives it.
 *
 * ⚠️ AND IT IS STILL BEST-EFFORT. A baker who confirms their email in a different browser, or on
 * their phone when they clicked on a laptop, arrives with nothing to carry; private windows and
 * cleared site data lose it too. Every read is wrapped, every failure is silent, and a missing tag
 * is NEVER allowed to interfere with signing up — it is a label on the account, not a credential.
 * Read the numbers it produces as a floor on what a campaign did, never as a census.
 *
 * ⚠️ NARROWED ON THE WAY IN as well as on the way out. The value comes from a URL anyone can write
 * and ends up in our database; a tag that is not a short lowercase slug is not one we sent.
 */

const KEY = "spattoo.signup.attribution";

type Attribution = { source: string | null; campaign: string | null };

const tag = (v: string | null): string | null => {
  const t = (v ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(t) ? t : null;
};

/** Take the campaign off the URL, if it is carrying one, and park it. Safe to call on every load. */
export function captureSignupAttribution(): void {
  if (typeof window === "undefined") return;
  try {
    const p = new URLSearchParams(window.location.search);
    const next: Attribution = {
      source:   tag(p.get("s") ?? p.get("utm_source")),
      campaign: tag(p.get("c") ?? p.get("utm_campaign")),
    };
    if (!next.source && !next.campaign) return;
    /* ⚠️ FIRST TOUCH WINS. A baker who comes back later through a different link is still the
       baker that campaign produced, and overwriting would quietly re-credit an account to whichever
       link they happened to click last. */
    if (window.localStorage.getItem(KEY)) return;
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private windows and blocked site data both throw here. Losing attribution is not a problem
    // worth showing anybody.
  }
}

/** What we remembered, for the signup request. Returns nulls when there is nothing or it is unreadable. */
export function readSignupAttribution(): Attribution {
  if (typeof window === "undefined") return { source: null, campaign: null };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { source: null, campaign: null };
    const parsed = JSON.parse(raw) as Partial<Attribution>;
    return { source: tag(parsed.source ?? null), campaign: tag(parsed.campaign ?? null) };
  } catch {
    return { source: null, campaign: null };
  }
}

/* Once the baker exists the tag has done its job and is on the row — see migration 131. Clearing it
   stops a SECOND bakery created later in the same browser (a different person on a shared laptop,
   or the same baker starting over after deleting) from inheriting a campaign it never came from. */
export function clearSignupAttribution(): void {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* nothing to do */ }
}
