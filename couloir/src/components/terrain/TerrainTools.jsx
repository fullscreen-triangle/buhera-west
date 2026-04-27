/**
 * TerrainTools — interactive terrain tools that live inside the Canvas.
 *
 * Patterns adapted from three-geo's geo-viewer example:
 *   - Measurement: click on terrain → mark point; click again → finish
 *     pair, draw cyan line between them, report distance.
 *   - Orbit pivot: right-click → mark a vertical magenta axis at that
 *     point and signal the engine to use it as the orbit target.
 *
 * Picking is done with a CPU raycast against the terrain's height function
 * (terrainSampling.terrainHeight), since the GPU-displaced mesh has flat
 * vertex positions on the CPU side.  We march the ray and detect the
 * crossing where ray.y goes below terrain height.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Laser from 'three-laser-pointer'
import { terrainHeight } from './terrainSampling'

// ─── ray-vs-terrain-height intersection (CPU march) ─────────────

function intersectTerrain(ray, terrainParams, maxT = 200, step = 0.1) {
  const { radius, amplitude } = terrainParams
  const o = ray.origin, d = ray.direction
  const maxY = amplitude + 0.5
  const minY = -1.0
  let t = 0
  let prev = null
  // start: skip until ray enters the box [-radius, radius] in xz
  while (t < maxT) {
    const x = o.x + d.x * t
    const y = o.y + d.y * t
    const z = o.z + d.z * t
    if (y < minY) break
    if (y > maxY && d.y > 0) break
    const r = Math.sqrt(x * x + z * z)
    if (r > radius * 1.05) {
      // outside the cylinder — keep advancing in case ray re-enters
      t += step * 4
      prev = null
      continue
    }
    const h = terrainHeight(x, z, terrainParams)
    if (prev !== null && y <= h && prev.y > prev.h) {
      // crossed — refine with bisection
      let lo = prev.t, hi = t
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2
        const mx = o.x + d.x * mid
        const my = o.y + d.y * mid
        const mz = o.z + d.z * mid
        const mh = terrainHeight(mx, mz, terrainParams)
        if (my <= mh) hi = mid; else lo = mid
      }
      const tt = (lo + hi) / 2
      return new THREE.Vector3(
        o.x + d.x * tt,
        o.y + d.y * tt,
        o.z + d.z * tt,
      )
    }
    prev = { t, y, h }
    t += step
  }
  return null
}

// ─── component ──────────────────────────────────────────────────

export default function TerrainTools({
  terrainParams,
  enabled = true,
  onMeasureUpdate,    // (data) => void  { p1, p2, distance }
  onOrbitPivot,       // (pt) => void    Vector3 of new orbit target
  setOrbitTargetSignal, // a [number, fn] from parent — bumps to clear marks
}) {
  const { camera, gl, scene, raycaster, mouse } = useThree()
  const groupRef = useRef()

  // measurement state held in refs so click handler reads latest
  const stateRef = useRef({
    pendingFirst: null,   // Vector3 of first point picked but not finalised
    pairs: [],            // array of {p1, p2, laser}
  })

  // cleanup helpers
  const disposables = useRef([])

  // pivot axis (magenta vertical line)
  const pivotLaserRef = useRef(null)

  // tmp preview line for in-progress measurement
  const tmpLaserRef = useRef(null)

  // create the persistent group + tmp laser + pivot laser once
  useEffect(() => {
    const g = groupRef.current
    if (!g) return

    const tmp = new Laser({ color: 0xffffff, maxPoints: 2 })
    tmp.material.transparent = true
    tmp.material.opacity = 0.7
    tmp.material.depthWrite = false
    tmp.visible = false
    g.add(tmp)
    tmpLaserRef.current = tmp

    const pivot = new Laser({ color: 0xff44ff, maxPoints: 2 })
    pivot.material.transparent = true
    pivot.material.opacity = 0.85
    pivot.material.depthWrite = false
    pivot.visible = false
    g.add(pivot)
    pivotLaserRef.current = pivot

    return () => {
      g.remove(tmp); tmp.geometry.dispose(); tmp.material.dispose()
      g.remove(pivot); pivot.geometry.dispose(); pivot.material.dispose()
      stateRef.current.pairs.forEach(p => {
        g.remove(p.laser); g.remove(p.dotA); g.remove(p.dotB)
        p.laser.geometry.dispose(); p.laser.material.dispose()
        p.dotA.geometry.dispose(); p.dotA.material.dispose()
        p.dotB.geometry.dispose(); p.dotB.material.dispose()
      })
      stateRef.current.pairs.length = 0
    }
  }, [])

  // ─── pick utility ────────────────────────────────────────────
  const pickPoint = (clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const m = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    raycaster.setFromCamera(m, camera)
    return intersectTerrain(raycaster.ray, terrainParams)
  }

  // ─── handlers ────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return
    const el = gl.domElement

    const onMove = (e) => {
      const st = stateRef.current
      if (!st.pendingFirst) return
      const pt = pickPoint(e.clientX, e.clientY)
      const tmp = tmpLaserRef.current
      if (pt && tmp) {
        tmp.setSource(st.pendingFirst)
        tmp.point(pt, 0xffffff)
        tmp.visible = true
      } else if (tmp) {
        tmp.visible = false
      }
    }

    const onClick = (e) => {
      // ignore clicks that originated from drag
      if (e.button !== 0) return
      const pt = pickPoint(e.clientX, e.clientY)
      if (!pt) return

      const st = stateRef.current
      const g = groupRef.current

      if (st.pendingFirst === null) {
        // start a new measurement
        st.pendingFirst = pt.clone()
      } else {
        // finish the pair
        const p1 = st.pendingFirst
        const p2 = pt.clone()
        const laser = new Laser({ color: 0x00ffff, maxPoints: 2 })
        laser.material.transparent = true
        laser.material.opacity = 0.95
        laser.material.depthWrite = false
        laser.setSource(p1)
        laser.point(p2)
        g.add(laser)

        const dotA = makeDot(p1, 0x00ffff)
        const dotB = makeDot(p2, 0x00ffff)
        g.add(dotA); g.add(dotB)

        st.pairs.push({ p1, p2, laser, dotA, dotB })
        st.pendingFirst = null
        if (tmpLaserRef.current) tmpLaserRef.current.visible = false

        if (onMeasureUpdate) {
          onMeasureUpdate({
            p1: [p1.x, p1.y, p1.z],
            p2: [p2.x, p2.y, p2.z],
            distance: p1.distanceTo(p2),
            count: st.pairs.length,
          })
        }
      }
    }

    const onContextMenu = (e) => {
      e.preventDefault()
      const pt = pickPoint(e.clientX, e.clientY)
      if (!pt) return
      const pivot = pivotLaserRef.current
      if (pivot) {
        const top = pt.clone()
        top.y += Math.max(2, terrainParams.amplitude * 0.5)
        pivot.setSource(pt)
        pivot.point(top, 0xff44ff)
        pivot.visible = true
      }
      if (onOrbitPivot) onOrbitPivot(pt.clone())
    }

    const onKey = (e) => {
      if (e.code === 'KeyM' && !e.repeat) {
        // M clears all measurements
        clearMeasurements()
      }
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('click', onClick)
    el.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKey)
    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('click', onClick)
      el.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled, terrainParams.amplitude, terrainParams.frequency,
      terrainParams.octaves, terrainParams.lacunarity, terrainParams.gain,
      terrainParams.waterLevel, terrainParams.radius, terrainParams.heightmap])

  const clearMeasurements = () => {
    const g = groupRef.current
    const st = stateRef.current
    st.pairs.forEach(p => {
      g.remove(p.laser); g.remove(p.dotA); g.remove(p.dotB)
      p.laser.geometry.dispose(); p.laser.material.dispose()
      p.dotA.geometry.dispose(); p.dotA.material.dispose()
      p.dotB.geometry.dispose(); p.dotB.material.dispose()
    })
    st.pairs.length = 0
    st.pendingFirst = null
    if (tmpLaserRef.current) tmpLaserRef.current.visible = false
    if (onMeasureUpdate) onMeasureUpdate(null)
  }

  return <group ref={groupRef} />
}

function makeDot(pos, color) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false }),
  )
  m.position.copy(pos)
  m.renderOrder = 999
  return m
}
