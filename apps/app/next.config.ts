import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The customer storefront mounts @spattoo/designer (a local-linked workspace
  // library); transpile it so its JSX/ESM is built with this app.
  transpilePackages: ["@spattoo/designer"],
};

export default nextConfig;
