/**
 * LandingScene — clean Berlin Olympic Stadium landing page scene.
 *
 *   - Real terrain centred on the Olympiastadion
 *     (52.5145°N, 13.2395°E), tiled from Mapbox at zoom 15
 *   - Stadium GLB placed on terrain at correct centre
 *   - Slow auto-orbit camera at human-flattering elevation (~25°)
 *   - Sky-dome gradient, hemisphere ambient + key directional sun
 *   - Y-up convention.  No partition shaders, no laser cardinal
 *     directions, no sandbox HUD.  Just the scene.
 */

import { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { buildHeightmap, buildSatelliteCanvas } from '@/components/terrain/mapbox'
import { sampleHeightmap } from '@/components/terrain/terrainSampling'
import RealTerrain from './RealTerrain'
import Stadium from './Stadium'
import Lightning from './Lightning'

// ── Berlin Olympiastadion ───────────────────────────────────
const CENTER_LAT = 52.5145
const CENTER_LNG = 13.2395
const ZOOM = 15
const TERRAIN_RADIUS = 575          // metres — half the side
const TERRAIN_SIZE = TERRAIN_RADIUS * 2

// ── sky dome ────────────────────────────────────────────────
function SkyDome({ sunElevation }) {
  // top: pale blue, horizon: warm haze
  const t = Math.max(sunElevation / (Math.PI / 2), 0)
  const top    = new THREE.Color().setRGB(0.32 + t * 0.12, 0.50 + t * 0.20, 0.78 + t * 0.10)
  const bottom = new THREE.Color().setRGB(0.85, 0.78, 0.66)

  return (
    <mesh>
      <sphereGeometry args={[5000, 32, 32]} />
      <shaderMaterial
        side={THREE.BackSide}
        uniforms={{
          uTop:    { value: top },
          uBottom: { value: bottom },
        }}
        vertexShader={`
          varying vec3 vWorldPos;
          void main(){
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          varying vec3 vWorldPos;
          uniform vec3 uTop;
          uniform vec3 uBottom;
          void main(){
            float h = clamp(normalize(vWorldPos).y * 0.5 + 0.5, 0.0, 1.0);
            vec3 col = mix(uBottom, uTop, smoothstep(0.45, 0.7, h));
            gl_FragColor = vec4(col, 1.0);
          }
        `}
      />
    </mesh>
  )
}

// ── auto-orbit camera ───────────────────────────────────────
function AutoOrbitCamera({ targetY, autoOrbit }) {
  const { camera } = useThree()
  const stateRef = useRef({ theta: 0.6 })
  const distance = 850
  const height = 240

  useFrame((_, dt) => {
    const s = stateRef.current
    if (autoOrbit) s.theta += dt * 0.05  // slow drift, ~3° per second
    camera.position.set(
      Math.sin(s.theta) * distance,
      height,
      Math.cos(s.theta) * distance,
    )
    camera.lookAt(0, targetY, 0)
  })
  return null
}

// ── loading splash ──────────────────────────────────────────
function LoadingOverlay({ status, error }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 5,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #0a0e18 0%, #1a2440 100%)',
      color: '#9bb4d6', fontFamily: 'monospace',
      pointerEvents: 'none',
    }}>
      <div style={{ fontSize: 12, letterSpacing: 4, marginBottom: 12, opacity: 0.6 }}>
        BUHERA-WEST
      </div>
      <div style={{ fontSize: 28, fontWeight: 200, letterSpacing: 2, marginBottom: 24 }}>
        Berlin Olympiastadion
      </div>
      <div style={{
        width: 240, height: 1,
        background: '#1f2a44', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: '#58E6D9',
          animation: 'shimmer 1.6s linear infinite',
          width: '40%',
        }}/>
      </div>
      <div style={{ marginTop: 16, fontSize: 11, color: '#5a7196' }}>
        {error
          ? <span style={{ color: '#ff7a7a' }}>{error}</span>
          : status}
      </div>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  )
}

// ── main ────────────────────────────────────────────────────
export default function LandingScene() {
  const [heightmap, setHeightmap] = useState(null)
  const [satellite, setSatellite] = useState(null)
  const [error, setError] = useState(null)
  const [status, setStatus] = useState('connecting…')
  const [autoOrbit, setAutoOrbit] = useState(true)

  // load Mapbox data
  useEffect(() => {
    let cancelled = false
    async function load() {
      const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
      if (!token) {
        setError('Mapbox token missing — add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local')
        return
      }
      try {
        setStatus('fetching elevation tiles…')
        const hm = await buildHeightmap(CENTER_LAT, CENTER_LNG, ZOOM, token)
        if (cancelled) return
        setHeightmap(hm)

        setStatus('fetching satellite imagery…')
        const sat = await buildSatelliteCanvas(CENTER_LAT, CENTER_LNG, ZOOM, token)
        if (cancelled) return
        setSatellite(sat)
        setStatus('rendering…')
      } catch (e) {
        if (!cancelled) setError(e.message || String(e))
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // stadium ground height — sample heightmap at (0, 0)
  const stadiumGroundY = heightmap
    ? sampleHeightmap(0, 0, heightmap, TERRAIN_RADIUS) * heightmap.rangeM
    : 0

  const ready = heightmap && satellite

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#0a0e18',
      overflow: 'hidden',
    }}>
      <Canvas
        shadows
        camera={{ position: [600, 240, 600], fov: 45, near: 1, far: 20000 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <SkyDome sunElevation={0.85} />

          {/* lights */}
          <hemisphereLight args={['#9bbfff', '#3a2c20', 0.55]} />
          <directionalLight
            color="#fff4dc"
            intensity={1.6}
            position={[800, 1600, -400]}   // sun above and slightly south
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-near={1}
            shadow-camera-far={3500}
            shadow-camera-left={-1000}
            shadow-camera-right={1000}
            shadow-camera-top={1000}
            shadow-camera-bottom={-1000}
          />

          {ready && (
            <>
              <RealTerrain
                heightmap={heightmap}
                satelliteCanvas={satellite}
                sizeMeters={TERRAIN_SIZE}
                segments={384}
                sunAzimuth={1.0}
                sunElevation={0.85}
              />
              <Stadium
                position={[0, stadiumGroundY, 0]}
                targetSpanMeters={310}
                headingDeg={20}
              />
              <Lightning
                // strike base ~280m to the south-east of the stadium,
                // lifted just above the ground so the bolt extends into
                // the sky for the full target height.
                position={[180, stadiumGroundY + 2, 220]}
                targetHeightMeters={700}
              />
            </>
          )}

          <AutoOrbitCamera targetY={stadiumGroundY + 30} autoOrbit={autoOrbit} />
        </Suspense>
      </Canvas>

      {!ready && <LoadingOverlay status={status} error={error} />}

      {/* Title / nav overlay */}
      {ready && (
        <>
          <div style={{
            position: 'absolute', top: 24, left: 32,
            color: '#fff', fontFamily: 'monospace',
            mixBlendMode: 'screen', pointerEvents: 'none',
          }}>
            <div style={{ fontSize: 11, letterSpacing: 5, opacity: 0.65 }}>
              BUHERA-WEST
            </div>
            <div style={{
              fontSize: 36, fontWeight: 200, letterSpacing: 2, marginTop: 6,
            }}>
              Olympiastadion · Berlin
            </div>
            <div style={{
              fontSize: 10, color: '#aac9ff', opacity: 0.7,
              marginTop: 4, letterSpacing: 1.5,
            }}>
              52.5145°N · 13.2395°E
            </div>
          </div>

          <button
            onClick={() => setAutoOrbit(v => !v)}
            style={{
              position: 'absolute', bottom: 24, right: 24,
              background: 'rgba(0,0,0,0.55)', color: '#cfe6ff',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 4, padding: '8px 16px',
              fontFamily: 'monospace', fontSize: 11, letterSpacing: 2,
              cursor: 'pointer', backdropFilter: 'blur(8px)',
            }}>
            {autoOrbit ? '⏸  PAUSE' : '▶  ROTATE'}
          </button>
        </>
      )}
    </div>
  )
}
