import type { Metadata } from "next";
import { BASE_DOMAIN } from "@/lib/domain";
import localFont from "next/font/local";
import Analytics from "@/components/Analytics";
import "./globals.css";

/* ── Self-hosted, deliberately — `next/font/google` fetches AT BUILD TIME ───────────────────────
 *
 * Next 16 builds with Turbopack, and when that build-time fetch fails inside Vercel's container
 * Turbopack reports it as a module-resolution error rather than a network one, so the log blames
 * the code. It reads:
 *
 *     Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
 *     next/font/google queries have exactly one entry
 *
 * That failed a deploy on 2026-09-22 and again on 2026-10-30, both times with the same commit
 * building clean locally — the second one blocking an unrelated release that was waiting behind it.
 * A build that reaches the network is a build that fails for reasons nobody can act on, so the
 * network is now out of it: the files sit next to this one and nothing is fetched.
 *
 * ⚠️ THE CSS VARIABLE NAMES ARE LOAD-BEARING and must not change — `globals.css` maps
 * `--font-geist-sans`/`--font-geist-mono` onto `--font-sans`/`--font-mono`, and SiteFooter reads
 * `--font-fraunces` directly. Renaming one silently drops the site to a system font.
 *
 * Faces are the `latin` subset only, matching the `subsets: ["latin"]` these replaced, and are the
 * variable builds, so the weight RANGES below are what the axis supports rather than a guess.
 * Both families are SIL Open Font License 1.1 (Geist © Vercel, Fraunces © Undercase Type), which
 * permits redistribution; see fonts/README.md.
 *
 * core's own `check:fonts` gate already forbids a third-party font CDN. This brings marketing in
 * line with the rule the rest of the codebase has been holding.
 */
const geistSans = localFont({
  src: "./fonts/geist-latin-var.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/geist-mono-latin-var.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

// Serif display face for the brand tagline — adds craft/warmth against the geometric Geist sans.
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin-var.woff2", style: "normal", weight: "400 500" },
    { path: "./fonts/fraunces-latin-italic-var.woff2", style: "italic", weight: "400 500" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const SITE_URL = `https://www.${BASE_DOMAIN}`;

export const metadata: Metadata = {
  // metadataBase is what turns a relative OG image path into the absolute URL that
  // WhatsApp, LinkedIn and Twitter require. Without it Next emits the relative path,
  // every scraper fails to resolve it, and the card silently falls back to text — which
  // is exactly what this site was doing until now. Derived from BASE_DOMAIN so the dev
  // deploy advertises dev URLs and prod advertises prod, with no second variable to set
  // wrong independently.
  metadataBase: new URL(SITE_URL),
  title: "Spattoo — 3D Cake Designer for Bakers",
  description: "Spattoo is a 3D cake designer tool for bakers. Let your customers design custom cakes online, confirm orders instantly, and manage everything in one place.",
  openGraph: {
    siteName: "Spattoo",
    type: "website",
    locale: "en_IN",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      {/* Safe in the ROOT layout here because every route on this site is ours.
          The baker app is NOT the same shape — apps/app serves customer storefronts
          from its root layout too, so its tag must mount on the baker-app route
          alone or it would track every cake buyer of every baker. */}
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
