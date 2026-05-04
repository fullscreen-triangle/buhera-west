/**
 * TerrainStadium — load a real-world reference building and place it on
 * the terrain at correct metric scale.
 *
 * Defaults to Olympiastadion Berlin (≈290 m long, real coordinates
 * 52.5145°N 13.2395°E).  Useful for calibrating the terrain’s vertical
 * amplitude, walker eye height and atmospheric altitude — once the
 * stadium *looks* like it’s 290 m long, the rest of the scene is at
 * the right scale.
 *
 * Scale derivation:
 *   metersPerWorldUnit = sizeMeters / (2 * radius)
 *   targetSpanWorldUnits = realSpanMeters / metersPerWorldUnit
 *
 * Position:
 *   Defaults to [0, ground, 0] (terrain centre, sampled height).  A
 *   geographic position [lat,lng] can be passed and is mapped onto the
 *   tile via the heightmap’s centre coordinates and `sizeMeters`.
 */

import { Suspense, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

import { terrainHeight } from './terrainSampling'

const DEFAULT_URL = '/models/olympiastadion_berlin.glb'

// ─── geographic placement helpers ───────────────────────────────────

/**
 * Map a (lat, lng) to terrain-local world (x, z) given the heightmap’s
 * centre coordinates and horizontal extent.  Uses a flat-earth
 * approximation valid over the few-km tile span.
 */
function geoToWorld(lat, lng, heightmap, radius) {
  const dLat = lat - heightmap.centerLat
  const dLng = lng - heightmap.centerLng
  const cosLat = Math.cos((heightmap.centerLat * Math.PI) / 180)
  const meanRadiusEarth = 6371008.8

  const dx_meters = dLng * (Math.PI / 180) * meanRadiusEarth * cosLat
  const dz_meters = -dLat * (Math.PI / 180) * meanRadiusEarth   // north → -Z

  const metersPerWorldUnit = heightmap.sizeMeters / (2 * radius)
  return [dx_meters / metersPerWorldUnit, dz_meters / metersPerWorldUnit]
}

// ─── loaded-model component (Suspense child) ────────────────────────

function StadiumModel({ url, targetSpanWorldUnits, headingDeg }) {
  const { scene } = useGLTF(url)

  const cloned = useMemo(() => {
    const c = scene.clone(true)
    c.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        if (o.material) o.material.side = THREE.DoubleSide
      }
    })
    return c
  }, [scene])

  const { positionOffset, scale } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const span = Math.max(size.x, size.z)
    const s = span > 0 ? targetSpanWorldUnits / span : 1.0

    return {
      positionOffset: new THREE.Vector3(-center.x, -box.min.y, -center.z),
      scale: s,
    }
  }, [cloned, targetSpanWorldUnits])

  return (
    <group
      rotation={[0, (headingDeg * Math.PI) / 180, 0]}
      scale={scale}
    >
      <primitive object={cloned} position={positionOffset.toArray()} />
    </group>
  )
}

// ─── locator dot (visible at any zoom) ──────────────────────────────

function LocatorDot({ y, sizeWorldUnits }) {
  return (
    <mesh position={[0, y, 0]}>
      <sphereGeometry args={[Math.max(sizeWorldUnits * 0.05, 0.05), 12, 12]} />
      <meshBasicMaterial color={[1.0, 0.65, 0.18]} />
    </mesh>
  )
}

// ─── public component ───────────────────────────────────────────────

/**
 * @param {Object}   props
 * @param {Object}   props.heightmap       — heightmap descriptor
 *                   ({ sizeMeters, centerLat, centerLng, ... })
 * @param {Object}   props.terrainParams   — params for terrainHeight() lookup
 * @param {number}   props.radius          — terrain disc radius in world units
 * @param {string}   [props.url]           — GLB path
 * @param {number}   [props.realSpanMeters] — real horizontal extent
 * @param {number}   [props.headingDeg]
 * @param {[number,number]} [props.geo]   — [lat, lng]; defaults to terrain centre
 * @param {boolean}  [props.showLocator]   — small bright dot at base
 */
export default function TerrainStadium({
  heightmap,
  terrainParams,
  radius,
  url            = DEFAULT_URL,
  realSpanMeters = 290,
  headingDeg     = 0,
  geo            = null,
  showLocator    = true,
}) {
  if (!heightmap || !heightmap.sizeMeters) return null

  const metersPerWorldUnit = heightmap.sizeMeters / (2 * radius)
  const targetSpanWorldUnits = realSpanMeters / metersPerWorldUnit

  // Default: place at terrain centre.  If geo is given, project it.
  let xz = [0, 0]
  if (geo && Array.isArray(geo) && geo.length === 2) {
    xz = geoToWorld(geo[0], geo[1], heightmap, radius)
  }
  const [wx, wz] = xz

  // Sample terrain surface at the placement.
  const groundY = terrainParams ? terrainHeight(wx, wz, terrainParams) : 0

  // If the projected position falls outside the disc, clamp inward so
  // the model stays visible (still useful as a sizing reference).
  const r = Math.sqrt(wx * wx + wz * wz)
  const safeFactor = r > radius * 0.95 ? (radius * 0.85) / Math.max(r, 1e-3) : 1
  const px = wx * safeFactor
  const pz = wz * safeFactor

  return (
    <group position={[px, groundY, pz]}>
      {showLocator && (
        <LocatorDot y={targetSpanWorldUnits * 0.25} sizeWorldUnits={targetSpanWorldUnits} />
      )}
      <Suspense fallback={null}>
        <StadiumModel
          url={url}
          targetSpanWorldUnits={targetSpanWorldUnits}
          headingDeg={headingDeg}
        />
      </Suspense>
    </group>
  )
}

// preload
useGLTF.preload(DEFAULT_URL)
