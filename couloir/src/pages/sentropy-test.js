/**
 * /sentropy-test — Pass 0 + Pass 3 verification page.
 *
 * Pulls a Mapbox heightmap + satellite for a chosen preset, runs
 *   terrainPartitionFromTiles  →  terrainToAtmosphere
 * and reports partition + atmosphere stats with debug visualisations.
 * Then feeds the volume into the atmosphere ray-march shader and
 * renders a sky preview from a controllable camera.
 */

import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import {
  buildHeightmap,
  buildSatelliteCanvas,
  PRESET_LOCATIONS,
} from '@/components/terrain/mapbox'
import {
  terrainPartitionFromTiles,
  terrainToAtmosphere,
  summarizePartition,
  summarizeAtmosphere,
} from '@/components/terrain/sentropy'
import {
  buildAtmosphereUniforms,
} from '@/components/terrain/atmosphereTexture'
import {
  atmosphereVertexShader,
  atmosphereFragmentShader,
} from '@/components/terrain/shaders/atmosphere'

// ─── debug visualisation helpers ────────────────────────────────

/**
 * False-colour the partition field by surface composition.
 *   water → blue, vegetation → green, rock/sand/snow → grey/white.
 */
function drawPartitionField(canvas, part) {
  const W = part.width, H = part.height
  const n_max = (part.params && part.params.n_max) || 8
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  for (let i = 0; i < W * H; i++) {
    const n = part.n[i], l = part.l[i], m = part.m[i]
    const water = 1 - l / Math.max(n, 1e-3)
    const veg   = m / Math.max(l, 1e-3)
    const temp  = n / n_max  // [0,1]: 0 = T_min (cold), 1 = T_max (hot)

    let r, g, b
    if (water > 0.5) {
      // water — blue, darker for deeper (lower l)
      r = 30
      g = 80 + 60 * (1 - water)
      b = 140 + 80 * water
    } else if (temp < 0.3) {
      // cold + not water-dominated → snow / ice
      const w = 200 + 50 * (0.3 - temp) / 0.3   // 200..250
      r = w
      g = w
      b = Math.min(255, w + 8)
    } else if (veg > 0.3) {
      // vegetation — green
      r = 60 + 60 * (1 - veg)
      g = 110 + 100 * veg
      b = 50
    } else {
      // rock — temperature-tinted (cool grey → warm tan)
      const t = (temp - 0.3) / 0.7
      r = 100 + 100 * t
      g = 100 + 70  * t
      b = 95  + 30  * t
    }
    img.data[i * 4]     = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

// Per-channel min-max over a typed-array slice.
function sliceRange(arr) {
  let min = Infinity, max = -Infinity
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  return { min, max }
}

function stretch(v, min, max) {
  if (max - min < 1e-12) return 128
  const t = (v - min) / (max - min)
  return t < 0 ? 0 : t > 1 ? 255 : Math.round(t * 255)
}

/**
 * Render the ground-level (z=0) S-entropy slice as RGB.  Each channel
 * is min-max stretched independently — at z=0, ρ ≈ ρ₀ everywhere and
 * raw (Sk, St, Se) all sit near saturation, so without stretching the
 * slice paints uniformly pale.  Returns the raw ranges so the caller
 * can display them.
 */
function drawAtmosphereGroundSlice(canvas, vol) {
  const W = vol.width, H = vol.height
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const sliceN = W * H

  const SkSlice = vol.Sk.subarray(0, sliceN)
  const StSlice = vol.St.subarray(0, sliceN)
  const SeSlice = vol.Se.subarray(0, sliceN)
  const skR = sliceRange(SkSlice)
  const stR = sliceRange(StSlice)
  const seR = sliceRange(SeSlice)

  for (let i = 0; i < sliceN; i++) {
    img.data[i * 4]     = stretch(SkSlice[i], skR.min, skR.max)
    img.data[i * 4 + 1] = stretch(StSlice[i], stR.min, stR.max)
    img.data[i * 4 + 2] = stretch(SeSlice[i], seR.min, seR.max)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return { Sk: skR, St: stR, Se: seR }
}

/**
 * Render an arbitrary altitude slice of Sk, min-max stretched and
 * tinted as warm haze.  Returns the raw range.
 */
function drawAtmosphereAltitudeSlice(canvas, vol, zIdx) {
  const W = vol.width, H = vol.height
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const sliceN = W * H
  const off = zIdx * sliceN
  const slice = vol.Sk.subarray(off, off + sliceN)
  const r = sliceRange(slice)

  for (let i = 0; i < sliceN; i++) {
    const t = stretch(slice[i], r.min, r.max)
    img.data[i * 4]     = t
    img.data[i * 4 + 1] = Math.round(t * 0.88)
    img.data[i * 4 + 2] = Math.round(t * 0.7)
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return r
}

// ─── atmosphere viewer (Pass 3) ─────────────────────────────────
//
// Vanilla Three.js full-screen quad with the atmospheric ray-march
// shader.  Re-renders whenever the volume or any control changes.

const SUN_PRESETS = [
  { name: 'noon',     az: 180, el: 70 },
  { name: 'morning',  az:  85, el: 30 },
  { name: 'sunset',   az: 270, el:  3 },
  { name: 'twilight', az: 285, el: -2 },
]

function AtmosphereViewer({ volume }) {
  const containerRef = useRef(null)
  const stateRef     = useRef(null)   // { renderer, scene, camera, mat, uniforms }

  const [sunAz, setSunAz]     = useState(85)   // deg
  const [sunEl, setSunEl]     = useState(30)
  const [camYaw, setCamYaw]   = useState(0)
  const [camPitch, setCamPitch] = useState(8)
  const [camAlt, setCamAlt]   = useState(120)
  const [stepM, setStepM]     = useState(180)
  const [maxSteps, setMaxSteps] = useState(192)
  const [renderMs, setRenderMs] = useState(null)

  // (Re)build the renderer + materials whenever the volume changes.
  useEffect(() => {
    if (!volume || !containerRef.current) return

    const W = 720, H = 405
    const renderer = new THREE.WebGLRenderer({
      antialias: false, preserveDrawingBuffer: false,
    })
    renderer.setSize(W, H)
    renderer.setPixelRatio(1)

    containerRef.current.innerHTML = ''
    containerRef.current.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const uniforms = buildAtmosphereUniforms(volume)
    uniforms.u_aspect.value = W / H
    uniforms.u_fov_y.value  = Math.PI / 3

    const mat = new THREE.ShaderMaterial({
      glslVersion:    THREE.GLSL3,
      uniforms,
      vertexShader:   atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
    })
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat)
    scene.add(quad)

    stateRef.current = { renderer, scene, ortho, mat, quad, uniforms, W, H }

    return () => {
      mat.dispose()
      quad.geometry.dispose()
      uniforms.u_atmos_volume.value.dispose()
      renderer.dispose()
      stateRef.current = null
    }
  }, [volume])

  // Update uniforms + render whenever a control changes.
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    const { renderer, scene, ortho, uniforms, W, H } = st

    // Sun direction (azimuth measured CW from north, elevation above horizon)
    const az = sunAz   * Math.PI / 180
    const el = sunEl   * Math.PI / 180
    const sx = Math.sin(az) * Math.cos(el)
    const sy = Math.sin(el)
    const sz = -Math.cos(az) * Math.cos(el)
    uniforms.u_sun_dir.value.set(sx, sy, sz).normalize()

    // Camera orientation (yaw measured CW from -Z = "north", pitch above horizon)
    const yaw   = camYaw   * Math.PI / 180
    const pitch = camPitch * Math.PI / 180
    const fwd = new THREE.Vector3(
      Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      -Math.cos(yaw) * Math.cos(pitch),
    ).normalize()
    const worldUp = new THREE.Vector3(0, 1, 0)
    const right = new THREE.Vector3().crossVectors(fwd, worldUp).normalize()
    const camUp = new THREE.Vector3().crossVectors(right, fwd).normalize()

    uniforms.u_camera_pos.value.set(0, camAlt, 0)
    uniforms.u_cam_forward.value.copy(fwd)
    uniforms.u_cam_right  .value.copy(right)
    uniforms.u_cam_up     .value.copy(camUp)
    uniforms.u_aspect.value = W / H

    uniforms.u_step_meters.value = stepM
    uniforms.u_max_steps  .value = maxSteps

    const t0 = performance.now()
    renderer.render(scene, ortho)
    const t1 = performance.now()
    setRenderMs(+(t1 - t0).toFixed(2))
  }, [volume, sunAz, sunEl, camYaw, camPitch, camAlt, stepM, maxSteps])

  if (!volume) return null

  return (
    <div style={S.viewerWrap}>
      <div style={S.h2}>Pass 3 — atmospheric ray march</div>
      <div ref={containerRef} style={S.viewerCanvas} />
      <div style={S.viewerInfo}>
        {renderMs != null && <span>render: {renderMs} ms · {volume.layers}-layer volume · {stepM}m × {maxSteps} steps</span>}
      </div>

      <div style={S.viewerGroup}>
        <div style={S.lblTitle}>sun</div>
        <Slider label="azimuth"   value={sunAz} min={0}    max={360} step={1}  onChange={setSunAz} />
        <Slider label="elevation" value={sunEl} min={-10}  max={90}  step={1}  onChange={setSunEl} />
        <div style={S.presetRow}>
          {SUN_PRESETS.map((p) => (
            <button key={p.name} style={S.btnSmall}
                    onClick={() => { setSunAz(p.az); setSunEl(p.el) }}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div style={S.viewerGroup}>
        <div style={S.lblTitle}>camera</div>
        <Slider label="yaw"      value={camYaw}   min={-180} max={180} step={5}  onChange={setCamYaw} />
        <Slider label="pitch"    value={camPitch} min={-30}  max={89}  step={1}  onChange={setCamPitch} />
        <Slider label="altitude (m)" value={camAlt} min={2}  max={3000} step={5} onChange={setCamAlt} />
      </div>

      <div style={S.viewerGroup}>
        <div style={S.lblTitle}>march</div>
        <Slider label="step (m)"  value={stepM}    min={20}   max={500} step={10} onChange={setStepM} />
        <Slider label="max steps" value={maxSteps} min={32}   max={512} step={8}  onChange={setMaxSteps} />
      </div>
    </div>
  )
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label style={S.sliderRow}>
      <span style={S.sliderLabel}>{label}</span>
      <input
        type="range" min={min} max={max} step={step}
        value={value} onChange={(e) => onChange(+e.target.value)}
        style={S.slider}
      />
      <span style={S.sliderValue}>{value}</span>
    </label>
  )
}

// ─── page ───────────────────────────────────────────────────────

export default function SEntropyTestPage() {
  const [presetIdx, setPresetIdx] = useState(0)
  const [zoom, setZoom] = useState(PRESET_LOCATIONS[0].zoom)
  const [resolution, setResolution] = useState(256)
  const [layers, setLayers] = useState(64)
  const [status, setStatus] = useState('idle')
  const [partSummary, setPartSummary] = useState(null)
  const [atmSummary, setAtmSummary] = useState(null)
  const [timing, setTiming] = useState(null)
  const [groundRange, setGroundRange] = useState(null)
  const [highRange, setHighRange] = useState(null)
  const [volume, setVolume] = useState(null)

  const satRef       = useRef(null)
  const partRef      = useRef(null)
  const atmGroundRef = useRef(null)
  const atmHighRef   = useRef(null)

  useEffect(() => {
    setZoom(PRESET_LOCATIONS[presetIdx].zoom)
  }, [presetIdx])

  async function run() {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) {
      setStatus('error: no Mapbox token (NEXT_PUBLIC_MAPBOX_TOKEN)')
      return
    }

    const { lat, lng } = PRESET_LOCATIONS[presetIdx]
    setStatus(`fetching tiles for ${PRESET_LOCATIONS[presetIdx].name} (${lat.toFixed(3)}, ${lng.toFixed(3)}) …`)
    setPartSummary(null)
    setAtmSummary(null)
    setTiming(null)
    setVolume(null)

    try {
      const t0 = performance.now()
      const [hm, satCanvas] = await Promise.all([
        buildHeightmap(lat, lng, zoom, token),
        buildSatelliteCanvas(lat, lng, zoom, token),
      ])
      const t1 = performance.now()

      // Draw raw satellite for visual reference
      if (satRef.current) {
        const c = satRef.current
        c.width = satCanvas.width
        c.height = satCanvas.height
        c.getContext('2d').drawImage(satCanvas, 0, 0)
      }

      setStatus('computing terrain partition …')
      const t2 = performance.now()
      const part = terrainPartitionFromTiles(hm, satCanvas, { resolution })
      const t3 = performance.now()

      setStatus('computing atmospheric volume …')
      const t4 = performance.now()
      const vol = terrainToAtmosphere(part, { layers })
      const t5 = performance.now()

      // Visualise
      if (partRef.current) drawPartitionField(partRef.current, part)
      const gR = atmGroundRef.current
        ? drawAtmosphereGroundSlice(atmGroundRef.current, vol) : null
      const hR = atmHighRef.current
        ? drawAtmosphereAltitudeSlice(atmHighRef.current, vol, Math.floor(layers * 0.25)) : null
      setGroundRange(gR)
      setHighRange(hR)

      setVolume(vol)
      setPartSummary(summarizePartition(part))
      setAtmSummary(summarizeAtmosphere(vol))
      setTiming({
        fetch_ms:     +(t1 - t0).toFixed(1),
        partition_ms: +(t3 - t2).toFixed(1),
        atmosphere_ms:+(t5 - t4).toFixed(1),
        total_ms:     +(t5 - t0).toFixed(1),
        memory_mb:    +(
          (vol.Sk.byteLength + vol.St.byteLength + vol.Se.byteLength + vol.n_ref.byteLength)
          / (1024 * 1024)
        ).toFixed(2),
      })
      setStatus(`done — ${PRESET_LOCATIONS[presetIdx].name}`)
    } catch (err) {
      console.error(err)
      setStatus(`error: ${err.message || err}`)
    }
  }

  return (
    <>
      <Head><title>S-Entropy Pass 0 Test</title></Head>
      <div style={S.page}>
        <h1 style={S.h1}>S-Entropy Pass 0 — terrain → atmosphere</h1>
        <p style={S.subtitle}>
          Implements Section 3 of <code>street-view-rendering.tex</code>:
          DEM + satellite → (n,l,m,s) → atmospheric (S<sub>k</sub>, S<sub>t</sub>, S<sub>e</sub>, n<sub>ref</sub>).
        </p>

        <div style={S.controls}>
          <label style={S.lbl}>
            Location
            <select
              value={presetIdx}
              onChange={(e) => setPresetIdx(+e.target.value)}
              style={S.input}
            >
              {PRESET_LOCATIONS.map((p, i) => (
                <option key={p.name} value={i}>{p.name}</option>
              ))}
            </select>
          </label>
          <label style={S.lbl}>
            Zoom
            <input
              type="number" min={8} max={15}
              value={zoom}
              onChange={(e) => setZoom(+e.target.value)}
              style={S.input}
            />
          </label>
          <label style={S.lbl}>
            Resolution
            <select
              value={resolution}
              onChange={(e) => setResolution(+e.target.value)}
              style={S.input}
            >
              <option value={128}>128</option>
              <option value={256}>256</option>
              <option value={384}>384</option>
            </select>
          </label>
          <label style={S.lbl}>
            Layers
            <select
              value={layers}
              onChange={(e) => setLayers(+e.target.value)}
              style={S.input}
            >
              <option value={32}>32</option>
              <option value={64}>64</option>
              <option value={128}>128</option>
            </select>
          </label>
          <button onClick={run} style={S.btn}>Run Pass 0</button>
        </div>

        <div style={S.status}>{status}</div>

        <div style={S.canvasGrid}>
          <Panel title="Satellite (input)" canvasRef={satRef} />
          <Panel title="Partition field (n,l,m → false colour)" canvasRef={partRef} />
          <Panel
            title="Atmosphere ground slice (Sₖ,Sₜ,Sₑ → RGB, per-channel stretched)"
            canvasRef={atmGroundRef}
            subtitle={groundRange && fmtGround(groundRange)}
          />
          <Panel
            title={`Atmosphere @ ~${Math.round(layers * 0.25 * (50000/layers)/1000)} km (Sₖ haze, stretched)`}
            canvasRef={atmHighRef}
            subtitle={highRange && fmtHigh(highRange)}
          />
        </div>

        <AtmosphereViewer volume={volume} />

        {timing && (
          <div style={S.section}>
            <h2 style={S.h2}>Timing</h2>
            <pre style={S.pre}>{JSON.stringify(timing, null, 2)}</pre>
          </div>
        )}
        {partSummary && (
          <div style={S.section}>
            <h2 style={S.h2}>Partition summary</h2>
            <pre style={S.pre}>{JSON.stringify(partSummary, null, 2)}</pre>
          </div>
        )}
        {atmSummary && (
          <div style={S.section}>
            <h2 style={S.h2}>Atmosphere summary</h2>
            <pre style={S.pre}>{JSON.stringify(atmSummary, null, 2)}</pre>
          </div>
        )}
      </div>
    </>
  )
}

function Panel({ title, canvasRef, subtitle }) {
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>{title}</div>
      <canvas ref={canvasRef} style={S.canvas} />
      {subtitle && <div style={S.panelSubtitle}>{subtitle}</div>}
    </div>
  )
}

const f = (x) => x === undefined || x === null ? '—' : Number(x).toExponential(3)
function fmtGround(r) {
  return `Sk [${f(r.Sk.min)} – ${f(r.Sk.max)}]   `
       + `St [${f(r.St.min)} – ${f(r.St.max)}]   `
       + `Se [${f(r.Se.min)} – ${f(r.Se.max)}]`
}
function fmtHigh(r) {
  return `Sk [${f(r.min)} – ${f(r.max)}]`
}

SEntropyTestPage.getLayout = (page) => page

// ─── styles ─────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100vh',
    background: '#060608',
    color: '#d8d8e0',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 13,
    padding: '24px 32px',
  },
  h1:       { fontSize: 18, color: '#58E6D9', margin: 0 },
  h2:       { fontSize: 13, color: '#58E6D9', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 1 },
  subtitle: { color: '#888', margin: '4px 0 18px' },
  controls: { display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 12 },
  lbl:      { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: '#888' },
  input:    { background: '#101015', color: '#d8d8e0', border: '1px solid #303038',
              padding: '6px 8px', fontFamily: 'inherit', fontSize: 13, minWidth: 120 },
  btn:      { background: '#58E6D9', color: '#060608', border: 0, padding: '8px 16px',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  status:   { color: '#58E6D9', marginBottom: 16, minHeight: 18 },
  canvasGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 16 },
  panel:    { background: '#0a0a10', border: '1px solid #20202a', padding: 8 },
  panelTitle: { fontSize: 11, color: '#888', marginBottom: 6 },
  panelSubtitle: { fontSize: 10, color: '#666', marginTop: 6, fontFamily: 'inherit' },
  canvas:   { width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' },
  section:  { background: '#0a0a10', border: '1px solid #20202a', padding: 12, marginBottom: 12 },
  pre:      { margin: 0, fontSize: 11, color: '#aaa', whiteSpace: 'pre-wrap' },

  // atmosphere viewer
  viewerWrap:    { background: '#0a0a10', border: '1px solid #20202a', padding: 12, marginBottom: 12 },
  viewerCanvas:  { width: '100%', maxWidth: 720, marginTop: 8, background: '#000' },
  viewerInfo:    { fontSize: 10, color: '#666', marginTop: 6 },
  viewerGroup:   { marginTop: 10, paddingTop: 8, borderTop: '1px dashed #20202a' },
  lblTitle:      { fontSize: 10, color: '#58E6D9', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  presetRow:     { display: 'flex', gap: 6, marginTop: 4 },
  btnSmall:      { background: 'transparent', color: '#888', border: '1px solid #303038',
                   padding: '3px 8px', fontFamily: 'inherit', fontSize: 10, cursor: 'pointer' },
  sliderRow:     { display: 'grid', gridTemplateColumns: '90px 1fr 50px', alignItems: 'center', gap: 8, marginBottom: 3 },
  sliderLabel:   { fontSize: 10, color: '#888' },
  sliderValue:   { fontSize: 10, color: '#aaa', textAlign: 'right' },
  slider:        { width: '100%', accentColor: '#58E6D9' },
}
