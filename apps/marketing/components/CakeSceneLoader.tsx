"use client";

import dynamic from "next/dynamic";

const CakeScene = dynamic(() => import("@/components/CakeScene"), { ssr: false });

export default function CakeSceneLoader() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <CakeScene />
    </div>
  );
}
