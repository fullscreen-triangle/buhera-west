/**
 * TerrainEngine — Self-contained terrain rendering component.
 *
 * - Circular terrain (shader-clipped, edge glow)
 * - Free orbit camera centered on terrain midpoint
 * - Wireframe toggle
 * - 3D directional laser beams (N/S/E/W)
 * - Sky dome + water floor
 * - Live HUD with all sliders + camera coordinate readout
 */

import { useState, useCallback, useRef, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import * as THREE from 'three'
import TerrainMesh from './TerrainMesh'
import DirectionalLasers from './DirectionalLasers'

// ─── sky dome ────────────────────────────────────────────────────────

function SkyDome({ sunElevation, sunIntensity }) {
  const t = Math.max(sunElevation, 0)
  const r = 0.10 + t * 0.30
  const g = 0.18 + t * 0.35
  const b = 0.40 + t * 0.50
  return (
    <mesh scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color={[r * sunIntensity, g * sunIntensity, b * sunIntensity]}
        side={1}
      />
    </mesh>
  )
}

// ─── water floor ─────────────────────────────────────────────────────

function WaterFloor({ radius, waterLevel, amplitude }) {
  const y = waterLevel * amplitude - 0.02
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <circleGeometry args={[radius * 1.02, 128]} />
      <meshBasicMaterial color={[0.02, 0.06, 0.14]} transparent opacity={0.9} />
    </mesh>
  )
}

// ─── base ring ───────────────────────────────────────────────────────

function BaseRing({ radius }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <ringGeometry args={[radius * 0.98, radius * 1.02, 128]} />
      <meshBasicMaterial color={[0.15, 0.5, 0.65]} transparent opacity={0.5} />
    </mesh>
  )
}

// ─── camera + cursor readout (inside Canvas) ────────────────────────

function SceneReadout({ controlsRef, onUpdate, radius }) {
  const { camera, mouse, raycaster } = useThree()
  const groundRef = useRef()
  const tmp = useRef({
    pos: new THREE.Vector3(),
    target: new THREE.Vector3(),
    fwd: new THREE.Vector3(),
    hit: new THREE.Vector3(),
  })

  useFrame(() => {
    const t = tmp.current
    t.pos.copy(camera.position)
    t.target.copy(controlsRef.current?.target ?? new THREE.Vector3())
    t.fwd.copy(t.target).sub(t.pos).normalize()

    // azimuth: angle in XZ plane from +X axis (standard math),
    // converted to compass bearing (0° = N, 90° = E, 180° = S, 270° = W)
    // World convention here: -Z is North (lasers).
    const azRad = Math.atan2(t.fwd.x, -t.fwd.z) // 0 when looking N
    let azDeg = (azRad * 180) / Math.PI
    if (azDeg < 0) azDeg += 360

    // elevation: angle above horizontal (positive = looking down)
    const elDeg = (Math.asin(-t.fwd.y) * 180) / Math.PI

    // distance from origin
    const dist = t.pos.length()

    // cursor hit on horizontal plane at y=0 (ground level approx)
    let cursorWorld = null
    let cursorCardinal = ''
    raycaster.setFromCamera(mouse, camera)
    const planeY = 0
    const ray = raycaster.ray
    if (Math.abs(ray.direction.y) > 1e-6) {
      const tHit = (planeY - ray.origin.y) / ray.direction.y
      if (tHit > 0) {
        t.hit.copy(ray.origin).addScaledVector(ray.direction, tHit)
        const r = Math.sqrt(t.hit.x * t.hit.x + t.hit.z * t.hit.z)
        if (r <= radius * 1.05) {
          cursorWorld = [t.hit.x, t.hit.z]
          // cardinal: compass bearing from origin to cursor
          const bRad = Math.atan2(t.hit.x, -t.hit.z)
          let bDeg = (bRad * 180) / Math.PI
          if (bDeg < 0) bDeg += 360
          cursorCardinal = bearingToCardinal(bDeg, r)
        }
      }
    }

    onUpdate({
      camPos: [t.pos.x, t.pos.y, t.pos.z],
      target: [t.target.x, t.target.y, t.target.z],
      azimuth: azDeg,
      elevation: elDeg,
      distance: dist,
      cursorWorld,
      cursorCardinal,
    })
  })

  return null
}

function bearingToCardinal(deg, dist) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']
  const idx = Math.round(deg / 22.5)
  return `${dirs[idx]} (${deg.toFixed(0)}°, r=${dist.toFixed(2)})`
}

// ─── HUD ─────────────────────────────────────────────────────────────

function HUD({ params, onChange }) {
  const slider = (label, key, min, max, step) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
      <label style={{ width: 80, fontSize: 10, color: '#aaa' }}>{label}</label>
      <input
        type="range" min={min} max={max} step={step}
        value={params[key]}
        onChange={e => onChange(key, parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#58E6D9', height: 14 }}
      />
      <span style={{ width: 40, fontSize: 10, color: '#777', textAlign: 'right' }}>
        {typeof params[key] === 'number' ? params[key].toFixed(2) : params[key]}
      </span>
    </div>
  )

  const toggle = (label, key) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
      <label style={{ width: 80, fontSize: 10, color: '#aaa' }}>{label}</label>
      <button
        onClick={() => onChange(key, !params[key])}
        style={{
          background: params[key] ? '#58E6D9' : '#333',
          color: params[key] ? '#000' : '#888',
          border: 'none', borderRadius: 4,
          padding: '2px 10px', fontSize: 10,
          cursor: 'pointer', fontFamily: 'monospace',
        }}
      >
        {params[key] ? 'ON' : 'OFF'}
      </button>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12,
      background: 'rgba(0,0,0,0.75)', borderRadius: 8,
      padding: '10px 14px', minWidth: 240,
      fontFamily: 'monospace', zIndex: 10,
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(88,230,217,0.15)',
    }}>
      <div style={{ color: '#58E6D9', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
        TERRAIN ENGINE
      </div>
      {slider('Amplitude', 'amplitude', 0.5, 8, 0.1)}
      {slider('Frequency', 'frequency', 0.2, 4, 0.05)}
      {slider('Octaves', 'octaves', 1, 10, 1)}
      {slider('Lacunarity', 'lacunarity', 1.2, 3.0, 0.1)}
      {slider('Gain', 'gain', 0.2, 0.8, 0.05)}
      {slider('Water', 'waterLevel', 0, 0.5, 0.01)}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0' }} />
      {slider('Sun Azim', 'sunAzimuth', -3.14, 3.14, 0.05)}
      {slider('Sun Elev', 'sunElevation', -0.1, 1.5, 0.05)}
      {slider('Sun Power', 'sunIntensity', 0.2, 3, 0.1)}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0' }} />
      {slider('Detail', 'segments', 64, 1024, 64)}
      {toggle('Wireframe', 'wireframe')}
      {toggle('Lasers', 'showLasers')}
    </div>
  )
}

// ─── coordinate readout ──────────────────────────────────────────────

function CoordinateReadout({ data }) {
  if (!data) return null
  const { camPos, target, azimuth, elevation, distance, cursorWorld, cursorCardinal } = data
  const fmt = (n) => n.toFixed(2).padStart(7)
  const fmtAz = (n) => n.toFixed(0).padStart(3)

  // compass label for camera bearing
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW', 'N']
  const compass = dirs[Math.round(azimuth / 22.5)]

  return (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      background: 'rgba(0,0,0,0.75)', borderRadius: 8,
      padding: '10px 14px', minWidth: 260,
      fontFamily: 'monospace', fontSize: 10, color: '#aaa',
      zIndex: 10,
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(88,230,217,0.15)',
    }}>
      <div style={{ color: '#58E6D9', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
        VIEW
      </div>
      <div style={{ marginBottom: 3 }}>
        <span style={{ color: '#666' }}>cam   </span>
        ({fmt(camPos[0])}, {fmt(camPos[1])}, {fmt(camPos[2])})
      </div>
      <div style={{ marginBottom: 3 }}>
        <span style={{ color: '#666' }}>target</span>
        ({fmt(target[0])}, {fmt(target[1])}, {fmt(target[2])})
      </div>
      <div style={{ marginBottom: 3 }}>
        <span style={{ color: '#666' }}>look  </span>
        <span style={{ color: '#58E6D9' }}>{compass.padEnd(3)}</span>
        {' '}az={fmtAz(azimuth)}° el={elevation >= 0 ? '+' : ''}{elevation.toFixed(0).padStart(3)}°
      </div>
      <div style={{ marginBottom: 3 }}>
        <span style={{ color: '#666' }}>dist  </span>
        {distance.toFixed(2)} units
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0' }} />
      <div style={{ color: '#666', fontSize: 9, marginBottom: 2 }}>CURSOR (ground plane)</div>
      {cursorWorld ? (
        <>
          <div>xz = ({fmt(cursorWorld[0])}, {fmt(cursorWorld[1])})</div>
          <div style={{ color: '#58E6D9' }}>{cursorCardinal}</div>
        </>
      ) : (
        <div style={{ color: '#444' }}>— off terrain —</div>
      )}
    </div>
  )
}

// ─── laser legend ────────────────────────────────────────────────────

function LaserLegend({ visible }) {
  if (!visible) return null
  const items = [
    { dir: 'N', color: '#ff2820' },
    { dir: 'S', color: '#1a4eff' },
    { dir: 'E', color: '#1aff33' },
    { dir: 'W', color: '#ffb31a' },
  ]
  return (
    <div style={{
      position: 'absolute', bottom: 12, left: 12,
      background: 'rgba(0,0,0,0.6)', borderRadius: 6,
      padding: '6px 12px', fontFamily: 'monospace',
      fontSize: 10, zIndex: 10,
      display: 'flex', gap: 12,
    }}>
      {items.map(({ dir, color }) => (
        <span key={dir} style={{ color }}>{dir}</span>
      ))}
    </div>
  )
}

// ─── info ────────────────────────────────────────────────────────────

function InfoPanel() {
  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 12,
      background: 'rgba(0,0,0,0.5)', borderRadius: 6,
      padding: '6px 12px', fontFamily: 'monospace',
      fontSize: 10, color: '#666', zIndex: 10,
    }}>
      Orbit: drag &nbsp;|&nbsp; Zoom: scroll &nbsp;|&nbsp; Pan: right-drag
    </div>
  )
}

// ─── main ────────────────────────────────────────────────────────────

export default function TerrainEngine({ className, style }) {
  const [params, setParams] = useState({
    amplitude: 3.0,
    frequency: 1.2,
    octaves: 8,
    lacunarity: 2.0,
    gain: 0.5,
    waterLevel: 0.25,
    sunAzimuth: 0.8,
    sunElevation: 0.6,
    sunIntensity: 1.4,
    segments: 512,
    wireframe: false,
    showLasers: true,
  })

  const [readout, setReadout] = useState(null)
  const controlsRef = useRef()
  // throttle readout updates to ~10 Hz
  const lastUpdateRef = useRef(0)
  const handleReadout = useCallback((data) => {
    const now = performance.now()
    if (now - lastUpdateRef.current > 100) {
      lastUpdateRef.current = now
      setReadout(data)
    }
  }, [])

  const handleChange = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const terrainRadius = 10
  const targetY = params.amplitude * 0.5

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%', height: '100%',
        minHeight: 500,
        background: '#060608',
        ...style,
      }}
    >
      <Canvas
        camera={{
          position: [15, targetY + 10, 15],
          fov: 50,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          toneMapping: 0,
          outputColorSpace: 'srgb',
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SkyDome
            sunElevation={params.sunElevation}
            sunIntensity={params.sunIntensity}
          />
          <WaterFloor
            radius={terrainRadius}
            waterLevel={params.waterLevel}
            amplitude={params.amplitude}
          />
          <BaseRing radius={terrainRadius} />
          <TerrainMesh
            radius={terrainRadius}
            segments={params.segments}
            amplitude={params.amplitude}
            frequency={params.frequency}
            octaves={params.octaves}
            lacunarity={params.lacunarity}
            gain={params.gain}
            waterLevel={params.waterLevel}
            sunAzimuth={params.sunAzimuth}
            sunElevation={params.sunElevation}
            sunIntensity={params.sunIntensity}
            wireframe={params.wireframe}
          />
          <DirectionalLasers
            radius={terrainRadius}
            amplitude={params.amplitude}
            visible={params.showLasers}
          />
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.08}
            minDistance={3}
            maxDistance={50}
            target={[0, targetY, 0]}
          />
          <SceneReadout
            controlsRef={controlsRef}
            onUpdate={handleReadout}
            radius={terrainRadius}
          />
        </Suspense>
        <Stats />
      </Canvas>

      <HUD params={params} onChange={handleChange} />
      <CoordinateReadout data={readout} />
      <LaserLegend visible={params.showLasers} />
      <InfoPanel />
    </div>
  )
}
