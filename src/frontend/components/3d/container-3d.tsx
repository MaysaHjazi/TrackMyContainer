"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

/* ── 3D Shipping Container ── */
function Container() {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.getElapsedTime() * 0.3) * 0.15 + 0.4;
      groupRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.2) * 0.05 - 0.1;
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.08} floatIntensity={0.4}>
      <group ref={groupRef} scale={0.9}>
        {/* Main container body */}
        <RoundedBox args={[2.4, 1.2, 1]} radius={0.03} smoothness={4} position={[0, 0, 0]}>
          <meshPhongMaterial color="#1B2B5E" shininess={60} />
        </RoundedBox>

        {/* Container ribs (corrugation lines) */}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={`rib-${i}`} position={[-1.05 + i * 0.22, 0, 0.505]}>
            <boxGeometry args={[0.02, 1.1, 0.02]} />
            <meshPhongMaterial color="#152249" />
          </mesh>
        ))}

        {/* Side ribs */}
        {Array.from({ length: 10 }).map((_, i) => (
          <mesh key={`rib-side-${i}`} position={[-1.05 + i * 0.22, 0, -0.505]}>
            <boxGeometry args={[0.02, 1.1, 0.02]} />
            <meshPhongMaterial color="#152249" />
          </mesh>
        ))}

        {/* Top edge highlight */}
        <mesh position={[0, 0.61, 0]}>
          <boxGeometry args={[2.42, 0.02, 1.02]} />
          <meshPhongMaterial color="#2B4BAB" />
        </mesh>

        {/* Bottom edge */}
        <mesh position={[0, -0.61, 0]}>
          <boxGeometry args={[2.42, 0.02, 1.02]} />
          <meshPhongMaterial color="#0F1933" />
        </mesh>

        {/* Front door face */}
        <mesh position={[1.205, 0, 0]}>
          <boxGeometry args={[0.03, 1.2, 1]} />
          <meshPhongMaterial color="#152249" />
        </mesh>

        {/* Door locking bars */}
        {[-0.3, -0.1, 0.1, 0.3].map((z, i) => (
          <mesh key={`lock-${i}`} position={[1.225, 0.2, z]}>
            <cylinderGeometry args={[0.012, 0.012, 0.35, 8]} />
            <meshPhongMaterial color="#F5F1E6" shininess={80} />
          </mesh>
        ))}

        {/* Orange arrow swoosh */}
        <mesh position={[0, -0.35, 0.52]} rotation={[0, 0, 0.15]}>
          <torusGeometry args={[0.8, 0.035, 8, 32, Math.PI * 0.7]} />
          <meshPhongMaterial color="#F5821F" emissive="#F5821F" emissiveIntensity={0.3} />
        </mesh>

        {/* TrackMyContainer.ai text on side (simple bar as label placeholder) */}
        <mesh position={[0, 0.35, 0.51]}>
          <boxGeometry args={[1.2, 0.08, 0.01]} />
          <meshPhongMaterial color="#2B4BAB" />
        </mesh>
      </group>
    </Float>
  );
}

/* ── Exported component ── */
export function HeroContainer() {
  return (
    <div className="w-full h-full min-h-[300px]">
      <Canvas
        camera={{ position: [2.5, 1, 2.5], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#E8ECF2" />
        <pointLight position={[-3, 2, -3]} intensity={0.4} color="#00B4C4" />
        <pointLight position={[3, -2, 3]} intensity={0.2} color="#F5821F" />

        <Container />
      </Canvas>
    </div>
  );
}
