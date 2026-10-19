"use client";

import type { CSSProperties, ReactNode } from "react";
import { SHOW_SIGNIN } from "../lib/domain";
import { useSignupUrl } from "../lib/useSignupUrl";

// Conversion CTA used by the hero and pricing. Links to the baker app's signup
// when it's live (NEXT_PUBLIC_SHOW_SIGNIN=true — dev today, prod at launch);
// otherwise it renders NOTHING (no CTA until the app exists — we no longer
// collect a pre-launch waitlist). One flag branch, in one place.
export default function StartCta({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  // Before the early return — a hook that runs on some renders and not others changes the hook
  // count and throws the tree away.
  const href = useSignupUrl();
  if (!SHOW_SIGNIN) return null;
  return (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  );
}
