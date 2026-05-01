/**
 * sentropy.js — Pass 0: Terrain → Atmosphere coupling.
 *
 * Implements Section 3 of street-view-rendering.tex:
 *   1. terrainPartitionFromTiles: DEM + satellite → terrain partition state
 *      (n, l, m, s) per cell, interpreted by the shader so that
 *        T_surf = T_min + (n / n_max)·(T_max - T_min)
 *        water  = 1 - l/n
 *        veg    = m / l
 *   2. terrainToAtmosphere:  partition state → atmospheric volume
 *      (Sk, St, Se, n_ref) per voxel, computed from the four
 *      mechanisms M1..M4 (Eqs. 8–11):
 *        M1 = ρ₀·exp(-z/H_dry)·(1 + α·(T_surf - T₀)/T₀)
 *        M2 = water·ρ_w0·exp(-z/H_vapor)
 *        M3 = veg·ρ_g0·exp(-z/H_gas)
 *        M4 = (1 - water)·ρ_a0·exp(-z/H_aerosol)
 *
 * Pure JavaScript (browser only — uses Canvas2D for satellite
 * downsampling).  No Three.js, no GPU.  Outputs are Float32Arrays
 * suitable for upload as 3D textures.
 */

// ─── default constants ──────────────────────────────────────────
//
// Values match the validation script
// (couloir/docs/street-view-rendering/experiments/validate_street_view_paper.py
//  lines 58–63, 114) so JS-side and paper-side numbers agree.

export const DEFAULT_PARAMS = {
  // Atmospheric scale heights (m)
  H_dry:     8500,
  H_vapor:   2000,
  H_gas:     5000,
  H_aerosol: 1500,

  // Reference densities (kg / m^3)
  rho_0:     1.225,    // dry air at sea level
  rho_w0:    0.010,    // peak water-vapour density
  rho_g0:    0.001,    // peak trace-gas density
  rho_a0:    0.0005,   // peak aerosol density

  // Thermodynamics
  T_0:           288.15,   // reference temperature (15 °C)
  T_min:         240.0,    // K, cold-pole / stratosphere proxy
  T_max:         320.0,    // K, hot-desert proxy
  alpha_thermal: 0.003,    // dry-air thermal expansion

  // Optics
  k_ref: 2.9e-4,           // refractive-index proportionality (Ciddor 1996)

  // Vertical sampling
  z_max:  50000,           // m, top of column
  layers: 64,              // vertical voxels

  // Horizontal sampling
  resolution: 256,         // S-entropy grid side length

  // Partition coordinate cap
  n_max: 8,                // matches surface-state shell capacity
}

// ─── RGB → material heuristic ───────────────────────────────────

/**
 * Crude per-pixel material classifier from satellite RGB.
 * Returns fractions in [0,1] summing to 1.
 *
 * Used only to map satellite imagery → (n, l, m, s); not a substitute
 * for proper spectral classification.
 */
export function classifyRGB(r, g, b) {
  const R = r / 255, G = g / 255, B = b / 255
  const brightness = (R + G + B) / 3
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const sat = max > 0 ? (max - min) / max : 0

  // Snow: very bright, low saturation
  const snow = Math.max(0, (brightness - 0.78) / 0.22)
              * (1 - Math.min(1, sat * 4))

  // Water: blue-dominant, low brightness
  const blueness = Math.max(0, B - Math.max(R, G))
  const water = Math.min(1, blueness * 3)
              * (1 - Math.min(1, brightness * 1.2))

  // Vegetation: green dominates red/blue
  const greenness = Math.max(0, G - Math.max(R, B) * 0.85)
  const veg = Math.min(1, greenness * 3)

  // Sand / desert: yellow-orange
  const yellowness = Math.max(0, (R + G) * 0.5 - B)
  const sand = Math.min(1, yellowness * 2.5)
             * Math.max(0, 1 - water - veg)

  // Rock = residual
  const rock = Math.max(0, 1 - water - veg - snow - sand)

  const total = water + veg + snow + sand + rock
  if (total <= 0) {
    return { water: 0, veg: 0, snow: 0, sand: 0, rock: 1 }
  }
  return {
    water: water / total,
    veg:   veg   / total,
    snow:  snow  / total,
    sand:  sand  / total,
    rock:  rock  / total,
  }
}

// ─── partition coordinates from surface composition ─────────────

/**
 * Map (elevation, latitude, material fractions) → (n, l, m, s)
 * such that the shader’s decoding rules
 *   T_surf = T_min + (n/n_max)(T_max - T_min)
 *   water  = 1 - l/n
 *   veg    = m / l
 * produce the intended values.
 */
function partitionFromSurface({
  elevation_m, lat,
  water, veg, snow, sand, rock,
}, p) {
  // Surface temperature: lapse rate + latitude band + cover bias
  const T_lapse = 0.0065 * Math.max(0, elevation_m)
  const T_lat   = 30 * Math.abs(lat) / 90
  let T_surf = p.T_0 - T_lapse - T_lat - 5 * snow + 2 * sand
  if (T_surf < p.T_min) T_surf = p.T_min
  if (T_surf > p.T_max) T_surf = p.T_max

  // Principal partition number (1..n_max), monotone in T_surf
  const n_cont = (T_surf - p.T_min) / (p.T_max - p.T_min) * p.n_max
  let n = Math.round(n_cont)
  if (n < 1)        n = 1
  if (n > p.n_max)  n = p.n_max

  // Angular partition — water content (snow counts as half-water)
  const water_frac = Math.min(1, water + 0.5 * snow)
  let l = Math.round(n * (1 - water_frac))
  if (l < 0)       l = 0
  if (l > n - 1)   l = n - 1

  // Orientation — vegetation fraction within the rock structure
  let m = Math.round(l * Math.min(1, veg))
  if (m < 0)  m = 0
  if (m > l)  m = l

  // Chirality default
  const s = 0.5

  return { n, l, m, s }
}

// ─── downsampling helpers ───────────────────────────────────────

/** Box-filter downsample of a Float32Array 2D image. */
function downsampleFloat(src, srcW, srcH, dstW, dstH) {
  const sx = srcW / dstW
  const sy = srcH / dstH
  const dst = new Float32Array(dstW * dstH)
  for (let y = 0; y < dstH; y++) {
    const y0 = Math.floor(y * sy)
    const y1 = Math.min(srcH, Math.max(y0 + 1, Math.ceil((y + 1) * sy)))
    for (let x = 0; x < dstW; x++) {
      const x0 = Math.floor(x * sx)
      const x1 = Math.min(srcW, Math.max(x0 + 1, Math.ceil((x + 1) * sx)))
      let sum = 0, n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          sum += src[yy * srcW + xx]
          n++
        }
      }
      dst[y * dstW + x] = n > 0 ? sum / n : 0
    }
  }
  return dst
}

/** Downsample an HTMLCanvasElement and return RGBA Uint8ClampedArray. */
function downsampleCanvas(src, dstW, dstH) {
  const c = document.createElement('canvas')
  c.width = dstW
  c.height = dstH
  const ctx = c.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(src, 0, 0, dstW, dstH)
  return ctx.getImageData(0, 0, dstW, dstH).data
}

// ─── public: terrain partition state ────────────────────────────

/**
 * Build the terrain partition field (n, l, m, s) from a Mapbox heightmap
 * and stitched satellite canvas.  Output resolution defaults to
 * params.resolution (256) regardless of input size.
 *
 * @param {Object} heightmap    output of buildHeightmap()
 * @param {HTMLCanvasElement} satelliteCanvas  output of buildSatelliteCanvas()
 * @param {Object} [params]     overrides for DEFAULT_PARAMS
 * @returns {{n:Float32Array, l:Float32Array, m:Float32Array, s:Float32Array,
 *           width:number, height:number, params:Object,
 *           centerLat:number, centerLng:number, sizeMeters:number}}
 */
export function terrainPartitionFromTiles(heightmap, satelliteCanvas, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...params }
  const W = p.resolution
  const H = p.resolution

  const elev = downsampleFloat(
    heightmap.data, heightmap.width, heightmap.height, W, H,
  )
  const sat = downsampleCanvas(satelliteCanvas, W, H)

  const N = W * H
  const nArr = new Float32Array(N)
  const lArr = new Float32Array(N)
  const mArr = new Float32Array(N)
  const sArr = new Float32Array(N)

  const lat    = heightmap.centerLat
  const floorM = heightmap.floorM
  const rangeM = heightmap.rangeM

  for (let i = 0; i < N; i++) {
    const elevation_m = floorM + elev[i] * rangeM
    const r = sat[i * 4], g = sat[i * 4 + 1], b = sat[i * 4 + 2]
    const mat = classifyRGB(r, g, b)
    const { n, l, m, s } = partitionFromSurface({
      elevation_m, lat,
      water: mat.water, veg: mat.veg, snow: mat.snow,
      sand:  mat.sand,  rock: mat.rock,
    }, p)
    nArr[i] = n
    lArr[i] = l
    mArr[i] = m
    sArr[i] = s
  }

  return {
    n: nArr, l: lArr, m: mArr, s: sArr,
    width: W, height: H,
    centerLat: heightmap.centerLat,
    centerLng: heightmap.centerLng,
    sizeMeters: heightmap.sizeMeters,
    params: p,
  }
}

// ─── public: atmospheric S-entropy volume (Pass 0) ──────────────

/**
 * Compute the atmospheric S-entropy volume above a partition field.
 *
 * Output is laid out slice-major: voxel(x, y, z) lives at index
 *   z * W * H + y * W + x
 * so a given altitude slice is contiguous.
 *
 * @param {Object} partition     output of terrainPartitionFromTiles()
 * @param {Object} [params]      overrides for DEFAULT_PARAMS
 * @returns {{Sk, St, Se, n_ref: Float32Array,
 *           width, height, layers, dz, params}}
 */
export function terrainToAtmosphere(partition, params = {}) {
  const p = { ...DEFAULT_PARAMS, ...partition.params, ...params }
  const W = partition.width
  const H = partition.height
  const Z = p.layers
  const dz = p.z_max / Z
  const sliceN = W * H
  const totalN = sliceN * Z

  const Sk    = new Float32Array(totalN)
  const St    = new Float32Array(totalN)
  const Se    = new Float32Array(totalN)
  const nRef  = new Float32Array(totalN)

  // Maximum density at z=0 with all mechanisms simultaneously maxed —
  // used as the normaliser for Sk and Se so they live in [0,1].
  const rho_max = p.rho_0 * (1 + p.alpha_thermal)
                + p.rho_w0 + p.rho_g0 + p.rho_a0
  const log_norm = Math.log(1 + rho_max / p.rho_0)
  const T_max = p.T_max

  for (let yi = 0; yi < H; yi++) {
    for (let xi = 0; xi < W; xi++) {
      const idx2 = yi * W + xi
      const n = partition.n[idx2]
      const l = partition.l[idx2]
      const m = partition.m[idx2]

      // Decode surface state — same mapping the shader applies in Pass 0.
      const T_surf = p.T_min + (n / p.n_max) * (p.T_max - p.T_min)
      const water  = Math.max(0, 1 - l / Math.max(n, 1e-3))
      const veg    = m / Math.max(l, 1e-3)

      const thermalAnomaly = 1 + p.alpha_thermal * (T_surf - p.T_0) / p.T_0
      const T_ratio = Math.sqrt(T_surf / T_max)

      for (let zi = 0; zi < Z; zi++) {
        const z = zi * dz

        const M1 = p.rho_0 * Math.exp(-z / p.H_dry)     * thermalAnomaly
        const M2 = water   * p.rho_w0 * Math.exp(-z / p.H_vapor)
        const M3 = veg     * p.rho_g0 * Math.exp(-z / p.H_gas)
        const M4 = (1 - water) * p.rho_a0 * Math.exp(-z / p.H_aerosol)
        const rho = M1 + M2 + M3 + M4

        const idx3 = zi * sliceN + idx2
        Sk[idx3]   = Math.log(1 + rho / p.rho_0) / log_norm
        St[idx3]   = T_ratio
        Se[idx3]   = (rho * T_surf) / (rho_max * T_max)
        nRef[idx3] = 1 + p.k_ref * rho / p.rho_0
      }
    }
  }

  return {
    Sk, St, Se, n_ref: nRef,
    width: W, height: H, layers: Z, dz,
    params: p,
  }
}

// ─── diagnostics ────────────────────────────────────────────────

function arrayStats(arr) {
  const N = arr.length
  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < N; i++) {
    const v = arr[i]
    if (v < min) min = v
    if (v > max) max = v
    sum += v
  }
  return { min, max, mean: sum / N }
}

/** Quick diagnostic for a partition field. */
export function summarizePartition(part) {
  const N = part.n.length
  let waterPx = 0, vegPx = 0, rockPx = 0
  for (let i = 0; i < N; i++) {
    const water = 1 - part.l[i] / Math.max(part.n[i], 1e-3)
    const veg   = part.m[i]    / Math.max(part.l[i], 1e-3)
    if (water > 0.5)      waterPx++
    else if (veg > 0.3)   vegPx++
    else                  rockPx++
  }
  return {
    shape: [part.width, part.height],
    n: arrayStats(part.n),
    l: arrayStats(part.l),
    m: arrayStats(part.m),
    composition: {
      water:      waterPx / N,
      vegetation: vegPx   / N,
      rock_other: rockPx  / N,
    },
  }
}

/** Quick diagnostic for an atmospheric volume. */
export function summarizeAtmosphere(vol) {
  const sliceN = vol.width * vol.height
  // ground slice = z=0
  const groundSk    = vol.Sk.subarray(0, sliceN)
  const groundSt    = vol.St.subarray(0, sliceN)
  const groundSe    = vol.Se.subarray(0, sliceN)
  const groundN     = vol.n_ref.subarray(0, sliceN)
  // top slice
  const topOffset   = (vol.layers - 1) * sliceN
  const topSk       = vol.Sk.subarray(topOffset, topOffset + sliceN)
  return {
    shape: [vol.width, vol.height, vol.layers],
    dz_meters: vol.dz,
    voxels: vol.Sk.length,
    ground: {
      Sk: arrayStats(groundSk),
      St: arrayStats(groundSt),
      Se: arrayStats(groundSe),
      n_ref: arrayStats(groundN),
    },
    top: {
      Sk: arrayStats(topSk),
    },
    overall: {
      Sk:    arrayStats(vol.Sk),
      St:    arrayStats(vol.St),
      Se:    arrayStats(vol.Se),
      n_ref: arrayStats(vol.n_ref),
    },
  }
}
