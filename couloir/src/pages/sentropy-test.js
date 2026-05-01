/**
 * /sentropy-test — Pass 0 sanity-check page.
 *
 * Pulls a Mapbox heightmap + satellite for a chosen preset, runs
 *   terrainPartitionFromTiles  →  terrainToAtmosphere
 * and reports the resulting partition + atmosphere stats alongside
 * debug visualisations.  No 3D, no shaders.
 */

import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'

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

// ─── debug visualisation helpers ────────────────────────────────

/**
 * False-colour the partition field by surface composition.
 *   water → blue, vegetation → green, rock/sand/snow → grey/white.
 */
function drawPartitionField(canvas, part) {
  const W = part.width, H = part.height
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  for (let i = 0; i < W * H; i++) {
    const n = part.n[i], l = part.l[i], m = part.m[i]
    const water = 1 - l / Math.max(n, 1e-3)
    const veg   = m / Math.max(l, 1e-3)
    const temp  = n / 8

    let r, g, b
    if (water > 0.5) {
      // water (cool blue, darker for less l)
      r = 30
      g = 80 + 60 * (1 - water)
      b = 140 + 80 * water
    } else if (veg > 0.3) {
      // vegetation (green)
      r = 60 + 60 * (1 - veg)
      g = 110 + 100 * veg
      b = 50
    } else {
      // rock/sand/snow — temp-tinted grey
      const base = 90 + 130 * temp
      r = base
      g = base
      b = base * 0.95
    }
    img.data[i * 4]     = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Render the ground-level (z=0) S-entropy slice as RGB:
 *   R = Sk, G = St, B = Se.
 */
function drawAtmosphereGroundSlice(canvas, vol) {
  const W = vol.width, H = vol.height
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const sliceN = W * H
  for (let i = 0; i < sliceN; i++) {
    img.data[i * 4]     = Math.max(0, Math.min(255, vol.Sk[i] * 255))
    img.data[i * 4 + 1] = Math.max(0, Math.min(255, vol.St[i] * 255))
    img.data[i * 4 + 2] = Math.max(0, Math.min(255, vol.Se[i] * 255))
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * Render an arbitrary altitude slice of Sk only, for inspecting
 * vertical structure (haze layer, scale heights).
 */
function drawAtmosphereAltitudeSlice(canvas, vol, zIdx) {
  const W = vol.width, H = vol.height
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(W, H)
  const sliceN = W * H
  const off = zIdx * sliceN
  for (let i = 0; i < sliceN; i++) {
    const v = Math.max(0, Math.min(255, vol.Sk[off + i] * 255 * 1.5))
    img.data[i * 4]     = v
    img.data[i * 4 + 1] = v * 0.85
    img.data[i * 4 + 2] = v * 0.65
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
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
      if (partRef.current)      drawPartitionField(partRef.current, part)
      if (atmGroundRef.current) drawAtmosphereGroundSlice(atmGroundRef.current, vol)
      if (atmHighRef.current)   drawAtmosphereAltitudeSlice(atmHighRef.current, vol, Math.floor(layers * 0.25))

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
          <Panel title="Atmosphere ground slice (Sₖ,Sₜ,Sₑ → RGB)" canvasRef={atmGroundRef} />
          <Panel title={`Atmosphere @ ~${Math.round(layers * 0.25 * (50000/layers)/1000)} km (Sₖ haze)`} canvasRef={atmHighRef} />
        </div>

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

function Panel({ title, canvasRef }) {
  return (
    <div style={S.panel}>
      <div style={S.panelTitle}>{title}</div>
      <canvas ref={canvasRef} style={S.canvas} />
    </div>
  )
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
  canvas:   { width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' },
  section:  { background: '#0a0a10', border: '1px solid #20202a', padding: 12, marginBottom: 12 },
  pre:      { margin: 0, fontSize: 11, color: '#aaa', whiteSpace: 'pre-wrap' },
}
