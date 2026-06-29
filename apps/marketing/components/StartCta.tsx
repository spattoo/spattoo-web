"use client";

import type { CSSProperties, ReactNode } from "react";
import { SHOW_SIGNIN, SIGNUP_URL } from "../lib/domain";

// Conversion CTA used by the hero and pricing. When the baker app is live
// (NEXT_PUBLIC_SHOW_SIGNIN=true — dev today, prod at launch) it links to the
// baker app's signup; otherwise it falls back to the waitlist modal. Keeps the
// flag branch in ONE place instead of pasting it at every call site.
export default function StartCta({
  className,
  style,
  onWaitlist,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  onWaitlist: () => void;
  children: ReactNode;
}) {
  if (SHOW_SIGNIN) {
    return (
      <a href={SIGNUP_URL} className={className} style={style}>
        {children}
      </a>
    );
  }
  return (
    <button type="button" onClick={onWaitlist} className={className} style={style}>
      {children}
    </button>
  );
}
