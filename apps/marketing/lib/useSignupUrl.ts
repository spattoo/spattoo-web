"use client";

import { useEffect, useState } from "react";
import { SIGNUP_URL, signupUrl } from "./domain";

/* ── The signup link, with the campaign that brought them here ───────────────────────────────────
 *
 * ⚠️ AFTER MOUNT, NOT DURING RENDER, and that is the whole reason this is a hook rather than a call
 * to `signupUrl()` in each component. These CTAs are client components, but Next still renders them
 * on the server first — where there is no `window` and no visitor to attribute. Reading the query
 * string during render therefore produces one href on the server and a different one in the
 * browser, which is a hydration mismatch: React warns, and in production it can keep the server's
 * markup, so the tag would be silently dropped on exactly the visits it exists to measure.
 *
 * Starting at the plain URL and settling once mounted means both renders agree, and the href is
 * correct from the first moment anybody can click it.
 */
export function useSignupUrl(): string {
  const [url, setUrl] = useState(SIGNUP_URL);
  useEffect(() => { setUrl(signupUrl()); }, []);
  return url;
}
