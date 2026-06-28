"use client";

// Lightweight 3D grid backdrop for the baker sign-in — the glowing floor + the
// vanishing rings from the marketing hero (apps/marketing SpaceGrid), WITHOUT the
// heavy cake/topper/font/draco assets. Unlit basic materials, static camera, no
// controls: it's a calm backdrop, not an interaction. Keeps the on-brand "studio"
// look while staying fast on every login.

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

function Grid() {
  const lines = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const verts: number[] = [];
    const cols = 14, rows = 20, width = 10, depth = 20;
    for (let i = 0; i <= rows; i++) {
      const z = -i * (depth / rows);
      verts.push(-width / 2, 0, z, width / 2, 0, z);
    }
    for (let i = 0; i <= cols; i++) {
      const x = -width / 2 + (i / cols) * width;
      verts.push(x, 0, 0, x, 0, -depth);
    }
    const wallHeights = [0.8, 1.6, 2.4, 3.2, 4.0];
    for (const y of wallHeights) {
      verts.push(width / 2, y, 0, width / 2, y, -depth);
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    return geo;
  }, []);

  const lineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#6b8f7e", transparent: true, opacity: 0.45 }),
    []
  );

  return <lineSegments geometry={lines} material={lineMat} />;
}

function VanishingRings() {
  const rings = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ z: -i * 3, scale: 0.3 + i * 0.35, opacity: 0.4 - i * 0.05 })),
    []
  );
  return (
    <>
      {rings.map((r, i) => (
        <mesh key={i} position={[0, 0, r.z]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[r.scale, r.scale + 0.015, 64]} />
          <meshBasicMaterial color="#6b8f7e" transparent opacity={r.opacity} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

export default function LoginGrid() {
  return (
    <Canvas
      camera={{ position: [0, 1.8, 4], fov: 60, near: 0.1, far: 100 }}
      gl={{ alpha: true, antialias: false, powerPreference: "default" }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ background: "transparent", width: "100%", height: "100%" }}
    >
      <group rotation={[-0.18, 0, 0]} position={[0, -1.2, 0]}>
        <Grid />
        <VanishingRings />
      </group>
    </Canvas>
  );
}
