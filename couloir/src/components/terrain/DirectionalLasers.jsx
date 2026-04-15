/**
 * DirectionalLasers — 3D laser beams for N/S/E/W directional encoding.
 *
 * Each laser is a cylinder mesh rising from the terrain edge, angled
 * outward and upward.  Animated pulsing glow via emissive + opacity.
 */

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function LaserBeam({ direction, color, radius, height, baseY }) {
  const groupRef = useRef()
  const matRef = useRef()

  const beamLength = radius * 1.3
  const beamRadius = 0.03

  // direction vector on the XZ plane
  const dir = useMemo(() => {
    const d = new THREE.Vector3(...direction).normalize()
    return d
  }, [direction])

  // position: start at terrain edge, pointing outward + upward
  const position = useMemo(() => {
    return [dir.x * radius * 0.15, baseY, dir.z * radius * 0.15]
  }, [dir, radius, baseY])

  // rotation: tilt beam from vertical toward the direction
  const rotation = useMemo(() => {
    // beam goes from center outward at ~30 degrees above horizontal
    const tiltAngle = Math.PI * 0.35 // angle from vertical
    const azimuth = Math.atan2(dir.x, dir.z)
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    euler.y = -azimuth
    euler.x = tiltAngle
    return euler
  }, [dir])

  // material
  const material = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: new THREE.Color(...color),
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useMemo(() => {
    if (material) {
      material.color.setRGB(...color)
    }
  }, [material, color])

  // animate pulse
  useFrame((state) => {
    if (material) {
      const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 3.0)
      material.opacity = 0.3 + pulse * 0.5
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* main beam — thin cylinder */}
      <mesh material={material}>
        <cylinderGeometry args={[beamRadius, beamRadius * 0.3, beamLength, 8, 1, true]} />
      </mesh>
      {/* glow — wider, more transparent */}
      <mesh>
        <cylinderGeometry args={[beamRadius * 4, beamRadius * 1.5, beamLength, 8, 1, true]} />
        <meshBasicMaterial
          color={new THREE.Color(...color)}
          transparent
          opacity={0.08}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* tip — small sphere */}
      <mesh position={[0, beamLength / 2, 0]}>
        <sphereGeometry args={[beamRadius * 2.5, 8, 8]} />
        <meshBasicMaterial
          color={new THREE.Color(...color)}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}

export default function DirectionalLasers({ radius = 10, amplitude = 3, visible = true }) {
  if (!visible) return null

  const baseY = amplitude * 0.3 // start from mid-terrain height

  const beams = [
    { direction: [0, 0, -1], color: [1.0, 0.15, 0.1], label: 'N' },   // North: -Z in world
    { direction: [0, 0, 1],  color: [0.1, 0.3, 1.0],  label: 'S' },   // South: +Z
    { direction: [1, 0, 0],  color: [0.1, 1.0, 0.2],  label: 'E' },   // East: +X
    { direction: [-1, 0, 0], color: [1.0, 0.7, 0.1],  label: 'W' },   // West: -X
  ]

  return (
    <group>
      {beams.map((beam) => (
        <LaserBeam
          key={beam.label}
          direction={beam.direction}
          color={beam.color}
          radius={radius}
          height={amplitude}
          baseY={baseY}
        />
      ))}
    </group>
  )
}
