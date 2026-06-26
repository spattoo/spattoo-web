import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spattoo",
  description: "Design your cake, request a quote.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
