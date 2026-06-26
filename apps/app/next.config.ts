import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The customer storefront mounts @spattoo/designer (a local-linked workspace
  // library); transpile it so its JSX/ESM is built with this app.
  transpilePackages: ["@spattoo/designer"],
  // StrictMode double-mounts components in dev, which doubles (and churns) the
  // designer's WebGL contexts → context exhaustion ("Context Lost", cake flickers).
  // Prod never double-mounts, so disabling just makes dev match prod for R3F.
  reactStrictMode: false,
};

export default nextConfig;
