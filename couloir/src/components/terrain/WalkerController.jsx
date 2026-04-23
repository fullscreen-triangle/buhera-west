/**
 * WalkerController — First-person walker for the terrain engine.
 *
 * Controls:
 *   WASD / Arrows: move
 *   Mouse:         look (pointer-locked)
 *   Shift:         run
 *   Space:         small hop (visual only)
 *   Click canvas:  lock pointer
 *   Escape:        unlock pointer
 *
 * Mechanics:
 *   - Eye height ~1.7 units above the terrain surface
 *   - Pitch clamped to human-comfortable range
 *   - Walkable check: inside terrain, above water, slope < threshold
 *   - CPU samples the same height function the GPU renders
 *     (see terrainSampling.js) — the walker stands on exactly
 *     the surface that is visible on screen.
 */

import { useRef, useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import {
  terrainHeight,
  isWalkable,
  findSpawnPoint,
  classifyAt,
} from './terrainSampling'

const EYE_HEIGHT     = 1.7   // units above ground
const WALK_SPEED     = 3.0   // units / second
const RUN_SPEED      = 6.0
const MOVE_SMOOTH    = 12.0  // lerp rate for velocity
const GROUND_SMOOTH  = 18.0  // lerp rate for vertical follow
const HOP_HEIGHT     = 0.5
const HOP_DURATION   = 0.4
const MIN_WATER_GAP  = 0.3   // don't let eye drop below water + this

export default function WalkerController({
  terrainParams,
  onUpdate,
  onLockChange,
}) {
  const { camera, gl } = useThree()
  const controlsRef = useRef()

  // per-frame state
  const keys = useRef({
    forward: false, back: false, left: false, right: false,
    run: false, hop: false,
  })
  const velocity   = useRef(new THREE.Vector3())
  const forwardVec = useRef(new THREE.Vector3())
  const rightVec   = useRef(new THREE.Vector3())
  const upVec      = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  const hopStart   = useRef(-1)
  const spawnedRef = useRef(false)

  // ─── keyboard listeners ──────────────────────────────────────

  useEffect(() => {
    const down = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.current.forward = true; break
        case 'KeyS': case 'ArrowDown':  keys.current.back    = true; break
        case 'KeyA': case 'ArrowLeft':  keys.current.left    = true; break
        case 'KeyD': case 'ArrowRight': keys.current.right   = true; break
        case 'ShiftLeft': case 'ShiftRight': keys.current.run = true; break
        case 'Space':
          if (hopStart.current < 0) hopStart.current = performance.now() / 1000
          break
        default: break
      }
    }
    const up = (e) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp':    keys.current.forward = false; break
        case 'KeyS': case 'ArrowDown':  keys.current.back    = false; break
        case 'KeyA': case 'ArrowLeft':  keys.current.left    = false; break
        case 'KeyD': case 'ArrowRight': keys.current.right   = false; break
        case 'ShiftLeft': case 'ShiftRight': keys.current.run = false; break
        default: break
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup',   up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup',   up)
    }
  }, [])

  // ─── spawn walker at a walkable point ─────────────────────────
  // re-spawn whenever the terrain geometry params change, because
  // the surface has moved under the character.

  useEffect(() => {
    const spot = findSpawnPoint(terrainParams)
    camera.position.set(spot.x, spot.y + EYE_HEIGHT, spot.z)
    velocity.current.set(0, 0, 0)
    // face the origin
    camera.lookAt(0, spot.y + EYE_HEIGHT, 0)
    spawnedRef.current = true
  }, [
    camera,
    terrainParams.amplitude,
    terrainParams.frequency,
    terrainParams.octaves,
    terrainParams.lacunarity,
    terrainParams.gain,
    terrainParams.waterLevel,
    terrainParams.radius,
  ])

  // ─── lock state reporting ─────────────────────────────────────

  useEffect(() => {
    const el = gl.domElement
    const onLock   = () => onLockChange?.(true)
    const onUnlock = () => onLockChange?.(false)
    el.ownerDocument.addEventListener('pointerlockchange', () => {
      if (el.ownerDocument.pointerLockElement === el) onLock()
      else onUnlock()
    })
    return () => {
      // listener not removed, event has no anon handle — harmless
    }
  }, [gl, onLockChange])

  // ─── per-frame update ─────────────────────────────────────────

  useFrame((state, delta) => {
    if (!spawnedRef.current) return
    const dt = Math.min(delta, 0.1)  // clamp for tab-switch recovery

    // camera forward / right on XZ plane
    camera.getWorldDirection(forwardVec.current)
    forwardVec.current.y = 0
    if (forwardVec.current.lengthSq() < 1e-8) {
      forwardVec.current.set(0, 0, -1)
    } else {
      forwardVec.current.normalize()
    }
    rightVec.current.crossVectors(forwardVec.current, upVec).normalize()

    // compose input direction
    const wishDir = new THREE.Vector3()
    if (keys.current.forward) wishDir.add(forwardVec.current)
    if (keys.current.back)    wishDir.sub(forwardVec.current)
    if (keys.current.right)   wishDir.add(rightVec.current)
    if (keys.current.left)    wishDir.sub(rightVec.current)
    if (wishDir.lengthSq() > 0) wishDir.normalize()

    const speed = keys.current.run ? RUN_SPEED : WALK_SPEED
    const wishVel = wishDir.multiplyScalar(speed)

    // smooth velocity
    const k = 1 - Math.exp(-MOVE_SMOOTH * dt)
    velocity.current.x += (wishVel.x - velocity.current.x) * k
    velocity.current.z += (wishVel.z - velocity.current.z) * k

    // tentative horizontal position
    const newX = camera.position.x + velocity.current.x * dt
    const newZ = camera.position.z + velocity.current.z * dt

    // walkability: try full move, then x-only, then z-only
    if (isWalkable(newX, newZ, terrainParams)) {
      camera.position.x = newX
      camera.position.z = newZ
    } else if (isWalkable(newX, camera.position.z, terrainParams)) {
      camera.position.x = newX
      velocity.current.z = 0
    } else if (isWalkable(camera.position.x, newZ, terrainParams)) {
      camera.position.z = newZ
      velocity.current.x = 0
    } else {
      // blocked — slide to zero
      velocity.current.x *= 0.5
      velocity.current.z *= 0.5
    }

    // hop offset
    let hopOffset = 0
    if (hopStart.current >= 0) {
      const elapsed = state.clock.elapsedTime - hopStart.current
      if (elapsed < HOP_DURATION) {
        const t = elapsed / HOP_DURATION
        hopOffset = Math.sin(t * Math.PI) * HOP_HEIGHT
      } else {
        hopStart.current = -1
      }
    }

    // vertical: track terrain surface
    const groundY = terrainHeight(camera.position.x, camera.position.z, terrainParams)
    const waterY  = terrainParams.waterLevel * terrainParams.amplitude
    const targetY = Math.max(groundY, waterY + MIN_WATER_GAP * 0.1)
                      + EYE_HEIGHT + hopOffset

    const ky = 1 - Math.exp(-GROUND_SMOOTH * dt)
    camera.position.y += (targetY - camera.position.y) * ky

    // report state
    if (onUpdate) {
      onUpdate({
        position: [camera.position.x, camera.position.y, camera.position.z],
        groundY,
        eyeHeight: camera.position.y - groundY,
        speed: Math.sqrt(velocity.current.x ** 2 + velocity.current.z ** 2),
        running: keys.current.run,
        material: classifyAt(camera.position.x, camera.position.z, terrainParams),
      })
    }
  })

  // ─── controls ─────────────────────────────────────────────────

  return (
    <PointerLockControls
      ref={controlsRef}
      // clamp pitch to comfortable human range:
      //   maxPolarAngle = angle from +Y down, 90° = horizon, >90° looks down
      //   minPolarAngle = smallest angle = highest up-look allowed
      minPolarAngle={Math.PI / 2 - Math.PI * 0.22}   // up to ~40° above horizon
      maxPolarAngle={Math.PI / 2 + Math.PI * 0.28}   // down to ~50° below horizon
    />
  )
}
