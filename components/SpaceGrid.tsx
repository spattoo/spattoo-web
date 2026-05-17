"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Text3D, Center } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

// Flower cascade now uses meshopt (bundled decoder) — draco path only needed for topper
useGLTF.setDecoderPath("/draco/");
import { Suspense } from "react";
import * as THREE from "three";

const RADIUS = 1.1;
const HEIGHT = 2.2;

// Shared animation state across components
const cakeColor = { value: new THREE.Color("#3d5c4a") };

// ── Room environment (no CDN — uses Three.js built-in) ────────────────────────

function SceneEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromScene(new RoomEnvironment()).texture;
    scene.environment = env;
    return () => { env.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

// ── Grid ──────────────────────────────────────────────────────────────────────

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
    () => new THREE.LineBasicMaterial({ color: "#6b8f7e", transparent: true, opacity: 0.9 }),
    []
  );
  const centerLineMat = useMemo(
    () => new THREE.LineBasicMaterial({ color: "#a8c5b5", transparent: true, opacity: 1 }),
    []
  );
  const centerLine = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -20], 3));
    return new THREE.Line(geo, centerLineMat);
  }, [centerLineMat]);

  return (
    <group>
      <lineSegments geometry={lines} material={lineMat} />
      <primitive object={centerLine} />
    </group>
  );
}

// ── Vanishing rings ───────────────────────────────────────────────────────────

function VanishingRings() {
  const rings = useMemo(() =>
    Array.from({ length: 6 }, (_, i) => ({
      z: -i * 3,
      scale: 0.3 + i * 0.35,
      opacity: 0.5 - i * 0.06,
    })), []
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

// ── Cake ──────────────────────────────────────────────────────────────────────

function CakeBoard() {
  return (
    <mesh position={[0, -0.65, 0]} receiveShadow>
      <cylinderGeometry args={[RADIUS + 0.5, RADIUS + 0.5, 0.05, 128]} />
      <meshStandardMaterial color="#c8a84b" roughness={0.4} metalness={0.95} />
    </mesh>
  );
}

function CakeBody() {
  const patchTex = useMemo(() => {
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
      const cx = p.x * size, cy = p.y * size, r = p.r * size;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(140, 185, 155, ${p.alpha})`);
      grad.addColorStop(1, "rgba(61, 92, 74, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  return (
    <group position={[0, -0.6 + HEIGHT / 2, 0]}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[RADIUS, RADIUS, HEIGHT, 64]} />
        <meshStandardMaterial map={patchTex} roughness={0.95} metalness={0} />
      </mesh>
    </group>
  );
}

// ── Topper prop ───────────────────────────────────────────────────────────────

function Topper() {
  const { scene } = useGLTF("/3D_happy_birthday_acrylic_topper_1.glb");
  const ref = useRef<THREE.Group>(null);
  const phase = useRef<"hidden" | "entering" | "sitting" | "exiting">("hidden");
  const phaseStart = useRef(0);

  const ENTER_FROM = useMemo(() => new THREE.Vector3(-3, 4, 0), []);
  const SIT_POS    = useMemo(() => new THREE.Vector3(0, 1.75, 0), []);
  const EXIT_TO    = useMemo(() => new THREE.Vector3(0, 4.5, 6), []);

  const T_ENTER = 1;
  const T_SIT   = 1.5;
  const T_EXIT_DURATION = 4;

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;

    if (phase.current === "hidden") {
      ref.current.visible = false;
      ref.current.position.copy(ENTER_FROM);
      if (t >= T_ENTER) {
        phase.current = "entering";
        phaseStart.current = t;
        ref.current.visible = true;
        ref.current.rotation.set(0.3, Math.PI / 4, 0.2);
      }
      return;
    }

    const elapsed = t - phaseStart.current;

    if (phase.current === "entering") {
      ref.current.visible = true;
      ref.current.position.lerp(SIT_POS, 0.04);
      ref.current.rotation.x = THREE.MathUtils.lerp(ref.current.rotation.x, 0, 0.05);
      ref.current.rotation.y = THREE.MathUtils.lerp(ref.current.rotation.y, 0, 0.05);
      ref.current.rotation.z = THREE.MathUtils.lerp(ref.current.rotation.z, 0, 0.05);
      if (ref.current.position.distanceTo(SIT_POS) < 0.05) {
        phase.current = "sitting";
        phaseStart.current = t;
      }
    } else if (phase.current === "sitting") {
      ref.current.position.y = SIT_POS.y + Math.sin(t * 1.2) * 0.04;
      ref.current.rotation.y += 0.003;
      if (elapsed > T_SIT) {
        phase.current = "exiting";
        phaseStart.current = t;
        ref.current.rotation.set(0, 0, 0);
      }
    } else if (phase.current === "exiting") {
      // Tilt forward from bottom — tip toward camera along z-axis
      ref.current.rotation.x += 0.028;
      ref.current.position.lerp(EXIT_TO, 0.022);
      if (elapsed > T_EXIT_DURATION) {
        phase.current = "hidden";
        ref.current.visible = false;
        ref.current.position.copy(ENTER_FROM);
        ref.current.rotation.set(0, 0, 0);
      }
    }
  });

  return <primitive ref={ref} object={scene} scale={0.7} visible={false} />;
}


// ── Cake name tag ─────────────────────────────────────────────────────────────

function CakeNameTag() {
  const groupRef = useRef<THREE.Group>(null);
  const phase = useRef<"hidden" | "entering" | "sitting" | "exiting">("hidden");
  const phaseStart = useRef(0);

  // Group origin sits at cylinder axis — chars radiate outward at RADIUS
  const SIT_POS    = useMemo(() => new THREE.Vector3(0, 0.95, 0), []);
  const ENTER_FROM = useMemo(() => new THREE.Vector3(3, 0.95, 0), []);
  const EXIT_TO    = useMemo(() => new THREE.Vector3(-3, 1.5, 3), []);

  const T_ENTER = 5;
  const T_SIT   = 8;
  const T_EXIT_DURATION = 4;

  // Arc each character around the cylinder surface
  const charData = useMemo(() => {
    const letters = ['J', 'e', 's', 's', 'y'];
    const widths  = [0.15, 0.165, 0.15, 0.15, 0.16]; // approx Helvetiker Bold at size=0.26
    const spacing = 0.03;
    const totalWidth = widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1);
    let offset = -totalWidth / 2;
    return letters.map((char, i) => {
      const center = offset + widths[i] / 2;
      const angle  = center / RADIUS;
      offset += widths[i] + spacing;
      return { char, angle };
    });
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;

    if (phase.current === "hidden") {
      groupRef.current.visible = false;
      groupRef.current.position.copy(ENTER_FROM);
      if (t >= T_ENTER) {
        phase.current = "entering";
        phaseStart.current = t;
        groupRef.current.visible = true;
      }
      return;
    }

    const elapsed = t - phaseStart.current;

    if (phase.current === "entering") {
      groupRef.current.position.lerp(SIT_POS, 0.055);
      if (groupRef.current.position.distanceTo(SIT_POS) < 0.04) {
        phase.current = "sitting";
        phaseStart.current = t;
      }
    } else if (phase.current === "sitting") {
      groupRef.current.position.copy(SIT_POS);
      if (elapsed > T_SIT) {
        phase.current = "exiting";
        phaseStart.current = t;
      }
    } else if (phase.current === "exiting") {
      groupRef.current.position.lerp(EXIT_TO, 0.028);
      if (elapsed > T_EXIT_DURATION) {
        phase.current = "hidden";
        groupRef.current.visible = false;
        groupRef.current.position.copy(ENTER_FROM);
      }
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {charData.map(({ char, angle }, i) => (
        <group
          key={i}
          position={[RADIUS * Math.sin(angle), 0, RADIUS * Math.cos(angle)]}
          rotation={[0, angle, 0]}
        >
          <Center disableZ>
            <Text3D
              font="/fonts/helvetiker_bold.typeface.json"
              size={0.26}
              height={0.05}
              bevelEnabled
              bevelThickness={0.012}
              bevelSize={0.007}
              bevelSegments={6}
              curveSegments={12}
            >
              {char}
              <meshStandardMaterial color="#c8a84b" emissive="#a07828" emissiveIntensity={0.2} metalness={0.95} roughness={0.4} />
            </Text3D>
          </Center>
        </group>
      ))}
    </group>
  );
}

// ── Timeline watcher (bridges 3D clock → React state) ─────────────────────────

function TimelineWatcher({ onReady: _onReady }: { onReady: () => void }) {
  return null;
}

// ── Cake container with z-pan before cascade ──────────────────────────────────

function CakeContainer({ children }: { children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    // t=11→12.5: tilt left on z, t=12.5→13: straighten back
    if (t >= 3 && t < 5) {
      const progress = (t - 3) / 2;
      const angle = progress < 0.5
        ? THREE.MathUtils.lerp(0, -0.07, progress * 2)
        : THREE.MathUtils.lerp(-0.07, 0, (progress - 0.5) * 2);
      ref.current.rotation.z = angle;
    } else if (t >= 5) {
      ref.current.rotation.z = 0;
    }
  });

  return <group ref={ref}>{children}</group>;
}

useGLTF.preload("/3D_happy_birthday_acrylic_topper_1.glb");

// ── HTML colour selector ──────────────────────────────────────────────────────

const COLOR_SWATCHES = [
  { name: "Forest",    hex: "#3d5c4a" },
  { name: "Cream",     hex: "#F5ECD7" },
  { name: "Blush",     hex: "#EEBCB3" },
  { name: "Golden",    hex: "#C9A96E" },
  { name: "Chocolate", hex: "#5C3D2E" },
  { name: "White",     hex: "#FAFAFA" },
];

function ColorSelector({ onDone }: { onDone: () => void }) {
  const [entered, setEntered]     = useState(false);
  const [selected, setSelected]   = useState(-1);
  const [leaving, setLeaving]     = useState(false);

  useEffect(() => {
    // Slide in
    const t0 = setTimeout(() => setEntered(true), 50);
    // Select cream after 1.2s
    const t1 = setTimeout(() => {
      setSelected(1);
      cakeColor.value = new THREE.Color("#F5ECD7");
    }, 1400);
    // Slide out after 4s
    const t2 = setTimeout(() => setLeaving(true), 4200);
    const t3 = setTimeout(onDone, 4800);
    return () => [t0, t1, t2, t3].forEach(clearTimeout);
  }, []);

  const translateX = !entered || leaving ? "110%" : "0%";

  return (
    <div style={{
      position: "absolute",
      right: "6%",
      top: "50%",
      transform: `translateY(-50%) translateX(${translateX})`,
      transition: "transform 0.55s cubic-bezier(0.22, 1, 0.36, 1)",
      background: "#111111",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: "14px",
      padding: "14px 16px",
      zIndex: 20,
      minWidth: "140px",
      pointerEvents: "none",
    }}>
      <p style={{
        color: "#6b8f7e",
        fontSize: "9px",
        letterSpacing: "0.2em",
        textTransform: "uppercase",
        marginBottom: "12px",
        margin: "0 0 12px",
      }}>Colour</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
        {COLOR_SWATCHES.map((s, i) => (
          <div key={i} style={{ position: "relative", display: "flex", justifyContent: "center" }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: s.hex,
              outline: selected === i ? "2px solid #ffffff" : "2px solid transparent",
              outlineOffset: "2px",
              transform: selected === i ? "scale(1.18)" : "scale(1)",
              transition: "transform 0.3s, outline-color 0.3s",
              boxShadow: selected === i ? "0 0 10px rgba(255,255,255,0.25)" : "none",
            }} />
          </div>
        ))}
      </div>

      {selected >= 0 && (
        <p style={{
          color: "#edeae3",
          fontSize: "10px",
          marginTop: "12px",
          margin: "12px 0 0",
          textAlign: "center",
          opacity: 0.7,
        }}>{COLOR_SWATCHES[selected].name}</p>
      )}
    </div>
  );
}

// ── Scene ─────────────────────────────────────────────────────────────────────

export default function SpaceGrid() {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <Canvas
        camera={{ position: [0, 1.8, 4], fov: 60, near: 0.1, far: 100 }}
        gl={{ alpha: true, antialias: false, powerPreference: "default" }}
        onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
        style={{ background: "transparent" }}
        shadows
      >
        <group rotation={[-0.18, 0, 0]} position={[0, -1.2, 0]}>
          <Grid />
          <VanishingRings />
        </group>

        <SceneEnvironment />

        <Suspense fallback={null}>
          <TimelineWatcher onReady={() => setShowPicker(true)} />
          <ambientLight intensity={2.0} />
          <directionalLight position={[5, 10, 6]} intensity={1.2} castShadow />
          <directionalLight position={[-5, 6, 3]} intensity={1.0} />
          <directionalLight position={[0, 4, 8]} intensity={1.0} />
          <pointLight position={[3, 2, 4]} intensity={0.7} color="#ffffff" />
          <pointLight position={[-3, 2, 4]} intensity={0.7} color="#ffffff" />

          {/* Cake — always visible */}
          <CakeContainer>
            <group scale={0.65} position={[0, -0.4, 0]}>
              <CakeBoard />
              <CakeBody />
              <Topper />
              <CakeNameTag />
            </group>
          </CakeContainer>
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      {showPicker && (
        <ColorSelector onDone={() => setShowPicker(false)} />
      )}
    </div>
  );
}

useGLTF.preload("/3D_happy_birthday_acrylic_topper_1.glb");
