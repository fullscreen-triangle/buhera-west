/**
 * Lightning — load the lightning event GLB and place it above the
 * stadium with a subtle flicker.
 *
 * The "static with annotations" model is a snapshot of a lightning
 * leader.  We auto-fit its vertical extent to a target height (~600m
 * to match real cloud-to-ground scale relative to the stadium), then
 * lift it into the sky and animate a faint emissive pulse so it reads
 * as alive without the gimmickry of a strobe.
 */

import { Suspense, useMemo, useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const LIGHTNING_URL = '/models/lightning_event_19a-1_static_with_annotations.glb'

function LightningModel({ url, targetHeightMeters }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()

  // clone + emissive setup
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(o => {
      if (o.isMesh) {
        o.castShadow = false
        o.receiveShadow = false
        const mat = o.material
        if (mat) {
          // upgrade to a self-luminous appearance even on standard materials
          mat.transparent = true
          mat.depthWrite = false
          mat.side = THREE.DoubleSide
          if ('emissive' in mat) {
            mat.emissive = new THREE.Color('#cfd9ff')
            mat.emissiveIntensity = 1.4
          }
          if ('color' in mat) {
            mat.color = new THREE.Color('#e8efff')
          }
        }
      }
    })
    return c
  }, [scene])

  // bbox-based fit: scale so vertical extent equals targetHeightMeters,
  // then translate so the bottom of the bounding box sits at y = 0.
  const { positionOffset, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const span = Math.max(size.y, 1e-3)
    const s = targetHeightMeters / span

    return {
      positionOffset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
      scale: s,
    }
  }, [cloned, targetHeightMeters])

  // gentle flicker
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pulse = 0.7 + 0.3 * (
      0.5 * Math.sin(t * 1.7)
      + 0.5 * Math.sin(t * 5.3 + 1.0)
    )
    cloned.traverse(o => {
      if (o.isMesh && o.material) {
        if ('opacity' in o.material) o.material.opacity = pulse
        if ('emissiveIntensity' in o.material) {
          o.material.emissiveIntensity = 0.9 + pulse * 1.4
        }
      }
    })
  })

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={cloned} position={positionOffset.toArray()} />
    </group>
  )
}

export default function Lightning({
  position = [0, 0, 0],          // [x, y, z] world metres — base of the bolt
  targetHeightMeters = 700,
  url = LIGHTNING_URL,
}) {
  return (
    <group position={position}>
      <Suspense fallback={null}>
        <LightningModel url={url} targetHeightMeters={targetHeightMeters} />
      </Suspense>
      {/* faint volumetric glow at the strike point */}
      <pointLight
        color="#dde6ff"
        intensity={2.5}
        distance={400}
        decay={2}
      />
    </group>
  )
}

useGLTF.preload(LIGHTNING_URL)
