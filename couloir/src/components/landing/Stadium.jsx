/**
 * Stadium — load a GLB and place it at a given world position with
 * automatic centring + scale-to-fit.
 *
 * The model's bounding box is computed; the model is recentred so its
 * base sits at y=0, then uniformly scaled so its longest horizontal
 * extent equals `targetSpanMeters`.  The whole thing is parented under
 * a group at `position` and rotated by `headingDeg` (compass degrees,
 * 0 = aligned with North on the map).
 *
 * If the GLB fails to load, renders a placeholder oval.
 */

import { Suspense, useMemo, useRef, useEffect } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

function StadiumModel({ url, targetSpanMeters, headingDeg }) {
  const { scene } = useGLTF(url)
  const groupRef = useRef()

  // Clone so we can mutate without affecting the cached source
  const cloned = useMemo(() => {
    const c = scene.clone(true)
    // ensure all meshes cast/receive shadows and have correct material
    c.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        if (o.material) {
          o.material.side = THREE.DoubleSide
        }
      }
    })
    return c
  }, [scene])

  // compute bbox + transform to fit target span
  const { positionOffset, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const span = Math.max(size.x, size.z)
    const s = span > 0 ? targetSpanMeters / span : 1.0

    return {
      // recentre on horizontal centre, lift so base sits at y=0
      positionOffset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
      scale: s,
    }
  }, [cloned, targetSpanMeters])

  return (
    <group
      ref={groupRef}
      rotation={[0, (headingDeg * Math.PI) / 180, 0]}
      scale={scale}
    >
      <primitive object={cloned} position={positionOffset.toArray()} />
    </group>
  )
}

function StadiumPlaceholder({ spanMeters }) {
  // simple oval ring approximating an athletics stadium
  const a = spanMeters / 2          // major semi-axis (X)
  const b = (spanMeters * 0.8) / 2  // minor semi-axis (Z)
  const ringHeight = spanMeters * 0.12

  // build an extruded oval
  const shape = useMemo(() => {
    const s = new THREE.Shape()
    const N = 64
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2
      const x = Math.cos(t) * a
      const z = Math.sin(t) * b
      if (i === 0) s.moveTo(x, z); else s.lineTo(x, z)
    }
    // hole = inner field
    const hole = new THREE.Path()
    const af = a * 0.4, bf = b * 0.6
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2
      const x = Math.cos(t) * af
      const z = Math.sin(t) * bf
      if (i === 0) hole.moveTo(x, z); else hole.lineTo(x, z)
    }
    s.holes.push(hole)
    return s
  }, [a, b])

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow>
      <extrudeGeometry
        args={[shape, { depth: ringHeight, bevelEnabled: false }]}
      />
      <meshStandardMaterial color="#bfbfbf" roughness={0.85} metalness={0.05} />
    </mesh>
  )
}

export default function Stadium({
  position = [0, 0, 0],         // [x, y, z] in metres
  url = '/models/stade_olympique_dathletisme_de_rades.glb',
  targetSpanMeters = 320,        // horizontal extent in metres
  headingDeg = 45,               // rotation about Y; tweak so axis aligns with terrain
}) {
  return (
    <group position={position}>
      <Suspense fallback={<StadiumPlaceholder spanMeters={targetSpanMeters} />}>
        <StadiumModel
          url={url}
          targetSpanMeters={targetSpanMeters}
          headingDeg={headingDeg}
        />
      </Suspense>
    </group>
  )
}

// preload the default GLB
useGLTF.preload('/models/stade_olympique_dathletisme_de_rades.glb')
