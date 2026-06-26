"use client";

import { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment } from "@react-three/drei";
import * as THREE from "three";

function useLightPatchTexture() {
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#3d5c4a";
    ctx.fillRect(0, 0, size, size);

    const patches = [
      { x: 0.65, y: 0.35, r: 0.28, alpha: 0.18 },
      { x: 0.3,  y: 0.6,  r: 0.22, alpha: 0.12 },
      { x: 0.75, y: 0.72, r: 0.18, alpha: 0.10 },
      { x: 0.5,  y: 0.2,  r: 0.20, alpha: 0.13 },
    ];

    for (const p of patches) {
      const cx = p.x * size;
      const cy = p.y * size;
      const r  = p.r * size;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(140, 185, 155, ${p.alpha})`);
      grad.addColorStop(1, "rgba(61, 92, 74, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }, []);
}

const RADIUS = 1.1;
const HEIGHT = 2.2;

function CakeBody() {
  const patchTex = useLightPatchTexture();
  return (
    <group position={[0, -0.6 + HEIGHT / 2, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[RADIUS, RADIUS, HEIGHT, 64]} />
        <meshPhysicalMaterial
          map={patchTex}
          roughness={0.95}
          metalness={0}
          sheen={0.3}
          sheenRoughness={1}
          sheenColor="#2d4a3a"
        />
      </mesh>
      <mesh position={[0, HEIGHT / 2 + 0.005, 0]} castShadow>
        <cylinderGeometry args={[RADIUS - 0.005, RADIUS - 0.005, 0.01, 64]} />
        <meshPhysicalMaterial
          color="#3d5c4a"
          roughness={0.95}
          metalness={0}
          sheen={0.3}
          sheenRoughness={1}
          sheenColor="#2d4a3a"
        />
      </mesh>
    </group>
  );
}

function CakeBoard() {
  return (
    <mesh position={[0, -0.65, 0]} receiveShadow>
      <cylinderGeometry args={[RADIUS + 0.5, RADIUS + 0.5, 0.05, 128]} />
      <meshStandardMaterial color="#c8a84b" roughness={0.4} metalness={0.95} />
    </mesh>
  );
}

function usePetalTexture() {
  return useMemo(() => {
    const size = 512;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d")!;

    // Soft cream base
    ctx.fillStyle = "#f8f0e3";
    ctx.fillRect(0, 0, size, size);

    // Warm tone variations — like light catching petal curves
    const patches = [
      { x: 0.5, y: 0.5, r: 0.35, alpha: 0.18 },
      { x: 0.2, y: 0.3, r: 0.25, alpha: 0.12 },
      { x: 0.8, y: 0.7, r: 0.28, alpha: 0.14 },
      { x: 0.4, y: 0.8, r: 0.20, alpha: 0.10 },
    ];
    for (const p of patches) {
      const cx = p.x * size;
      const cy = p.y * size;
      const r  = p.r * size;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(210, 175, 120, ${p.alpha})`);
      grad.addColorStop(1, "rgba(248, 240, 227, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }

    return new THREE.CanvasTexture(canvas);
  }, []);
}

const FLOWER_COUNT = 3;

function FlowerBand() {
  const { scene } = useGLTF("/green-petal-flower-2.glb");

  // Clone scene for each instance with emissive removed
  const clones = useMemo(() =>
    Array.from({ length: FLOWER_COUNT }, () => {
      const clone = scene.clone(true);
      clone.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m: THREE.Material) => {
          (m as THREE.MeshStandardMaterial).emissiveIntensity = 0;
        });
      });
      return clone;
    }), [scene]);

  // Diagonal from bottom-left to top-right, following cylinder surface
  const flowers = useMemo(() =>
    Array.from({ length: FLOWER_COUNT }, (_, i) => {
      const t = i / (FLOWER_COUNT - 1);
      const x = THREE.MathUtils.lerp(-0.5, 0.5, t);
      const y = THREE.MathUtils.lerp(-0.4, 0.85, t);
      const z = Math.sqrt(Math.max(0, RADIUS * RADIUS - x * x)) - 0.05;
      const rotY = Math.atan2(x, z) - Math.PI / 4; // correct 45° GLB offset
      // Slight size variation: larger in middle, smaller at edges
      const scale = 0.28 + 0.08 * Math.sin(t * Math.PI);
      return { x, y, z, rotY, scale };
    }), []);

  return (
    <>
      {flowers.map((f, i) => (
        <primitive
          key={i}
          object={clones[i]}
          scale={f.scale}
          position={[f.x, f.y, f.z]}
          rotation={[-0.65, f.rotY, 0]}
        />
      ))}
    </>
  );
}

useGLTF.preload("/green-petal-flower-2.glb");

export default function TestPage() {
  return (
    <div style={{ width: "100vw", height: "100vh", background: "#000000" }}>
      <Canvas
        camera={{ position: [0, 2, 5], fov: 45 }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          antialias: true,
        }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.localClippingEnabled = true;
        }}
        shadows
      >
        <Suspense fallback={null}>
          <Environment preset="apartment" backgroundBlurriness={1} />
          <ambientLight intensity={2.0} />
          <directionalLight position={[5, 10, 6]} intensity={1.2} castShadow />
          <directionalLight position={[-5, 6, 3]} intensity={1.0} />
          <directionalLight position={[0, 4, 8]} intensity={1.0} />
          <directionalLight position={[0, 6, -8]} intensity={0.5} />
          <pointLight position={[3, 2, 4]} intensity={0.7} color="#ffffff" />
          <pointLight position={[-3, 2, 4]} intensity={0.7} color="#ffffff" />
          <group scale={1.8} position={[0, -0.5, 0]}>
            <CakeBoard />
            <CakeBody />
            <FlowerBand />
          </group>
        </Suspense>
        <OrbitControls />
      </Canvas>
    </div>
  );
}
