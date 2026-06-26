"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, MeshTransmissionMaterial, Torus } from "@react-three/drei";
import * as THREE from "three";

const palette = ["#edeae3", "#a8c5b5", "#6b8f7e", "#3d5247", "#2d4438"];

function Blob({
  position,
  scale,
  color,
  speed,
  rotAxis,
}: {
  position: [number, number, number];
  scale: number;
  color: string;
  speed: number;
  rotAxis: [number, number, number];
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    const t = state.clock.elapsedTime * speed;
    mesh.current.rotation.x = rotAxis[0] * t;
    mesh.current.rotation.y = rotAxis[1] * t;
    mesh.current.rotation.z = rotAxis[2] * t;
  });

  return (
    <Float speed={1.2 + speed} floatIntensity={1.4} rotationIntensity={0.4}>
      <mesh ref={mesh} position={position} scale={scale} castShadow>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color={color}
          roughness={0.15}
          metalness={0.1}
          envMapIntensity={1}
        />
      </mesh>
    </Float>
  );
}

function Ring({
  position,
  scale,
  color,
  speed,
  tilt,
}: {
  position: [number, number, number];
  scale: number;
  color: string;
  speed: number;
  tilt: [number, number, number];
}) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.z = state.clock.elapsedTime * speed;
  });

  return (
    <Float speed={0.8 + speed} floatIntensity={1.0} rotationIntensity={0.3}>
      <mesh ref={mesh} position={position} scale={scale} rotation={tilt as unknown as THREE.Euler}>
        <torusGeometry args={[1, 0.28, 24, 80]} />
        <meshStandardMaterial color={color} roughness={0.2} metalness={0.15} />
      </mesh>
    </Float>
  );
}

function GlassOrb({ position, scale }: { position: [number, number, number]; scale: number }) {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!mesh.current) return;
    mesh.current.rotation.y = state.clock.elapsedTime * 0.15;
  });

  return (
    <Float speed={0.6} floatIntensity={0.8} rotationIntensity={0.2}>
      <mesh ref={mesh} position={position} scale={scale}>
        <sphereGeometry args={[1, 64, 64]} />
        <MeshTransmissionMaterial
          backside
          samples={6}
          thickness={0.5}
          roughness={0.05}
          transmission={1}
          ior={1.4}
          chromaticAberration={0.06}
          color="#a8c5b5"
        />
      </mesh>
    </Float>
  );
}

function Scene() {
  return (
    <>
      {/* Large cream sphere — right center */}
      <Blob position={[2.8, 0.2, -1.5]} scale={1.1} color={palette[0]} speed={0.08} rotAxis={[0.2, 0.5, 0.1]} />

      {/* Mid sage sphere — upper right */}
      <Blob position={[1.4, 2.2, -0.5]} scale={0.55} color={palette[1]} speed={0.12} rotAxis={[0.3, 0.2, 0.4]} />

      {/* Small dark green sphere — lower right */}
      <Blob position={[3.8, -1.4, -0.8]} scale={0.38} color={palette[3]} speed={0.18} rotAxis={[0.1, 0.6, 0.2]} />

      {/* Tiny cream sphere — far right */}
      <Blob position={[4.5, 1.0, -2]} scale={0.22} color={palette[0]} speed={0.22} rotAxis={[0.4, 0.1, 0.5]} />

      {/* Small sage blob — mid left (peeks from behind text area) */}
      <Blob position={[-1.2, -1.6, -2]} scale={0.45} color={palette[2]} speed={0.1} rotAxis={[0.2, 0.3, 0.1]} />

      {/* Ring — tilted, right */}
      <Ring position={[3.2, 1.2, -1]} scale={0.7} color={palette[2]} speed={0.2} tilt={[0.8, 0.3, 0.2]} />

      {/* Ring — large, background */}
      <Ring position={[1.8, -0.8, -3]} scale={1.3} color={palette[3]} speed={0.1} tilt={[1.2, 0.5, 0.4]} />

      {/* Ring — small floating top */}
      <Ring position={[4.8, 2.0, -1.5]} scale={0.35} color={palette[1]} speed={0.35} tilt={[0.4, 1.0, 0.6]} />

      {/* Glass orb — center right */}
      <GlassOrb position={[2.0, -0.4, 0.5]} scale={0.65} />
    </>
  );
}

export default function CakeScene() {
  return (
    <div style={{ width: "100%", height: "100vh" }}>
      <Canvas
        camera={{ position: [0, 0, 7], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 5]} intensity={2} color="#f0ede8" />
        <pointLight position={[-4, 4, 2]} intensity={1.5} color="#a8c5b5" />
        <pointLight position={[6, -2, 3]} intensity={1.0} color="#edeae3" />

        <Scene />
      </Canvas>
    </div>
  );
}
