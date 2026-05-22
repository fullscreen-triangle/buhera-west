/**
 * StreetViewEngine — third-person terrain exploration.
 *
 * The user sees the avatar walking on real Mapbox terrain.
 * Camera follows behind the character; mouse-drag rotates it.
 *
 * Controls:
 *   Mouse drag (left button)  — rotate camera around character
 *   W / Arrow-up              — walk forward
 *   S / Arrow-down            — walk backward
 *   A / Arrow-left            — strafe left
 *   D / Arrow-right           — strafe right
 *   Shift                     — run
 *   Scroll wheel              — zoom in / out
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  buildHeightmap,
  buildSatelliteCanvas,
  PRESET_LOCATIONS,
} from './mapbox'
import { sampleHeightmap } from './terrainSampling'

// ─── constants ──────────────────────────────────────────────────────
const EYE_HEIGHT  = 1.7    // metres — camera look-at point above character feet
const CAMERA_DIST = 10     // metres behind character
const CAMERA_H    = 4      // metres above character feet
const WALK_SPEED  = 4      // m/s  realistic walk
const RUN_SPEED   = 10     // m/s  realistic run
const SEGMENTS    = 256    // terrain mesh grid

// ─── terrain geometry (CPU, no rotation tricks) ─────────────────────
// Vertices placed at (x, h*amplitude, z) in world space directly.
// UV: u=east, v=north-at-top so satellite image is north-up.
function buildTerrainGeo(hm, radius, amplitude) {
  const s = SEGMENTS
  const n = s + 1
  const pos = new Float32Array(n * n * 3)
  const uv  = new Float32Array(n * n * 2)
  const idx = []

  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const x = (ix / s - 0.5) * 2 * radius
      const z = (iz / s - 0.5) * 2 * radius
      const h = sampleHeightmap(x, z, hm, radius) * amplitude
      const i = iz * n + ix
      pos[i*3]   = x
      pos[i*3+1] = h
      pos[i*3+2] = z
      uv[i*2]   = ix / s
      uv[i*2+1] = 1 - iz / s
    }
  }

  for (let iz = 0; iz < s; iz++) {
    for (let ix = 0; ix < s; ix++) {
      const a = iz*n+ix, b = a+1, c = (iz+1)*n+ix, d = c+1
      idx.push(a, b, d,  a, d, c)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv',       new THREE.BufferAttribute(uv,  2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// ─── component ──────────────────────────────────────────────────────
export default function StreetViewEngine({ style, className }) {
  const mountRef  = useRef(null)
  const engineRef = useRef(null)

  const [status,    setStatus   ] = useState('idle')
  const [loading,   setLoading  ] = useState(false)
  const [presetIdx, setPresetIdx] = useState(1)
  const [hud,       setHud      ] = useState(null)
  const [animNames, setAnimNames] = useState([])

  // ── Three.js engine (mount once) ─────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    // renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = false
    el.appendChild(renderer.domElement)

    // scene + sky
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8ec8f0)
    scene.fog = new THREE.FogExp2(0xb8d8f0, 0.00002)

    // camera — starts far away, repositioned when terrain loads
    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.5, 120000)
    camera.position.set(0, 8000, 0)

    // lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const sun = new THREE.DirectionalLight(0xfff5dd, 1.1)
    sun.position.set(5000, 8000, 3000)
    scene.add(sun)

    // ── mutable state (accessible from frame loop + loadPreset) ─────
    const S = {
      terrain:  null,       // { hm, radius, amplitude }
      charPos:  new THREE.Vector3(),
      charYaw:  0,          // character Y-rotation (radians)
      camYaw:   0,          // horizontal camera angle
      camPitch: 0.35,       // vertical camera angle (0=level, ~0.7=top-down)
      camZoom:  1.0,        // zoom multiplier
      vel:      new THREE.Vector3(),
      keys:     {},
      isDrag:   false,
      lastMX:   0, lastMY: 0,
      character: null,      // THREE.Group from GLTF
      mixer:    null,
      clips:    {},         // { idle, walk, run }
      curClip:  null,
      spawned:  false,
    }
    engineRef.current = { scene, camera, renderer, S }

    // ── load GLB character ───────────────────────────────────────────
    const loader = new GLTFLoader()
    loader.load(
      '/models/xbot_multiple_animations.glb',
      (gltf) => {
        S.character = gltf.scene
        S.character.scale.setScalar(1)
        S.character.visible = false  // hidden until terrain loads
        scene.add(S.character)

        S.mixer = new THREE.AnimationMixer(S.character)

        // map animation clips by name (case-insensitive fuzzy match)
        const names = gltf.animations.map(c => c.name)
        setAnimNames(names)

        gltf.animations.forEach(clip => {
          const n = clip.name.toLowerCase()
          if (!S.clips.idle && (n.includes('idle') || n.includes('stand') || n.includes('tpose')))
            S.clips.idle = S.mixer.clipAction(clip)
          else if (!S.clips.run && (n.includes('run') || n.includes('sprint') || n.includes('jog')))
            S.clips.run = S.mixer.clipAction(clip)
          else if (!S.clips.walk && n.includes('walk'))
            S.clips.walk = S.mixer.clipAction(clip)
        })

        // fallback: assign by order if name matching failed
        if (!S.clips.idle && gltf.animations[0]) S.clips.idle = S.mixer.clipAction(gltf.animations[0])
        if (!S.clips.walk && gltf.animations[1]) S.clips.walk = S.mixer.clipAction(gltf.animations[1])
        if (!S.clips.run  && gltf.animations[2]) S.clips.run  = S.mixer.clipAction(gltf.animations[2])

        // start idle
        if (S.clips.idle) { S.clips.idle.play(); S.curClip = 'idle' }
        else if (S.clips.walk) { S.clips.walk.play(); S.curClip = 'walk' }
      },
      undefined,
      (err) => console.warn('GLB load error:', err),
    )

    // ── animation state machine ──────────────────────────────────────
    function setClip(name) {
      if (name === S.curClip) return
      const fallback = S.clips.idle || S.clips.walk || S.clips.run
      const from = S.clips[S.curClip]
      const to   = S.clips[name] || fallback
      if (!to) return
      if (from && from !== to) from.fadeOut(0.15)
      to.reset().fadeIn(0.15).play()
      S.curClip = name
    }

    // ── frame loop ───────────────────────────────────────────────────
    let lastT = performance.now()
    let animId

    function frame() {
      animId = requestAnimationFrame(frame)
      const now = performance.now()
      const dt  = Math.min((now - lastT) / 1000, 0.1)
      lastT = now

      if (S.mixer) S.mixer.update(dt)

      const { terrain, charPos, vel, keys } = S

      if (terrain && S.spawned && S.character) {
        // ── movement direction from camera yaw ──────────────────────
        const fwdX = -Math.sin(S.camYaw)
        const fwdZ = -Math.cos(S.camYaw)
        const rgtX =  Math.cos(S.camYaw)
        const rgtZ = -Math.sin(S.camYaw)

        let wx = 0, wz = 0
        if (keys.KeyW || keys.ArrowUp)    { wx += fwdX; wz += fwdZ }
        if (keys.KeyS || keys.ArrowDown)  { wx -= fwdX; wz -= fwdZ }
        if (keys.KeyD || keys.ArrowRight) { wx += rgtX; wz += rgtZ }
        if (keys.KeyA || keys.ArrowLeft)  { wx -= rgtX; wz -= rgtZ }

        const moving  = wx*wx + wz*wz > 0.01
        const running = moving && (keys.ShiftLeft || keys.ShiftRight)
        const speed   = running ? RUN_SPEED : WALK_SPEED

        if (moving) {
          const len = Math.sqrt(wx*wx + wz*wz)
          wx /= len; wz /= len
          // face movement direction
          S.charYaw = Math.atan2(-wx, -wz)
        }

        // smooth velocity
        const k = 1 - Math.exp(-14 * dt)
        vel.x += ((moving ? wx * speed : 0) - vel.x) * k
        vel.z += ((moving ? wz * speed : 0) - vel.z) * k

        // move character
        const nx = charPos.x + vel.x * dt
        const nz = charPos.z + vel.z * dt
        const r2 = nx*nx + nz*nz
        if (r2 < (terrain.radius * 0.95) ** 2) {
          charPos.x = nx; charPos.z = nz
        } else {
          vel.x *= 0.1; vel.z *= 0.1
        }

        // snap to terrain surface
        const hNorm = sampleHeightmap(charPos.x, charPos.z, terrain.hm, terrain.radius)
        charPos.y = hNorm * terrain.amplitude

        // apply to Three.js object
        S.character.position.copy(charPos)
        S.character.rotation.y = S.charYaw

        // animations
        if (!moving)        setClip('idle')
        else if (running)   setClip('run')
        else                setClip('walk')

        // ── third-person camera ─────────────────────────────────────
        const dist   = CAMERA_DIST * S.camZoom
        const height = CAMERA_H   * S.camZoom

        // camera sits behind character, elevated by camPitch
        const camX = charPos.x + Math.sin(S.camYaw) * dist * Math.cos(S.camPitch)
        const camZ = charPos.z + Math.cos(S.camYaw) * dist * Math.cos(S.camPitch)
        const camY = charPos.y + height + dist * Math.sin(S.camPitch)

        // keep camera above terrain
        const camHNorm = sampleHeightmap(camX, camZ, terrain.hm, terrain.radius)
        const camFloor = camHNorm * terrain.amplitude + 1.0
        camera.position.set(camX, Math.max(camFloor, camY), camZ)
        camera.lookAt(charPos.x, charPos.y + EYE_HEIGHT, charPos.z)

        // HUD (throttled)
        if (Math.random() < 0.1) {
          setHud({
            x: charPos.x / 1000, z: charPos.z / 1000,
            alt: charPos.y,
            spd: Math.sqrt(vel.x**2 + vel.z**2),
            run: running,
          })
        }
      }

      renderer.render(scene, camera)
    }
    frame()

    // ── input ────────────────────────────────────────────────────────
    const onKeyDown = e => { S.keys[e.code] = true }
    const onKeyUp   = e => { S.keys[e.code] = false }

    // mouse drag → rotate camera
    const onMouseDown = e => {
      if (e.button !== 0) return
      S.isDrag = true; S.lastMX = e.clientX; S.lastMY = e.clientY
    }
    const onMouseMove = e => {
      if (!S.isDrag) return
      S.camYaw   -= (e.clientX - S.lastMX) * 0.007
      S.camPitch  = Math.max(0.05, Math.min(0.9, S.camPitch + (e.clientY - S.lastMY) * 0.004))
      S.lastMX = e.clientX; S.lastMY = e.clientY
    }
    const onMouseUp   = () => { S.isDrag = false }

    // scroll → zoom
    const onWheel = e => {
      S.camZoom = Math.max(0.5, Math.min(4, S.camZoom + e.deltaY * 0.001))
    }

    // resize
    const onResize = () => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
    }

    window.addEventListener('keydown',   onKeyDown)
    window.addEventListener('keyup',     onKeyUp)
    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('resize',    onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('keydown',   onKeyDown)
      window.removeEventListener('keyup',     onKeyUp)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize',    onResize)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // ── load Mapbox terrain ──────────────────────────────────────────
  const loadPreset = useCallback(async (idx) => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) { setStatus('error: NEXT_PUBLIC_MAPBOX_TOKEN not set'); return }

    const p = PRESET_LOCATIONS[idx]
    setLoading(true)
    setStatus(`loading ${p.name}…`)

    try {
      const [hm, sat] = await Promise.all([
        buildHeightmap(p.lat, p.lng, p.zoom, token),
        buildSatelliteCanvas(p.lat, p.lng, p.zoom, token),
      ])

      const radius    = hm.sizeMeters / 2
      const amplitude = Math.max(1, hm.rangeM)

      setStatus('building terrain…')
      const geo  = buildTerrainGeo(hm, radius, amplitude)
      const tex  = new THREE.CanvasTexture(sat)
      tex.colorSpace = THREE.SRGBColorSpace
      const mat  = new THREE.MeshLambertMaterial({ map: tex })
      const mesh = new THREE.Mesh(geo, mat)

      const { scene, S, camera } = engineRef.current

      // swap terrain
      scene.children
        .filter(c => c.userData.isTerrain)
        .forEach(c => { scene.remove(c); c.geometry?.dispose(); c.material?.map?.dispose(); c.material?.dispose() })
      mesh.userData.isTerrain = true
      scene.add(mesh)

      // find spawn point — dry land, away from edges
      let sx = 0, sz = 0, sy = 0
      for (let i = 0; i < 500; i++) {
        const a = Math.random() * Math.PI * 2
        const r = 1000 + Math.random() * (radius * 0.45)
        const x = r * Math.cos(a)
        const z = r * Math.sin(a)
        const h = sampleHeightmap(x, z, hm, radius)
        if (h > 0.08 && h < 0.92) { sx = x; sy = h * amplitude; sz = z; break }
      }

      // place character
      S.terrain  = { hm, radius, amplitude }
      S.charPos.set(sx, sy, sz)
      S.charYaw  = 0
      S.camYaw   = 0
      S.camPitch = 0.35
      S.camZoom  = 1
      S.vel.set(0, 0, 0)
      S.spawned  = true

      if (S.character) {
        S.character.position.set(sx, sy, sz)
        S.character.rotation.y = 0
        S.character.visible = true
      }

      // position camera behind character immediately
      const camX = sx + Math.sin(S.camYaw) * CAMERA_DIST
      const camZ = sz + Math.cos(S.camYaw) * CAMERA_DIST
      const camY = sy + CAMERA_H
      camera.position.set(camX, camY, camZ)
      camera.lookAt(sx, sy + EYE_HEIGHT, sz)

      const km = (hm.sizeMeters / 1000).toFixed(1)
      setStatus(`${p.name} · ${km} km wide · ${Math.round(hm.minHeightM)}–${Math.round(hm.maxHeightM)} m`)
    } catch (err) {
      console.error(err)
      setStatus(`error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadPreset(1) }, [loadPreset])

  return (
    <div
      className={className}
      style={{
        position: 'relative', width: '100%', height: '100%',
        background: '#060608', userSelect: 'none',
        ...style,
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* HUD */}
      <div style={{
        position: 'absolute', top: 12, left: 12,
        background: 'rgba(0,0,0,.72)', border: '1px solid rgba(88,230,217,.15)',
        borderRadius: 8, padding: '10px 14px', width: 234,
        fontFamily: 'monospace', fontSize: 10, color: '#aaa', zIndex: 10,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: '#58E6D9', fontSize: 11, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
          STREET VIEW
        </div>

        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          <select
            value={presetIdx}
            onChange={e => setPresetIdx(+e.target.value)}
            style={{ flex: 1, background: 'rgba(255,255,255,.04)', color: '#ccc', border: '1px solid rgba(255,255,255,.08)', borderRadius: 3, padding: '3px 6px', fontSize: 9, fontFamily: 'monospace' }}
          >
            {PRESET_LOCATIONS.map((p, i) => <option key={p.name} value={i}>{p.name}</option>)}
          </select>
          <button
            onClick={() => loadPreset(presetIdx)}
            disabled={loading}
            style={{ background: loading ? '#333' : '#58E6D9', color: loading ? '#666' : '#000', border: 'none', borderRadius: 3, padding: '3px 8px', fontSize: 9, fontWeight: 700, fontFamily: 'monospace', cursor: loading ? 'default' : 'pointer' }}
          >{loading ? '…' : 'LOAD'}</button>
        </div>

        <div style={{ fontSize: 9, color: status.startsWith('error') ? '#f77' : status.includes('m') && !loading ? '#58E6D9' : '#666', marginBottom: 4 }}>
          {status}
        </div>

        {hud && (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', margin: '4px 0' }} />
            <div>{hud.x.toFixed(2)} km E · {hud.z.toFixed(2)} km S</div>
            <div>alt {hud.alt.toFixed(0)} m · {hud.spd.toFixed(1)} m/s{hud.run ? ' ▶▶ RUN' : ''}</div>
          </>
        )}

        {animNames.length > 0 && (
          <>
            <div style={{ borderTop: '1px solid rgba(255,255,255,.06)', margin: '4px 0' }} />
            <div style={{ color: '#555', fontSize: 8 }}>anims: {animNames.join(', ')}</div>
          </>
        )}
      </div>

      {/* Controls */}
      <div style={{
        position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(0,0,0,.65)', borderRadius: 6, padding: '6px 16px',
        fontFamily: 'monospace', fontSize: 10, color: '#aaa',
        pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
      }}>
        WASD — move · SHIFT — run · drag mouse — rotate camera · scroll — zoom
      </div>
    </div>
  )
}
