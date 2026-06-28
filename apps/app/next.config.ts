import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The customer storefront mounts @spattoo/designer (a local-linked workspace
  // library); transpile it so its JSX/ESM is built with this app.
  // three/drei are EXTERNALIZED by the designer's Vite lib build, so they arrive
  // raw from node_modules — transpile them too, else Safari < 16.4 can't parse
  // their modern syntax (class `static {}`) and the storefront canvas goes blank
  // on Safari 15 (India's older iOS). Safari-15 floor lives in browserslist.
  transpilePackages: ["@spattoo/designer", "three", "@react-three/fiber", "@react-three/drei"],
  // StrictMode double-mounts components in dev, which doubles (and churns) the
  // designer's WebGL contexts → context exhaustion ("Context Lost", cake flickers).
  // Prod never double-mounts, so disabling just makes dev match prod for R3F.
  reactStrictMode: false,
};

export default nextConfig;
