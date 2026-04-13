/**
 * TerrainEngine — Self-contained terrain rendering component.
 *
 * Features:
 *  - Circular terrain base (shader-clipped with edge glow)
 *  - Centered orbit: camera targets midpoint of terrain height
 *  - All sliders are live (uniforms updated via useEffect)
 *  - Wireframe mode toggle
 *  - Directional lasers (N/S/E/W encoding)
 *  - Sky dome + water floor
 */

import { useState, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import TerrainMesh from './TerrainMesh'

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

// ─── water floor (circular) ──────────────────────────────────────────

function WaterFloor({ radius, waterLevel, amplitude }) {
  const y = waterLevel * amplitude - 0.02
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <circleGeometry args={[radius * 1.02, 128]} />
      <meshBasicMaterial color={[0.02, 0.06, 0.14]} transparent opacity={0.9} />
    </mesh>
  )
}

// ─── base ring (cosmetic edge) ───────────────────────────────────────

function BaseRing({ radius }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <ringGeometry args={[radius * 0.99, radius * 1.01, 128]} />
      <meshBasicMaterial color={[0.2, 0.6, 0.8]} transparent opacity={0.4} />
    </mesh>
  )
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
        <span key={dir} style={{ color }}>
          {dir}
        </span>
      ))}
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

  const handleChange = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const terrainRadius = 10
  // Camera targets the middle of the terrain height range so you can
  // look equally at peaks and valleys.
  const midY = params.amplitude * 0.4

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
          position: [14, midY + 6, 14],
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
            showLasers={params.showLasers}
          />
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={3}
            maxDistance={50}
            target={[0, midY, 0]}
          />
        </Suspense>
        <Stats />
      </Canvas>

      <HUD params={params} onChange={handleChange} />
      <LaserLegend visible={params.showLasers} />
      <InfoPanel />
    </div>
  )
}
