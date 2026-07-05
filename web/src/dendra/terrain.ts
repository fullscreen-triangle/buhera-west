// dendra — terrain sampler (M4 start): Mapbox Terrain-RGB → real elevation.
// Reimplemented clean for the dendra stack (approach proven in couloir/mapbox.js).
// Browser-only: uses Image + canvas. Used by the resolver / sandbox Charts.

export interface Anchor { lat: number; lng: number; zoom: number; }

export interface ElevationProfile {
  profile: number[];   // metres, E–W transect across the tile row through the anchor
  min: number; max: number; mean: number;
  z: number; x: number; y: number;
}

const TERRAIN_RGB_MAX_Z = 15; // mapbox.terrain-rgb max zoom

// Web Mercator: lng/lat → tile (x,y) and pixel (px,py) within the 256² tile.
function lngLatToTile(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const fx = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  const x = Math.floor(fx), y = Math.floor(fy);
  const px = Math.min(255, Math.max(0, Math.floor((fx - x) * 256)));
  const py = Math.min(255, Math.max(0, Math.floor((fy - y) * 256)));
  return { x, y, px, py };
}

const decodeM = (r: number, g: number, b: number) => -10000 + (r * 65536 + g * 256 + b) * 0.1;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("terrain tile fetch failed"));
    img.src = url;
  });
}

/* ---------- height field (Scene ground, M6): 3×3 terrain-RGB → real relief ---------- */

export interface HeightField {
  data: Float32Array;  // metres, res×res, row-major (gy*res + gx); gx=east, gy=south
  res: number;         // pixels per side
  mpp: number;         // metres per pixel
  apx: number; apy: number; // anchor's pixel position in the grid (local origin)
  min: number; max: number;
  sizeMeters: number;
  z: number;
}

const GRID = 3, TILE = 256;

function tileFrac(lng: number, lat: number, z: number) {
  const n = 2 ** z;
  const fx = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const fy = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { fx, fy, x: Math.floor(fx), y: Math.floor(fy) };
}

export async function fetchHeightField(anchor: Anchor, token: string): Promise<HeightField> {
  if (!token) throw new Error("missing Mapbox token");
  const z = Math.max(0, Math.min(TERRAIN_RGB_MAX_Z, Math.round(anchor.zoom)));
  const { fx, fy, x: cx, y: cy } = tileFrac(anchor.lng, anchor.lat, z);
  const half = Math.floor(GRID / 2);
  const res = TILE * GRID; // 768

  const jobs: Promise<{ gx: number; gy: number; img: HTMLImageElement }>[] = [];
  for (let dy = -half; dy <= half; dy++)
    for (let dx = -half; dx <= half; dx++) {
      const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${cx + dx}/${cy + dy}.png?access_token=${token}`;
      jobs.push(loadImage(url).then((img) => ({ gx: (dx + half) * TILE, gy: (dy + half) * TILE, img })));
    }
  const tiles = await Promise.all(jobs);

  const canvas = document.createElement("canvas");
  canvas.width = res; canvas.height = res;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  for (const t of tiles) ctx.drawImage(t.img, t.gx, t.gy);

  const px = ctx.getImageData(0, 0, res, res).data;
  const data = new Float32Array(res * res);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < res * res; i++) {
    const m = decodeM(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]);
    data[i] = m;
    if (m < min) min = m;
    if (m > max) max = m;
  }
  const mpp = (40075016.686 * Math.cos((anchor.lat * Math.PI) / 180)) / (256 * 2 ** z);
  const apx = TILE * half + (fx - cx) * TILE;
  const apy = TILE * half + (fy - cy) * TILE;
  return { data, res, mpp, apx, apy, min, max, sizeMeters: res * mpp, z };
}

// local metres (x east, z where north = −z) → elevation in metres, bilinear.
export function sampleHeight(hf: HeightField, x: number, z: number): number {
  const gx = hf.apx + x / hf.mpp;
  const gy = hf.apy + z / hf.mpp;
  const x0 = Math.floor(gx), y0 = Math.floor(gy);
  if (x0 < 0 || y0 < 0 || x0 >= hf.res - 1 || y0 >= hf.res - 1) return hf.min;
  const tx = gx - x0, ty = gy - y0;
  const d = hf.data, r = hf.res;
  const h00 = d[y0 * r + x0], h10 = d[y0 * r + x0 + 1];
  const h01 = d[(y0 + 1) * r + x0], h11 = d[(y0 + 1) * r + x0 + 1];
  return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
}

export async function sampleElevationProfile(anchor: Anchor, token: string): Promise<ElevationProfile> {
  if (!token) throw new Error("missing Mapbox token");
  const z = Math.max(0, Math.min(TERRAIN_RGB_MAX_Z, Math.round(anchor.zoom)));
  const { x, y, py } = lngLatToTile(anchor.lng, anchor.lat, z);

  const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.png?access_token=${token}`;
  const img = await loadImage(url);

  const canvas = document.createElement("canvas");
  canvas.width = 256; canvas.height = 256;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(img, 0, 0);

  // E–W transect through the anchor's pixel row
  const row = ctx.getImageData(0, py, 256, 1).data;
  const profile: number[] = [];
  for (let i = 0; i < 256; i++) profile.push(decodeM(row[i * 4], row[i * 4 + 1], row[i * 4 + 2]));

  // whole-tile stats
  const all = ctx.getImageData(0, 0, 256, 256).data;
  let min = Infinity, max = -Infinity, sum = 0;
  for (let i = 0; i < all.length; i += 4) {
    const m = decodeM(all[i], all[i + 1], all[i + 2]);
    if (m < min) min = m;
    if (m > max) max = m;
    sum += m;
  }
  return { profile, min, max, mean: sum / (256 * 256), z, x, y };
}
