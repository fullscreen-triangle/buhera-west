/**
 * TerrainEngine — Self-contained terrain rendering component.
 *
 * Wraps a React-Three-Fiber Canvas with:
 *  • GPU-displaced procedural terrain (TerrainMesh)
 *  • Orbit camera controls
 *  • Sky background derived from terrain atmospheric state
 *  • On-screen HUD with controls (amplitude, frequency, water level, sun)
 *
 * Usage:
 *   import TerrainEngine from '@/components/terrain/TerrainEngine'
 *   <TerrainEngine />
 *
 * The component fills its parent container (width/height 100%).
 * It is dynamically imported with ssr:false in the page.
 */

import { useState, useCallback, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stats } from '@react-three/drei'
import TerrainMesh from './TerrainMesh'

// ─── Sky dome (simple gradient, no external textures) ────────────────

function SkyDome({ sunElevation, sunIntensity }) {
  // sky colour darkens as sun drops, brightens as it rises
  const t = Math.max(sunElevation, 0) // 0 = horizon, 1 = zenith
  const r = 0.15 + t * 0.35
  const g = 0.25 + t * 0.40
  const b = 0.50 + t * 0.45
  return (
    <mesh scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color={[r * sunIntensity, g * sunIntensity, b * sunIntensity]}
        side={1} // BackSide
      />
    </mesh>
  )
}

// ─── Ground plane beneath water (catches rays that miss terrain) ─────

function WaterFloor({ size, waterLevel, amplitude }) {
  const y = waterLevel * amplitude - 0.01
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <planeGeometry args={[size * 2, size * 2]} />
      <meshBasicMaterial color={[0.02, 0.06, 0.14]} />
    </mesh>
  )
}

// ─── HUD overlay ─────────────────────────────────────────────────────

function HUD({ params, onChange }) {
  const slider = (label, key, min, max, step) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
      <label style={{ width: 90, fontSize: 11, color: '#ccc' }}>{label}</label>
      <input
        type="range"
        min={min} max={max} step={step}
        value={params[key]}
        onChange={e => onChange(key, parseFloat(e.target.value))}
        style={{ flex: 1, accentColor: '#58E6D9' }}
      />
      <span style={{ width: 44, fontSize: 11, color: '#aaa', textAlign: 'right' }}>
        {typeof params[key] === 'number' ? params[key].toFixed(2) : params[key]}
      </span>
    </div>
  )

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12,
      background: 'rgba(0,0,0,0.7)', borderRadius: 8,
      padding: '10px 14px', minWidth: 260,
      fontFamily: 'monospace', zIndex: 10,
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ color: '#58E6D9', fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
        TERRAIN ENGINE
      </div>
      {slider('Amplitude', 'amplitude', 0.5, 8, 0.1)}
      {slider('Frequency', 'frequency', 0.2, 4, 0.05)}
      {slider('Octaves', 'octaves', 1, 10, 1)}
      {slider('Lacunarity', 'lacunarity', 1.2, 3.0, 0.1)}
      {slider('Gain', 'gain', 0.2, 0.8, 0.05)}
      {slider('Water', 'waterLevel', 0, 0.5, 0.01)}
      {slider('Sun Azim', 'sunAzimuth', -3.14, 3.14, 0.05)}
      {slider('Sun Elev', 'sunElevation', -0.1, 1.5, 0.05)}
      {slider('Sun Power', 'sunIntensity', 0.2, 3, 0.1)}
      {slider('Segments', 'segments', 64, 1024, 64)}
    </div>
  )
}

// ─── Navigation info ─────────────────────────────────────────────────

function InfoPanel() {
  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 12,
      background: 'rgba(0,0,0,0.5)', borderRadius: 6,
      padding: '6px 12px', fontFamily: 'monospace',
      fontSize: 10, color: '#888', zIndex: 10,
    }}>
      Orbit: drag &nbsp;|&nbsp; Zoom: scroll &nbsp;|&nbsp; Pan: right-drag
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────

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
  })

  const handleChange = useCallback((key, value) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const terrainSize = 20

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 500,
        background: '#0a0a0a',
        ...style,
      }}
    >
      <Canvas
        camera={{
          position: [12, 8, 12],
          fov: 55,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          toneMapping: 0, // NoToneMapping — shader handles it
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
            size={terrainSize}
            waterLevel={params.waterLevel}
            amplitude={params.amplitude}
          />
          <TerrainMesh
            size={terrainSize}
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
          />
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            minDistance={2}
            maxDistance={40}
            maxPolarAngle={Math.PI / 2.05}
            target={[0, 1, 0]}
          />
        </Suspense>
        <Stats />
      </Canvas>

      <HUD params={params} onChange={handleChange} />
      <InfoPanel />
    </div>
  )
}
