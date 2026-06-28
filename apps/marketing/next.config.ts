import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // three/drei ship modern ES2022 (class `static {}` blocks) that Safari < 16.4
  // can't parse → "Unexpected token '{'" → the client-only 3D hero never mounts
  // (blank on Safari 15, i.e. India's older iOS). Next doesn't transpile
  // node_modules by default, so name them; the Safari-15 floor is in browserslist.
  transpilePackages: ["three", "@react-three/fiber", "@react-three/drei"],
};

export default nextConfig;
