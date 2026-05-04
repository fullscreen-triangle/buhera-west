/**
 * LocationPanel — UI for loading real-world terrain from Mapbox.
 *
 * Shows:
 *   - Source toggle: Procedural / Real (Mapbox)
 *   - Preset location buttons (Everest, Grand Canyon, ...)
 *   - Lat / Lng / Zoom inputs
 *   - Fetch button + status
 *   - When loaded: min/max elevation + grid size in metres
 */

import { useState, useEffect } from 'react'
import { buildHeightmap, buildSatelliteCanvas, PRESET_LOCATIONS } from './mapbox'

export default function LocationPanel({
  source,
  onSourceChange,
  onHeightmapLoaded,
  heightmapInfo,
}) {
  const [lat, setLat] = useState(PRESET_LOCATIONS[0].lat)
  const [lng, setLng] = useState(PRESET_LOCATIONS[0].lng)
  const [zoom, setZoom] = useState(PRESET_LOCATIONS[0].zoom)
  const [status, setStatus] = useState({ kind: 'idle' })
  const [locationName, setLocationName] = useState(PRESET_LOCATIONS[0].name)

  // read token from env once
  const [token, setToken] = useState('')
  useEffect(() => {
    setToken(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '')
  }, [])

  const handlePreset = (p) => {
    setLat(p.lat); setLng(p.lng); setZoom(p.zoom)
    setLocationName(p.name)
  }

  const handleFetch = async () => {
    if (!token) {
      setStatus({ kind: 'error', msg: 'No Mapbox token. Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local' })
      return
    }
    setStatus({ kind: 'loading' })
    try {
      const [hm, sat] = await Promise.all([
        buildHeightmap(lat, lng, zoom, token),
        buildSatelliteCanvas(lat, lng, zoom, token),
      ])
      setStatus({
        kind: 'ok',
        msg: `${(hm.sizeMeters / 1000).toFixed(1)} km across · ${Math.round(hm.minHeightM)}m → ${Math.round(hm.maxHeightM)}m`,
      })
      onHeightmapLoaded(hm, sat, locationName)
      onSourceChange('real')
    } catch (err) {
      setStatus({ kind: 'error', msg: err.message || 'Fetch failed' })
    }
  }

  return (
    <div style={{
      position: 'absolute', top: 12, left: 268,
      background: 'rgba(0,0,0,0.75)', borderRadius: 8,
      padding: '10px 14px', width: 260,
      fontFamily: 'monospace', fontSize: 10, color: '#aaa', zIndex: 10,
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(88,230,217,0.15)',
    }}>
      <div style={{ color: '#58E6D9', fontSize: 11, fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>
        TERRAIN SOURCE
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button
          onClick={() => onSourceChange('procedural')}
          style={srcBtn(source === 'procedural')}
        >PROCEDURAL</button>
        <button
          onClick={() => onSourceChange('real')}
          disabled={!heightmapInfo}
          style={{ ...srcBtn(source === 'real'), opacity: heightmapInfo ? 1 : 0.4 }}
        >REAL</button>
      </div>

      <div style={{ color: '#666', fontSize: 9, marginBottom: 4 }}>PRESETS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 8 }}>
        {PRESET_LOCATIONS.map(p => (
          <button
            key={p.name}
            onClick={() => handlePreset(p)}
            style={{
              background: locationName === p.name ? '#333' : 'rgba(255,255,255,0.04)',
              color: locationName === p.name ? '#58E6D9' : '#888',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 3, padding: '2px 6px',
              fontSize: 9, fontFamily: 'monospace',
              cursor: 'pointer',
            }}
          >{p.name}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
        <label style={{ width: 30, color: '#aaa' }}>Lat</label>
        <input type="number" step="0.0001" value={lat}
          onChange={e => setLat(parseFloat(e.target.value) || 0)}
          style={inputStyle()} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
        <label style={{ width: 30, color: '#aaa' }}>Lng</label>
        <input type="number" step="0.0001" value={lng}
          onChange={e => setLng(parseFloat(e.target.value) || 0)}
          style={inputStyle()} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <label style={{ width: 30, color: '#aaa' }}>Zoom</label>
        <input type="range" min={10} max={16} step={1} value={zoom}
          onChange={e => setZoom(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: '#58E6D9' }} />
        <span style={{ width: 24, textAlign: 'right', color: '#777' }}>{zoom}</span>
      </div>

      <button
        onClick={handleFetch}
        disabled={status.kind === 'loading'}
        style={{
          width: '100%',
          background: status.kind === 'loading' ? '#333' : '#58E6D9',
          color: status.kind === 'loading' ? '#666' : '#000',
          border: 'none', borderRadius: 4,
          padding: '6px 10px', fontSize: 10, fontWeight: 700,
          fontFamily: 'monospace', cursor: 'pointer',
          letterSpacing: 1,
        }}
      >
        {status.kind === 'loading' ? 'FETCHING…' : 'FETCH TERRAIN'}
      </button>

      <div style={{ marginTop: 6, minHeight: 14, fontSize: 9,
        color: status.kind === 'error' ? '#ff7a7a'
             : status.kind === 'ok'    ? '#58E6D9'
             : '#666',
      }}>
        {status.kind === 'idle'    && (token ? '● token detected' : '○ no token — add NEXT_PUBLIC_MAPBOX_TOKEN')}
        {status.kind === 'loading' && 'fetching 9 tiles…'}
        {status.kind === 'error'   && status.msg}
        {status.kind === 'ok'      && `✓ ${locationName}: ${status.msg}`}
      </div>
    </div>
  )
}

function srcBtn(active) {
  return {
    flex: 1,
    background: active ? '#58E6D9' : 'rgba(255,255,255,0.04)',
    color: active ? '#000' : '#888',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 4, padding: '4px 6px',
    fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
    letterSpacing: 1, cursor: 'pointer',
  }
}

function inputStyle() {
  return {
    flex: 1,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#ccc', borderRadius: 3,
    padding: '2px 6px', fontSize: 10,
    fontFamily: 'monospace',
  }
}
