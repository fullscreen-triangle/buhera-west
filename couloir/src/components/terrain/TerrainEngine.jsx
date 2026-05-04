/**
 * TerrainEngine — Self-contained terrain rendering component.
 *
 * Modes:
 *   ORBIT  — free-orbit camera around the terrain (default)
 *   WALKER — first-person walker, WASD + mouse, terrain-following
 *
 * Toggle with the V key or the VIEW button in the HUD.
 *
 * Features:
 *   - Circular terrain (shader-clipped, edge glow)
 *   - GPU-displaced + partition-classified materials
 *   - 3D directional laser beams (N/S/E/W)
 *   - Sky dome + water floor
 *   - Live HUD sliders, coordinate readout, walker stats
 */

import { useState, useCallback, useRef, useEffect, useMemo, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import * as THREE from 'three'
import TerrainMesh from './TerrainMesh'
import DirectionalLasers from './DirectionalLasers'
import WalkerController from './WalkerController'
import LocationPanel from './LocationPanel'
import TerrainTools from './TerrainTools'
import TerrainStadium from './TerrainStadium'

const TERRAIN_RADIUS = 10

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

// ─── auto-orbit (inside Canvas) ────────────────────────────────────
// When active, rotates the camera in a horizontal circle around `target`,
// preserving the camera's distance and elevation at activation time.

function AutoOrbit({ active, target }) {
  const { camera } = useThree()
  const stateRef = useRef(null)
  const targetVec = useRef(new THREE.Vector3())

  useEffect(() => {
    if (!active) { stateRef.current = null; return }
    targetVec.current.set(...target)
    const dx = camera.position.x - targetVec.current.x
    const dz = camera.position.z - targetVec.current.z
    const radius = Math.sqrt(dx * dx + dz * dz)
    const theta = Math.atan2(dz, dx)
    stateRef.current = {
      radius: Math.max(radius, 4),
      y: camera.position.y,
      theta,
    }
  }, [active, target, camera])

  useFrame((state, delta) => {
    if (!active || !stateRef.current) return
    const s = stateRef.current
    s.theta += delta * 0.25  // ~14°/s
    targetVec.current.set(...target)
    camera.position.set(
      targetVec.current.x + s.radius * Math.cos(s.theta),
      s.y,
      targetVec.current.z + s.radius * Math.sin(s.theta),
    )
    camera.lookAt(targetVec.current)
  })

  return null
}

// ─── orbit readout (inside Canvas) ──────────────────────────────────

function OrbitReadout({ controlsRef, onUpdate, radius }) {
  const { camera, mouse, raycaster } = useThree()
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

    let azDeg = (Math.atan2(t.fwd.x, -t.fwd.z) * 180) / Math.PI
    if (azDeg < 0) azDeg += 360
    const elDeg = (Math.asin(-t.fwd.y) * 180) / Math.PI

    let cursorWorld = null
    let cursorCardinal = ''
    raycaster.setFromCamera(mouse, camera)
    const ray = raycaster.ray
    if (Math.abs(ray.direction.y) > 1e-6) {
      const tHit = (0 - ray.origin.y) / ray.direction.y
      if (tHit > 0) {
        t.hit.copy(ray.origin).addScaledVector(ray.direction, tHit)
        const r = Math.sqrt(t.hit.x * t.hit.x + t.hit.z * t.hit.z)
        if (r <= radius * 1.05) {
          cursorWorld = [t.hit.x, t.hit.z]
          let bDeg = (Math.atan2(t.hit.x, -t.hit.z) * 180) / Math.PI
          if (bDeg < 0) bDeg += 360
          cursorCardinal = bearingToCardinal(bDeg, r)
        }
      }
    }

    onUpdate({
      camPos: [t.pos.x, t.pos.y, t.pos.z],
      target: [t.target.x, t.target.y, t.target.z],
      azimuth: azDeg, elevation: elDeg, distance: t.pos.length(),
      cursorWorld, cursorCardinal,
    })
  })
  return null
}

function bearingToCardinal(deg, dist) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW','N']
  return `${dirs[Math.round(deg / 22.5)]} (${deg.toFixed(0)}°, r=${dist.toFixed(2)})`
}

// ─── HUD ─────────────────────────────────────────────────────────────

function HUD({ params, onChange, viewMode, onToggleView, dimmed }) {
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
      opacity: dimmed ? 0.35 : 1,
      transition: 'opacity 0.2s',
      pointerEvents: dimmed ? 'none' : 'auto',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{ color: '#58E6D9', fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>
          TERRAIN ENGINE
        </span>
        <button
          onClick={onToggleView}
          title="Press V to toggle"
          style={{
            background: viewMode === 'walker' ? '#ff7f0e' : '#58E6D9',
            color: '#000', border: 'none', borderRadius: 4,
            padding: '2px 10px', fontSize: 10, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'monospace',
          }}>
          {viewMode.toUpperCase()}
        </button>
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
      {toggle('Stadium', 'showStadium')}
    </div>
  )
}

// ─── orbit coordinate readout ───────────────────────────────────────

function OrbitPanel({ data }) {
  if (!data) return null
  const { camPos, target, azimuth, elevation, distance, cursorWorld, cursorCardinal } = data
  const fmt = (n) => n.toFixed(2).padStart(7)
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE',
                'S','SSW','SW','WSW','W','WNW','NW','NNW','N']
  const compass = dirs[Math.round(azimuth / 22.5)]
  return (
    <div style={panelStyle()}>
      <div style={panelTitle()}>VIEW</div>
      <div>cam    ({fmt(camPos[0])}, {fmt(camPos[1])}, {fmt(camPos[2])})</div>
      <div>target ({fmt(target[0])}, {fmt(target[1])}, {fmt(target[2])})</div>
      <div>look   <span style={{ color: '#58E6D9' }}>{compass.padEnd(3)}</span>
        {' '}az={azimuth.toFixed(0).padStart(3)}° el={elevation >= 0 ? '+' : ''}{elevation.toFixed(0).padStart(3)}°</div>
      <div>dist   {distance.toFixed(2)} units</div>
      <div style={divider()} />
      <div style={{ color: '#666', fontSize: 9, marginBottom: 2 }}>CURSOR (ground plane)</div>
      {cursorWorld ? (
        <>
          <div>xz = ({fmt(cursorWorld[0])}, {fmt(cursorWorld[1])})</div>
          <div style={{ color: '#58E6D9' }}>{cursorCardinal}</div>
        </>
      ) : <div style={{ color: '#444' }}>— off terrain —</div>}
    </div>
  )
}

// ─── walker readout ─────────────────────────────────────────────────

function WalkerPanel({ data, locked }) {
  if (!data) return null
  const fmt = (n) => n.toFixed(2).padStart(7)
  return (
    <div style={panelStyle()}>
      <div style={panelTitle()}>WALKER</div>
      <div>pos    ({fmt(data.position[0])}, {fmt(data.position[1])}, {fmt(data.position[2])})</div>
      <div>ground {data.groundY.toFixed(2)} &nbsp; eye+{data.eyeHeight.toFixed(2)}</div>
      <div>speed  {data.speed.toFixed(2)} u/s {data.running ? <span style={{ color: '#ff7f0e' }}>(run)</span> : ''}</div>
      <div>on     <span style={{ color: '#58E6D9' }}>{data.material}</span></div>
      <div style={divider()} />
      <div style={{ color: locked ? '#58E6D9' : '#ff7f0e', fontSize: 9 }}>
        {locked ? '● pointer locked' : '○ click to lock pointer'}
      </div>
    </div>
  )
}

function panelStyle() {
  return {
    position: 'absolute', top: 12, right: 12,
    background: 'rgba(0,0,0,0.75)', borderRadius: 8,
    padding: '10px 14px', minWidth: 260,
    fontFamily: 'monospace', fontSize: 10, color: '#aaa',
    zIndex: 10,
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(88,230,217,0.15)',
    whiteSpace: 'pre',
  }
}

function panelTitle() {
  return { color: '#58E6D9', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }
}

function divider() {
  return { borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0' }
}

// ─── tools panel (measurement + orbit pivot) ───────────────────────

function ToolsPanel({ measure, orbitTarget, autoOrbit,
                     onToggleAutoOrbit, onClearPivot, onClearMeasurements }) {
  const fmt = (n) => n.toFixed(2).padStart(7)
  return (
    <div style={{
      position: 'absolute', top: 12, right: 282,
      background: 'rgba(0,0,0,0.75)', borderRadius: 8,
      padding: '10px 14px', minWidth: 220,
      fontFamily: 'monospace', fontSize: 10, color: '#aaa',
      zIndex: 10,
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(88,230,217,0.15)',
    }}>
      <div style={{ color: '#58E6D9', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
        TOOLS
      </div>
      <div style={{ color: '#666', fontSize: 9, marginBottom: 4 }}>
        L-CLICK = measure &nbsp; R-CLICK = pivot
      </div>

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '4px 0' }} />
      <div style={{ color: '#666', fontSize: 9, marginBottom: 2 }}>MEASUREMENT</div>
      {measure ? (
        <>
          <div>p1 ({fmt(measure.p1[0])}, {fmt(measure.p1[1])}, {fmt(measure.p1[2])})</div>
          <div>p2 ({fmt(measure.p2[0])}, {fmt(measure.p2[1])}, {fmt(measure.p2[2])})</div>
          <div style={{ color: '#00ffff', marginTop: 2 }}>
            dist = {measure.distance.toFixed(3)} units &nbsp;
            <span style={{ color: '#666' }}>(#{measure.count})</span>
          </div>
          <button onClick={onClearMeasurements} style={smallBtn()}>
            clear (M)
          </button>
        </>
      ) : (
        <div style={{ color: '#444' }}>— click two points —</div>
      )}

      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '6px 0 4px' }} />
      <div style={{ color: '#666', fontSize: 9, marginBottom: 2 }}>ORBIT PIVOT</div>
      {orbitTarget ? (
        <>
          <div style={{ color: '#ff44ff' }}>
            ({fmt(orbitTarget[0])}, {fmt(orbitTarget[1])}, {fmt(orbitTarget[2])})
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <button
              onClick={onToggleAutoOrbit}
              style={{
                ...smallBtn(),
                background: autoOrbit ? '#58E6D9' : '#333',
                color: autoOrbit ? '#000' : '#ccc',
              }}
            >{autoOrbit ? 'auto-orbit ON' : 'auto-orbit OFF'}</button>
            <button onClick={onClearPivot} style={smallBtn()}>clear</button>
          </div>
        </>
      ) : (
        <div style={{ color: '#444' }}>— right-click terrain —</div>
      )}
    </div>
  )
}

function smallBtn() {
  return {
    background: '#333',
    color: '#ccc',
    border: 'none',
    borderRadius: 3,
    padding: '2px 8px',
    fontSize: 10,
    fontFamily: 'monospace',
    cursor: 'pointer',
    marginTop: 4,
  }
}

// ─── laser legend ───────────────────────────────────────────────────

function LaserLegend({ visible }) {
  if (!visible) return null
  const items = [
    { dir: 'N', color: '#ff2820' }, { dir: 'S', color: '#1a4eff' },
    { dir: 'E', color: '#1aff33' }, { dir: 'W', color: '#ffb31a' },
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

// ─── walker crosshair ───────────────────────────────────────────────

function Crosshair({ visible }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', zIndex: 5,
    }}>
      <svg width="18" height="18" viewBox="0 0 18 18">
        <circle cx="9" cy="9" r="1.2" fill="#58E6D9" />
        <line x1="9" y1="2"  x2="9"  y2="6"  stroke="#58E6D9" strokeWidth="1" />
        <line x1="9" y1="12" x2="9"  y2="16" stroke="#58E6D9" strokeWidth="1" />
        <line x1="2" y1="9"  x2="6"  y2="9"  stroke="#58E6D9" strokeWidth="1" />
        <line x1="12" y1="9" x2="16" y2="9"  stroke="#58E6D9" strokeWidth="1" />
      </svg>
    </div>
  )
}

// ─── walker hint ────────────────────────────────────────────────────

function WalkerHint({ visible, locked }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute', bottom: 40, left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.7)', borderRadius: 6,
      padding: '6px 14px', fontFamily: 'monospace',
      fontSize: 10, color: '#aaa', zIndex: 10,
    }}>
      {locked
        ? <>WASD <span style={{ color: '#666' }}>move</span> &nbsp; SHIFT <span style={{ color: '#666' }}>run</span> &nbsp; SPACE <span style={{ color: '#666' }}>hop</span> &nbsp; ESC <span style={{ color: '#666' }}>unlock</span> &nbsp; V <span style={{ color: '#666' }}>orbit</span></>
        : <>Click the scene to lock the pointer &nbsp; • &nbsp; Press V to return to orbit</>
      }
    </div>
  )
}

// ─── info (bottom-right) ────────────────────────────────────────────

function InfoPanel({ viewMode }) {
  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 12,
      background: 'rgba(0,0,0,0.5)', borderRadius: 6,
      padding: '6px 12px', fontFamily: 'monospace',
      fontSize: 10, color: '#666', zIndex: 10,
    }}>
      {viewMode === 'orbit'
        ? <>Orbit: drag &nbsp;|&nbsp; Zoom: scroll &nbsp;|&nbsp; V: walker</>
        : <>Walker: WASD + mouse &nbsp;|&nbsp; V: orbit</>
      }
    </div>
  )
}

// ─── main ───────────────────────────────────────────────────────────

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
    showStadium: true,
  })

  const [viewMode, setViewMode] = useState('orbit') // 'orbit' | 'walker'
  const [orbitData, setOrbitData] = useState(null)
  const [walkerData, setWalkerData] = useState(null)
  const [pointerLocked, setPointerLocked] = useState(false)

  // real-world terrain state
  const [source, setSource] = useState('procedural') // 'procedural' | 'real'
  const [heightmap, setHeightmap] = useState(null)   // { data, width, height, ... }
  const [satellite, setSatellite] = useState(null)   // HTMLCanvasElement
  const [locationName, setLocationName] = useState(null)

  const handleHeightmapLoaded = useCallback((hm, sat, name) => {
    setHeightmap(hm)
    setSatellite(sat ?? null)
    setLocationName(name)
  }, [])

  // tools state
  const [measure, setMeasure] = useState(null)        // last measurement
  const [orbitTarget, setOrbitTarget] = useState(null) // [x, y, z] | null
  const [autoOrbit, setAutoOrbit] = useState(false)
  const handleMeasure = useCallback((d) => setMeasure(d), [])
  const handleOrbitPivot = useCallback((pt) => {
    setOrbitTarget([pt.x, pt.y, pt.z])
  }, [])

  const controlsRef = useRef()
  const lastOrbitUpdate = useRef(0)
  const lastWalkerUpdate = useRef(0)

  const handleOrbitUpdate = useCallback((data) => {
    const now = performance.now()
    if (now - lastOrbitUpdate.current > 100) {
      lastOrbitUpdate.current = now
      setOrbitData(data)
    }
  }, [])

  const handleWalkerUpdate = useCallback((data) => {
    const now = performance.now()
    if (now - lastWalkerUpdate.current > 80) {
      lastWalkerUpdate.current = now
      setWalkerData(data)
    }
  }, [])

  const handleChange = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleView = useCallback(() => {
    setViewMode(prev => prev === 'orbit' ? 'walker' : 'orbit')
  }, [])

  // V key toggles mode
  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'KeyV' && !e.repeat) toggleView()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleView])

  // combine terrain params for the walker sampler (includes heightmap in real mode)
  const terrainParams = useMemo(() => ({
    amplitude: params.amplitude,
    frequency: params.frequency,
    octaves: params.octaves,
    lacunarity: params.lacunarity,
    gain: params.gain,
    waterLevel: params.waterLevel,
    radius: TERRAIN_RADIUS,
    heightmap: source === 'real' ? heightmap : null,
  }), [params.amplitude, params.frequency, params.octaves, params.lacunarity,
      params.gain, params.waterLevel, source, heightmap])

  const targetY = params.amplitude * 0.5

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%', height: '100%',
        minHeight: 500,
        background: '#060608',
        cursor: viewMode === 'walker' && pointerLocked ? 'none' : 'default',
        ...style,
      }}
    >
      <Canvas
        camera={{
          position: [15, targetY + 10, 15],
          fov: 50,
          near: 0.01,
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
          {/* lighting for GLB models — terrain mesh uses its own shader */}
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[
              Math.cos(params.sunAzimuth) * Math.cos(params.sunElevation) * 80,
              Math.max(0.05, Math.sin(params.sunElevation)) * 80,
              Math.sin(params.sunAzimuth) * Math.cos(params.sunElevation) * 80,
            ]}
            intensity={params.sunIntensity}
            color={'#fff4e0'}
          />
          <SkyDome
            sunElevation={params.sunElevation}
            sunIntensity={params.sunIntensity}
          />
          <WaterFloor
            radius={TERRAIN_RADIUS}
            waterLevel={params.waterLevel}
            amplitude={params.amplitude}
          />
          <BaseRing radius={TERRAIN_RADIUS} />
          <TerrainMesh
            radius={TERRAIN_RADIUS}
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
            heightmap={source === 'real' ? heightmap : null}
            satellite={source === 'real' ? satellite : null}
          />
          <DirectionalLasers
            radius={TERRAIN_RADIUS}
            amplitude={params.amplitude}
            visible={params.showLasers}
          />
          {source === 'real' && heightmap && params.showStadium && (
            <TerrainStadium
              heightmap={heightmap}
              terrainParams={terrainParams}
              radius={TERRAIN_RADIUS}
              realSpanMeters={290}
            />
          )}

          {viewMode === 'orbit' ? (
            <>
              <OrbitControls
                ref={controlsRef}
                enableDamping dampingFactor={0.08}
                minDistance={0.3} maxDistance={50}
                target={orbitTarget ?? [0, targetY, 0]}
                enabled={!autoOrbit}
              />
              <OrbitReadout
                controlsRef={controlsRef}
                onUpdate={handleOrbitUpdate}
                radius={TERRAIN_RADIUS}
              />
              <AutoOrbit
                active={autoOrbit}
                target={orbitTarget ?? [0, targetY, 0]}
              />
              <TerrainTools
                terrainParams={terrainParams}
                enabled={true}
                onMeasureUpdate={handleMeasure}
                onOrbitPivot={handleOrbitPivot}
              />
            </>
          ) : (
            <WalkerController
              terrainParams={terrainParams}
              onUpdate={handleWalkerUpdate}
              onLockChange={setPointerLocked}
            />
          )}
        </Suspense>
        <Stats />
      </Canvas>

      <HUD
        params={params}
        onChange={handleChange}
        viewMode={viewMode}
        onToggleView={toggleView}
        dimmed={viewMode === 'walker' && pointerLocked}
      />
      <LocationPanel
        source={source}
        onSourceChange={setSource}
        onHeightmapLoaded={handleHeightmapLoaded}
        heightmapInfo={heightmap ? { name: locationName } : null}
      />
      {viewMode === 'orbit' && (
        <ToolsPanel
          measure={measure}
          orbitTarget={orbitTarget}
          autoOrbit={autoOrbit}
          onToggleAutoOrbit={() => setAutoOrbit(v => !v)}
          onClearPivot={() => { setOrbitTarget(null); setAutoOrbit(false) }}
          onClearMeasurements={() => {
            setMeasure(null)
            // tell tools to clear by simulating M key
            const evt = new KeyboardEvent('keydown', { code: 'KeyM' })
            window.dispatchEvent(evt)
          }}
        />
      )}
      {viewMode === 'orbit' && <OrbitPanel data={orbitData} />}
      {viewMode === 'walker' && <WalkerPanel data={walkerData} locked={pointerLocked} />}
      <LaserLegend visible={params.showLasers} />
      <Crosshair visible={viewMode === 'walker' && pointerLocked} />
      <WalkerHint visible={viewMode === 'walker'} locked={pointerLocked} />
      <InfoPanel viewMode={viewMode} />
    </div>
  )
}
