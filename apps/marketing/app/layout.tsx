import type { Metadata } from "next";
import { BASE_DOMAIN } from "@/lib/domain";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import Analytics from "@/components/Analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Serif display face for the brand tagline — adds craft/warmth against the geometric Geist sans.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "500"],
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
