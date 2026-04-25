/**
 * terrainSampling.js
 *
 * CPU-side terrain height/slope lookup matching the GPU vertex shader.
 *
 * The shader's fBm + ridge + terrace + edge-fade is ported line-for-line
 * from the GLSL in ./shaders/terrain.js so the walker stands on exactly
 * the same surface that is rendered.
 *
 * Noise: Ashima Arts simplex 3D (MIT), translated to plain JS.
 */

// ─── scalar helpers ──────────────────────────────────────────────

const mod289 = (x) => x - Math.floor(x * (1 / 289)) * 289

const permute = (x) => mod289(((x * 34) + 1) * x)

const taylorInvSqrt = (r) => 1.79284291400159 - 0.85373472095314 * r

const smoothstep01 = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

// ─── Ashima simplex 3D, ported from GLSL ─────────────────────────

export function snoise(vx, vy, vz) {
  const Cx = 1 / 6
  const Cy = 1 / 3

  // vec3 i = floor(v + dot(v, C.yyy))
  const sum = vx + vy + vz
  const iAdd = sum * Cy
  const ix = Math.floor(vx + iAdd)
  const iy = Math.floor(vy + iAdd)
  const iz = Math.floor(vz + iAdd)

  // vec3 x0 = v - i + dot(i, C.xxx)
  const iDot = (ix + iy + iz) * Cx
  const x0x = vx - ix + iDot
  const x0y = vy - iy + iDot
  const x0z = vz - iz + iDot

  // vec3 g = step(x0.yzx, x0.xyz)  (b >= a ? 1 : 0)
  const gx = x0x >= x0y ? 1 : 0
  const gy = x0y >= x0z ? 1 : 0
  const gz = x0z >= x0x ? 1 : 0
  const lx = 1 - gx, ly = 1 - gy, lz = 1 - gz

  const i1x = Math.min(gx, lz)
  const i1y = Math.min(gy, lx)
  const i1z = Math.min(gz, ly)
  const i2x = Math.max(gx, lz)
  const i2y = Math.max(gy, lx)
  const i2z = Math.max(gz, ly)

  const x1x = x0x - i1x + Cx
  const x1y = x0y - i1y + Cx
  const x1z = x0z - i1z + Cx
  const x2x = x0x - i2x + Cy
  const x2y = x0y - i2y + Cy
  const x2z = x0z - i2z + Cy
  const x3x = x0x - 0.5
  const x3y = x0y - 0.5
  const x3z = x0z - 0.5

  const mi_x = mod289(ix), mi_y = mod289(iy), mi_z = mod289(iz)

  // chained permute on (mi_z + {0, i1z, i2z, 1})
  let p0 = permute(mi_z + 0)
  let p1 = permute(mi_z + i1z)
  let p2 = permute(mi_z + i2z)
  let p3 = permute(mi_z + 1)
  p0 = permute(p0 + mi_y + 0)
  p1 = permute(p1 + mi_y + i1y)
  p2 = permute(p2 + mi_y + i2y)
  p3 = permute(p3 + mi_y + 1)
  p0 = permute(p0 + mi_x + 0)
  p1 = permute(p1 + mi_x + i1x)
  p2 = permute(p2 + mi_x + i2x)
  p3 = permute(p3 + mi_x + 1)

  const n_ = 0.142857142857
  const nsx = n_ * 2 - 0
  const nsy = n_ * 0.5 - 1
  const nsz = n_ * 1 - 0

  const nsz2 = nsz * nsz
  const j0 = p0 - 49 * Math.floor(p0 * nsz2)
  const j1 = p1 - 49 * Math.floor(p1 * nsz2)
  const j2 = p2 - 49 * Math.floor(p2 * nsz2)
  const j3 = p3 - 49 * Math.floor(p3 * nsz2)

  const xf0 = Math.floor(j0 * nsz)
  const xf1 = Math.floor(j1 * nsz)
  const xf2 = Math.floor(j2 * nsz)
  const xf3 = Math.floor(j3 * nsz)

  const yf0 = Math.floor(j0 - 7 * xf0)
  const yf1 = Math.floor(j1 - 7 * xf1)
  const yf2 = Math.floor(j2 - 7 * xf2)
  const yf3 = Math.floor(j3 - 7 * xf3)

  const xx0 = xf0 * nsx + nsy
  const xx1 = xf1 * nsx + nsy
  const xx2 = xf2 * nsx + nsy
  const xx3 = xf3 * nsx + nsy
  const yy0 = yf0 * nsx + nsy
  const yy1 = yf1 * nsx + nsy
  const yy2 = yf2 * nsx + nsy
  const yy3 = yf3 * nsx + nsy

  const h0 = 1 - Math.abs(xx0) - Math.abs(yy0)
  const h1 = 1 - Math.abs(xx1) - Math.abs(yy1)
  const h2 = 1 - Math.abs(xx2) - Math.abs(yy2)
  const h3 = 1 - Math.abs(xx3) - Math.abs(yy3)

  // b0 = vec4(xx0, xx1, yy0, yy1), b1 = vec4(xx2, xx3, yy2, yy3)
  const s0_0 = Math.floor(xx0) * 2 + 1
  const s0_1 = Math.floor(xx1) * 2 + 1
  const s0_2 = Math.floor(yy0) * 2 + 1
  const s0_3 = Math.floor(yy1) * 2 + 1
  const s1_0 = Math.floor(xx2) * 2 + 1
  const s1_1 = Math.floor(xx3) * 2 + 1
  const s1_2 = Math.floor(yy2) * 2 + 1
  const s1_3 = Math.floor(yy3) * 2 + 1

  const sh0 = h0 <= 0 ? -1 : 0
  const sh1 = h1 <= 0 ? -1 : 0
  const sh2 = h2 <= 0 ? -1 : 0
  const sh3 = h3 <= 0 ? -1 : 0

  // a0 = b0.xzyw + s0.xzyw * sh.xxyy
  const a0_0 = xx0 + s0_0 * sh0
  const a0_1 = yy0 + s0_2 * sh0
  const a0_2 = xx1 + s0_1 * sh1
  const a0_3 = yy1 + s0_3 * sh1
  const a1_0 = xx2 + s1_0 * sh2
  const a1_1 = yy2 + s1_2 * sh2
  const a1_2 = xx3 + s1_1 * sh3
  const a1_3 = yy3 + s1_3 * sh3

  let p0x = a0_0, p0y = a0_1, p0z = h0
  let p1x = a0_2, p1y = a0_3, p1z = h1
  let p2x = a1_0, p2y = a1_1, p2z = h2
  let p3x = a1_2, p3y = a1_3, p3z = h3

  const n0 = taylorInvSqrt(p0x * p0x + p0y * p0y + p0z * p0z)
  const n1 = taylorInvSqrt(p1x * p1x + p1y * p1y + p1z * p1z)
  const n2 = taylorInvSqrt(p2x * p2x + p2y * p2y + p2z * p2z)
  const n3 = taylorInvSqrt(p3x * p3x + p3y * p3y + p3z * p3z)

  p0x *= n0; p0y *= n0; p0z *= n0
  p1x *= n1; p1y *= n1; p1z *= n1
  p2x *= n2; p2y *= n2; p2z *= n2
  p3x *= n3; p3y *= n3; p3z *= n3

  const dx0 = x0x * x0x + x0y * x0y + x0z * x0z
  const dx1 = x1x * x1x + x1y * x1y + x1z * x1z
  const dx2 = x2x * x2x + x2y * x2y + x2z * x2z
  const dx3 = x3x * x3x + x3y * x3y + x3z * x3z

  let m0 = Math.max(0.6 - dx0, 0); m0 *= m0
  let m1 = Math.max(0.6 - dx1, 0); m1 *= m1
  let m2 = Math.max(0.6 - dx2, 0); m2 *= m2
  let m3 = Math.max(0.6 - dx3, 0); m3 *= m3

  const pd0 = p0x * x0x + p0y * x0y + p0z * x0z
  const pd1 = p1x * x1x + p1y * x1y + p1z * x1z
  const pd2 = p2x * x2x + p2y * x2y + p2z * x2z
  const pd3 = p3x * x3x + p3y * x3y + p3z * x3z

  return 42 * (m0 * m0 * pd0 + m1 * m1 * pd1 + m2 * m2 * pd2 + m3 * m3 * pd3)
}

// ─── fBm wrapper ─────────────────────────────────────────────────

function fbm(x, y, z, octaves, lacunarity, gain) {
  let sum = 0, amp = 1, freq = 1, norm = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * snoise(x * freq, y * freq, z * freq)
    norm += amp
    amp *= gain
    freq *= lacunarity
  }
  return sum / norm
}

// ─── bilinear heightmap sampling (real-world terrain) ────────────

/**
 * Bilinear-sample a Float32Array heightmap at world (x, z).
 * The heightmap covers [-radius, +radius] on both axes.
 * Returns a normalised [0,1] height.
 */
export function sampleHeightmap(worldX, worldZ, hm, radius) {
  const { data, width: W, height: H } = hm
  // normalise to [0, 1]
  let u = (worldX + radius) / (2 * radius)
  // world -Z is "north" and the heightmap's row 0 is also "north",
  // so v=1 (top) should correspond to worldZ = -radius.
  let v = 1 - (worldZ + radius) / (2 * radius)

  // clamp (slight over-sampling past edge shows boundary)
  u = Math.max(0, Math.min(1, u))
  v = Math.max(0, Math.min(1, v))

  const fx = u * (W - 1)
  const fy = v * (H - 1)
  const x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1)
  const y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1)
  const tx = fx - x0, ty = fy - y0

  const h00 = data[y0 * W + x0]
  const h10 = data[y0 * W + x1]
  const h01 = data[y1 * W + x0]
  const h11 = data[y1 * W + x1]

  const h0 = h00 * (1 - tx) + h10 * tx
  const h1 = h01 * (1 - tx) + h11 * tx
  return h0 * (1 - ty) + h1 * ty
}

// ─── full height function — mirrors the vertex shader ─────────────

/**
 * Returns terrain height in normalised [0,1] space.
 * Multiply by params.amplitude to get world Y.
 *
 * If p.heightmap is supplied (real-world mode), bilinear-samples it.
 * Otherwise falls back to the procedural fBm/ridge/terrace chain
 * that the GPU shader uses in procedural mode.
 */
export function terrainHeightNorm(worldX, worldZ, p) {
  // ── real-world heightmap branch ──
  if (p.heightmap) {
    const rNorm = Math.sqrt(worldX * worldX + worldZ * worldZ) / p.radius
    const edgeFade = smoothstep01(1.0, 0.92, rNorm)
    let h = sampleHeightmap(worldX, worldZ, p.heightmap, p.radius)
    h *= edgeFade
    return h
  }

  // ── procedural fBm branch ──
  const freq = p.frequency
  const sx = worldX * freq + (p.offsetX || 0)
  const sy = (-worldZ) * freq + (p.offsetY || 0)
  const sz = p.timeOffset || 0

  const rNorm = Math.sqrt(worldX * worldX + worldZ * worldZ) / p.radius
  const edgeFade = smoothstep01(1.0, 0.92, rNorm)

  let h = fbm(sx, sy, sz, p.octaves, p.lacunarity, p.gain)
  h = h * 0.5 + 0.5

  const ridgeRaw = snoise(sx * 2, sy * 2, sz * 2)
  let ridge = 1 - Math.abs(ridgeRaw)
  ridge = ridge * ridge
  h = h * 0.65 + ridge * 0.35

  const plateauRaw = snoise(sx * 0.3, sy * 0.3, sz * 0.3)
  const plateau = plateauRaw * 0.5 + 0.5
  const terrace = Math.floor(h * 6) / 6
  const mixT = plateau * 0.15
  h = h * (1 - mixT) + terrace * mixT

  h *= edgeFade
  return h
}

/**
 * World-space Y position of the terrain surface at (worldX, worldZ).
 */
export function terrainHeight(worldX, worldZ, p) {
  return terrainHeightNorm(worldX, worldZ, p) * p.amplitude
}

/**
 * Slope at (worldX, worldZ), normalised [0,1].
 * 0 = perfectly flat, 1 = vertical cliff.
 * Mirrors the shader's vSlope computation.
 */
export function terrainSlope(worldX, worldZ, p) {
  const eps = 0.05
  const hC = terrainHeightNorm(worldX, worldZ, p)
  const hR = terrainHeightNorm(worldX + eps, worldZ, p)
  const hU = terrainHeightNorm(worldX, worldZ - eps, p)

  const dhR = (hR - hC) * p.amplitude
  const dhU = (hU - hC) * p.amplitude

  // cross((eps, dhR, 0), (0, dhU, eps)) = (dhR*eps, -eps*eps, eps*dhU)
  const nx = dhR * eps
  const ny = -eps * eps
  const nz = eps * dhU
  const mag = Math.sqrt(nx * nx + ny * ny + nz * nz)
  if (mag === 0) return 0
  return 1 - Math.abs(ny / mag)
}

/**
 * Returns a cheap "walkable" classification at (x, z).
 * Encapsulates: inside the circle, above water, not too steep.
 */
export function isWalkable(worldX, worldZ, p) {
  const r = Math.sqrt(worldX * worldX + worldZ * worldZ)
  if (r > p.radius * 0.95) return false

  const hNorm = terrainHeightNorm(worldX, worldZ, p)
  if (hNorm < p.waterLevel + 0.005) return false

  const slope = terrainSlope(worldX, worldZ, p)
  if (slope > 0.65) return false

  return true
}

/**
 * Find a walkable spawn point for the walker.
 * Tries random positions within the terrain; falls back to origin.
 */
export function findSpawnPoint(p) {
  for (let i = 0; i < 200; i++) {
    const angle = Math.random() * Math.PI * 2
    const r = Math.random() * p.radius * 0.7
    const x = r * Math.cos(angle)
    const z = r * Math.sin(angle)
    if (isWalkable(x, z, p)) {
      return { x, y: terrainHeight(x, z, p), z }
    }
  }
  return { x: 0, y: p.amplitude * 0.5, z: 0 }
}

/**
 * Classify the material at (x, z) from elevation + slope.
 * Matches the fragment shader's classifyMaterial.
 */
export function classifyAt(worldX, worldZ, p) {
  const elev = terrainHeightNorm(worldX, worldZ, p)
  const slope = terrainSlope(worldX, worldZ, p)
  const w = p.waterLevel

  if (elev < w - 0.02)                       return 'deep water'
  if (elev < w + 0.01)                       return 'shoreline'
  if (elev < 0.35 && slope < 0.3)            return 'grass'
  if (elev < 0.55 && slope < 0.5)            return 'forest'
  if (elev < 0.70)                           return 'scrub'
  if (elev < 0.88 || slope > 0.6)            return 'rock'
  return 'snow'
}
