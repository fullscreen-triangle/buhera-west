/**
 * mapbox.js — Fetch and decode real-world terrain from Mapbox.
 *
 * Uses the Terrain-RGB raster tile API:
 *   elevation_m = -10000 + (R*65536 + G*256 + B) * 0.1
 *
 * Public API:
 *   buildHeightmap(lat, lng, zoom, token) -> { data, width, height, ... }
 *
 * The returned Float32Array stores normalised [0,1] heights
 * (raw elevations above min are rescaled by max-min).  The raw
 * min/max elevations in metres are returned alongside so callers
 * can display real-world altitudes.
 */

// ─── Web Mercator tile math ──────────────────────────────────────

const TILE_SIZE = 256
const GRID_SIDE = 3  // 3x3 tile grid (768 x 768 px final)

export function lngLatToTile(lng, lat, z) {
  const n = 2 ** z
  const x = Math.floor((lng + 180) / 360 * n)
  const latRad = (lat * Math.PI) / 180
  const y = Math.floor(
    (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n,
  )
  return { x, y, z }
}

export function tileToLngLat(x, y, z) {
  const n = 2 ** z
  const lng = (x / n) * 360 - 180
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)))
  const lat = (latRad * 180) / Math.PI
  return { lng, lat }
}

// metres per pixel at a given latitude and zoom
export function metersPerPixel(lat, zoom) {
  return (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom)
}

// ─── tile fetching ───────────────────────────────────────────────

function terrainUrl(x, y, z, token) {
  // v4 endpoint still supported; PNG 256x256
  return `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.png?access_token=${token}`
}

function satelliteUrl(x, y, z, token) {
  return `https://api.mapbox.com/v4/mapbox.satellite/${z}/${x}/${y}.jpg?access_token=${token}`
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Image load failed: ${url}`))
    img.src = url
  })
}

// draw an image into a canvas and return the RGBA pixel data
function imageToPixels(img) {
  const canvas = document.createElement('canvas')
  canvas.width = img.width
  canvas.height = img.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height)
}

// ─── heightmap construction ──────────────────────────────────────

/**
 * Build a heightmap from a 3x3 grid of Mapbox Terrain-RGB tiles
 * centred on the tile containing (lat, lng) at the given zoom.
 *
 * Returns:
 *   {
 *     data:        Float32Array (width*height), values in [0,1]
 *     width, height: dimensions in pixels (usually 768 x 768)
 *     minHeightM:  minimum raw elevation (metres)
 *     maxHeightM:  maximum raw elevation (metres)
 *     centerLat, centerLng: geographic centre of the grid
 *     sizeMeters:  real-world side length of the grid (square)
 *     zoom:        tile zoom level used
 *   }
 */
export async function buildHeightmap(lat, lng, zoom, token) {
  if (!token) throw new Error('Missing Mapbox token')

  const centerTile = lngLatToTile(lng, lat, zoom)
  const half = Math.floor(GRID_SIDE / 2)

  // 3x3 tile grid around the centre
  const tilesToFetch = []
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      tilesToFetch.push({
        x: centerTile.x + dx,
        y: centerTile.y + dy,
        gx: dx + half,  // grid column index (0..GRID_SIDE-1)
        gy: dy + half,  // grid row    index (0..GRID_SIDE-1)
      })
    }
  }

  // fetch all tiles in parallel
  const images = await Promise.all(
    tilesToFetch.map(t =>
      loadImage(terrainUrl(t.x, t.y, zoom, token))
        .then(img => ({ ...t, img }))
    ),
  )

  // stitch into one big canvas
  const W = TILE_SIZE * GRID_SIDE
  const H = TILE_SIZE * GRID_SIDE
  const stitchCanvas = document.createElement('canvas')
  stitchCanvas.width = W
  stitchCanvas.height = H
  const sctx = stitchCanvas.getContext('2d', { willReadFrequently: true })

  for (const t of images) {
    sctx.drawImage(t.img, t.gx * TILE_SIZE, t.gy * TILE_SIZE)
  }

  const imageData = sctx.getImageData(0, 0, W, H)
  const px = imageData.data

  // decode to metres + find min/max
  const raw = new Float32Array(W * H)
  let minM =  Infinity
  let maxM = -Infinity
  for (let i = 0; i < W * H; i++) {
    const r = px[i * 4]
    const g = px[i * 4 + 1]
    const b = px[i * 4 + 2]
    const m = -10000 + ((r * 65536 + g * 256 + b) * 0.1)
    raw[i] = m
    if (m < minM) minM = m
    if (m > maxM) maxM = m
  }

  // normalise to [0, 1] using 0 m as floor (ocean floor clipped)
  const floorM = Math.max(0, minM)
  const range = Math.max(1, maxM - floorM)
  const data = new Float32Array(W * H)
  for (let i = 0; i < W * H; i++) {
    data[i] = Math.max(0, (raw[i] - floorM) / range)
  }

  // geographic centre of the grid (use centre tile centre)
  const centerLngLat = tileToLngLat(centerTile.x + 0.5, centerTile.y + 0.5, zoom)
  const mpp = metersPerPixel(centerLngLat.lat, zoom)
  const sizeMeters = W * mpp

  return {
    data,
    width: W,
    height: H,
    minHeightM: minM,
    maxHeightM: maxM,
    floorM,
    rangeM: range,
    centerLat: centerLngLat.lat,
    centerLng: centerLngLat.lng,
    sizeMeters,
    zoom,
  }
}

// ─── stitched satellite imagery ──────────────────────────────────

/**
 * Fetch and stitch a 3x3 grid of Mapbox satellite tiles centered on
 * (lat, lng) at the given zoom.  Returns a Canvas suitable for
 * Three.js CanvasTexture.
 */
export async function buildSatelliteCanvas(lat, lng, zoom, token) {
  if (!token) throw new Error('Missing Mapbox token')

  const c = lngLatToTile(lng, lat, zoom)
  const half = Math.floor(GRID_SIDE / 2)

  const tiles = []
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      tiles.push({
        x: c.x + dx, y: c.y + dy,
        gx: dx + half, gy: dy + half,
      })
    }
  }

  const images = await Promise.all(
    tiles.map(t =>
      loadImage(satelliteUrl(t.x, t.y, zoom, token))
        .then(img => ({ ...t, img }))
    ),
  )

  const W = TILE_SIZE * GRID_SIDE
  const H = TILE_SIZE * GRID_SIDE
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  for (const t of images) {
    ctx.drawImage(t.img, t.gx * TILE_SIZE, t.gy * TILE_SIZE)
  }
  return canvas
}

// ─── preset locations for the UI ─────────────────────────────────

export const PRESET_LOCATIONS = [
  { name: 'Buhera West',  lat: -19.2608, lng:  31.4995, zoom: 12 },
  { name: 'Mt. Everest',  lat:  27.9881, lng:  86.9250, zoom: 12 },
  { name: 'Grand Canyon', lat:  36.0544, lng: -112.2401, zoom: 12 },
  { name: 'Matterhorn',   lat:  45.9763, lng:   7.6586, zoom: 13 },
  { name: 'Mt. Fuji',     lat:  35.3606, lng: 138.7274, zoom: 12 },
  { name: 'Yosemite',     lat:  37.7456, lng: -119.5936, zoom: 12 },
  { name: 'Iceland',      lat:  64.9630, lng: -19.0208, zoom: 11 },
  { name: 'Table Mtn',    lat: -33.9580, lng:  18.4030, zoom: 13 },
]
