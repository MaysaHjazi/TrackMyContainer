"use client";

import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Sphere, Line, Float, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { TextureLoader } from "three";
import { useTheme } from "@/frontend/theme-provider";

/* ══════════════════════════════════════════════════════════════
   DATA
   ══════════════════════════════════════════════════════════════ */

/* Theme-aware color palettes */
const PALETTE = {
  light: { sea: "#3B82F6", air: "#FF6A00", pin: "#FF6A00", dot: "#3B82F6" },
  dark:  { sea: "#00B4C4", air: "#F5821F", pin: "#F5821F", dot: "#00B4C4" },
} as const;

/* Route topology — `kind` stays stable; color is resolved per theme */
const ROUTE_DEFS: { from: [number, number]; to: [number, number]; kind: "sea" | "air" }[] = [
  { from: [121.5, 31.2], to: [4.5, 51.9],   kind: "sea" },
  { from: [103.8, 1.3],  to: [55.3, 25.3],  kind: "sea" },
  { from: [129.0, 35.1], to: [-118.2, 33.9],kind: "sea" },
  { from: [55.3, 25.3],  to: [-0.1, 51.5],  kind: "air" },
  { from: [8.6, 50.0],   to: [121.5, 31.2], kind: "air" },
  { from: [4.5, 51.9],   to: [-74.0, 40.7], kind: "sea" },
  { from: [51.5, 25.3],  to: [151.2, -33.9],kind: "air" },
  { from: [121.5, 31.2], to: [-46.3, -23.9],kind: "sea" },
];

const PORTS: [number, number][] = [
  [121.5, 31.2], [103.8, 1.3], [4.5, 51.9], [55.3, 25.3],
  [-118.2, 33.9], [129.0, 35.1], [-74.0, 40.7], [72.9, 19.1],
  [151.2, -33.9], [-46.3, -23.9], [139.7, 35.7], [9.9, 53.5],
];

/* ══════════════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════════════ */

function latLngToVector3(lng: number, lat: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createArc(from: [number, number], to: [number, number], radius: number): THREE.Vector3[] {
  const start = latLngToVector3(from[0], from[1], radius);
  const end = latLngToVector3(to[0], to[1], radius);
  const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const dist = start.distanceTo(end);
  mid.normalize().multiplyScalar(radius + dist * 0.18);
  const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
  return curve.getPoints(50);
}

/* ══════════════════════════════════════════════════════════════
   COMPONENTS
   ══════════════════════════════════════════════════════════════ */

/* ── Location Pin (orange marker) ── */
function LocationPin({ position, delay, color }: { position: THREE.Vector3; delay: number; color: string }) {
  const pinRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  // Point pin outward from globe center
  const normal = position.clone().normalize();
  const pinPos = position.clone().add(normal.clone().multiplyScalar(0.04));

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = ((clock.getElapsedTime() + delay) % 2.5) / 2.5;
    const scale = 1 + t * 4;
    ringRef.current.scale.set(scale, scale, scale);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t);
  });

  return (
    <group ref={pinRef} position={pinPos}>
      <mesh>
        <sphereGeometry args={[0.025, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.045, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.02, 0.035, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── Port dot with pulse ── */
function PortDot({ position, delay, color }: { position: THREE.Vector3; delay: number; color: string }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    const t = ((clock.getElapsedTime() + delay) % 2) / 2;
    const scale = 1 + t * 3;
    ringRef.current.scale.set(scale, scale, scale);
    (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.5 * (1 - t);
  });

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.018, 10, 10]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} />
      </mesh>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.015, 0.025, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* ── Glowing traveling dot ── */
function TravelingDot({ from, to, color, speed, radius }: {
  from: [number, number]; to: [number, number]; color: string; speed: number; radius: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    const start = latLngToVector3(from[0], from[1], radius);
    const end = latLngToVector3(to[0], to[1], radius);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dist = start.distanceTo(end);
    mid.normalize().multiplyScalar(radius + dist * 0.18);
    return new THREE.QuadraticBezierCurve3(start, mid, end);
  }, [from, to, radius]);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.getElapsedTime() * speed) % 1;
    const pos = curve.getPoint(t);
    ref.current.position.copy(pos);
    if (glowRef.current) glowRef.current.position.copy(pos);
  });

  return (
    <>
      <mesh ref={ref}>
        <sphereGeometry args={[0.025, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.055, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.15} />
      </mesh>
    </>
  );
}

/* ── Realistic 3D Shipping Container ── */
function ShippingContainer({ color, position, rotation, scale = 1, floatSpeed = 1 }: {
  color: string; position: [number, number, number]; rotation: [number, number, number];
  scale?: number; floatSpeed?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const baseColor = useMemo(() => new THREE.Color(color), [color]);
  const darkColor = useMemo(() => new THREE.Color(color).multiplyScalar(0.6), [color]);
  const frameColor = useMemo(() => new THREE.Color(color).multiplyScalar(0.45), [color]);
  const lightColor = useMemo(() => new THREE.Color(color).multiplyScalar(1.1), [color]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = rotation[1] + clock.getElapsedTime() * 0.12 * floatSpeed;
    groupRef.current.position.y = position[1] + Math.sin(clock.getElapsedTime() * floatSpeed) * 0.04;
  });

  // Container dimensions (20ft standard proportions)
  const W = 0.5 * scale;   // length
  const H = 0.2 * scale;   // height
  const D = 0.19 * scale;  // depth/width
  const WALL = 0.004 * scale; // wall thickness
  const RIDGE_W = 0.006 * scale;
  const RIDGE_D = 0.008 * scale;
  const FRAME = 0.012 * scale;

  return (
    <group ref={groupRef} position={position} rotation={rotation}>

      {/* ── Main body panels ── */}
      {/* Back wall */}
      <mesh position={[-W / 2, 0, 0]}>
        <boxGeometry args={[WALL, H, D]} />
        <meshStandardMaterial color={baseColor} roughness={0.45} metalness={0.55} />
      </mesh>
      {/* Top panel */}
      <mesh position={[0, H / 2, 0]}>
        <boxGeometry args={[W, WALL, D]} />
        <meshStandardMaterial color={lightColor} roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Bottom panel (floor) */}
      <mesh position={[0, -H / 2, 0]}>
        <boxGeometry args={[W, WALL * 2, D]} />
        <meshStandardMaterial color={darkColor} roughness={0.6} metalness={0.4} />
      </mesh>
      {/* Left side wall */}
      <mesh position={[0, 0, D / 2]}>
        <boxGeometry args={[W, H, WALL]} />
        <meshStandardMaterial color={baseColor} roughness={0.45} metalness={0.55} />
      </mesh>
      {/* Right side wall */}
      <mesh position={[0, 0, -D / 2]}>
        <boxGeometry args={[W, H, WALL]} />
        <meshStandardMaterial color={baseColor} roughness={0.45} metalness={0.55} />
      </mesh>

      {/* ── Corrugation ridges (both sides) ── */}
      {Array.from({ length: 16 }).map((_, i) => {
        const x = -W / 2 + W * 0.06 + i * (W * 0.88 / 15);
        return (
          <group key={`ridge-${i}`}>
            {/* Front side ridges */}
            <mesh position={[x, 0, D / 2 + RIDGE_D / 2]}>
              <boxGeometry args={[RIDGE_W, H * 0.88, RIDGE_D]} />
              <meshStandardMaterial color={baseColor} roughness={0.5} metalness={0.5} />
            </mesh>
            {/* Back side ridges */}
            <mesh position={[x, 0, -D / 2 - RIDGE_D / 2]}>
              <boxGeometry args={[RIDGE_W, H * 0.88, RIDGE_D]} />
              <meshStandardMaterial color={baseColor} roughness={0.5} metalness={0.5} />
            </mesh>
          </group>
        );
      })}

      {/* ── Steel frame edges (dark) ── */}
      {/* Top front edge */}
      <mesh position={[0, H / 2, D / 2]}>
        <boxGeometry args={[W + FRAME, FRAME, FRAME]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Top back edge */}
      <mesh position={[0, H / 2, -D / 2]}>
        <boxGeometry args={[W + FRAME, FRAME, FRAME]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Bottom front edge */}
      <mesh position={[0, -H / 2, D / 2]}>
        <boxGeometry args={[W + FRAME, FRAME, FRAME]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Bottom back edge */}
      <mesh position={[0, -H / 2, -D / 2]}>
        <boxGeometry args={[W + FRAME, FRAME, FRAME]} />
        <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Vertical corner posts (4 corners) */}
      {[
        [W / 2, 0, D / 2],
        [W / 2, 0, -D / 2],
        [-W / 2, 0, D / 2],
        [-W / 2, 0, -D / 2],
      ].map(([cx, cy, cz], i) => (
        <mesh key={`post-${i}`} position={[cx, cy, cz]}>
          <boxGeometry args={[FRAME, H + FRAME, FRAME]} />
          <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.8} />
        </mesh>
      ))}

      {/* ── Corner castings (8 corners — the metal blocks) ── */}
      {[
        [W / 2, H / 2, D / 2], [W / 2, H / 2, -D / 2],
        [-W / 2, H / 2, D / 2], [-W / 2, H / 2, -D / 2],
        [W / 2, -H / 2, D / 2], [W / 2, -H / 2, -D / 2],
        [-W / 2, -H / 2, D / 2], [-W / 2, -H / 2, -D / 2],
      ].map(([cx, cy, cz], i) => (
        <mesh key={`cast-${i}`} position={[cx, cy, cz]}>
          <boxGeometry args={[FRAME * 1.6, FRAME * 1.6, FRAME * 1.6]} />
          <meshStandardMaterial color={frameColor} roughness={0.25} metalness={0.9} />
        </mesh>
      ))}

      {/* ── Door end (right side +X) ── */}
      {/* Left door */}
      <mesh position={[W / 2, 0, D * 0.13]}>
        <boxGeometry args={[WALL * 1.5, H * 0.9, D * 0.4]} />
        <meshStandardMaterial color={baseColor} roughness={0.45} metalness={0.55} />
      </mesh>
      {/* Right door */}
      <mesh position={[W / 2, 0, -D * 0.13]}>
        <boxGeometry args={[WALL * 1.5, H * 0.9, D * 0.4]} />
        <meshStandardMaterial color={baseColor} roughness={0.45} metalness={0.55} />
      </mesh>
      {/* Door gap line (center) */}
      <mesh position={[W / 2 + WALL, 0, 0]}>
        <boxGeometry args={[WALL * 0.5, H * 0.85, WALL * 0.5]} />
        <meshStandardMaterial color={darkColor} roughness={0.6} metalness={0.4} />
      </mesh>

      {/* Door handles / locking bars */}
      {[-1, 1].map((side) => (
        <group key={`handle-${side}`}>
          {/* Vertical bar */}
          <mesh position={[W / 2 + WALL * 1.5, 0, side * D * 0.22]}>
            <boxGeometry args={[WALL, H * 0.7, WALL * 1.2]} />
            <meshStandardMaterial color={frameColor} roughness={0.3} metalness={0.85} />
          </mesh>
          {/* Handle cam (top) */}
          <mesh position={[W / 2 + WALL * 2, H * 0.22, side * D * 0.22]}>
            <boxGeometry args={[WALL * 3, WALL * 2, WALL * 2]} />
            <meshStandardMaterial color={frameColor} roughness={0.25} metalness={0.9} />
          </mesh>
          {/* Handle cam (bottom) */}
          <mesh position={[W / 2 + WALL * 2, -H * 0.22, side * D * 0.22]}>
            <boxGeometry args={[WALL * 3, WALL * 2, WALL * 2]} />
            <meshStandardMaterial color={frameColor} roughness={0.25} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ── Forklift pockets (bottom) ── */}
      {[-D * 0.25, D * 0.25].map((z, i) => (
        <mesh key={`fork-${i}`} position={[0, -H / 2 - FRAME * 0.5, z]}>
          <boxGeometry args={[W * 0.3, FRAME * 0.8, FRAME * 2]} />
          <meshStandardMaterial color={darkColor} roughness={0.5} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Globe with Earth texture — theme-aware (day or night) ── */
function GlobeMesh({ isDark }: { isDark: boolean }) {
  const globeRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const palette = isDark ? PALETTE.dark : PALETTE.light;
  // Preload ALL textures so theme swap is instant; show current-mode one.
  const dayTex    = useLoader(TextureLoader, "/textures/earth-day.jpg");
  const nightTex  = useLoader(TextureLoader, "/textures/earth-night.jpg");
  const cloudsTex = useLoader(TextureLoader, "/textures/earth-clouds.png");

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (globeRef.current)  globeRef.current.rotation.y  = t * 0.04;
    // Clouds drift slightly faster than the globe for depth
    if (cloudsRef.current) cloudsRef.current.rotation.y = t * 0.055;
  });

  return (
    <group ref={globeRef}>
      {/* ── Atmosphere: outer soft glow ── */}
      <Sphere args={[1.68, 48, 48]}>
        <meshBasicMaterial
          color={isDark ? "#1B3A6E" : "#7FB6FF"}
          transparent
          opacity={isDark ? 0.05 : 0.12}
          side={THREE.BackSide}
        />
      </Sphere>
      {/* Inner atmosphere ring */}
      <Sphere args={[1.56, 48, 48]}>
        <meshBasicMaterial
          color={isDark ? "#2B5EA0" : "#B8D9FF"}
          transparent
          opacity={isDark ? 0.08 : 0.22}
          side={THREE.BackSide}
        />
      </Sphere>

      {isDark ? (
        /* ── DARK MODE — night texture with city lights ── */
        <Sphere args={[1.5, 64, 64]}>
          <meshStandardMaterial
            map={nightTex}
            emissiveMap={nightTex}
            emissive={new THREE.Color("#ffffff")}
            emissiveIntensity={1.2}
            roughness={0.9}
            metalness={0.1}
          />
        </Sphere>
      ) : (
        <>
          {/* ── LIGHT MODE — realistic day earth ── */}
          <Sphere args={[1.5, 96, 96]}>
            <meshStandardMaterial
              map={dayTex}
              roughness={0.6}
              metalness={0.08}
              emissive={new THREE.Color("#FFEED0")}
              emissiveIntensity={0.03}
            />
          </Sphere>

          {/* ── Cloud layer — slightly larger sphere, semi-transparent ── */}
          <mesh ref={cloudsRef}>
            <sphereGeometry args={[1.515, 96, 96]} />
            <meshStandardMaterial
              map={cloudsTex}
              transparent
              opacity={0.42}
              depthWrite={false}
              roughness={1}
              metalness={0}
              emissive={new THREE.Color("#FFFFFF")}
              emissiveIntensity={0.04}
            />
          </mesh>
        </>
      )}


      {/* Port dots (sea blue) — half the ports */}
      {PORTS.slice(0, 6).map((port, i) => {
        const pos = latLngToVector3(port[0], port[1], 1.53);
        return <PortDot key={`port-${i}`} position={pos} delay={i * 0.5} color={palette.dot} />;
      })}

      {/* Location pins (orange) — other half */}
      {PORTS.slice(6).map((port, i) => {
        const pos = latLngToVector3(port[0], port[1], 1.53);
        return <LocationPin key={`pin-${i}`} position={pos} delay={i * 0.7} color={palette.pin} />;
      })}

      {/* Route arcs — theme-aware color + opacity */}
      {ROUTE_DEFS.map((route, i) => {
        const points = createArc(route.from, route.to, 1.5);
        const color = route.kind === "sea" ? palette.sea : palette.air;
        return (
          <Line
            key={i}
            points={points}
            color={color}
            lineWidth={1.8}
            transparent
            opacity={isDark ? 0.5 : 0.72}
          />
        );
      })}

      {/* Traveling dots */}
      {ROUTE_DEFS.map((route, i) => (
        <TravelingDot
          key={`dot-${i}`}
          from={route.from}
          to={route.to}
          color={route.kind === "sea" ? palette.sea : palette.air}
          speed={0.06 + i * 0.012}
          radius={1.5}
        />
      ))}
    </group>
  );
}

/* ── Floating particles (stars) ── */
function Particles({ count = 350, isDark = false }: { count?: number; isDark?: boolean }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 1] = (Math.random() - 0.5) * 12;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    return arr;
  }, [count]);

  return (
    <points>
      <bufferGeometry>
        {/* @ts-expect-error – @react-three/fiber bufferAttribute args vs props mismatch */}
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={isDark ? 0.015 : 0.010}
        color={isDark ? "#4B6EC4" : "#D4DCE6"}
        transparent
        opacity={isDark ? 0.6 : 0.25}
        sizeAttenuation
      />
    </points>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN EXPORT
   ══════════════════════════════════════════════════════════════ */

export function HeroGlobe() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => setMounted(true), []);
  // Render dark theme on SSR to avoid flash; refine on client
  const isDark = mounted ? theme === "dark" : false;

  return (
    <div
      className="w-full h-full min-h-[400px] motion-safe:transition-[opacity,transform] ease-out"
      style={{
        opacity: ready ? 1 : 0,
        transform: ready ? "scale(1)" : "scale(0.94)",
        transitionDuration: "1200ms",
      }}
    >
      <Canvas
        camera={{ position: [0, 0.2, 6.3], fov: 38 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
        onCreated={() => {
          // Globe geometry is up — ease it in once the first frame renders
          requestAnimationFrame(() => setReady(true));
        }}
      >
        {/* Lighting rig — bright for light mode, soft for dark mode */}
        {isDark ? (
          <>
            <ambientLight intensity={0.2} />
            <directionalLight position={[5, 3, 5]} intensity={0.8} color="#E8ECF2" />
            <directionalLight position={[0, 2, 4]} intensity={0.5} color="#ffffff" />
            <pointLight position={[-4, -2, -4]} intensity={0.3} color="#00B4C4" />
            <pointLight position={[3, 4, -2]} intensity={0.2} color="#F5821F" />
          </>
        ) : (
          <>
            {/* Cinematic light-mode rig — bright sun from upper-right, soft fill,
                ocean-blue rim, warm sunset accent on the opposite side */}
            <ambientLight intensity={0.55} />
            {/* Key light — sun */}
            <directionalLight position={[5, 4, 5]} intensity={1.8} color="#FFF4DB" />
            {/* Fill — cool sky */}
            <directionalLight position={[-4, 1, 3]} intensity={0.5} color="#DCE9FF" />
            {/* Rim — ocean reflection */}
            <pointLight position={[-4, -2, -4]} intensity={0.45} color="#4FA3FF" />
            {/* Sunset accent on back */}
            <pointLight position={[3, 2, -5]}  intensity={0.35} color="#FFB070" />
            {/* Soft under-light to lift shadows */}
            <pointLight position={[0, -4, 2]} intensity={0.18} color="#FFFFFF" />
          </>
        )}

        <Float speed={0.6} rotationIntensity={0.08} floatIntensity={0.2}>
          <GlobeMesh isDark={isDark} />
        </Float>

        {/* ── 3D Containers floating around globe ── */}
        {/* Orange container — top right of globe */}
        <Float speed={0.9} rotationIntensity={0.1} floatIntensity={0.25}>
          <ShippingContainer
            color="#E8721A"
            position={[1.4, 0.9, 1.2]}
            rotation={[0.1, -0.4, 0.08]}
            scale={1.5}
            floatSpeed={0.7}
          />
        </Float>

        {/* Dark blue container — bottom right of globe */}
        <Float speed={0.7} rotationIntensity={0.08} floatIntensity={0.2}>
          <ShippingContainer
            color="#1B3A6E"
            position={[0.5, -1.4, 1.3]}
            rotation={[-0.15, 0.5, -0.1]}
            scale={1.3}
            floatSpeed={0.5}
          />
        </Float>

        {/* Maroon container — left of globe, small */}
        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.25}>
          <ShippingContainer
            color="#7A2020"
            position={[-1.6, -0.3, 0.8]}
            rotation={[0.05, 1.2, 0.06]}
            scale={1}
            floatSpeed={0.8}
          />
        </Float>

        <Particles isDark={isDark} />

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.25}
          minPolarAngle={Math.PI * 0.3}
          maxPolarAngle={Math.PI * 0.7}
        />
      </Canvas>
    </div>
  );
}
