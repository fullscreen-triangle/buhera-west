/**
 * DirectionalLasers — N/S/E/W laser beams using three-laser-pointer.
 *
 * Replaces the earlier cylinder-mesh approach with proper line-based
 * lasers (geometry = BufferGeometry of 2 points, single LineBasicMaterial).
 * Each laser is a thin glowing line with a tip sphere; animated via
 * material opacity pulse.
 */

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import Laser from 'three-laser-pointer'

const BEAM_DEFS = [
  { dir: 'N', vec: [ 0, 0, -1], color: 0xff2820, hex: '#ff2820' },
  { dir: 'S', vec: [ 0, 0,  1], color: 0x1a4eff, hex: '#1a4eff' },
  { dir: 'E', vec: [ 1, 0,  0], color: 0x1aff33, hex: '#1aff33' },
  { dir: 'W', vec: [-1, 0,  0], color: 0xffb31a, hex: '#ffb31a' },
]

function BeamGroup({ baseY, radius }) {
  const groupRef = useRef()

  // build one Laser line per direction, plus a tip sphere
  const beams = useMemo(() => {
    return BEAM_DEFS.map(def => {
      const laser = new Laser({ color: def.color, maxPoints: 2 })
      laser.material.transparent = true
      laser.material.depthWrite = false
      laser.renderOrder = 999

      // beam goes from a small radius around center, outward & upward at ~30°
      const dirVec = new THREE.Vector3(...def.vec)
      const startOffset = 0.4
      const reach = radius * 1.3
      const upTilt = 0.45
      const start = new THREE.Vector3(
        dirVec.x * startOffset, baseY,
        dirVec.z * startOffset,
      )
      const end = new THREE.Vector3(
        dirVec.x * reach,
        baseY + reach * upTilt,
        dirVec.z * reach,
      )
      laser.setSource(start)
      laser.point(end)

      // tip sphere
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
        new THREE.MeshBasicMaterial({
          color: def.color, transparent: true,
          opacity: 0.9, depthWrite: false,
        }),
      )
      tip.position.copy(end)
      tip.renderOrder = 999

      return { laser, tip, def }
    })
  }, [baseY, radius])

  // attach to group on mount
  useEffect(() => {
    const g = groupRef.current
    if (!g) return
    beams.forEach(b => { g.add(b.laser); g.add(b.tip) })
    return () => {
      beams.forEach(b => {
        g.remove(b.laser); g.remove(b.tip)
        b.laser.geometry.dispose()
        b.laser.material.dispose()
        b.tip.geometry.dispose()
        b.tip.material.dispose()
      })
    }
  }, [beams])

  // pulse animation
  useFrame((state) => {
    const t = state.clock.elapsedTime
    beams.forEach((b, i) => {
      const phase = t * 2.5 + i * 0.7
      const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(phase))
      b.laser.material.opacity = pulse
      b.tip.material.opacity = 0.4 + pulse * 0.5
      const s = 0.85 + 0.3 * Math.sin(phase * 1.3)
      b.tip.scale.setScalar(s)
    })
  })

  return <group ref={groupRef} />
}

export default function DirectionalLasers({ radius = 10, amplitude = 3, visible = true }) {
  if (!visible) return null
  const baseY = amplitude * 0.4
  return <BeamGroup baseY={baseY} radius={radius} />
}
